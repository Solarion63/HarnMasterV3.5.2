import { BloodlossService } from "./bloodloss-service.js";
import { evaluateBleederTreatment, evaluatePhysicianDiagnosis } from "./medical-rules.js";
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

function diagnosableInjuries(patient) {
  return Array.from(patient?.itemTypes?.injury ?? []).filter(injury =>
    injury.getFlag("hm3", "bloodloss") !== true
    && injury.system?.isBloodloss !== true
    && String(injury.name).toLowerCase() !== "bloodloss"
  );
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

async function chooseDiagnosisInjury(patient, injuries) {
  if (injuries.length === 1) return injuries[0];

  const options = injuries.map(injury =>
    `<option value="${escapeHtml(injury.id)}">${escapeHtml(injury.name)}</option>`
  ).join("");
  const content = `
    <div class="form-group">
      <label>Injury to diagnose</label>
      <select name="diagnosisInjury">${options}</select>
      <p class="hint">Choose which of ${escapeHtml(patient.name)}'s injuries is being diagnosed.</p>
    </div>`;

  const injuryId = await DialogV2.prompt({
    window: { title: `Diagnose ${patient.name}` },
    content,
    ok: {
      label: "Diagnose Injury",
      callback: (_event, _button, dialog) =>
        dialog.element?.querySelector('[name="diagnosisInjury"]')?.value ?? null
    },
    rejectClose: false
  });

  return injuryId ? injuries.find(injury => injury.id === injuryId) ?? null : null;
}

function treatmentOutcome(evaluation, treatment) {
  if (!evaluation.isSuccess) return "Bleeding continues.";
  switch (treatment?.status) {
    case "stopped":
    case "requested":
      return "Bleeding stopped.";
    case "unavailable":
      return "Successful treatment roll, but the patient could not be updated because no active GM is available.";
    default:
      return "Successful treatment roll, but the bleeding condition was not changed.";
  }
}

function diagnosisOutcome(evaluation, diagnosis) {
  if (diagnosis?.status === "unavailable") {
    return "Diagnosis result could not be recorded because no active GM is available.";
  }
  if (evaluation.isSuccess) {
    return `Diagnosis succeeds. Apply ${evaluation.treatmentModifier >= 0 ? "+" : ""}${evaluation.treatmentModifier} EML to the later Treatment Roll.`;
  }
  return "Diagnosis fails. Apply a -10 to -30 EML penalty to the later Treatment Roll at GM discretion.";
}

async function treatmentChatMessage({ healer, patient, effect, evaluation, treatment }) {
  const woundName = effect.name.replace(/^Bleeding Injury — /, "");
  const modifierParts = [
    `Bleeder +${evaluation.treatmentModifier}`,
    evaluation.hemophiliaModifier ? `Hemophilia ${evaluation.hemophiliaModifier}` : null,
    evaluation.situationalModifier
      ? `Situational ${evaluation.situationalModifier > 0 ? "+" : ""}${evaluation.situationalModifier}`
      : null
  ].filter(Boolean).join(", ");

  const outcome = treatmentOutcome(evaluation, treatment);

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

async function diagnosisChatMessage({ healer, patient, injury, evaluation, diagnosis }) {
  const modifierParts = evaluation.situationalModifier
    ? `Situational ${evaluation.situationalModifier > 0 ? "+" : ""}${evaluation.situationalModifier}`
    : "No situational modifier";
  const outcome = diagnosisOutcome(evaluation, diagnosis);

  return ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: healer }),
    content: `
      <div class="hm3 chat-card">
        <header class="card-header flexrow"><h3>Physician — Diagnosis</h3></header>
        <div class="card-content">
          <p><strong>Physician:</strong> ${escapeHtml(healer.name)}</p>
          <p><strong>Patient:</strong> ${escapeHtml(patient.name)}</p>
          <p><strong>Injury:</strong> ${escapeHtml(injury.name)}</p>
          <p><strong>Target:</strong> ${evaluation.physicianEML} (${escapeHtml(modifierParts)}) → ${evaluation.target}</p>
          <p><strong>Existing Physician roll:</strong> ${evaluation.rollValue} — ${evaluation.resultCode}</p>
          <p><strong>${escapeHtml(outcome)}</strong></p>
        </div>
      </div>`
  });
}

async function diagnoseInjury({ healer, patient, physicianSkill, rollResult, token }) {
  const injuries = diagnosableInjuries(patient);
  if (!injuries.length) {
    ui.notifications.info(`${patient.name} has no recorded injury available for Physician diagnosis.`);
    return null;
  }

  const injury = await chooseDiagnosisInjury(patient, injuries);
  if (!injury) return null;

  const physicianEML = Number(physicianSkill.system.effectiveMasteryLevel)
    || Number(physicianSkill.system.masteryLevel)
    || 0;
  const additionalModifier = Number(rollResult.modifier) || 0;
  const evaluation = evaluatePhysicianDiagnosis({
    rollValue: rollResult.rollValue,
    physicianEML,
    additionalModifier
  });
  const diagnosis = await MedicalService.recordDiagnosis({
    healer,
    patient,
    injury,
    physicianSkill,
    rollValue: rollResult.rollValue,
    additionalModifier
  });

  await diagnosisChatMessage({ healer, patient, injury, evaluation, diagnosis });
  return { healer, patient, injury, evaluation, diagnosis, token };
}

export async function physicianTreatment({ healer, physicianSkill, rollResult, token = null } = {}) {
  if (!game.settings.get("hm3", "advancedPhysicianAutomation")) return null;
  if (!healer || !physicianSkill || !rollResult) return null;
  if (String(physicianSkill.name).toLowerCase() !== "physician") return null;

  const target = targetedPatient();
  if (target.multiple) {
    ui.notifications.warn("Target exactly one patient to use automated Physician treatment or diagnosis.");
    return null;
  }
  if (!target.patient) return null;

  const patient = target.patient;
  const effects = BloodlossService.bleedingEffects(patient);
  if (!effects.length) {
    return diagnoseInjury({ healer, patient, physicianSkill, rollResult, token });
  }

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

  let treatment = { status: "failed", changed: false };
  if (evaluation.isSuccess) {
    treatment = await MedicalService.stopBleeding({
      healer,
      patient,
      effect,
      physicianSkill,
      rollValue: rollResult.rollValue,
      additionalModifier
    });
  }

  await treatmentChatMessage({ healer, patient, effect, evaluation, treatment });
  return { healer, patient, effect, evaluation, treatment, stopped: treatment.changed, token };
}
