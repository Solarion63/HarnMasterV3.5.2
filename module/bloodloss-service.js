import { bloodlossIsFatal, elapsedBleeding } from "./bloodloss-rules.js";

const BLEEDING_EFFECT_FLAG = "bleedingInjury";
const BLOODLOSS_ITEM_FLAG = "bloodloss";
const DEFAULT_BLEED_RATE = 1;
let worldTimeProcessing = Promise.resolve();

function activeGmOwnsProcessing() {
  if (!game.user?.isGM) return false;
  const activeGms = game.users
    ?.filter(user => user.active && user.isGM)
    ?.sort((left, right) => String(left.id).localeCompare(String(right.id))) ?? [];
  return activeGms[0]?.id === game.user.id;
}

function statusConfigByName(name) {
  const wanted = String(name).trim().toLowerCase();
  return (CONFIG.statusEffects ?? []).find(entry => {
    const id = String(entry.id ?? "").toLowerCase();
    const label = String(entry.name ?? entry.label ?? "").toLowerCase();
    return id === wanted || label === wanted;
  }) ?? null;
}

function effectsWithStatus(actor, statusId) {
  return Array.from(actor.effects ?? []).filter(effect => {
    const statuses = effect.statuses;
    if (typeof statuses?.has === "function") return statuses.has(statusId);
    if (Array.isArray(statuses)) return statuses.includes(statusId);
    return false;
  });
}

async function setStatus(actor, name, active) {
  const statusId = statusConfigByName(name)?.id ?? null;
  if (!statusId) {
    console.warn(`HM3 | Configured ${name} status effect could not be found.`);
    return null;
  }

  const existing = effectsWithStatus(actor, statusId);
  if (active) {
    if (existing.length > 1) {
      await actor.deleteEmbeddedDocuments("ActiveEffect", existing.slice(1).map(effect => effect.id));
    }
    if (existing.length) return existing[0];
    return actor.toggleStatusEffect(statusId, { active: true });
  }

  if (existing.length) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", existing.map(effect => effect.id));
  }
  return null;
}

function bloodlossItem(actor) {
  return actor.itemTypes?.injury?.find(item =>
    item.getFlag("hm3", BLOODLOSS_ITEM_FLAG) === true
    || item.system.isBloodloss === true
    || item.name.toLowerCase() === "bloodloss"
  ) ?? null;
}

function bleedingEffects(actor) {
  return Array.from(actor.effects ?? []).filter(effect =>
    !effect.disabled && effect.getFlag("hm3", BLEEDING_EFFECT_FLAG)
  );
}

function actorsForBloodlossProcessing() {
  const actors = new Map();
  for (const actor of game.actors ?? []) {
    if (actor?.uuid) actors.set(actor.uuid, actor);
  }

  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      const actor = token.actor;
      if (actor?.uuid) actors.set(actor.uuid, actor);
    }
  }

  return actors.values();
}

function removeGeneratedBleederNote(notes) {
  return String(notes ?? "")
    .split(";")
    .map(note => note.trim())
    .filter(note => note && note.toLowerCase() !== "bleeder")
    .join("; ");
}

async function markSourceInjuryNotBleeding(actor, effect) {
  const injuryId = effect?.getFlag?.("hm3", "sourceInjuryId");
  if (!injuryId) return;

  const injury = actor.items.get(injuryId);
  if (!injury || injury.type !== "injury") return;

  await injury.update({
    "system.isBleeder": false,
    "system.notes": removeGeneratedBleederNote(injury.system.notes)
  });
}

async function ensureBloodlossItem(actor) {
  const existing = bloodlossItem(actor);
  if (existing) return existing;

  const created = await actor.createEmbeddedDocuments("Item", [{
    name: "Bloodloss",
    type: "injury",
    system: {
      severity: "",
      injuryLevel: 0,
      healRate: 0,
      isBloodloss: true,
      notes: "Accumulated Blood Points from bleeding injuries."
    },
    flags: {
      hm3: {
        [BLOODLOSS_ITEM_FLAG]: true
      }
    }
  }]);
  return created[0] ?? null;
}

async function syncBleedingStatus(actor) {
  return setStatus(actor, "Bleeding", bleedingEffects(actor).length > 0);
}

async function syncDeadStatus(actor, totalBloodloss) {
  if (!bloodlossIsFatal(totalBloodloss, actor.system.endurance)) return false;
  await setStatus(actor, "Dead", true);
  return true;
}

export class BloodlossService {
  static isBleedingEffect(effect) {
    return Boolean(effect?.getFlag?.("hm3", BLEEDING_EFFECT_FLAG));
  }

  static bloodlossItem(actor) {
    return bloodlossItem(actor);
  }

  static bleedingEffects(actor) {
    return bleedingEffects(actor);
  }

  static async startBleeding(actor, injury, { rate = DEFAULT_BLEED_RATE } = {}) {
    if (!actor || !injury) return null;

    const existing = bleedingEffects(actor).find(effect =>
      effect.getFlag("hm3", "sourceInjuryId") === injury.id
    );
    if (existing) {
      await syncBleedingStatus(actor);
      return existing;
    }

    const worldTime = Number(game.time.worldTime) || 0;
    const bleedingStatus = statusConfigByName("Bleeding");
    const effectData = {
      name: `Bleeding Injury — ${injury.name}`,
      disabled: false,
      duration: {
        startTime: worldTime
      },
      flags: {
        hm3: {
          [BLEEDING_EFFECT_FLAG]: true,
          sourceInjuryId: injury.id,
          bleedRate: Math.max(0, Number(rate) || DEFAULT_BLEED_RATE),
          lastProcessedWorldTime: worldTime
        }
      }
    };
    const statusImage = bleedingStatus?.img ?? bleedingStatus?.icon;
    if (statusImage) effectData.img = statusImage;

    const created = await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    return created[0] ?? null;
  }

  static async stopBleeding(actor, effectOrId) {
    if (!actor) return false;
    const effect = typeof effectOrId === "string"
      ? actor.effects.get(effectOrId)
      : effectOrId;
    if (!BloodlossService.isBleedingEffect(effect)) return false;

    await markSourceInjuryNotBleeding(actor, effect);
    await actor.deleteEmbeddedDocuments("ActiveEffect", [effect.id]);
    await syncBleedingStatus(actor);
    return true;
  }

  static async processActor(actor, worldTime) {
    const effects = bleedingEffects(actor);
    if (!effects.length) {
      await syncBleedingStatus(actor);
      return { bloodlossAdded: 0, totalBloodloss: Number(bloodlossItem(actor)?.system.injuryLevel) || 0 };
    }

    let bloodlossAdded = 0;
    const updates = [];
    for (const effect of effects) {
      const lastProcessedWorldTime = effect.getFlag("hm3", "lastProcessedWorldTime");
      const rate = effect.getFlag("hm3", "bleedRate") ?? DEFAULT_BLEED_RATE;
      const elapsed = elapsedBleeding({ lastProcessedWorldTime, worldTime, rate });
      bloodlossAdded += elapsed.bloodloss;

      if (elapsed.minutes > 0) {
        updates.push({
          _id: effect.id,
          "flags.hm3.lastProcessedWorldTime": elapsed.nextProcessedWorldTime
        });
      }
    }

    if (updates.length) await actor.updateEmbeddedDocuments("ActiveEffect", updates);
    if (bloodlossAdded <= 0) {
      await syncBleedingStatus(actor);
      return { bloodlossAdded: 0, totalBloodloss: Number(bloodlossItem(actor)?.system.injuryLevel) || 0 };
    }

    const item = await ensureBloodlossItem(actor);
    if (!item) throw new Error(`HM3 | Unable to create Bloodloss Injury for ${actor.name}.`);

    const current = Math.max(0, Number(item.system.injuryLevel) || 0);
    const totalBloodloss = current + bloodlossAdded;
    await item.update({
      "system.injuryLevel": totalBloodloss,
      "system.isBloodloss": true,
      "flags.hm3.bloodloss": true
    });

    await syncBleedingStatus(actor);
    const fatal = await syncDeadStatus(actor, totalBloodloss);
    if (fatal) {
      ui.notifications.error(`${actor.name} has bled to death (${totalBloodloss} Bloodloss > Endurance ${actor.system.endurance}).`);
    }

    return { bloodlossAdded, totalBloodloss, fatal };
  }

  static async processWorldTime(worldTime) {
    if (!game.settings.get("hm3", "bloodloss")) return;
    if (!activeGmOwnsProcessing()) return;

    for (const actor of actorsForBloodlossProcessing()) {
      if (!["character", "creature"].includes(actor.type)) continue;
      if (!bleedingEffects(actor).length) continue;
      try {
        await BloodlossService.processActor(actor, worldTime);
      } catch (error) {
        console.error(`HM3 | Bloodloss processing failed for ${actor.name}.`, error);
      }
    }
  }

  static async synchronizeActor(actor) {
    if (!actor) return;
    await syncBleedingStatus(actor);
    const totalBloodloss = Number(bloodlossItem(actor)?.system.injuryLevel) || 0;
    if (totalBloodloss > 0) await syncDeadStatus(actor, totalBloodloss);
  }
}

Hooks.on("updateWorldTime", worldTime => {
  worldTimeProcessing = worldTimeProcessing
    .then(() => BloodlossService.processWorldTime(worldTime))
    .catch(error => console.error("HM3 | Bloodloss world-time processing failed.", error));
});

Hooks.on("createActiveEffect", effect => {
  if (!BloodlossService.isBleedingEffect(effect)) return;
  BloodlossService.synchronizeActor(effect.parent).catch(error =>
    console.error("HM3 | Failed to synchronize bleeding status after effect creation.", error)
  );
});

Hooks.on("updateActiveEffect", effect => {
  if (!BloodlossService.isBleedingEffect(effect)) return;
  BloodlossService.synchronizeActor(effect.parent).catch(error =>
    console.error("HM3 | Failed to synchronize bleeding status after effect update.", error)
  );
});

Hooks.on("deleteActiveEffect", effect => {
  if (!BloodlossService.isBleedingEffect(effect)) return;
  BloodlossService.synchronizeActor(effect.parent).catch(error =>
    console.error("HM3 | Failed to synchronize bleeding status after effect deletion.", error)
  );
});
