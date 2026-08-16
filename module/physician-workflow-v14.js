import { BloodlossService } from "./bloodloss-service.js";
import { evaluateBleederTreatment } from "./medical-rules.js";
import { MedicalService } from "./medical-service.js";

const { DialogV2 } = foundry.applications.api;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function targetedPatient() {
  const targets = Array.from(game.user?.targets ?? [])
    .map(token => token.actor)
    .filter(actor => actor && ["character", "creature"].includes(actor.type));

  if (!targets.length) return { patient: null, multiple: false };
  if (targets.length > 1) return { patient: null, multiple: true };
  return { patient: targets[0], multiple: false };
}

async function chooseBleedingEffect(patient, effects) {
  if (effects.length === 1) return effects[0];

  const options = effects.map(effect =>
    `<option value="${escapeHtml(effect.id)}">${escapeHtml(effect.name.replace(/^Bleeding Injury — /, ""))}</option>`
  ).join("");
  const content = `
    <div class="form-group">
      <label>Bleeding wound</label>
      <select name="bleedingEffect">${options}</select>
      <p class="hint">Choose which of ${escapeHtml(patient.name)}'s bleeding wounds is being treated.</p>
    </div>`;

  const effectId = await DialogV2.prompt({
    window: { title: `Treat ${patient.name}'s Bleeding` },
    content,
    ok: {
      label: "Treat Wound",
      callback: (_event, _button, dialog) =>
        dialog.element?.querySelector('[name="bleedingEffect"]')?.value ?? null
    },
    rejectClose: false
  });

  return effectId ? effects.find(effect => effect.id === effectId) ?? null : null;
}

async function treatmentChatMessage({ healer, patient, effect, evaluation, stopped }) {
  const woundName = effect.name.replace(/^Bleeding Injury — /, "");
  const modifierParts = [
    `Bleeder +${evaluation.treatmentModifier}`,
    evaluation.hemophiliaModifier ? `Hemophilia ${evaluation.hemophiliaModifier}` : null,
    evaluation.situationalModifier
      ? `Situational ${evaluation.situationalModifier > 0 ? "+" : ""}${evaluation.situationalModifier}`
      : null
  ].filter(Boolean).join(", ");

  const outcome = evaluation.isSuccess
    ? (stopped ? "Bleeding stopped." : "Successful treatment; patient update requested from the GM.")
    : "Bleeding continues.";

  return ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: healer }),
    content: `
      <div class="hm3 chat-card">
        <header class="card-header flexrow"><h3>Physician — Stop Bleeding</h3></header>
        <div class="card-content">
          <p><strong>Healer:</strong> ${escapeHtml(healer.name)}</p>
          <p><strong>Patient:</strong> ${escapeHtml(patient.name)}</p>
          <p><strong>Wound:</strong> ${escapeHtml(woundName)}</p>
          <p><strong>Target:</strong> ${evaluation.physicianEML} (${escapeHtml(modifierParts)}) → ${evaluation.target}</p>
          <p><strong>Existing Physician roll:</strong> ${evaluation.rollValue} — ${evaluation.resultCode}</p>
          <p><strong>${escapeHtml(outcome)}</strong></p>
        </div>
      </div>`
  });
}

export async function physicianTreatment({ healer, physicianSkill, rollResult, token = null } = {}) {
  if (!game.settings.get("hm3", "advancedPhysicianAutomation")) return null;
  if (!healer || !physicianSkill || !rollResult) return null;
  if (String(physicianSkill.name).toLowerCase() !== "physician") return null;

  const target = targetedPatient();
  if (target.multiple) {
    ui.notifications.warn("Target exactly one patient to use automated Physician treatment.");
    return null;
  }
  if (!target.patient) return null;

  const patient = target.patient;
  const effects = BloodlossService.bleedingEffects(patient);
  if (!effects.length) return null;

  const effect = await chooseBleedingEffect(patient, effects);
  if (!effect) return null;

  const physicianEML = Number(physicianSkill.system.effectiveMasteryLevel)
    || Number(physicianSkill.system.masteryLevel)
    || 0;
  const additionalModifier = Number(rollResult.modifier) || 0;
  const evaluation = evaluateBleederTreatment({
    rollValue: rollResult.rollValue,
    physicianEML,
    patient,
    additionalModifier
  });

  let stopped = false;
  if (evaluation.isSuccess) {
    stopped = await MedicalService.stopBleeding({
      healer,
      patient,
      effect,
      physicianSkill,
      rollValue: rollResult.rollValue,
      additionalModifier
    });
  }

  await treatmentChatMessage({ healer, patient, effect, evaluation, stopped });
  return { healer, patient, effect, evaluation, stopped, token };
}
