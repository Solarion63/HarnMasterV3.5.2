import { BloodlossService } from "./bloodloss-service.js";
import { evaluateBleederTreatment } from "./medical-rules.js";

const SOCKET_NAMESPACE = "system.hm3";
const STOP_BLEEDING_REQUEST = "medical.stopBleeding";
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

async function applyStopBleeding({ patient, effect }) {
  if (!patient || !BloodlossService.isBleedingEffect(effect)) return false;
  return BloodlossService.stopBleeding(patient, effect);
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
}
