import { SHOCK_STATES, shockDiceCount } from "./shock-rules.js";
import { ShockService } from "./shock-service.js";
import { shockRoll } from "./shock-workflow-v14.js";

const TURN_FLAG = "shockRecoveryTurn";
let turnProcessing = Promise.resolve();

function authoritativeGm() {
  if (!game.user?.isGM) return false;
  const activeGms = game.users
    ?.filter(user => user.active && user.isGM)
    ?.sort((left, right) => String(left.id).localeCompare(String(right.id))) ?? [];
  return activeGms[0]?.id === game.user.id;
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

function recoveryTurnKey(combat, combatant) {
  return [combat.id, combat.round ?? 0, combat.turn ?? -1, combatant.id].join(":");
}

async function postPlayerReminder(actor, turnKey) {
  const recipients = whisperRecipients(actor);
  if (!recipients.length) return false;

  const content = await foundry.applications.handlebars.renderTemplate(
    "systems/hm3/templates/chat/shock-recovery-reminder-card.html",
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
  await actor.setFlag("hm3", TURN_FLAG, turnKey);
  return true;
}

async function processCombatTurn(combat) {
  if (!game.settings.get("hm3", "automateShockEffects")) return;
  if (!authoritativeGm()) return;

  const combatant = combat.combatant;
  const actor = combatant?.actor;
  if (!actor || ShockService.workflowState(actor) !== SHOCK_STATES.UNCONSCIOUS) return;

  const turnKey = recoveryTurnKey(combat, combatant);
  if (actor.getFlag("hm3", TURN_FLAG) === turnKey) return;

  const owners = playerOwners(actor);
  if (owners.length) {
    await postPlayerReminder(actor, turnKey);
    return;
  }

  await actor.setFlag("hm3", TURN_FLAG, turnKey);
  try {
    await shockRoll(true, actor);
  } catch (error) {
    await actor.unsetFlag("hm3", TURN_FLAG);
    throw error;
  }
}

function queueCombatTurn(combat) {
  turnProcessing = turnProcessing
    .then(() => processCombatTurn(combat))
    .catch(error => console.error("HM3 | Turn-based Shock recovery failed.", error));
}

Hooks.on("updateCombat", (combat, changed) => {
  if (!Object.prototype.hasOwnProperty.call(changed, "turn")
    && !Object.prototype.hasOwnProperty.call(changed, "round")) return;
  queueCombatTurn(combat);
});
