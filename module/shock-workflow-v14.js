import { DiceHM3 } from "./dice-hm3.js";
import { callOnHooks, shockRoll as legacyShockRoll } from "./macros.js";
import {
  SHOCK_PHASES,
  SHOCK_STATES,
  resolveShockOutcome,
  shockDiceCount,
  shockPhaseForState
} from "./shock-rules.js";
import { ShockService } from "./shock-service.js";

const { renderTemplate } = foundry.applications.handlebars;

function currentMessageMode() {
  const mode = game.settings.get("core", "messageMode") ?? "public";
  return mode in CONFIG.ChatMessage.modes ? mode : "public";
}

function resolveActor(myActor) {
  let actor = myActor;

  if (!(actor instanceof Actor)) {
    if (actor) {
      actor = fromUuidSync(actor);
    } else {
      const speaker = ChatMessage.getSpeaker();
      if (speaker?.token) actor = canvas.tokens.get(speaker.token)?.actor ?? null;
      else if (speaker?.actor) actor = game.actors.get(speaker.actor) ?? null;
    }
  }

  if (!actor) {
    ui.notifications.warn("No actor selected, Shock Roll ignored.");
    return null;
  }
  if (!actor.isOwner) {
    ui.notifications.warn(`You do not have permissions to control ${actor.name}.`);
    return null;
  }
  return actor;
}

function speakerForActor(actor) {
  return ChatMessage.getSpeaker({ actor });
}

function phaseLabel(phase) {
  switch (phase) {
    case SHOCK_PHASES.RECOVERY:
      return "Shock Recovery Roll";
    case SHOCK_PHASES.FOLLOW_UP:
      return "Follow-up Shock Roll";
    default:
      return "Shock Roll";
  }
}

async function postConsequence(actor, data) {
  const actorId = actor.isToken ? actor.token?.actorId ?? actor.id : actor.id;
  const tokenId = actor.isToken ? actor.token?.id ?? null : null;
  const content = await renderTemplate("systems/hm3/templates/chat/shock-consequence-card.html", {
    actorName: actor.name,
    actorId,
    tokenId,
    visibleActorId: actorId,
    ...data
  });

  return ChatMessage.create({
    user: game.user.id,
    speaker: speakerForActor(actor),
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    sound: CONFIG.sounds.notify
  }, {
    messageMode: currentMessageMode()
  });
}

async function automaticSuccess(actor, rollData) {
  const result = {
    type: rollData.type,
    title: rollData.label,
    origTarget: rollData.target,
    modifier: 0,
    modifiedTarget: rollData.target,
    isSuccess: true,
    rollValue: 0,
    rollResult: "—",
    showResult: false,
    description: "Automatic Success",
    notes: "No Universal Penalty; no dice are rolled.",
    roll: null,
    automatic: true
  };

  actor.runCustomMacro(result);
  callOnHooks("hm3.onShockRoll", actor, result, rollData);
  await postConsequence(actor, {
    title: rollData.label,
    result: "Automatic Success",
    detail: "No Universal Penalty; the Shock Roll succeeds automatically."
  });
  return result;
}

async function performShockTest(actor, phase, noDialog) {
  const numdice = shockDiceCount(actor.system?.universalPenalty);
  const target = Number(actor.system?.endurance) || 0;
  const label = phaseLabel(phase);
  const rollData = {
    type: "shock",
    label,
    target,
    numdice,
    notesData: {
      up: numdice,
      endurance: target,
      phase
    },
    speaker: speakerForActor(actor),
    fastforward: noDialog,
    notes: ""
  };
  if (actor.isToken) rollData.token = actor.token.id;
  else rollData.actor = actor.id;

  if (!Hooks.call("hm3.preShockRoll", rollData, actor)) return null;
  if (numdice === 0) return automaticSuccess(actor, rollData);

  const result = await DiceHM3.d6Roll(rollData);
  if (result) {
    actor.runCustomMacro(result);
    callOnHooks("hm3.onShockRoll", actor, result, rollData);
  }
  return result;
}

async function resolveInitial(actor, result) {
  const outcome = resolveShockOutcome(SHOCK_PHASES.INITIAL, result.isSuccess);
  if (outcome.nextState === SHOCK_STATES.UNCONSCIOUS) {
    await ShockService.enterUnconscious(actor);
    await postConsequence(actor, {
      title: "Shock Roll Failed",
      result: "Unconscious and Prone",
      detail: "In combat, make another Shock Roll on a subsequent turn to recover consciousness.",
      nextAction: "Shock Recovery Roll"
    });
  } else {
    await ShockService.clearTransientShockState(actor);
    await postConsequence(actor, {
      title: "Shock Roll Passed",
      result: "Remains Conscious",
      detail: "No Shock consequence is applied."
    });
  }
  return outcome;
}

async function resolveRecovery(actor, result, noDialog) {
  const outcome = resolveShockOutcome(SHOCK_PHASES.RECOVERY, result.isSuccess);
  if (outcome.nextState === SHOCK_STATES.UNCONSCIOUS) {
    await ShockService.enterUnconscious(actor);
    await postConsequence(actor, {
      title: "Shock Recovery Failed",
      result: "Remains Unconscious",
      detail: "Try another Shock Recovery Roll on a subsequent combat turn.",
      nextAction: "Shock Recovery Roll"
    });
    return outcome;
  }

  await ShockService.markFollowUp(actor);
  await postConsequence(actor, {
    title: "Consciousness Regained",
    result: "Follow-up Shock Roll Required",
    detail: "The character regains consciousness and must immediately make the required follow-up Shock Roll."
  });

  const followUp = await performShockTest(actor, SHOCK_PHASES.FOLLOW_UP, noDialog);
  if (!followUp) {
    await postConsequence(actor, {
      title: "Follow-up Shock Roll Required",
      result: "Pending",
      detail: "The required follow-up roll was not completed.",
      nextAction: "Follow-up Shock Roll"
    });
    return outcome;
  }

  await resolveFollowUp(actor, followUp);
  return outcome;
}

async function resolveFollowUp(actor, result) {
  const outcome = resolveShockOutcome(SHOCK_PHASES.FOLLOW_UP, result.isSuccess);
  if (outcome.nextState === SHOCK_STATES.SHOCK) {
    const injury = await ShockService.enterShock(actor);
    await postConsequence(actor, {
      title: "Shock",
      result: "Character Enters Shock",
      detail: `${injury?.name ?? "Shock"} injury added at H5 with Injury Level 0. Shock recovery is handled separately.`
    });
  } else {
    await ShockService.clearTransientShockState(actor);
    await postConsequence(actor, {
      title: "Shock Avoided",
      result: "Recovered",
      detail: "The character is conscious and does not enter Shock."
    });
  }
  return outcome;
}

export async function shockRoll(noDialog = false, myActor = null) {
  if (!game.settings.get("hm3", "automateShockEffects")) {
    return legacyShockRoll(noDialog, myActor);
  }

  const actor = resolveActor(myActor);
  if (!actor) return null;

  const state = ShockService.workflowState(actor);
  if (state === SHOCK_STATES.SHOCK) {
    ui.notifications.warn(`${actor.name} is already in Shock. Shock recovery is handled separately.`);
    return null;
  }

  const phase = shockPhaseForState(state);
  const result = await performShockTest(actor, phase, noDialog);
  if (!result) return null;

  switch (phase) {
    case SHOCK_PHASES.RECOVERY:
      await resolveRecovery(actor, result, noDialog);
      break;
    case SHOCK_PHASES.FOLLOW_UP:
      await resolveFollowUp(actor, result);
      break;
    default:
      await resolveInitial(actor, result);
      break;
  }

  return result;
}
