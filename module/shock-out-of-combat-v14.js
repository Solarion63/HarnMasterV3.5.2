import { SHOCK_STATES, shockDiceCount } from "./shock-rules.js";
import { ShockService } from "./shock-service.js";
import {
  completeOutOfCombatShockRecovery,
  scheduleOutOfCombatShockRecovery
} from "./shock-workflow-v14.js";

let processing = Promise.resolve();

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

async function postPlayerReminder(actor, availableAt) {
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

async function ensureRecoverySchedule(actor, worldTime) {
  if (ShockService.recoveryAvailableAt(actor)) return;
  if (ShockService.isInStartedCombat(actor)) return;

  console.warn(`HM3 | ${actor.name} is unconscious from Shock without an out-of-combat recovery schedule; creating one now.`);
  await scheduleOutOfCombatShockRecovery(actor);
}

async function processActor(actor, worldTime) {
  if (!["character", "creature"].includes(actor.type)) return;
  if (ShockService.workflowState(actor) !== SHOCK_STATES.UNCONSCIOUS) return;
  if (ShockService.isInStartedCombat(actor)) return;

  await ensureRecoverySchedule(actor, worldTime);
  const availableAt = ShockService.recoveryAvailableAt(actor);
  if (!availableAt || worldTime < availableAt) return;

  if (playerOwners(actor).length) {
    await postPlayerReminder(actor, availableAt);
  } else {
    await completeOutOfCombatShockRecovery(actor, true);
  }
}

async function process(worldTime = Number(game.time?.worldTime) || 0) {
  if (!game.settings.get("hm3", "automateShockEffects")) return;
  if (!authoritativeGm()) return;

  for (const actor of actorsForProcessing()) {
    try {
      await processActor(actor, worldTime);
    } catch (error) {
      console.error(`HM3 | Out-of-combat Shock recovery failed for ${actor.name}.`, error);
    }
  }
}

function queueProcess(worldTime) {
  const numericWorldTime = Number(worldTime);
  const effectiveWorldTime = Number.isFinite(numericWorldTime)
    ? numericWorldTime
    : Number(game.time?.worldTime) || 0;

  processing = processing
    .then(() => process(effectiveWorldTime))
    .catch(error => console.error("HM3 | Out-of-combat Shock processing failed.", error));
}

Hooks.once("ready", () => queueProcess(Number(game.time?.worldTime) || 0));
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
