import { BloodlossService } from "./bloodloss-service.js";
import {
  DIAGNOSIS_FAILURE_PENALTY_MAX,
  DIAGNOSIS_FAILURE_PENALTY_MIN,
  evaluateBleederTreatment,
  evaluatePhysicianDiagnosis,
  evaluatePhysicianTreatment,
  physicianTreatmentEntry
} from "./medical-rules.js";

const SOCKET_NAMESPACE = "system.hm3";
const STOP_BLEEDING_REQUEST = "medical.stopBleeding";
const RECORD_DIAGNOSIS_REQUEST = "medical.recordDiagnosis";
const RECORD_TREATMENT_REQUEST = "medical.recordTreatment";
const MEDICAL_RESPONSE = "medical.response";
let socketRegistered = false;

function activeGmOwnsMedicalRequests() {
  if (!game.user?.isGM) return false;
  const activeGms = game.users
    ?.filter(user => user.active && user.isGM)
    ?.sort((left, right) => String(left.id).localeCompare(String(right.id))) ?? [];
  return activeGms[0]?.id === game.user.id;
}

function hasActiveGm() {
  return game.users?.some(user => user.active && user.isGM) ?? false;
}

async function actorFromUuid(uuid) {
  if (!uuid) return null;
  const document = await fromUuid(uuid);
  if (!document) return null;
  if (document.documentName === "Actor") return document;
  return document.actor ?? null;
}

function physicianSkill(actor, skillId = null) {
  if (!actor) return null;
  if (skillId) {
    const skill = actor.items.get(skillId);
    if (skill?.type === "skill" && String(skill.name).toLowerCase() === "physician") return skill;
  }
  return actor.itemTypes?.skill?.find(skill =>
    String(skill.name).toLowerCase() === "physician"
  ) ?? null;
}

function userOwnsActor(user, actor) {
  if (!user || !actor) return false;
  if (user.isGM) return true;
  if (typeof actor.testUserPermission === "function") {
    return actor.testUserPermission(user, "OWNER");
  }
  return false;
}

function medicalInjury(patient, injuryId) {
  const injury = patient?.items?.get(injuryId) ?? null;
  if (!injury || injury.type !== "injury") return null;
  if (injury.getFlag("hm3", "bloodloss") === true) return null;
  if (injury.system?.isBloodloss === true) return null;
  if (String(injury.name).toLowerCase() === "bloodloss") return null;
  return injury;
}

function hasPhysicianDiagnosis(injury) {
  return injury?.getFlag("hm3", "physicianDiagnosis") != null;
}

function hasPhysicianTreatment(injury) {
  if (!injury) return false;
  if (injury.getFlag("hm3", "physicianTreatment") != null) return true;

  // Compatibility with the historical standalone treatment macro. The new
  // system-owned workflow never writes this legacy flag, but respecting it
  // prevents an imported/macro-treated Injury from receiving a second roll.
  const legacyTreated = injury.getFlag("hm3", "treated");
  return legacyTreated === true || String(legacyTreated).toLowerCase() === "treated";
}

function diagnosisModifierForTreatment(injury, requestedFailurePenalty = null) {
  const diagnosis = injury?.getFlag("hm3", "physicianDiagnosis") ?? null;
  if (!diagnosis) return 0;

  const code = String(diagnosis.resultCode ?? "").toUpperCase();
  if (["MS", "CS"].includes(code)) return Number(diagnosis.treatmentModifier) || 0;

  if (["MF", "CF"].includes(code)) {
    const penalty = Number(requestedFailurePenalty);
    if (!Number.isFinite(penalty)
      || penalty < DIAGNOSIS_FAILURE_PENALTY_MIN
      || penalty > DIAGNOSIS_FAILURE_PENALTY_MAX) {
      throw new Error("Failed diagnosis requires a GM-selected Treatment penalty from -30 to -10 EML.");
    }
    return Math.trunc(penalty);
  }

  return 0;
}

function sanitizeInteger(value, { min, max, label }) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} must be a number.`);
  const integer = Math.trunc(number);
  if (integer < min || integer > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }
  return integer;
}

function sanitizeDuration(duration) {
  if (!duration || typeof duration !== "object") return { seconds: 0, text: "" };
  const seconds = sanitizeInteger(duration.seconds ?? 0, {
    min: 0,
    max: 60 * 60 * 24,
    label: "Treatment duration"
  });
  return {
    seconds,
    text: String(duration.text ?? "").slice(0, 160)
  };
}

async function applyStopBleeding({ patient, effect }) {
  if (!patient || !BloodlossService.isBleedingEffect(effect)) return false;
  return BloodlossService.stopBleeding(patient, effect);
}

async function applyDiagnosis({ healer, patient, injury, evaluation }) {
  if (!healer || !patient || !injury || !evaluation) return false;
  if (hasPhysicianDiagnosis(injury)) return false;

  await injury.setFlag("hm3", "physicianDiagnosis", {
    healerUuid: healer.uuid,
    healerName: healer.name,
    resultCode: evaluation.resultCode,
    rollValue: evaluation.rollValue,
    physicianEML: evaluation.physicianEML,
    situationalModifier: evaluation.situationalModifier,
    treatmentModifier: evaluation.treatmentModifier,
    failurePenaltyMin: evaluation.failurePenaltyMin,
    failurePenaltyMax: evaluation.failurePenaltyMax,
    diagnosedAt: Number(game.time?.worldTime) || 0
  });
  return true;
}

async function applyTreatment({ healer, patient, injury, evaluation, duration }) {
  if (!healer || !patient || !injury || !evaluation) return false;
  if (hasPhysicianTreatment(injury)) return false;

  const treatment = {
    healerUuid: healer.uuid,
    healerName: healer.name,
    resultCode: evaluation.resultCode,
    rollValue: evaluation.rollValue,
    physicianEML: evaluation.physicianEML,
    treatmentKey: evaluation.treatmentKey,
    treatmentLabel: evaluation.treatmentLabel,
    procedure: evaluation.procedure,
    procedureModifier: evaluation.procedureModifier,
    diagnosisModifier: evaluation.diagnosisModifier,
    equipmentModifier: evaluation.equipmentModifier,
    lateDays: evaluation.lateDays,
    lateModifier: evaluation.lateModifier,
    situationalModifier: evaluation.situationalModifier,
    totalModifier: evaluation.totalModifier,
    modifiedTarget: evaluation.target,
    treatmentResult: evaluation.treatmentResult,
    healingRate: evaluation.healingRate,
    emergencyHealing: evaluation.emergencyHealing,
    permanentImpairment: evaluation.permanentImpairment,
    amputation: evaluation.amputation,
    amputationWound: evaluation.amputationWound,
    durationSeconds: duration.seconds,
    durationText: duration.text,
    treatedAt: Number(game.time?.worldTime) || 0
  };

  const update = { "flags.hm3.physicianTreatment": treatment };
  if (evaluation.healingRate != null) update["system.healRate"] = evaluation.healingRate;
  await injury.update(update);
  return true;
}

function emitResponse(payload, ok, message) {
  game.socket.emit(SOCKET_NAMESPACE, {
    type: MEDICAL_RESPONSE,
    requestId: payload.requestId,
    requesterId: payload.requesterId,
    ok,
    message
  });
}

async function handleStopBleedingRequest(payload) {
  if (!activeGmOwnsMedicalRequests()) return;

  try {
    const requester = game.users.get(payload.requesterId);
    if (!requester) throw new Error("Requesting user could not be found.");

    const healer = await actorFromUuid(payload.healerUuid);
    const patient = await actorFromUuid(payload.patientUuid);
    if (!healer || !patient) throw new Error("Healer or patient could not be resolved.");
    if (!userOwnsActor(requester, healer)) {
      throw new Error("Requesting user does not own the treating actor.");
    }

    const skill = physicianSkill(healer, payload.physicianSkillId);
    if (!skill) throw new Error(`${healer.name} does not have the Physician skill.`);

    const effect = patient.effects.get(payload.effectId);
    if (!BloodlossService.isBleedingEffect(effect)) {
      throw new Error("The requested bleeding injury is no longer active.");
    }

    const evaluation = evaluateBleederTreatment({
      rollValue: payload.rollValue,
      physicianEML: Number(skill.system.effectiveMasteryLevel) || Number(skill.system.masteryLevel) || 0,
      patient,
      additionalModifier: payload.additionalModifier
    });
    if (!evaluation.isSuccess) {
      throw new Error("The submitted Physician roll does not successfully stop this bleeding injury.");
    }

    await applyStopBleeding({ patient, effect });
    emitResponse(payload, true, `${patient.name}'s bleeding from ${effect.name.replace(/^Bleeding Injury — /, "")} has been stopped.`);
  } catch (error) {
    console.error("HM3 | Medical socket request failed.", error);
    emitResponse(payload, false, error.message ?? "Medical treatment request failed.");
  }
}

async function handleDiagnosisRequest(payload) {
  if (!activeGmOwnsMedicalRequests()) return;

  try {
    const requester = game.users.get(payload.requesterId);
    if (!requester) throw new Error("Requesting user could not be found.");

    const healer = await actorFromUuid(payload.healerUuid);
    const patient = await actorFromUuid(payload.patientUuid);
    if (!healer || !patient) throw new Error("Healer or patient could not be resolved.");
    if (!userOwnsActor(requester, healer)) {
      throw new Error("Requesting user does not own the diagnosing actor.");
    }

    const skill = physicianSkill(healer, payload.physicianSkillId);
    if (!skill) throw new Error(`${healer.name} does not have the Physician skill.`);

    const injury = medicalInjury(patient, payload.injuryId);
    if (!injury) throw new Error("The requested injury is no longer available for diagnosis.");
    if (hasPhysicianDiagnosis(injury)) {
      throw new Error(`${patient.name}'s ${injury.name} has already been diagnosed.`);
    }

    const evaluation = evaluatePhysicianDiagnosis({
      rollValue: payload.rollValue,
      physicianEML: Number(skill.system.effectiveMasteryLevel) || Number(skill.system.masteryLevel) || 0,
      additionalModifier: payload.additionalModifier
    });

    const changed = await applyDiagnosis({ healer, patient, injury, evaluation });
    if (!changed) throw new Error(`${patient.name}'s ${injury.name} has already been diagnosed.`);

    const modifierText = evaluation.isSuccess
      ? `Treatment modifier ${evaluation.treatmentModifier >= 0 ? "+" : ""}${evaluation.treatmentModifier}.`
      : "Treatment penalty is -10 to -30 at GM discretion.";
    emitResponse(payload, true, `${patient.name}'s ${injury.name} diagnosis recorded (${evaluation.resultCode}). ${modifierText}`);
  } catch (error) {
    console.error("HM3 | Medical diagnosis socket request failed.", error);
    emitResponse(payload, false, error.message ?? "Medical diagnosis request failed.");
  }
}

async function handleTreatmentRequest(payload) {
  if (!activeGmOwnsMedicalRequests()) return;

  try {
    const requester = game.users.get(payload.requesterId);
    if (!requester) throw new Error("Requesting user could not be found.");

    const healer = await actorFromUuid(payload.healerUuid);
    const patient = await actorFromUuid(payload.patientUuid);
    if (!healer || !patient) throw new Error("Healer or patient could not be resolved.");
    if (!userOwnsActor(requester, healer)) {
      throw new Error("Requesting user does not own the treating actor.");
    }
    if (BloodlossService.bleedingEffects(patient).length) {
      throw new Error(`${patient.name}'s bleeding must be stopped before normal wounds can be treated.`);
    }

    const skill = physicianSkill(healer, payload.physicianSkillId);
    if (!skill) throw new Error(`${healer.name} does not have the Physician skill.`);

    const injury = medicalInjury(patient, payload.injuryId);
    if (!injury) throw new Error("The requested injury is no longer available for treatment.");
    if (hasPhysicianTreatment(injury)) {
      throw new Error(`${patient.name}'s ${injury.name} has already received its one Treatment Roll.`);
    }
    if (!physicianTreatmentEntry(payload.treatmentKey)) {
      throw new Error("The selected Treatment Table entry is invalid.");
    }

    const diagnosisModifier = diagnosisModifierForTreatment(injury, payload.diagnosisFailurePenalty);
    const equipmentModifier = sanitizeInteger(payload.equipmentModifier ?? 0, {
      min: -100,
      max: 100,
      label: "Equipment/supplies modifier"
    });
    const lateDays = sanitizeInteger(payload.lateDays ?? 0, {
      min: 0,
      max: 3650,
      label: "Delayed-treatment days"
    });
    const evaluation = evaluatePhysicianTreatment({
      rollValue: payload.rollValue,
      physicianEML: Number(skill.system.effectiveMasteryLevel) || Number(skill.system.masteryLevel) || 0,
      treatmentKey: payload.treatmentKey,
      diagnosisModifier,
      equipmentModifier,
      lateDays,
      additionalModifier: payload.additionalModifier
    });
    const duration = sanitizeDuration(payload.duration);
    const changed = await applyTreatment({ healer, patient, injury, evaluation, duration });
    if (!changed) throw new Error(`${patient.name}'s ${injury.name} has already received its one Treatment Roll.`);

    emitResponse(
      payload,
      true,
      `${patient.name}'s ${injury.name} treatment recorded (${evaluation.resultCode} → ${evaluation.treatmentResult}).`
    );
  } catch (error) {
    console.error("HM3 | Medical treatment socket request failed.", error);
    emitResponse(payload, false, error.message ?? "Medical wound-treatment request failed.");
  }
}

function handleMedicalResponse(payload) {
  if (payload.requesterId !== game.user?.id) return;
  if (payload.ok) ui.notifications.info(payload.message);
  else ui.notifications.error(payload.message);
}

async function onSocketMessage(payload) {
  if (!payload || typeof payload !== "object") return;
  if (payload.type === STOP_BLEEDING_REQUEST) {
    await handleStopBleedingRequest(payload);
    return;
  }
  if (payload.type === RECORD_DIAGNOSIS_REQUEST) {
    await handleDiagnosisRequest(payload);
    return;
  }
  if (payload.type === RECORD_TREATMENT_REQUEST) {
    await handleTreatmentRequest(payload);
    return;
  }
  if (payload.type === MEDICAL_RESPONSE) handleMedicalResponse(payload);
}

export class MedicalService {
  static registerSocket() {
    if (socketRegistered) return;
    game.socket.on(SOCKET_NAMESPACE, payload => {
      onSocketMessage(payload).catch(error =>
        console.error("HM3 | Medical socket handler failed.", error)
      );
    });
    socketRegistered = true;
  }

  static async stopBleeding({
    healer,
    patient,
    effect,
    physicianSkill: skill,
    rollValue,
    additionalModifier = 0
  }) {
    if (!healer || !patient || !BloodlossService.isBleedingEffect(effect)) {
      return { status: "invalid", changed: false };
    }

    const treatingSkill = skill ?? physicianSkill(healer);
    if (!treatingSkill) {
      ui.notifications.warn(`${healer.name} does not have the Physician skill.`);
      return { status: "invalid", changed: false };
    }

    const evaluation = evaluateBleederTreatment({
      rollValue,
      physicianEML: Number(treatingSkill.system.effectiveMasteryLevel) || Number(treatingSkill.system.masteryLevel) || 0,
      patient,
      additionalModifier
    });
    if (!evaluation.isSuccess) return { status: "failed", changed: false };

    if (patient.isOwner || game.user.isGM) {
      const changed = await applyStopBleeding({ patient, effect });
      return { status: changed ? "stopped" : "invalid", changed };
    }

    if (!hasActiveGm()) {
      ui.notifications.error(`An active GM is required for ${healer.name} to treat ${patient.name}, because you do not own the patient actor.`);
      return { status: "unavailable", changed: false };
    }

    game.socket.emit(SOCKET_NAMESPACE, {
      type: STOP_BLEEDING_REQUEST,
      requestId: foundry.utils.randomID(),
      requesterId: game.user.id,
      healerUuid: healer.uuid,
      patientUuid: patient.uuid,
      physicianSkillId: treatingSkill.id,
      effectId: effect.id,
      rollValue: Number(rollValue),
      additionalModifier: Number(additionalModifier) || 0
    });
    ui.notifications.info(`Successful treatment roll sent to the GM to stop ${patient.name}'s bleeding.`);
    return { status: "requested", changed: false };
  }

  static async recordDiagnosis({
    healer,
    patient,
    injury,
    physicianSkill: skill,
    rollValue,
    additionalModifier = 0
  }) {
    if (!healer || !patient || !injury) return { status: "invalid", changed: false };

    const diagnosingSkill = skill ?? physicianSkill(healer);
    if (!diagnosingSkill) {
      ui.notifications.warn(`${healer.name} does not have the Physician skill.`);
      return { status: "invalid", changed: false };
    }

    const diagnosisInjury = medicalInjury(patient, injury.id);
    if (!diagnosisInjury) return { status: "invalid", changed: false };
    if (hasPhysicianDiagnosis(diagnosisInjury)) {
      ui.notifications.info(`${patient.name}'s ${diagnosisInjury.name} has already been diagnosed.`);
      return { status: "already-diagnosed", changed: false };
    }

    const evaluation = evaluatePhysicianDiagnosis({
      rollValue,
      physicianEML: Number(diagnosingSkill.system.effectiveMasteryLevel) || Number(diagnosingSkill.system.masteryLevel) || 0,
      additionalModifier
    });

    if (patient.isOwner || game.user.isGM) {
      const changed = await applyDiagnosis({ healer, patient, injury: diagnosisInjury, evaluation });
      return {
        status: changed ? "recorded" : "already-diagnosed",
        changed,
        evaluation
      };
    }

    if (!hasActiveGm()) {
      ui.notifications.error(`An active GM is required for ${healer.name} to diagnose ${patient.name}, because you do not own the patient actor.`);
      return { status: "unavailable", changed: false, evaluation };
    }

    game.socket.emit(SOCKET_NAMESPACE, {
      type: RECORD_DIAGNOSIS_REQUEST,
      requestId: foundry.utils.randomID(),
      requesterId: game.user.id,
      healerUuid: healer.uuid,
      patientUuid: patient.uuid,
      physicianSkillId: diagnosingSkill.id,
      injuryId: diagnosisInjury.id,
      rollValue: Number(rollValue),
      additionalModifier: Number(additionalModifier) || 0
    });
    ui.notifications.info(`Diagnosis result sent to the GM for ${patient.name}'s ${diagnosisInjury.name}.`);
    return { status: "requested", changed: false, evaluation };
  }

  static async recordTreatment({
    healer,
    patient,
    injury,
    physicianSkill: skill,
    treatmentKey,
    diagnosisFailurePenalty = null,
    equipmentModifier = 0,
    lateDays = 0,
    rollValue,
    additionalModifier = 0,
    duration = null
  }) {
    if (!healer || !patient || !injury) return { status: "invalid", changed: false };

    const treatingSkill = skill ?? physicianSkill(healer);
    if (!treatingSkill) {
      ui.notifications.warn(`${healer.name} does not have the Physician skill.`);
      return { status: "invalid", changed: false };
    }
    if (BloodlossService.bleedingEffects(patient).length) {
      ui.notifications.warn(`${patient.name}'s bleeding must be stopped before normal wounds can be treated.`);
      return { status: "bleeding", changed: false };
    }

    const treatmentInjury = medicalInjury(patient, injury.id);
    if (!treatmentInjury) return { status: "invalid", changed: false };
    if (hasPhysicianTreatment(treatmentInjury)) {
      ui.notifications.info(`${patient.name}'s ${treatmentInjury.name} has already received its one Treatment Roll.`);
      return { status: "already-treated", changed: false };
    }
    if (!physicianTreatmentEntry(treatmentKey)) {
      ui.notifications.error("The selected Treatment Table entry is invalid.");
      return { status: "invalid", changed: false };
    }

    let diagnosisModifier;
    try {
      diagnosisModifier = diagnosisModifierForTreatment(treatmentInjury, diagnosisFailurePenalty);
    } catch (error) {
      ui.notifications.warn(error.message);
      return { status: "invalid", changed: false };
    }

    const safeEquipmentModifier = Math.trunc(Number(equipmentModifier) || 0);
    const safeLateDays = Math.max(0, Math.trunc(Number(lateDays) || 0));
    const evaluation = evaluatePhysicianTreatment({
      rollValue,
      physicianEML: Number(treatingSkill.system.effectiveMasteryLevel) || Number(treatingSkill.system.masteryLevel) || 0,
      treatmentKey,
      diagnosisModifier,
      equipmentModifier: safeEquipmentModifier,
      lateDays: safeLateDays,
      additionalModifier
    });
    const safeDuration = sanitizeDuration(duration);

    if (patient.isOwner || game.user.isGM) {
      const changed = await applyTreatment({
        healer,
        patient,
        injury: treatmentInjury,
        evaluation,
        duration: safeDuration
      });
      return {
        status: changed ? "recorded" : "already-treated",
        changed,
        evaluation
      };
    }

    if (!hasActiveGm()) {
      ui.notifications.error(`An active GM is required for ${healer.name} to treat ${patient.name}, because you do not own the patient actor.`);
      return { status: "unavailable", changed: false, evaluation };
    }

    game.socket.emit(SOCKET_NAMESPACE, {
      type: RECORD_TREATMENT_REQUEST,
      requestId: foundry.utils.randomID(),
      requesterId: game.user.id,
      healerUuid: healer.uuid,
      patientUuid: patient.uuid,
      physicianSkillId: treatingSkill.id,
      injuryId: treatmentInjury.id,
      treatmentKey,
      diagnosisFailurePenalty: diagnosisFailurePenalty == null ? null : Number(diagnosisFailurePenalty),
      equipmentModifier: safeEquipmentModifier,
      lateDays: safeLateDays,
      rollValue: Number(rollValue),
      additionalModifier: Number(additionalModifier) || 0,
      duration: safeDuration
    });
    ui.notifications.info(`Treatment result sent to the GM for ${patient.name}'s ${treatmentInjury.name}.`);
    return { status: "requested", changed: false, evaluation };
  }
}
