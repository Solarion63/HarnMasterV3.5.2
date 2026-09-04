import { BloodlossService } from "./bloodloss-service.js";
import { evaluateBleederTreatment, evaluatePhysicianDiagnosis } from "./medical-rules.js";
import { MedicalService } from "./medical-service.js";
import { physicianDiagnosisChooserLabel } from "./physician-diagnosis-presentation-v14.js";

const { DialogV2 } = foundry.applications.api;

/**
 * Tracks the system-owned Physician workflow across the generic Skill-roll hooks.
 *
 * HM3's historical Skill macro runs after the dice have already been rolled. For
 * Physician automation we need to know the patient and wound first. The pre-roll
 * hook therefore cancels the first generic roll request, prepares the medical
 * action asynchronously, then re-enters the ordinary Skill roller with a ready
 * action. The normal HM3 roll dialog/card remains authoritative for the actual
 * Physician test.
 */
const physicianRollStates = new Map();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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
  return Array.from(patient?.itemTypes?.injury ?? []).filter(injury => !isBloodlossInjury(injury));
}

function undiagnosedInjuries(patient) {
  return recordedInjuries(patient).filter(injury =>
    injury.getFlag("hm3", "physicianDiagnosis") == null
  );
}

function signedRollModifier(rollResult) {
  const modifier = Number(rollResult?.modifier) || 0;
  if (rollResult?.plusMinus === "-") return -Math.abs(modifier);
  if (rollResult?.plusMinus === "+") return Math.abs(modifier);
  return modifier;
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
      <p class="hint">Choose which of ${escapeHtml(patient.name)}'s bleeding wounds is being treated before making the Physician roll.</p>
    </div>`;

  const effectId = await DialogV2.prompt({
    window: { title: `Treat ${patient.name}'s Bleeding` },
    content,
    ok: {
      label: "Select Wound",
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
    `<option value="${escapeHtml(injury.id)}">${escapeHtml(physicianDiagnosisChooserLabel(injury))}</option>`
  ).join("");
  const content = `
    <div class="form-group">
      <label>Injury to diagnose</label>
      <select name="diagnosisInjury">${options}</select>
      <p class="hint">Choose which undiagnosed injury is being examined before making the Physician roll.</p>
    </div>`;

  const injuryId = await DialogV2.prompt({
    window: { title: `Diagnose ${patient.name}` },
    content,
    ok: {
      label: "Select Injury",
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
  if (diagnosis?.status === "already-diagnosed") {
    return "This injury had already been diagnosed; the new result was not recorded.";
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
          <p><strong>Physician roll:</strong> ${evaluation.rollValue} — ${evaluation.resultCode}</p>
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
  const persisted = ["recorded", "requested"].includes(diagnosis?.status);
  const recordText = persisted
    ? `Diagnosis recorded on ${injury.name}.`
    : "Diagnosis was not recorded on the injury.";

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
          <p><strong>Physician roll:</strong> ${evaluation.rollValue} — ${evaluation.resultCode}</p>
          <p><strong>${escapeHtml(outcome)}</strong></p>
          <p><em>${escapeHtml(recordText)}</em></p>
        </div>
      </div>`
  });
}

/**
 * Inspect a targeted patient and select the medical action before dice are rolled.
 *
 * A null target deliberately means an ordinary Physician Skill roll. A targeted
 * patient is different: invalid/complete medical states stop the roll entirely so
 * the user does not spend a roll on an action that cannot be performed.
 */
export async function preparePhysicianAction({ healer, physicianSkill } = {}) {
  if (!game.settings.get("hm3", "advancedPhysicianAutomation")) {
    return { status: "ordinary", action: null };
  }
  if (!healer || !isPhysicianSkill(physicianSkill)) {
    return { status: "ordinary", action: null };
  }

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
      action: { type: "bleeding", patient, effect }
    };
  }

  const injuries = recordedInjuries(patient);
  if (!injuries.length) {
    ui.notifications.info(`${patient.name} has no injuries.`);
    return { status: "cancelled", action: null, reason: "no-injuries" };
  }

  const availableInjuries = injuries.filter(injury =>
    injury.getFlag("hm3", "physicianDiagnosis") == null
  );
  if (!availableInjuries.length) {
    ui.notifications.info(`All recorded injuries on ${patient.name} have already been diagnosed.`);
    return { status: "cancelled", action: null, reason: "all-diagnosed" };
  }

  const injury = await chooseDiagnosisInjury(patient, availableInjuries);
  if (!injury) return { status: "cancelled", action: null, reason: "selection-cancelled" };

  return {
    status: "prepared",
    action: { type: "diagnosis", patient, injury }
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

  await treatmentChatMessage({ healer, patient, effect, evaluation, treatment });
  return { healer, patient, effect, evaluation, treatment, stopped: treatment.changed, token };
}

export async function resolvePhysicianAction({
  healer,
  physicianSkill,
  rollResult,
  token = null,
  action
} = {}) {
  if (!healer || !isPhysicianSkill(physicianSkill) || !rollResult || !action) return null;

  if (action.type === "diagnosis") {
    return resolveDiagnosisAction({ healer, physicianSkill, rollResult, token, action });
  }
  if (action.type === "bleeding") {
    return resolveBleedingAction({ healer, physicianSkill, rollResult, token, action });
  }
  return null;
}

/**
 * Compatibility entry point used by existing Physician Item macros.
 *
 * System-managed Physician rolls are now prepared before the roll and resolved
 * from the Skill-roll hook below. When such a state exists, this legacy launcher
 * intentionally does nothing so it cannot diagnose/treat the same wound twice.
 * Direct callers without a prepared state retain the old post-roll compatibility
 * behavior, including the new no-injury/already-diagnosed guards.
 */
export async function physicianTreatment({ healer, physicianSkill, rollResult, token = null } = {}) {
  if (!game.settings.get("hm3", "advancedPhysicianAutomation")) return null;
  if (!healer || !isPhysicianSkill(physicianSkill) || !rollResult) return null;

  const key = physicianStateKey(healer, physicianSkill);
  if (key && physicianRollStates.has(key)) {
    return physicianRollStates.get(key)?.result ?? null;
  }

  const prepared = await preparePhysicianAction({ healer, physicianSkill });
  if (prepared.status !== "prepared") return null;
  return resolvePhysicianAction({
    healer,
    physicianSkill,
    rollResult,
    token,
    action: prepared.action
  });
}

/**
 * Intercept targeted Physician tests before the generic Skill roller opens its
 * roll dialog. The initial call is cancelled while the patient/wound is selected;
 * then the same generic Skill roller is invoked once with a prepared action.
 */
Hooks.on("hm3.preSkillRoll", (stdRollData, actor, item) => {
  if (!isPhysicianSkill(item)) return true;
  if (!game.settings.get("hm3", "advancedPhysicianAutomation")) return true;

  const key = physicianStateKey(actor, item);
  if (!key) return true;

  const existing = physicianRollStates.get(key);
  if (existing?.phase === "ready") {
    existing.phase = "rolling";
    return true;
  }
  if (["preparing", "rolling"].includes(existing?.phase)) {
    ui.notifications.info("A Physician action is already in progress.");
    return false;
  }
  if (existing) physicianRollStates.delete(key);

  const target = targetedPatient();
  if (!target.patient && !target.multiple) {
    // Preserve an ordinary no-target Physician test, but retain a state marker so
    // the historical post-roll Item macro cannot turn it into treatment if the
    // user's target selection changes while the roll dialog is open.
    physicianRollStates.set(key, {
      phase: "ordinary",
      actor,
      item,
      action: null,
      result: null
    });
    return true;
  }
  if (target.multiple) {
    ui.notifications.warn("Target exactly one patient to use automated Physician treatment or diagnosis.");
    physicianRollStates.set(key, {
      phase: "cancelled",
      actor,
      item,
      action: null,
      result: null
    });
    return false;
  }

  const state = {
    phase: "preparing",
    actor,
    item,
    action: null,
    result: null
  };
  physicianRollStates.set(key, state);

  void preparePhysicianAction({ healer: actor, physicianSkill: item })
    .then(prepared => {
      if (physicianRollStates.get(key) !== state) return null;
      if (prepared.status !== "prepared") {
        state.phase = "cancelled";
        return null;
      }

      state.action = prepared.action;
      state.phase = "ready";
      const roller = game.hm3?.macros?.skillRoll;
      if (typeof roller !== "function") {
        state.phase = "cancelled";
        ui.notifications.error("The HM3 Skill roller is unavailable.");
        return null;
      }
      return roller(item.uuid, Boolean(stdRollData.fastforward), actor);
    })
    .catch(error => {
      state.phase = "cancelled";
      console.error("HM3 | Physician pre-roll preparation failed", error);
      ui.notifications.error("The Physician action could not be prepared. See the console for details.");
    });

  return false;
});

/**
 * Resolve the already-selected Physician action after the ordinary HM3 Skill
 * roller has produced its result. This hook is system-owned, so diagnosis works
 * even for migrated Physician Items whose historical custom macro is blank.
 */
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

  // The prepared action has now consumed its Physician roll. It must no longer
  // block a subsequent Physician use while document updates/chat presentation
  // finish asynchronously. The medical service independently rejects attempts
  // to overwrite an already-recorded diagnosis or an inactive Bleeder effect.
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
