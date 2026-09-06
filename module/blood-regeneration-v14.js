import { BloodlossService } from "./bloodloss-service.js";
import { BLOODLOSS_HEAL_RATE, bloodRegenerationTarget } from "./bloodloss-rules.js";
import { DiceHM3 } from "./dice-hm3.js";
import { getItem } from "./item-lookup.js";
import { callOnHooks, healingRoll as legacyHealingRoll } from "./macros.js";

const { renderTemplate } = foundry.applications.handlebars;

function isBloodlossItem(actor, item) {
  const canonical = BloodlossService.bloodlossItem(actor);
  return Boolean(canonical && item && canonical.id === item.id);
}

async function resolveActor(actorRef) {
  if (!actorRef) return null;
  if (actorRef instanceof Actor) return actorRef;
  try {
    const document = await fromUuid(actorRef);
    if (document?.documentName === "Actor") return document;
    return document?.actor ?? null;
  } catch (_error) {
    return null;
  }
}

async function resolveInjuryAndActor(itemRef, actorRef) {
  const suppliedActor = await resolveActor(actorRef);
  const item = await getItem(itemRef, "injury", suppliedActor);
  if (!item) return null;

  const actor = item.actor ?? item.parent ?? suppliedActor;
  if (!actor) {
    ui.notifications.warn("No actor for this Healing Roll could be determined.");
    return null;
  }
  if (!actor.isOwner) {
    ui.notifications.warn(`You do not have permissions to control ${actor.name}.`);
    return null;
  }
  return { actor, item };
}

function resultCode(result) {
  if (result.isSuccess) return result.isCritical ? "CS" : "MS";
  return result.isCritical ? "CF" : "MF";
}

function formatRemaining(seconds) {
  const totalHours = Math.ceil(Math.max(0, Number(seconds) || 0) / 3600);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days && hours) return `${days}d ${hours}h`;
  if (days) return `${days}d`;
  return `${hours}h`;
}

async function postRegenerationResult(actor, rollResult, resolution) {
  const content = await renderTemplate("systems/hm3/templates/chat/blood-regeneration-card.html", {
    actorName: actor.name,
    resultCode: resolution.resultCode,
    description: rollResult.description,
    previousBloodloss: resolution.previousBloodloss,
    reduction: resolution.reduction,
    totalBloodloss: resolution.totalBloodloss
  });

  return ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.OTHER
  });
}

/**
 * Foundry v14 Healing Roll entry point.
 *
 * Ordinary wounds retain the historical healing-roll implementation. The
 * system-owned Bloodloss Injury is intercepted here because its H6 roll has a
 * distinct five-day cadence and BP-reduction result table.
 */
export async function healingRoll(itemRef, noDialog = false, myActor = null) {
  const resolved = await resolveInjuryAndActor(itemRef, myActor);
  if (!resolved) return null;
  const { actor, item } = resolved;

  if (!isBloodlossItem(actor, item)) {
    return legacyHealingRoll(itemRef, noDialog, actor);
  }

  const preparedItem = await BloodlossService.prepareBloodRegeneration(actor);
  if (!preparedItem) return null;
  if (Math.max(0, Number(preparedItem.system.injuryLevel) || 0) <= 0) {
    await actor.deleteEmbeddedDocuments("Item", [preparedItem.id]);
    ui.notifications.info(`${actor.name}'s Bloodloss has fully regenerated.`);
    return null;
  }

  const worldTime = Number(game.time?.worldTime) || 0;
  const eligibility = BloodlossService.regenerationEligibility(actor, worldTime);
  if (!eligibility.eligible) {
    ui.notifications.warn(
      `${actor.name} cannot make another Blood Regeneration roll for ${formatRemaining(eligibility.remainingSeconds)}.`
    );
    return null;
  }

  const speaker = ChatMessage.getSpeaker({ actor });
  const stdRollData = {
    type: "blood-regeneration",
    label: `${actor.name} Blood Regeneration Roll`,
    target: bloodRegenerationTarget(actor.system.endurance),
    notesData: {
      up: actor.system.universalPenalty,
      pp: actor.system.physicalPenalty,
      il: actor.system.eph?.totalInjuryLevels || 0,
      fatigue: actor.system.eph?.fatigue,
      endurance: actor.system.endurance,
      injuryName: preparedItem.name,
      healRate: BLOODLOSS_HEAL_RATE
    },
    speaker,
    fastforward: noDialog,
    notes: preparedItem.system.notes
  };
  if (actor.isToken) stdRollData.token = actor.token.id;
  else stdRollData.actor = actor.id;

  if (!Hooks.call("hm3.preHealingRoll", stdRollData, actor, preparedItem)) return null;
  const result = await DiceHM3.d100StdRoll(stdRollData);
  if (!result) return null;

  const code = resultCode(result);
  const resolution = await BloodlossService.applyRegeneration(actor, code, worldTime);
  if (!resolution.applied) {
    if (resolution.reason === "cooldown") {
      ui.notifications.warn(
        `${actor.name} cannot make another Blood Regeneration roll for ${formatRemaining(resolution.remainingSeconds)}.`
      );
    }
    return null;
  }

  preparedItem.runCustomMacro(result);
  callOnHooks("hm3.onHealingRoll", actor, result, stdRollData, preparedItem);
  await postRegenerationResult(actor, result, resolution);

  if (resolution.totalBloodloss <= 0) {
    await actor.deleteEmbeddedDocuments("Item", [preparedItem.id]);
    ui.notifications.info(`${actor.name}'s Bloodloss has fully regenerated.`);
  } else if (resolution.reduction > 0) {
    ui.notifications.info(
      `${actor.name} regenerates ${resolution.reduction} Blood Point${resolution.reduction === 1 ? "" : "s"}; `
      + `${resolution.totalBloodloss} Bloodloss remains.`
    );
  } else {
    ui.notifications.info(`${actor.name}'s Blood Regeneration roll does not reduce Bloodloss.`);
  }

  return {
    ...result,
    bloodRegeneration: resolution
  };
}

// hm3.js owns creation of the public game.hm3 API. This module is loaded after
// hm3.js and replaces only the Healing Roll entry point during the same init
// phase, preserving every other historical macro function unchanged.
Hooks.once("init", () => {
  if (!game.hm3?.macros) {
    console.error("HM3 | Blood Regeneration could not register the Healing Roll wrapper.");
    return;
  }
  game.hm3.macros.healingRoll = healingRoll;
});
