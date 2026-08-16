import { DiceHM3 } from "./dice-hm3.js";
import { BloodlossService } from "./bloodloss-service.js";

function rootsFromRender(html) {
  if (!html) return [];
  if (html instanceof HTMLElement || html instanceof DocumentFragment) return [html];
  if (Array.isArray(html)) return html.filter(root => root?.querySelectorAll);
  if (typeof html.length === "number") return Array.from(html).filter(root => root?.querySelectorAll);
  return html.querySelectorAll ? [html] : [];
}

function patientFromButton(button) {
  const tokenId = button.dataset.tokenId;
  if (tokenId) return canvas.tokens.get(tokenId)?.actor ?? null;
  const actorId = button.dataset.actorId;
  return actorId ? game.actors.get(actorId) ?? null : null;
}

function controlledTreater(patient) {
  const controlled = canvas.tokens.controlled
    .map(token => token.actor)
    .filter(actor => actor && ["character", "creature"].includes(actor.type));
  if (controlled.length === 1) return controlled[0];
  return patient;
}

function physicianSkill(actor) {
  return actor?.itemTypes?.skill?.find(skill => skill.name.toLowerCase() === "physician") ?? null;
}

function hasHemophilia(actor) {
  return actor?.itemTypes?.trait?.some(trait => trait.name.toLowerCase().includes("hemophilia")) ?? false;
}

export async function treatBleeding(patient, effect, treater = null) {
  if (!patient || !BloodlossService.isBleedingEffect(effect)) return null;
  if (!patient.isOwner && !game.user.isGM) {
    ui.notifications.warn(`You do not have permission to treat ${patient.name}.`);
    return null;
  }

  const treatingActor = treater ?? controlledTreater(patient);
  const physician = physicianSkill(treatingActor);
  if (!physician) {
    ui.notifications.warn(`${treatingActor?.name ?? "The selected treater"} does not have the Physician skill.`);
    return null;
  }

  const treatmentModifier = 50;
  const hemophiliaModifier = hasHemophilia(patient) ? -40 : 0;
  const modifier = treatmentModifier + hemophiliaModifier;
  const target = Number(physician.system.effectiveMasteryLevel) || 0;
  const speaker = ChatMessage.getSpeaker({ actor: treatingActor });
  const result = await DiceHM3.d100StdRoll({
    type: "bleeding-treatment",
    label: `${treatingActor.name} Treats ${patient.name}'s Bleeding`,
    target,
    modifier,
    notesData: {
      patient: patient.name,
      physician: physician.name,
      physicianEML: target,
      treatmentModifier,
      hemophiliaModifier
    },
    speaker,
    fastforward: false,
    notes: hasHemophilia(patient)
      ? "Bleeder treatment +50; Hemophilia -40. Any success stops this bleeding wound."
      : "Bleeder treatment +50. Any success stops this bleeding wound."
  });
  if (!result) return null;

  if (result.isSuccess) {
    await BloodlossService.stopBleeding(patient, effect);
    ui.notifications.info(`${patient.name}'s bleeding from ${effect.name.replace(/^Bleeding Injury — /, "")} has been stopped.`);
  } else {
    ui.notifications.warn(`${patient.name} is still bleeding.`);
  }

  return result;
}

async function onTreatBleeding(button) {
  const patient = patientFromButton(button);
  if (!patient) {
    ui.notifications.warn("The bleeding patient could not be found.");
    return null;
  }

  const effectId = button.dataset.effectId;
  const effect = effectId ? patient.effects.get(effectId) : null;
  if (!BloodlossService.isBleedingEffect(effect)) {
    ui.notifications.info("That bleeding injury is no longer active.");
    button.disabled = true;
    return null;
  }

  return treatBleeding(patient, effect);
}

function bindTreatButton(button) {
  if (button.dataset.hm3BloodlossBound === "1") return;
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    onTreatBleeding(button)
      .catch(error => {
        console.error("HM3 | Stop Bleeding treatment failed.", error);
        ui.notifications.error("Stop Bleeding treatment failed. See the console for details.");
      })
      .finally(() => {
        if (button.isConnected) button.disabled = false;
      });
  });
  button.dataset.hm3BloodlossBound = "1";
  button.dataset.hm3Bound = "1";
}

Hooks.on("renderChatMessageHTML", (_message, html) => {
  for (const root of rootsFromRender(html)) {
    for (const button of root.querySelectorAll('.hm3.chat-card button[data-action="treat-bleeding"]')) {
      bindTreatButton(button);
    }
  }
});
