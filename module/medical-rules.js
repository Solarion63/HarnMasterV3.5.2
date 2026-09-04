import { classifyTestRoll } from "./dice-rules.js";

export const BLEEDER_TREATMENT_MODIFIER = 50;
export const HEMOPHILIA_BLEEDING_MODIFIER = -40;
export const DIAGNOSIS_MS_TREATMENT_MODIFIER = 10;
export const DIAGNOSIS_CS_TREATMENT_MODIFIER = 30;
export const DIAGNOSIS_FAILURE_PENALTY_MIN = -30;
export const DIAGNOSIS_FAILURE_PENALTY_MAX = -10;

export function hasHemophilia(actor) {
  return actor?.itemTypes?.trait?.some(trait =>
    String(trait.name ?? "").toLowerCase().includes("hemophilia")
  ) ?? false;
}

export function bleederTreatmentModifier(patient) {
  return BLEEDER_TREATMENT_MODIFIER
    + (hasHemophilia(patient) ? HEMOPHILIA_BLEEDING_MODIFIER : 0);
}

function resultCode(result) {
  return result.isSuccess
    ? (result.isCritical ? "CS" : "MS")
    : (result.isCritical ? "CF" : "MF");
}

export function evaluatePhysicianDiagnosis({
  rollValue,
  physicianEML,
  additionalModifier = 0
}) {
  const situationalModifier = Number(additionalModifier) || 0;
  const result = classifyTestRoll({
    total: Number(rollValue),
    target: Number(physicianEML) || 0,
    modifier: situationalModifier,
    diceSides: 100
  });
  const code = resultCode(result);
  const treatmentModifier = code === "CS"
    ? DIAGNOSIS_CS_TREATMENT_MODIFIER
    : code === "MS"
      ? DIAGNOSIS_MS_TREATMENT_MODIFIER
      : null;

  return {
    ...result,
    rollValue: Number(rollValue),
    physicianEML: Number(physicianEML) || 0,
    situationalModifier,
    resultCode: code,
    treatmentModifier,
    failurePenaltyMin: result.isSuccess ? null : DIAGNOSIS_FAILURE_PENALTY_MIN,
    failurePenaltyMax: result.isSuccess ? null : DIAGNOSIS_FAILURE_PENALTY_MAX
  };
}

export function evaluateBleederTreatment({
  rollValue,
  physicianEML,
  patient,
  additionalModifier = 0
}) {
  const situationalModifier = Number(additionalModifier) || 0;
  const modifier = bleederTreatmentModifier(patient) + situationalModifier;
  const result = classifyTestRoll({
    total: Number(rollValue),
    target: Number(physicianEML) || 0,
    modifier,
    diceSides: 100
  });

  return {
    ...result,
    rollValue: Number(rollValue),
    physicianEML: Number(physicianEML) || 0,
    situationalModifier,
    treatmentModifier: BLEEDER_TREATMENT_MODIFIER,
    hemophiliaModifier: hasHemophilia(patient) ? HEMOPHILIA_BLEEDING_MODIFIER : 0,
    resultCode: resultCode(result)
  };
}
