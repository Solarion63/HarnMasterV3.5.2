import { DiceHM3 } from "./dice-hm3.js";
import { callOnHooks, shockRoll as legacyShockRoll } from "./macros.js";
import {
  SHOCK_OUT_OF_COMBAT_RECOVERY_FORMULA,
  SHOCK_PHASES,
  SHOCK_STATES,
  resolveShockOutcome,
  shockDiceCount,
  shockPhaseForState,
  shockRecoveryAvailableAt,
  shockRecoveryResultCode,
  shockRecoveryTarget
} from "./shock-rules.js";
import { ShockService } from "./shock-service.js";

const { DialogV2 } = foundry.applications.api;
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

function formatRemaining(seconds) {
  const totalMinutes = Math.max(0, Math.ceil((Number(seconds) || 0) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
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

async function performShockTest(actor, phase, noDialog, diceCount = null) {
  const numdice = diceCount == null
    ? shockDiceCount(actor.system?.universalPenalty)
    : shockDiceCount(diceCount);
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

async function promptShockRecoveryOptions(actor, injury) {
  const healRate = Number(injury.system?.healRate) || 0;
  const endurance = Number(actor.system?.endurance) || 0;
  const baseTarget = healRate * endurance;
  const data = await DialogV2.input({
    window: { title: `Shock Recovery — ${actor.name}` },
    content: `
      <div class="hm3 shock-recovery-dialog">
        <p><strong>Shock:</strong> H${healRate}</p>
        <p><strong>Base Target:</strong> H${healRate} × Endurance ${endurance} = ${baseTarget}</p>
        <div class="form-group">
          <label>Attending Physician EML</label>
          <div class="form-fields">
            <input type="number" name="physicianEML" value="0" min="0" step="1">
          </div>
        </div>
        <p class="notes">Half the attending Physician's EML is added to the target. Enter 0 if no Physician is attending.</p>
      </div>`,
    ok: { label: "Roll Shock Recovery" },
    rejectClose: false
  });
  if (!data) return null;

  const value = Number(data.physicianEML);
  return {
    physicianEML: Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
  };
}

export async function scheduleOutOfCombatShockRecovery(actor) {
  if (!actor || ShockService.workflowState(actor) !== SHOCK_STATES.UNCONSCIOUS) return null;
  const existing = ShockService.recoveryAvailableAt(actor);
  if (existing) return existing;

  const durationRoll = await new Roll(SHOCK_OUT_OF_COMBAT_RECOVERY_FORMULA).evaluate();
  const durationMinutes = Math.max(1, Number(durationRoll.total) || 1);
  const availableAt = shockRecoveryAvailableAt(game.time?.worldTime, durationMinutes);
  await ShockService.scheduleOutOfCombatRecovery(actor, availableAt);

  await durationRoll.toMessage({
    speaker: speakerForActor(actor),
    flavor: `<b>Shock Unconscious Duration</b><br>${durationMinutes} minutes`
  });
  await postConsequence(actor, {
    title: "Out-of-Combat Shock Recovery",
    result: `Unconscious for ${durationMinutes} minutes`,
    detail: "When that time has passed, the character regains consciousness and must make the required follow-up Shock Roll.",
    clearAction: "Clear Shock Recovery"
  });
  return availableAt;
}

async function resolveInitial(actor, result, initialDiceCount) {
  const outcome = resolveShockOutcome(SHOCK_PHASES.INITIAL, result.isSuccess);
  if (outcome.nextState === SHOCK_STATES.UNCONSCIOUS) {
    await ShockService.enterUnconscious(actor, initialDiceCount);
    if (!ShockService.isInStartedCombat(actor)) {
      await scheduleOutOfCombatShockRecovery(actor);
    } else {
      await postConsequence(actor, {
        title: "Shock Roll Failed",
        result: "Unconscious and Prone",
        detail: `In combat, recovery is attempted on subsequent turns using the same ${initialDiceCount}d6 as this failed Shock Roll.`,
        clearAction: "Clear Shock Recovery"
      });
    }
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
    const recoveryDiceCount = ShockService.recoveryDiceCount(actor);
    await ShockService.enterUnconscious(actor);
    if (!ShockService.isInStartedCombat(actor)) {
      await scheduleOutOfCombatShockRecovery(actor);
    } else {
      await postConsequence(actor, {
        title: "Shock Recovery Failed",
        result: "Remains Unconscious",
        detail: recoveryDiceCount
          ? `Another ${recoveryDiceCount}d6 recovery attempt is due on the character's next combat turn.`
          : "Another recovery attempt is due on the character's next combat turn.",
        clearAction: "Clear Shock Recovery"
      });
    }
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
      detail: `${injury?.name ?? "Shock"} injury added at H5 with Injury Level 0. The first Shock Recovery roll is due in four hours.`,
      clearAction: "Clear Shock"
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

export async function completeOutOfCombatShockRecovery(actor, noDialog = false) {
  if (!actor || ShockService.workflowState(actor) !== SHOCK_STATES.UNCONSCIOUS) return null;

  await ShockService.markFollowUp(actor);
  await postConsequence(actor, {
    title: "Consciousness Regained",
    result: "Follow-up Shock Roll Required",
    detail: "The out-of-combat unconscious period has ended. The character regains consciousness and must make the required follow-up Shock Roll."
  });

  const followUp = await performShockTest(actor, SHOCK_PHASES.FOLLOW_UP, noDialog);
  if (!followUp) return null;
  await resolveFollowUp(actor, followUp);
  return followUp;
}

export async function shockInjuryRecoveryRoll(myActor = null) {
  if (!game.settings.get("hm3", "automateShockEffects")) {
    ui.notifications.warn("Automated Shock Effects is disabled.");
    return null;
  }

  const actor = resolveActor(myActor);
  if (!actor) return null;
  if (ShockService.workflowState(actor) !== SHOCK_STATES.SHOCK) {
    ui.notifications.warn(`${actor.name} is not currently in Shock.`);
    return null;
  }

  const prepared = await ShockService.prepareShockRecovery(actor, game.time?.worldTime);
  if (!prepared?.injury) {
    ui.notifications.warn(`${actor.name} has no Shock injury to recover from.`);
    return null;
  }
  if (!prepared.eligible) {
    ui.notifications.warn(
      `${actor.name}'s next Shock Recovery roll is due in ${formatRemaining(prepared.remainingSeconds)}.`
    );
    return null;
  }

  const options = await promptShockRecoveryOptions(actor, prepared.injury);
  if (!options) return null;

  const endurance = Number(actor.system?.endurance) || 0;
  const target = shockRecoveryTarget({
    healRate: prepared.healRate,
    endurance,
    physicianEML: options.physicianEML
  });
  const rollData = {
    type: "shock-recovery",
    label: "Shock Recovery Roll",
    target: target.baseTarget,
    modifier: target.physicianBonus,
    speaker: speakerForActor(actor),
    fastforward: true,
    notesData: {
      healRate: prepared.healRate,
      endurance,
      physicianEML: options.physicianEML,
      physicianBonus: target.physicianBonus
    },
    notes: ""
  };
  if (actor.isToken) rollData.token = actor.token.id;
  else rollData.actor = actor.id;

  if (!Hooks.call("hm3.preShockRecoveryRoll", rollData, actor, prepared.injury)) return null;

  const result = await DiceHM3.d100StdRoll(rollData);
  if (!result) return null;

  actor.runCustomMacro(result);
  callOnHooks("hm3.onShockRecoveryRoll", actor, result, rollData, prepared.injury);

  const resultCode = shockRecoveryResultCode(result);
  const resolution = await ShockService.applyShockInjuryRecovery(
    actor,
    resultCode,
    game.time?.worldTime
  );

  if (!resolution.applied) {
    ui.notifications.warn("The Shock Recovery result could not be applied because the recovery state changed.");
    return result;
  }

  if (resolution.recovered) {
    await postConsequence(actor, {
      title: "Shock Recovery",
      result: `${resultCode}: H${resolution.previousHealRate} → H6`,
      detail: "Shock abates at H6. The Shock injury and Shocked status have been removed."
    });
  } else if (resolution.dead) {
    await postConsequence(actor, {
      title: "Shock Recovery",
      result: `${resultCode}: H${resolution.previousHealRate} → H0`,
      detail: "The patient has died from Shock at H0."
    });
  } else {
    await postConsequence(actor, {
      title: "Shock Recovery",
      result: `${resultCode}: H${resolution.previousHealRate} → H${resolution.healRate}`,
      detail: "Shock persists. The next Shock Recovery roll is due in four hours.",
      clearAction: "Clear Shock"
    });
  }

  return {
    ...result,
    shockRecovery: resolution
  };
}

export async function shockRoll(noDialog = false, myActor = null) {
  if (!game.settings.get("hm3", "automateShockEffects")) {
    return legacyShockRoll(noDialog, myActor);
  }

  const actor = resolveActor(myActor);
  if (!actor) return null;

  const state = ShockService.workflowState(actor);
  if (state === SHOCK_STATES.SHOCK) {
    ui.notifications.warn(
      `${actor.name} is already in Shock. Use the four-hour Shock Recovery roll instead.`
    );
    return null;
  }

  const phase = shockPhaseForState(state);
  const diceCount = phase === SHOCK_PHASES.RECOVERY
    ? await ShockService.ensureRecoveryDiceCount(actor, actor.system?.universalPenalty)
    : shockDiceCount(actor.system?.universalPenalty);
  const result = await performShockTest(actor, phase, noDialog, diceCount);
  if (!result) return null;

  switch (phase) {
    case SHOCK_PHASES.RECOVERY:
      await resolveRecovery(actor, result, noDialog);
      break;
    case SHOCK_PHASES.FOLLOW_UP:
      await resolveFollowUp(actor, result);
      break;
    default:
      await resolveInitial(actor, result, diceCount);
      break;
  }

  return result;
}
