import {
  SHOCK_STATES,
  shockDiceCount,
  shockRecoveryBaseTarget
} from "./shock-rules.js";
import { ShockService } from "./shock-service.js";
import {
  completeOutOfCombatShockRecovery,
  scheduleOutOfCombatShockRecovery
} from "./shock-workflow-v14.js";

let processing = Promise.resolve();

function currentWorldTime() {
  const value = Number(game.time?.worldTime);
  return Number.isFinite(value) ? value : 0;
}

function authoritativeGm() {
  if (!game.user?.isGM) return false;
  const activeGms = game.users
    ?.filter(user => user.active && user.isGM)
    ?.sort((left, right) => String(left.id).localeCompare(String(right.id))) ?? [];
  return activeGms[0]?.id === game.user.id;
}

function actorsForProcessing() {
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

function playerOwners(actor) {
  return (game.users ?? []).filter(user =>
    !user.isGM && actor.testUserPermission?.(user, "OWNER")
  );
}

function whisperRecipients(actor) {
  const recipients = new Set();
  for (const user of game.users ?? []) {
    if (user.isGM || (!user.isGM && actor.testUserPermission?.(user, "OWNER"))) {
      recipients.add(user.id);
    }
  }
  return Array.from(recipients);
}

async function postUnconsciousReminder(actor, availableAt) {
  const key = String(availableAt);
  if (ShockService.recoveryReminderFor(actor) === key) return false;

  const recipients = whisperRecipients(actor);
  if (!recipients.length) return false;

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/hm3/templates/chat/shock-out-of-combat-reminder-card.html",
    {
      actorName: actor.name,
      actorUuid: actor.uuid,
      diceCount: shockDiceCount(actor.system?.universalPenalty),
      endurance: Number(actor.system?.endurance) || 0
    }
  );

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: recipients,
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    sound: CONFIG.sounds.notify
  });
  await ShockService.markRecoveryReminder(actor, key);
  return true;
}

async function postShockInjuryRecoveryReminder(actor, recovery) {
  const key = String(recovery.availableAt);
  if (ShockService.shockInjuryRecoveryReminderFor(actor) === key) return false;

  const recipients = whisperRecipients(actor);
  if (!recipients.length) return false;

  const endurance = Number(actor.system?.endurance) || 0;
  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/hm3/templates/chat/shock-injury-recovery-reminder-card.html",
    {
      actorName: actor.name,
      actorUuid: actor.uuid,
      healRate: recovery.healRate,
      endurance,
      baseTarget: shockRecoveryBaseTarget(recovery.healRate, endurance)
    }
  );

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: recipients,
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    sound: CONFIG.sounds.notify
  });
  await ShockService.markShockInjuryRecoveryReminder(actor, key);
  return true;
}

async function ensureUnconsciousRecoverySchedule(actor) {
  if (ShockService.recoveryAvailableAt(actor)) return;
  if (ShockService.isInStartedCombat(actor)) return;

  console.warn(
    `HM3 | ${actor.name} is unconscious from Shock without an out-of-combat recovery schedule; creating one now.`
  );
  await scheduleOutOfCombatShockRecovery(actor);
}

async function processUnconsciousActor(actor, worldTime) {
  if (ShockService.isInStartedCombat(actor)) return;

  await ensureUnconsciousRecoverySchedule(actor);
  const availableAt = ShockService.recoveryAvailableAt(actor);
  if (availableAt == null || worldTime < availableAt) return;

  if (playerOwners(actor).length) {
    await postUnconsciousReminder(actor, availableAt);
  } else {
    await completeOutOfCombatShockRecovery(actor, true);
  }
}

async function processShockActor(actor, worldTime) {
  const recovery = await ShockService.prepareShockRecovery(actor, worldTime);
  if (!recovery?.injury || recovery.healRate <= 0 || recovery.healRate >= 6) return;
  if (!recovery.eligible) return;

  // An attending Physician can modify this roll, so even NPC recovery is
  // presented as a GM/player action rather than assuming a +0 modifier.
  await postShockInjuryRecoveryReminder(actor, recovery);
}

async function processActor(actor, worldTime) {
  if (!["character", "creature"].includes(actor.type)) return;

  const state = ShockService.workflowState(actor);
  if (state === SHOCK_STATES.UNCONSCIOUS) {
    await processUnconsciousActor(actor, worldTime);
  } else if (state === SHOCK_STATES.SHOCK) {
    await processShockActor(actor, worldTime);
  }
}

async function process(worldTime = currentWorldTime()) {
  if (!game.settings.get("hm3", "automateShockEffects")) return;
  if (!authoritativeGm()) return;

  for (const actor of actorsForProcessing()) {
    try {
      await processActor(actor, worldTime);
    } catch (error) {
      console.error(`HM3 | Shock time processing failed for ${actor.name}.`, error);
    }
  }
}

function queueProcess(worldTime) {
  const numericWorldTime = Number(worldTime);
  const effectiveWorldTime = Number.isFinite(numericWorldTime)
    ? numericWorldTime
    : currentWorldTime();

  processing = processing
    .then(() => process(effectiveWorldTime))
    .catch(error => console.error("HM3 | Shock time processing failed.", error));
}

Hooks.once("ready", () => queueProcess(currentWorldTime()));
Hooks.on("updateWorldTime", (...args) => {
  const worldTime = args.find(value => Number.isFinite(Number(value)));
  queueProcess(worldTime);
});

Hooks.on("deleteCombat", combat => {
  if (!game.settings.get("hm3", "automateShockEffects")) return;
  if (!authoritativeGm()) return;

  processing = processing
    .then(async () => {
      const actors = new Map();
      for (const combatant of combat.combatants ?? []) {
        const actor = combatant.actor;
        if (actor?.uuid) actors.set(actor.uuid, actor);
      }
      for (const actor of actors.values()) {
        if (ShockService.workflowState(actor) !== SHOCK_STATES.UNCONSCIOUS) continue;
        await scheduleOutOfCombatShockRecovery(actor);
      }
    })
    .catch(error => console.error("HM3 | Failed to schedule Shock recovery after combat ended.", error));
});

Hooks.on("deleteItem", item => {
  if (!ShockService.isShockInjury(item)) return;
  const actor = item.parent;
  if (!actor || !authoritativeGm()) return;

  ShockService.clearShock(actor, { removeInjury: false })
    .catch(error => console.error("HM3 | Failed to clear Shock state after Shock injury deletion.", error));
});

Hooks.on("deleteActiveEffect", effect => {
  if (!ShockService.isManagedShockStatus(effect)) return;
  const actor = effect.parent;
  if (!actor || !authoritativeGm() || !ShockService.isActiveShock(actor)) return;

  // Manually removing the system-managed Shocked status is treated as an
  // explicit GM override, matching the existing Unconscious override behavior.
  ShockService.clearShock(actor)
    .catch(error => console.error("HM3 | Failed to clear Shock after Shocked status deletion.", error));
});
