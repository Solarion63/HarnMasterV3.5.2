import { classifyTestRoll } from "./dice-rules.js";

export const BLEEDER_TREATMENT_MODIFIER = 50;
export const HEMOPHILIA_BLEEDING_MODIFIER = -40;

export function hasHemophilia(actor) {
  return actor?.itemTypes?.trait?.some(trait =>
    String(trait.name ?? "").toLowerCase().includes("hemophilia")
  ) ?? false;
}

export function bleederTreatmentModifier(patient) {
  return BLEEDER_TREATMENT_MODIFIER
    + (hasHemophilia(patient) ? HEMOPHILIA_BLEEDING_MODIFIER : 0);
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
    resultCode: result.isSuccess
      ? (result.isCritical ? "CS" : "MS")
      : (result.isCritical ? "CF" : "MF")
  };
}
