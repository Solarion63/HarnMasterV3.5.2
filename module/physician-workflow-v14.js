import { BloodlossService } from "./bloodloss-service.js";
import {
  PHYSICIAN_TREATMENT_TABLE,
  bleederTreatmentModifier,
  defaultPhysicianTreatmentKey,
  evaluateBleederTreatment,
  evaluatePhysicianDiagnosis,
  evaluatePhysicianTreatment,
  physicianTreatmentEntry
} from "./medical-rules.js";
import { MedicalService } from "./medical-service.js";
import {
  physicianDiagnosisPresentation,
  physicianWoundChooserLabel
} from "./physician-diagnosis-presentation-v14.js";

const { DialogV2 } = foundry.applications.api;
const physicianRollStates = new Map();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function signed(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}`;
}

function isPhysicianSkill(item) {
  return item?.type === "skill" && String(item.name ?? "").toLowerCase() === "physician";
}

function physicianStateKey(actor, item) {
  if (!actor || !item) return null;
  return `${actor.uuid ?? actor.id}:${item.id}`;
}

function targetedPatient() {
  const targets = Array.from(game.user?.targets ?? [])
    .map(token => token.actor)
    .filter(actor => actor && ["character", "creature"].includes(actor.type));

  if (!targets.length) return { patient: null, multiple: false };
  if (targets.length > 1) return { patient: null, multiple: true };
  return { patient: targets[0], multiple: false };
}

function isBloodlossInjury(injury) {
  if (!injury || injury.type !== "injury") return false;
  return injury.getFlag("hm3", "bloodloss") === true
    || injury.system?.isBloodloss === true
    || String(injury.name).toLowerCase() === "bloodloss";
}

function recordedInjuries(patient) {
  return Array.from(patient?.itemTypes?.injury ?? []).filter(injury =>
    !isBloodlossInjury(injury) && Number(injury.system?.injuryLevel) > 0
  );
}

function hasPhysicianTreatment(injury) {
  if (!injury) return false;
  if (injury.getFlag("hm3", "physicianTreatment") != null) return true;
  const legacy = injury.getFlag("hm3", "treated");
  return legacy === true || String(legacy).toLowerCase() === "treated";
}

function signedRollModifier(rollResult) {
  const modifier = Number(rollResult?.modifier) || 0;
  if (rollResult?.plusMinus === "-") return -Math.abs(modifier);
  if (rollResult?.plusMinus === "+") return Math.abs(modifier);
  return modifier;
}

function diagnosisModifierForPreparedTreatment(injury, failedDiagnosisPenalty = null) {
  const diagnosis = injury?.getFlag("hm3", "physicianDiagnosis") ?? null;
  if (!diagnosis) return 0;
  const code = String(diagnosis.resultCode ?? "").toUpperCase();
  if (["MS", "CS"].includes(code)) return Number(diagnosis.treatmentModifier) || 0;
  if (["MF", "CF"].includes(code)) return Number(failedDiagnosisPenalty) || 0;
  return 0;
}

function suggestedLateDays(injury) {
  const createdAt = Number(injury?.getFlag("hm3", "injuryCreatedAt"));
  const now = Number(game.time?.worldTime);
  if (!Number.isFinite(createdAt) || createdAt <= 0 || !Number.isFinite(now) || now <= createdAt) return 0;
  const elapsed = now - createdAt;
  if (elapsed <= 86400) return 0;
  return Math.ceil((elapsed - 86400) / 86400);
}

async function chooseBleedingEffect(patient, effects) {
  const options = effects.map(effect =>
    `<option value="${escapeHtml(effect.id)}">${escapeHtml(effect.name.replace(/^Bleeding Injury — /, ""))}</option>`
  ).join("");
  const content = `
    <div class="form-group">
      <label>Bleeding wound</label>
      <select name="bleedingEffect">${options}</select>
      <p class="hint">Choose the bleeding wound to treat. The Physician roll occurs only after you confirm this selection.</p>
    </div>`;

  const effectId = await DialogV2.wait({
    window: { title: `Treat ${patient.name}'s Bleeding` },
    content,
    buttons: [
      {
        action: "select",
        label: "Select Wound",
        default: true,
        callback: (_event, _button, dialog) =>
          dialog.element?.querySelector('[name="bleedingEffect"]')?.value ?? null
      },
      { action: "cancel", label: "Cancel", callback: () => null }
    ],
    rejectClose: false
  });

  return effectId ? effects.find(effect => effect.id === effectId) ?? null : null;
}

async function chooseMedicalInjury(patient, injuries) {
  const options = injuries.map(injury =>
    `<option value="${escapeHtml(injury.id)}">${escapeHtml(physicianWoundChooserLabel(injury))}</option>`
  ).join("");
  const content = `
    <div class="form-group">
      <label>Injury</label>
      <select name="medicalInjury">${options}</select>
      <p class="hint">Choose the wound to examine or treat. Injuries that already received their one Treatment Roll are not listed.</p>
    </div>`;

  const injuryId = await DialogV2.wait({
    window: { title: `Physician — ${patient.name}` },
    content,
    buttons: [
      {
        action: "select",
        label: "Select Injury",
        default: true,
        callback: (_event, _button, dialog) =>
          dialog.element?.querySelector('[name="medicalInjury"]')?.value ?? null
      },
      { action: "cancel", label: "Cancel", callback: () => null }
    ],
    rejectClose: false
  });

  return injuryId ? injuries.find(injury => injury.id === injuryId) ?? null : null;
}

async function chooseInjuryAction(patient, injury) {
  const diagnosis = physicianDiagnosisPresentation(injury);
  const diagnosisText = diagnosis
    ? `${diagnosis.resultLabel} (${diagnosis.resultCode}); Treatment ${diagnosis.treatmentLabel}`
    : "Not diagnosed. Diagnosis is optional; this injury may be treated without diagnosing it.";
  const buttons = [];

  if (!diagnosis) {
    buttons.push({
      action: "diagnose",
      label: "Diagnose",
      callback: () => "diagnosis"
    });
  }
  buttons.push({
    action: "treat",
    label: "Treat",
    default: Boolean(diagnosis),
    callback: () => "treatment"
  });
  buttons.push({ action: "cancel", label: "Cancel", callback: () => "cancel" });

  return DialogV2.wait({
    window: { title: `Physician — ${injury.name}` },
    content: `
      <p><strong>Patient:</strong> ${escapeHtml(patient.name)}</p>
      <p><strong>Injury:</strong> ${escapeHtml(injury.name)}</p>
      <p><strong>Diagnosis:</strong> ${escapeHtml(diagnosisText)}</p>`,
    buttons,
    rejectClose: false
  });
}

function treatmentOptions(selectedKey) {
  return Object.entries(PHYSICIAN_TREATMENT_TABLE).map(([key, entry]) => {
    const selected = key === selectedKey ? " selected" : "";
    return `<option value="${escapeHtml(key)}"${selected}>${escapeHtml(`${entry.label} — ${entry.procedure} (${signed(entry.modifier)})`)}</option>`;
  }).join("");
}

async function configureTreatment(patient, injury) {
  const defaultKey = defaultPhysicianTreatmentKey(injury);
  const diagnosis = physicianDiagnosisPresentation(injury);
  const diagnosisCode = diagnosis?.resultCode ?? "";
  const failedDiagnosis = ["MF", "CF"].includes(diagnosisCode);
  const diagnosisText = diagnosis
    ? `${diagnosis.resultLabel} (${diagnosis.resultCode}); ${diagnosis.treatmentLabel}`
    : "No diagnosis modifier (Diagnosis is optional).";
  const lateDays = suggestedLateDays(injury);
  const failureField = failedDiagnosis
    ? `<div class="form-group">
         <label>Failed Diagnosis Penalty</label>
         <input type="number" name="diagnosisPenalty" min="-30" max="-10" step="1" placeholder="-10 to -30" required>
         <p class="hint">HârnMaster leaves the exact -10 to -30 EML penalty to GM discretion.</p>
       </div>`
    : "";

  const result = await DialogV2.wait({
    window: { title: `Treat ${patient.name} — ${injury.name}` },
    content: `
      <p><strong>Diagnosis:</strong> ${escapeHtml(diagnosisText)}</p>
      <div class="form-group">
        <label>Treatment Table Entry</label>
        <select name="treatmentKey">${treatmentOptions(defaultKey)}</select>
        <p class="hint">The system suggests a row from the wound's aspect and severity. Correct it here for ambiguous or legacy injuries.</p>
      </div>
      ${failureField}
      <div class="form-group">
        <label>Equipment / Supplies Modifier</label>
        <input type="number" name="equipmentModifier" value="0" step="1">
        <p class="hint">Use for quality/availability of supplies, herbal remedies, disinfectants, anesthetic, or other GM-approved circumstances.</p>
      </div>
      <div class="form-group">
        <label>Days Beyond First 24 Hours</label>
        <input type="number" name="lateDays" value="${lateDays}" min="0" step="1">
        <p class="hint">Treatment EML is reduced by 5 per delayed day. New v14 wounds derive a suggested value from world time; adjust legacy wounds as needed.</p>
      </div>
      <p class="hint">Procedure duration will be rolled/recorded after the Treatment Roll. Foundry world time will not advance automatically.</p>`,
    buttons: [
      {
        action: "continue",
        label: "Continue to Treatment Roll",
        default: true,
        callback: (_event, _button, dialog) => {
          const root = dialog.element;
          const diagnosisPenaltyText = root?.querySelector('[name="diagnosisPenalty"]')?.value ?? "";
          if (failedDiagnosis) {
            const penalty = Number(diagnosisPenaltyText);
            if (!Number.isFinite(penalty) || penalty < -30 || penalty > -10) {
              ui.notifications.warn("Choose a failed-diagnosis Treatment penalty from -30 to -10 EML.");
              return null;
            }
          }
          return {
            treatmentKey: root?.querySelector('[name="treatmentKey"]')?.value ?? defaultKey,
            diagnosisFailurePenalty: failedDiagnosis ? Number(diagnosisPenaltyText) : null,
            equipmentModifier: Math.trunc(Number(root?.querySelector('[name="equipmentModifier"]')?.value) || 0),
            lateDays: Math.max(0, Math.trunc(Number(root?.querySelector('[name="lateDays"]')?.value) || 0))
          };
        }
      },
      { action: "cancel", label: "Cancel", callback: () => "cancel" }
    ],
    rejectClose: false
  });

  if (!result || result === "cancel") return null;
  if (!physicianTreatmentEntry(result.treatmentKey)) return null;
  return result;
}

async function rollTreatmentDuration(treatmentKey, injuryLevel) {
  const entry = physicianTreatmentEntry(treatmentKey);
  const duration = entry?.duration;
  if (!duration) return { seconds: 0, text: "" };

  if (duration.type === "injuryLevel") {
    const units = Math.max(0, Number(injuryLevel) || 0) * Number(duration.unitsPerLevel || 0);
    return {
      seconds: Math.round(units * duration.secondsPerUnit),
      text: `${units} ${duration.unit}`
    };
  }

  if (duration.type === "combined") {
    let units = 0;
    const parts = [];
    for (const formula of duration.formulas ?? []) {
      const roll = await new Roll(formula).evaluate();
      units += Number(roll.total) || 0;
      parts.push(`${formula}=${roll.total}`);
    }
    return {
      seconds: Math.round(units * duration.secondsPerUnit),
      text: `${units} ${duration.unit} (${parts.join(" + ")})`
    };
  }

  const roll = await new Roll(duration.formula).evaluate();
  const units = Number(roll.total) || 0;
  return {
    seconds: Math.round(units * duration.secondsPerUnit),
    text: `${units} ${duration.unit} (${duration.formula})`
  };
}

function bleedingOutcome(evaluation, treatment) {
  if (!evaluation.isSuccess) return "Bleeding continues.";
  switch (treatment?.status) {
    case "stopped":
    case "requested": return "Bleeding stopped.";
    case "unavailable": return "Successful roll, but the patient could not be updated because no active GM is available.";
    default: return "Successful treatment roll, but the bleeding condition was not changed.";
  }
}

function diagnosisOutcome(evaluation, diagnosis) {
  if (diagnosis?.status === "unavailable") return "Diagnosis could not be recorded because no active GM is available.";
  if (diagnosis?.status === "already-diagnosed") return "This injury had already been diagnosed; the new result was not recorded.";
  if (evaluation.isSuccess) {
    return `Diagnosis succeeds. Apply ${signed(evaluation.treatmentModifier)} EML to the later Treatment Roll.`;
  }
  return "Diagnosis fails. Apply a -10 to -30 EML penalty to the later Treatment Roll at GM discretion.";
}

function normalTreatmentOutcome(evaluation, treatment) {
  if (treatment?.status === "unavailable") return "Treatment result could not be recorded because no active GM is available.";
  if (treatment?.status === "already-treated") return "This injury already received its one Treatment Roll; the new result was not recorded.";
  if (evaluation.amputation) {
    return `Amputation result ${evaluation.treatmentResult}: create a new ${evaluation.amputationWound} wound and treat that new injury separately.`;
  }
  if (evaluation.emergencyHealing) return "EE: the injury heals in one day; no Healing Rolls are required.";
  const impairment = evaluation.permanentImpairment
    ? " A permanent 1d3 attribute reduction is pending after the injury heals."
    : "";
  return `Healing Rate ${evaluation.treatmentResult} recorded.${impairment}`;
}

async function bleedingChatMessage({ healer, patient, effect, evaluation, treatment }) {
  const woundName = effect.name.replace(/^Bleeding Injury — /, "");
  const modifierParts = [
    `Bleeder +${evaluation.treatmentModifier}`,
    evaluation.hemophiliaModifier ? `Hemophilia ${evaluation.hemophiliaModifier}` : null,
    evaluation.situationalModifier ? `Situational ${signed(evaluation.situationalModifier)}` : null
  ].filter(Boolean).join(", ");

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
          <p><strong>Physician roll:</strong> ${evaluation.rollValue} — ${evaluation.resultCode}</p>
          <p><strong>${escapeHtml(bleedingOutcome(evaluation, treatment))}</strong></p>
        </div>
      </div>`
  });
}

async function diagnosisChatMessage({ healer, patient, injury, evaluation, diagnosis }) {
  const persisted = ["recorded", "requested"].includes(diagnosis?.status);
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
          <p><strong>Target:</strong> ${evaluation.physicianEML}${evaluation.situationalModifier ? ` (${signed(evaluation.situationalModifier)})` : ""} → ${evaluation.target}</p>
          <p><strong>Physician roll:</strong> ${evaluation.rollValue} — ${evaluation.resultCode}</p>
          <p><strong>${escapeHtml(diagnosisOutcome(evaluation, diagnosis))}</strong></p>
          <p><em>${escapeHtml(persisted ? `Diagnosis recorded on ${injury.name}.` : "Diagnosis was not recorded on the injury.")}</em></p>
        </div>
      </div>`
  });
}

async function normalTreatmentChatMessage({ healer, patient, injury, evaluation, treatment, duration }) {
  const modifiers = [
    `Procedure ${signed(evaluation.procedureModifier)}`,
    evaluation.diagnosisModifier ? `Diagnosis ${signed(evaluation.diagnosisModifier)}` : null,
    evaluation.equipmentModifier ? `Equipment ${signed(evaluation.equipmentModifier)}` : null,
    evaluation.lateModifier ? `Delay ${evaluation.lateModifier}` : null,
    evaluation.situationalModifier ? `Situational ${signed(evaluation.situationalModifier)}` : null
  ].filter(Boolean).join(", ");
  const persisted = ["recorded", "requested"].includes(treatment?.status);

  return ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: healer }),
    content: `
      <div class="hm3 chat-card">
        <header class="card-header flexrow"><h3>Physician — Wound Treatment</h3></header>
        <div class="card-content">
          <p><strong>Physician:</strong> ${escapeHtml(healer.name)}</p>
          <p><strong>Patient:</strong> ${escapeHtml(patient.name)}</p>
          <p><strong>Injury:</strong> ${escapeHtml(injury.name)}</p>
          <p><strong>Treatment:</strong> ${escapeHtml(evaluation.treatmentLabel)} — ${escapeHtml(evaluation.procedure)}</p>
          <p><strong>Target:</strong> ${evaluation.physicianEML} (${escapeHtml(modifiers)}) → ${evaluation.target}</p>
          <p><strong>Physician roll:</strong> ${evaluation.rollValue} — ${evaluation.resultCode}</p>
          <p><strong>Treatment result:</strong> ${escapeHtml(evaluation.treatmentResult)}</p>
          <p><strong>Procedure time:</strong> ${escapeHtml(duration.text || "Not recorded")}</p>
          <p><strong>${escapeHtml(normalTreatmentOutcome(evaluation, treatment))}</strong></p>
          <p><em>${escapeHtml(persisted ? "This injury's one Treatment Roll has been recorded." : "Treatment was not recorded on the injury.")}</em></p>
        </div>
      </div>`
  });
}

export async function preparePhysicianAction({ healer, physicianSkill } = {}) {
  if (!game.settings.get("hm3", "advancedPhysicianAutomation")) return { status: "ordinary", action: null };
  if (!healer || !isPhysicianSkill(physicianSkill)) return { status: "ordinary", action: null };

  const target = targetedPatient();
  if (target.multiple) {
    ui.notifications.warn("Target exactly one patient to use automated Physician treatment or diagnosis.");
    return { status: "cancelled", action: null, reason: "multiple-targets" };
  }
  if (!target.patient) return { status: "ordinary", action: null };

  const patient = target.patient;
  const effects = BloodlossService.bleedingEffects(patient);
  if (effects.length) {
    const effect = await chooseBleedingEffect(patient, effects);
    if (!effect) return { status: "cancelled", action: null, reason: "selection-cancelled" };
    return {
      status: "prepared",
      action: {
        type: "bleeding",
        patient,
        effect,
        rollTargetModifier: bleederTreatmentModifier(patient),
        rollLabel: `Physician — Stop Bleeding: ${effect.name.replace(/^Bleeding Injury — /, "")}`
      }
    };
  }

  const injuries = recordedInjuries(patient);
  if (!injuries.length) {
    ui.notifications.info(`${patient.name} has no injuries.`);
    return { status: "cancelled", action: null, reason: "no-injuries" };
  }

  const untreated = injuries.filter(injury => !hasPhysicianTreatment(injury));
  if (!untreated.length) {
    ui.notifications.info(`All recorded injuries on ${patient.name} have already received their one Treatment Roll.`);
    return { status: "cancelled", action: null, reason: "all-treated" };
  }

  const injury = await chooseMedicalInjury(patient, untreated);
  if (!injury) return { status: "cancelled", action: null, reason: "selection-cancelled" };

  const actionType = await chooseInjuryAction(patient, injury);
  if (!["diagnosis", "treatment"].includes(actionType)) {
    return { status: "cancelled", action: null, reason: "action-cancelled" };
  }

  if (actionType === "diagnosis") {
    if (injury.getFlag("hm3", "physicianDiagnosis") != null) {
      ui.notifications.info(`${patient.name}'s ${injury.name} has already been diagnosed.`);
      return { status: "cancelled", action: null, reason: "already-diagnosed" };
    }
    return {
      status: "prepared",
      action: {
        type: "diagnosis",
        patient,
        injury,
        rollTargetModifier: 0,
        rollLabel: `Physician — Diagnose: ${injury.name}`
      }
    };
  }

  const treatmentConfig = await configureTreatment(patient, injury);
  if (!treatmentConfig) return { status: "cancelled", action: null, reason: "treatment-cancelled" };
  const entry = physicianTreatmentEntry(treatmentConfig.treatmentKey);
  const diagnosisModifier = diagnosisModifierForPreparedTreatment(
    injury,
    treatmentConfig.diagnosisFailurePenalty
  );
  const lateModifier = -5 * treatmentConfig.lateDays;
  const rollTargetModifier = entry.modifier
    + diagnosisModifier
    + treatmentConfig.equipmentModifier
    + lateModifier;

  return {
    status: "prepared",
    action: {
      type: "treatment",
      patient,
      injury,
      ...treatmentConfig,
      rollTargetModifier,
      rollLabel: `Physician — Treat: ${injury.name}`
    }
  };
}

async function resolveDiagnosisAction({ healer, physicianSkill, rollResult, token, action }) {
  const patient = action.patient;
  const injury = patient?.items?.get(action.injury?.id) ?? null;
  if (!injury || isBloodlossInjury(injury)) {
    ui.notifications.warn("The selected injury is no longer available for diagnosis.");
    return { status: "invalid", changed: false };
  }
  if (injury.getFlag("hm3", "physicianDiagnosis") != null) {
    ui.notifications.info(`${patient.name}'s ${injury.name} has already been diagnosed.`);
    return { status: "already-diagnosed", changed: false };
  }

  const physicianEML = Number(physicianSkill.system.effectiveMasteryLevel)
    || Number(physicianSkill.system.masteryLevel)
    || 0;
  const additionalModifier = signedRollModifier(rollResult);
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

async function resolveBleedingAction({ healer, physicianSkill, rollResult, token, action }) {
  const patient = action.patient;
  const effect = patient?.effects?.get(action.effect?.id) ?? null;
  if (!BloodlossService.isBleedingEffect(effect)) {
    ui.notifications.warn("The selected bleeding injury is no longer active.");
    return { status: "invalid", changed: false };
  }

  const physicianEML = Number(physicianSkill.system.effectiveMasteryLevel)
    || Number(physicianSkill.system.masteryLevel)
    || 0;
  const additionalModifier = signedRollModifier(rollResult);
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

  await bleedingChatMessage({ healer, patient, effect, evaluation, treatment });
  return { healer, patient, effect, evaluation, treatment, stopped: treatment.changed, token };
}

async function resolveNormalTreatmentAction({ healer, physicianSkill, rollResult, token, action }) {
  const patient = action.patient;
  const injury = patient?.items?.get(action.injury?.id) ?? null;
  if (!injury || isBloodlossInjury(injury)) {
    ui.notifications.warn("The selected injury is no longer available for treatment.");
    return { status: "invalid", changed: false };
  }
  if (BloodlossService.bleedingEffects(patient).length) {
    ui.notifications.warn(`${patient.name}'s bleeding must be stopped before normal wounds can be treated.`);
    return { status: "bleeding", changed: false };
  }
  if (hasPhysicianTreatment(injury)) {
    ui.notifications.info(`${patient.name}'s ${injury.name} has already received its one Treatment Roll.`);
    return { status: "already-treated", changed: false };
  }

  const physicianEML = Number(physicianSkill.system.effectiveMasteryLevel)
    || Number(physicianSkill.system.masteryLevel)
    || 0;
  const additionalModifier = signedRollModifier(rollResult);
  const diagnosisModifier = diagnosisModifierForPreparedTreatment(injury, action.diagnosisFailurePenalty);
  const evaluation = evaluatePhysicianTreatment({
    rollValue: rollResult.rollValue,
    physicianEML,
    treatmentKey: action.treatmentKey,
    diagnosisModifier,
    equipmentModifier: action.equipmentModifier,
    lateDays: action.lateDays,
    additionalModifier
  });
  const duration = await rollTreatmentDuration(action.treatmentKey, injury.system?.injuryLevel);
  const treatment = await MedicalService.recordTreatment({
    healer,
    patient,
    injury,
    physicianSkill,
    treatmentKey: action.treatmentKey,
    diagnosisFailurePenalty: action.diagnosisFailurePenalty,
    equipmentModifier: action.equipmentModifier,
    lateDays: action.lateDays,
    rollValue: rollResult.rollValue,
    additionalModifier,
    duration
  });

  await normalTreatmentChatMessage({ healer, patient, injury, evaluation, treatment, duration });
  return { healer, patient, injury, evaluation, treatment, duration, token };
}

export async function resolvePhysicianAction({
  healer,
  physicianSkill,
  rollResult,
  token = null,
  action
} = {}) {
  if (!healer || !isPhysicianSkill(physicianSkill) || !rollResult || !action) return null;
  if (action.type === "diagnosis") return resolveDiagnosisAction({ healer, physicianSkill, rollResult, token, action });
  if (action.type === "bleeding") return resolveBleedingAction({ healer, physicianSkill, rollResult, token, action });
  if (action.type === "treatment") return resolveNormalTreatmentAction({ healer, physicianSkill, rollResult, token, action });
  return null;
}

export async function physicianTreatment({ healer, physicianSkill, rollResult, token = null } = {}) {
  if (!game.settings.get("hm3", "advancedPhysicianAutomation")) return null;
  if (!healer || !isPhysicianSkill(physicianSkill) || !rollResult) return null;

  const key = physicianStateKey(healer, physicianSkill);
  if (key && physicianRollStates.has(key)) return physicianRollStates.get(key)?.result ?? null;

  const prepared = await preparePhysicianAction({ healer, physicianSkill });
  if (prepared.status !== "prepared") return null;
  return resolvePhysicianAction({ healer, physicianSkill, rollResult, token, action: prepared.action });
}

Hooks.on("hm3.preSkillRoll", (stdRollData, actor, item) => {
  if (!isPhysicianSkill(item)) return true;
  if (!game.settings.get("hm3", "advancedPhysicianAutomation")) return true;

  const key = physicianStateKey(actor, item);
  if (!key) return true;

  const existing = physicianRollStates.get(key);
  if (existing?.phase === "ready") {
    existing.phase = "rolling";
    const action = existing.action;
    if (action) {
      stdRollData.target = Number(stdRollData.target) + (Number(action.rollTargetModifier) || 0);
      stdRollData.label = action.rollLabel ?? stdRollData.label;
    }
    return true;
  }
  if (["preparing", "rolling"].includes(existing?.phase)) {
    ui.notifications.info("A Physician action is already in progress.");
    return false;
  }
  if (existing) physicianRollStates.delete(key);

  const target = targetedPatient();
  if (!target.patient && !target.multiple) {
    physicianRollStates.set(key, { phase: "ordinary", actor, item, action: null, result: null });
    return true;
  }
  if (target.multiple) {
    ui.notifications.warn("Target exactly one patient to use automated Physician treatment or diagnosis.");
    return false;
  }

  const state = { phase: "preparing", actor, item, action: null, result: null };
  physicianRollStates.set(key, state);

  void preparePhysicianAction({ healer: actor, physicianSkill: item })
    .then(prepared => {
      if (physicianRollStates.get(key) !== state) return null;
      if (prepared.status !== "prepared") {
        physicianRollStates.delete(key);
        return null;
      }

      state.action = prepared.action;
      state.phase = "ready";
      const roller = game.hm3?.macros?.skillRoll;
      if (typeof roller !== "function") {
        physicianRollStates.delete(key);
        ui.notifications.error("The HM3 Skill roller is unavailable.");
        return null;
      }
      return roller(item.uuid, Boolean(stdRollData.fastforward), actor);
    })
    .then(result => {
      if (physicianRollStates.get(key) !== state) return result;
      if (state.phase === "rolling" && result == null) physicianRollStates.delete(key);
      return result;
    })
    .catch(error => {
      if (physicianRollStates.get(key) === state) physicianRollStates.delete(key);
      console.error("HM3 | Physician pre-roll preparation failed", error);
      ui.notifications.error("The Physician action could not be prepared. See the console for details.");
    });

  return false;
});

Hooks.on("hm3.onSkillRoll", (actor, result, _stdRollData, item) => {
  if (!isPhysicianSkill(item)) return;
  if (!game.settings.get("hm3", "advancedPhysicianAutomation")) return;

  const key = physicianStateKey(actor, item);
  if (!key) return;
  const state = physicianRollStates.get(key);
  if (!state) return;

  if (state.phase === "ordinary") {
    state.phase = "resolved";
    return;
  }
  if (state.phase !== "rolling" || !state.action) return;

  state.phase = "consumed";
  const rollResult = {
    rollValue: Number(result?.rollValue),
    modifier: signedRollModifier(result)
  };
  const token = actor.isToken ? actor.token : null;

  void resolvePhysicianAction({
    healer: actor,
    physicianSkill: item,
    rollResult,
    token,
    action: state.action
  })
    .then(resolution => {
      state.result = resolution;
      state.phase = "resolved";
    })
    .catch(error => {
      state.phase = "resolved";
      console.error("HM3 | Physician action resolution failed", error);
      ui.notifications.error("The Physician action could not be resolved. See the console for details.");
    });
});
