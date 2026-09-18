import {
  SHOCK_INJURY_HEAL_RATE,
  SHOCK_RECOVERY_INTERVAL_SECONDS,
  SHOCK_STATES,
  resolveShockRecovery,
  shockDiceCount,
  shockInjuryRecoveryEligibility
} from "./shock-rules.js";

const STATE_FLAG = "shockState";
const SHOCK_ITEM_FLAG = "isShock";
const MANAGED_STATUS_FLAG = "shockManagedStatus";
const RECOVERY_AVAILABLE_FLAG = "shockRecoveryAvailableAt";
const RECOVERY_REMINDER_FLAG = "shockRecoveryReminderFor";
const RECOVERY_DICE_FLAG = "shockRecoveryDice";
const SHOCK_CREATED_AT_FLAG = "shockCreatedAt";
const SHOCK_INJURY_RECOVERY_AVAILABLE_FLAG = "shockInjuryRecoveryAvailableAt";
const SHOCK_INJURY_RECOVERY_REMINDER_FLAG = "shockInjuryRecoveryReminderFor";
const SHOCK_INJURY_LAST_ROLL_FLAG = "shockInjuryRecoveryLastRolledAt";
const SHOCK_CLEANUP_ACTORS = new WeakSet();

const STATUS_DEFINITIONS = Object.freeze({
  unconscious: {
    name: "Unconscious",
    img: "icons/svg/unconscious.svg"
  },
  prone: {
    name: "Prone",
    img: "icons/svg/falling.svg"
  },
  shocked: {
    name: "Shocked",
    img: "icons/svg/daze.svg"
  },
  dead: {
    name: "Dead",
    img: "icons/svg/skull.svg"
  }
});

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function finiteWorldTime(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function flagValue(document, key) {
  return document?.getFlag?.("hm3", key) ?? document?.flags?.hm3?.[key] ?? null;
}

function configuredStatus(statusName) {
  const wanted = normalized(statusName);
  return (CONFIG.statusEffects ?? []).find(status => {
    const localized = game.i18n.localize(status.name ?? status.label ?? "");
    return [status.id, status.name, status.label, localized]
      .some(value => normalized(value) === wanted);
  }) ?? null;
}

function statusMatches(effect, statusName) {
  const wanted = normalized(statusName);
  const configured = configuredStatus(statusName);
  const configuredId = normalized(configured?.id);
  const effectName = normalized(effect.name ?? effect.label);
  const statuses = effect.statuses ?? new Set();
  const hasStatus = value => typeof statuses.has === "function"
    ? statuses.has(value)
    : Array.isArray(statuses) && statuses.includes(value);

  return effectName === wanted
    || hasStatus(wanted)
    || (configuredId && hasStatus(configuredId));
}

function managedStatusMatches(effect, statusName) {
  return normalized(effect.flags?.hm3?.[MANAGED_STATUS_FLAG]) === normalized(statusName);
}

async function ensureStatus(actor, statusName) {
  const existing = actor.effects.find(effect => statusMatches(effect, statusName));
  if (existing) {
    if (managedStatusMatches(existing, statusName)
      && Number(existing.showIcon) !== CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS) {
      await existing.update({ showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS });
    }
    return existing;
  }

  const configured = configuredStatus(statusName);
  const fallback = STATUS_DEFINITIONS[statusName] ?? {
    name: statusName,
    img: "icons/svg/aura.svg"
  };
  const statusId = configured?.id ?? statusName;
  const statusLabel = configured?.name ?? configured?.label ?? fallback.name;
  const effectName = game.i18n.localize(statusLabel);

  const created = await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: effectName || fallback.name,
    img: configured?.img ?? configured?.icon ?? fallback.img,
    showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
    statuses: [statusId],
    disabled: false,
    changes: [],
    flags: {
      hm3: {
        [MANAGED_STATUS_FLAG]: statusName
      }
    }
  }]);

  return created[0] ?? null;
}

async function removeManagedStatus(actor, statusName) {
  const ids = actor.effects
    .filter(effect => managedStatusMatches(effect, statusName))
    .map(effect => effect.id);

  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
}

async function clearRecoveryTimingFlags(actor) {
  await actor.unsetFlag("hm3", RECOVERY_AVAILABLE_FLAG);
  await actor.unsetFlag("hm3", RECOVERY_REMINDER_FLAG);
}

async function clearRecoveryStateFlags(actor) {
  await clearRecoveryTimingFlags(actor);
  await actor.unsetFlag("hm3", RECOVERY_DICE_FLAG);
}

function sameCombatActor(actor, combatant, combat) {
  const combatActor = combatant?.actor;
  if (!actor || !combatActor) return false;
  if (combatActor.uuid && actor.uuid && combatActor.uuid === actor.uuid) return true;

  if (actor.isToken) {
    const actorToken = actor.token;
    const tokenId = actorToken?.id;
    const sceneId = actorToken?.parent?.id ?? actorToken?.parent?.uuid?.split(".")?.[1];
    if (tokenId && combatant.tokenId === tokenId) {
      return !sceneId || !combat?.scene?.id || combat.scene.id === sceneId;
    }
  }

  return !actor.isToken && !combatActor.isToken && actor.id === combatActor.id;
}

export class ShockService {
  static state(actor) {
    const state = actor?.getFlag?.("hm3", STATE_FLAG) ?? actor?.flags?.hm3?.[STATE_FLAG] ?? null;
    return Object.values(SHOCK_STATES).includes(state) ? state : null;
  }

  static async setState(actor, state) {
    if (!actor) return null;
    if (state == null) {
      await actor.unsetFlag("hm3", STATE_FLAG);
      return null;
    }
    if (!Object.values(SHOCK_STATES).includes(state)) {
      throw new Error(`Invalid Shock state: ${state}`);
    }
    await actor.setFlag("hm3", STATE_FLAG, state);
    return state;
  }

  static isInStartedCombat(actor) {
    if (!actor) return false;
    for (const combat of game.combats ?? []) {
      if (!combat?.started) continue;
      for (const combatant of combat.combatants ?? []) {
        if (sameCombatActor(actor, combatant, combat)) return true;
      }
    }
    return false;
  }

  static recoveryAvailableAt(actor) {
    const raw = actor?.getFlag?.("hm3", RECOVERY_AVAILABLE_FLAG);
    if (raw === undefined || raw === null || raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  static async scheduleOutOfCombatRecovery(actor, availableAt) {
    const numeric = Number(availableAt);
    if (!Number.isFinite(numeric)) {
      throw new Error("Shock recovery availability must be a finite Foundry world-time value.");
    }
    await actor.setFlag("hm3", RECOVERY_AVAILABLE_FLAG, numeric);
    await actor.unsetFlag("hm3", RECOVERY_REMINDER_FLAG);
    return numeric;
  }

  static recoveryReminderFor(actor) {
    return actor?.getFlag?.("hm3", RECOVERY_REMINDER_FLAG) ?? null;
  }

  static async markRecoveryReminder(actor, key) {
    await actor.setFlag("hm3", RECOVERY_REMINDER_FLAG, String(key));
  }

  static recoveryDiceCount(actor) {
    const raw = actor?.getFlag?.("hm3", RECOVERY_DICE_FLAG)
      ?? actor?.flags?.hm3?.[RECOVERY_DICE_FLAG]
      ?? null;
    const diceCount = shockDiceCount(raw);
    return diceCount > 0 ? diceCount : null;
  }

  static async setRecoveryDiceCount(actor, diceCount) {
    const normalizedDiceCount = shockDiceCount(diceCount);
    if (normalizedDiceCount < 1) {
      throw new Error("Shock recovery dice count must be at least 1d6.");
    }
    await actor.setFlag("hm3", RECOVERY_DICE_FLAG, normalizedDiceCount);
    return normalizedDiceCount;
  }

  static async ensureRecoveryDiceCount(actor, fallbackUniversalPenalty) {
    const storedDiceCount = this.recoveryDiceCount(actor);
    if (storedDiceCount != null) return storedDiceCount;

    const fallbackDiceCount = shockDiceCount(fallbackUniversalPenalty);
    if (fallbackDiceCount < 1) return 0;
    return this.setRecoveryDiceCount(actor, fallbackDiceCount);
  }

  static isShockInjury(item) {
    if (!item || item.type !== "injury") return false;
    return Boolean(flagValue(item, SHOCK_ITEM_FLAG))
      || (normalized(item.name) === "shock" && Number(item.system?.injuryLevel) === 0);
  }

  static shockInjury(actor) {
    if (!actor) return null;
    return actor.items.find(item => this.isShockInjury(item)) ?? null;
  }

  static isActiveShock(actor) {
    const shockInjury = this.shockInjury(actor);
    const shockHealRate = Number(shockInjury?.system?.healRate);
    return Number.isFinite(shockHealRate)
      && shockHealRate > 0
      && shockHealRate < 6;
  }

  static isManagedShockStatus(effect) {
    return managedStatusMatches(effect, "shocked");
  }

  static workflowState(actor) {
    const state = this.state(actor);
    if (state === SHOCK_STATES.UNCONSCIOUS
      && !actor?.effects?.some(effect => statusMatches(effect, "unconscious"))) {
      return null;
    }

    const activeShock = this.isActiveShock(actor);
    if (state === SHOCK_STATES.SHOCK) return activeShock ? state : null;
    if (state) return state;
    return activeShock ? SHOCK_STATES.SHOCK : null;
  }

  static async ensureShockInjury(actor) {
    let injury = this.shockInjury(actor);
    const now = finiteWorldTime(game.time?.worldTime);

    if (injury) {
      const update = {};
      const healRate = Number(injury.system?.healRate);
      if (!Number.isFinite(healRate) || healRate < 0 || healRate > 6) {
        update["system.healRate"] = SHOCK_INJURY_HEAL_RATE;
      }
      if (!flagValue(injury, SHOCK_ITEM_FLAG)) {
        update[`flags.hm3.${SHOCK_ITEM_FLAG}`] = true;
      }
      if (Object.keys(update).length) await injury.update(update);
      return injury;
    }

    const created = await actor.createEmbeddedDocuments("Item", [{
      name: "Shock",
      type: "injury",
      img: "icons/svg/daze.svg",
      system: {
        severity: "",
        injuryLevel: 0,
        healRate: SHOCK_INJURY_HEAL_RATE,
        isBleeder: false,
        notes: "Shock injury. Test Shock Recovery once every four hours; Shock abates at H6 and is fatal at H0."
      },
      flags: {
        hm3: {
          [SHOCK_ITEM_FLAG]: true,
          [SHOCK_CREATED_AT_FLAG]: now,
          [SHOCK_INJURY_RECOVERY_AVAILABLE_FLAG]: now + SHOCK_RECOVERY_INTERVAL_SECONDS
        }
      }
    }]);

    injury = created[0] ?? null;
    return injury;
  }

  static shockInjuryRecoveryEligibility(actor, worldTime = game.time?.worldTime) {
    const injury = this.shockInjury(actor);
    if (!injury) {
      return {
        eligible: false,
        availableAt: null,
        remainingSeconds: 0,
        legacy: false,
        injury: null
      };
    }

    const eligibility = shockInjuryRecoveryEligibility({
      availableAt: flagValue(injury, SHOCK_INJURY_RECOVERY_AVAILABLE_FLAG),
      createdAt: flagValue(injury, SHOCK_CREATED_AT_FLAG),
      worldTime
    });
    return { ...eligibility, injury };
  }

  static async prepareShockRecovery(actor, worldTime = game.time?.worldTime) {
    const injury = this.shockInjury(actor);
    if (!injury) return null;

    const prepared = await this.ensureShockInjury(actor);
    const eligibility = this.shockInjuryRecoveryEligibility(actor, worldTime);
    if (eligibility.legacy) {
      await prepared.setFlag("hm3", SHOCK_INJURY_RECOVERY_AVAILABLE_FLAG, eligibility.availableAt);
    }

    const healRate = Number(prepared.system?.healRate);
    if (Number.isFinite(healRate) && healRate > 0 && healRate < 6) {
      await ensureStatus(actor, "shocked");
      if (this.state(actor) !== SHOCK_STATES.SHOCK) {
        await this.setState(actor, SHOCK_STATES.SHOCK);
      }
    }

    return {
      ...eligibility,
      injury: prepared,
      healRate: Number(prepared.system?.healRate) || 0
    };
  }

  static shockInjuryRecoveryReminderFor(actor) {
    return flagValue(this.shockInjury(actor), SHOCK_INJURY_RECOVERY_REMINDER_FLAG);
  }

  static async markShockInjuryRecoveryReminder(actor, key) {
    const injury = this.shockInjury(actor);
    if (!injury) return false;
    await injury.setFlag("hm3", SHOCK_INJURY_RECOVERY_REMINDER_FLAG, String(key));
    return true;
  }

  static async applyShockInjuryRecovery(
    actor,
    resultCode,
    worldTime = game.time?.worldTime
  ) {
    const prepared = await this.prepareShockRecovery(actor, worldTime);
    if (!prepared?.injury) {
      return { applied: false, reason: "no-shock-injury" };
    }
    if (!prepared.eligible) {
      return {
        applied: false,
        reason: "cooldown",
        remainingSeconds: prepared.remainingSeconds,
        availableAt: prepared.availableAt
      };
    }

    const now = finiteWorldTime(worldTime);
    const resolution = resolveShockRecovery({
      healRate: prepared.injury.system?.healRate,
      resultCode
    });

    if (resolution.recovered) {
      await this.clearShock(actor);
      return {
        applied: true,
        reason: "recovered",
        availableAt: null,
        ...resolution
      };
    }

    if (resolution.dead) {
      await prepared.injury.update({
        "system.healRate": 0,
        [`flags.hm3.${SHOCK_INJURY_LAST_ROLL_FLAG}`]: now
      });
      await prepared.injury.unsetFlag("hm3", SHOCK_INJURY_RECOVERY_AVAILABLE_FLAG);
      await prepared.injury.unsetFlag("hm3", SHOCK_INJURY_RECOVERY_REMINDER_FLAG);
      await removeManagedStatus(actor, "shocked");
      await ensureStatus(actor, "dead");
      if (this.state(actor) === SHOCK_STATES.SHOCK) await this.setState(actor, null);
      return {
        applied: true,
        reason: "dead",
        availableAt: null,
        ...resolution
      };
    }

    const availableAt = now + SHOCK_RECOVERY_INTERVAL_SECONDS;
    await prepared.injury.update({
      "system.healRate": resolution.healRate,
      [`flags.hm3.${SHOCK_INJURY_LAST_ROLL_FLAG}`]: now,
      [`flags.hm3.${SHOCK_INJURY_RECOVERY_AVAILABLE_FLAG}`]: availableAt
    });
    await prepared.injury.unsetFlag("hm3", SHOCK_INJURY_RECOVERY_REMINDER_FLAG);
    await ensureStatus(actor, "shocked");
    await this.setState(actor, SHOCK_STATES.SHOCK);

    return {
      applied: true,
      reason: "continues",
      availableAt,
      ...resolution
    };
  }

  static async enterUnconscious(actor, recoveryDiceCount = null) {
    await ensureStatus(actor, "unconscious");
    await ensureStatus(actor, "prone");
    await clearRecoveryTimingFlags(actor);
    if (recoveryDiceCount != null) {
      await this.setRecoveryDiceCount(actor, recoveryDiceCount);
    }
    await this.setState(actor, SHOCK_STATES.UNCONSCIOUS);
  }

  static async markFollowUp(actor) {
    await removeManagedStatus(actor, "unconscious");
    await clearRecoveryStateFlags(actor);
    await this.setState(actor, SHOCK_STATES.FOLLOW_UP);
  }

  static async enterShock(actor) {
    await removeManagedStatus(actor, "unconscious");
    await clearRecoveryStateFlags(actor);
    const injury = await this.ensureShockInjury(actor);
    const now = finiteWorldTime(game.time?.worldTime);

    await injury.update({
      "system.healRate": SHOCK_INJURY_HEAL_RATE,
      [`flags.hm3.${SHOCK_ITEM_FLAG}`]: true,
      [`flags.hm3.${SHOCK_CREATED_AT_FLAG}`]: now,
      [`flags.hm3.${SHOCK_INJURY_RECOVERY_AVAILABLE_FLAG}`]:
        now + SHOCK_RECOVERY_INTERVAL_SECONDS
    });
    await injury.unsetFlag("hm3", SHOCK_INJURY_RECOVERY_REMINDER_FLAG);
    await ensureStatus(actor, "shocked");
    await this.setState(actor, SHOCK_STATES.SHOCK);
    return injury;
  }

  static isShockCleanupInProgress(actor) {
    return Boolean(actor && SHOCK_CLEANUP_ACTORS.has(actor));
  }

  static async clearShock(actor, { removeInjury = true } = {}) {
    if (!actor) return false;
    if (this.isShockCleanupInProgress(actor)) return false;

    SHOCK_CLEANUP_ACTORS.add(actor);
    try {
      const injury = this.shockInjury(actor);
      const hadManagedStatus = actor.effects.some(effect => managedStatusMatches(effect, "shocked"));
      const hadState = this.state(actor) === SHOCK_STATES.SHOCK;

      // Clear workflow state before deleting embedded documents. Deleting either
      // document fires Foundry hooks; the cleanup guard prevents those hooks
      // from initiating a second, competing deletion of the same documents.
      if (hadState) await this.setState(actor, null);
      await removeManagedStatus(actor, "shocked");

      if (removeInjury && injury) {
        const currentInjury = this.shockInjury(actor);
        if (currentInjury?.id === injury.id) {
          await actor.deleteEmbeddedDocuments("Item", [injury.id]);
        }
      }

      return Boolean(injury || hadManagedStatus || hadState);
    } finally {
      SHOCK_CLEANUP_ACTORS.delete(actor);
    }
  }

  static async clearTransientShockState(actor) {
    await removeManagedStatus(actor, "unconscious");
    await clearRecoveryStateFlags(actor);
    await this.setState(actor, null);
  }

  static async cancelUnconsciousRecovery(actor) {
    if (this.workflowState(actor) !== SHOCK_STATES.UNCONSCIOUS) return false;
    await this.clearTransientShockState(actor);
    return true;
  }

  static async clearAutomatedShockState(actor) {
    const state = this.workflowState(actor);
    if (state === SHOCK_STATES.SHOCK || this.shockInjury(actor)) {
      return this.clearShock(actor);
    }
    if (state === SHOCK_STATES.UNCONSCIOUS || state === SHOCK_STATES.FOLLOW_UP) {
      await this.clearTransientShockState(actor);
      return true;
    }
    return false;
  }
}
