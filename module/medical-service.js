import { BloodlossService } from "./bloodloss-service.js";
import { evaluateBleederTreatment, evaluatePhysicianDiagnosis } from "./medical-rules.js";

const SOCKET_NAMESPACE = "system.hm3";
const STOP_BLEEDING_REQUEST = "medical.stopBleeding";
const RECORD_DIAGNOSIS_REQUEST = "medical.recordDiagnosis";
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

function diagnosableInjury(patient, injuryId) {
  const injury = patient?.items?.get(injuryId) ?? null;
  if (!injury || injury.type !== "injury") return null;
  if (injury.getFlag("hm3", "bloodloss") === true) return null;
  if (injury.system?.isBloodloss === true) return null;
  if (String(injury.name).toLowerCase() === "bloodloss") return null;
  return injury;
}

async function applyStopBleeding({ patient, effect }) {
  if (!patient || !BloodlossService.isBleedingEffect(effect)) return false;
  return BloodlossService.stopBleeding(patient, effect);
}

async function applyDiagnosis({ healer, patient, injury, evaluation }) {
  if (!healer || !patient || !injury || !evaluation) return false;
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

    const injury = diagnosableInjury(patient, payload.injuryId);
    if (!injury) throw new Error("The requested injury is no longer available for diagnosis.");

    const evaluation = evaluatePhysicianDiagnosis({
      rollValue: payload.rollValue,
      physicianEML: Number(skill.system.effectiveMasteryLevel) || Number(skill.system.masteryLevel) || 0,
      additionalModifier: payload.additionalModifier
    });

    await applyDiagnosis({ healer, patient, injury, evaluation });
    const modifierText = evaluation.isSuccess
      ? `Treatment modifier ${evaluation.treatmentModifier >= 0 ? "+" : ""}${evaluation.treatmentModifier}.`
      : "Treatment penalty is -10 to -30 at GM discretion.";
    emitResponse(payload, true, `${patient.name}'s ${injury.name} diagnosis recorded (${evaluation.resultCode}). ${modifierText}`);
  } catch (error) {
    console.error("HM3 | Medical diagnosis socket request failed.", error);
    emitResponse(payload, false, error.message ?? "Medical diagnosis request failed.");
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

    const diagnosisInjury = diagnosableInjury(patient, injury.id);
    if (!diagnosisInjury) return { status: "invalid", changed: false };

    const evaluation = evaluatePhysicianDiagnosis({
      rollValue,
      physicianEML: Number(diagnosingSkill.system.effectiveMasteryLevel) || Number(diagnosingSkill.system.masteryLevel) || 0,
      additionalModifier
    });

    if (patient.isOwner || game.user.isGM) {
      const changed = await applyDiagnosis({ healer, patient, injury: diagnosisInjury, evaluation });
      return { status: changed ? "recorded" : "invalid", changed, evaluation };
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
}
