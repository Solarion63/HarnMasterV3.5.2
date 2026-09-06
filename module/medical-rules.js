import { classifyTestRoll } from "./dice-rules.js";

export const BLEEDER_TREATMENT_MODIFIER = 50;
export const HEMOPHILIA_BLEEDING_MODIFIER = -40;
export const DIAGNOSIS_MS_TREATMENT_MODIFIER = 10;
export const DIAGNOSIS_CS_TREATMENT_MODIFIER = 30;
export const DIAGNOSIS_FAILURE_PENALTY_MIN = -30;
export const DIAGNOSIS_FAILURE_PENALTY_MAX = -10;
export const LATE_TREATMENT_PENALTY_PER_DAY = -5;

/**
 * HârnMaster 3.5.2 Physician 3 Treatment Table.
 *
 * `results` contains the result of the ONE Treatment Roll for an injury. Normal
 * entries produce a Healing Rate (or EE); Grievous Frost instead produces the
 * severity of the new amputation wound which must subsequently be treated.
 */
export const PHYSICIAN_TREATMENT_TABLE = Object.freeze({
  bruise: {
    label: "Bruise",
    description: "Welts/Swelling",
    procedure: "Compress",
    modifier: 30,
    results: { CF: "H4", MF: "H5", MS: "H6", CS: "EE" },
    duration: { type: "roll", formula: "5d6", unit: "minutes", secondsPerUnit: 60 }
  },
  fracture: {
    label: "Fracture",
    description: "Simple Fracture",
    procedure: "Splint",
    modifier: 20,
    results: { CF: "H3*", MF: "H4*", MS: "H5", CS: "H6" },
    duration: { type: "roll", formula: "5d6", unit: "minutes", secondsPerUnit: 60 }
  },
  crush: {
    label: "Crush",
    description: "Compound Fracture/Bleeder",
    procedure: "Surgery/Splint",
    modifier: 10,
    results: { CF: "H2*", MF: "H3*", MS: "H4", CS: "H5" },
    duration: { type: "combined", formulas: ["10d6", "5d6"], unit: "minutes", secondsPerUnit: 60 }
  },
  cutMinor: {
    label: "Minor Cut/Tear",
    description: "Cut/Gash 1–2 inches long",
    procedure: "Clean & Dress",
    modifier: 30,
    results: { CF: "H4", MF: "H5", MS: "H6", CS: "EE" },
    duration: { type: "injuryLevel", unitsPerLevel: 5, unit: "minutes", secondsPerUnit: 60 }
  },
  cutSerious: {
    label: "Serious Cut/Tear",
    description: "Cut/Gash 2–6 inches long",
    procedure: "Surgery",
    modifier: 20,
    results: { CF: "H3", MF: "H4", MS: "H5", CS: "H6" },
    duration: { type: "roll", formula: "10d6", unit: "minutes", secondsPerUnit: 60 }
  },
  cutGrievous: {
    label: "Grievous Cut/Tear",
    description: "Cut/Gash over 6 inches long/Bleeder",
    procedure: "Surgery",
    modifier: 10,
    results: { CF: "H2*", MF: "H3*", MS: "H4*", CS: "H5" },
    duration: { type: "roll", formula: "10d6", unit: "minutes", secondsPerUnit: 60 }
  },
  stabMinor: {
    label: "Minor Stab/Bite",
    description: "Puncture 1 inch deep",
    procedure: "Clean & Dress",
    modifier: 25,
    results: { CF: "H4", MF: "H5", MS: "H6", CS: "EE" },
    duration: { type: "injuryLevel", unitsPerLevel: 5, unit: "minutes", secondsPerUnit: 60 }
  },
  stabSerious: {
    label: "Serious Stab/Bite",
    description: "Puncture 3 inches deep",
    procedure: "Clean & Dress",
    modifier: 15,
    results: { CF: "H3", MF: "H4", MS: "H5", CS: "H6" },
    duration: { type: "injuryLevel", unitsPerLevel: 5, unit: "minutes", secondsPerUnit: 60 }
  },
  stabGrievous: {
    label: "Grievous Stab/Bite",
    description: "Deep Puncture/Bleeder",
    procedure: "Surgery",
    modifier: 5,
    results: { CF: "H2*", MF: "H3*", MS: "H4*", CS: "H5" },
    duration: { type: "roll", formula: "10d6", unit: "minutes", secondsPerUnit: 60 }
  },
  burnMinor: {
    label: "Minor Burn",
    description: "1st Degree Burn/Blisters",
    procedure: "Compress",
    modifier: 30,
    results: { CF: "H4", MF: "H5", MS: "H6", CS: "EE" },
    duration: { type: "roll", formula: "5d6", unit: "minutes", secondsPerUnit: 60 }
  },
  burnSerious: {
    label: "Serious Burn",
    description: "2nd Degree Burn/Open Wound",
    procedure: "Clean & Dress",
    modifier: 15,
    results: { CF: "H2", MF: "H3", MS: "H4", CS: "H5" },
    duration: { type: "injuryLevel", unitsPerLevel: 5, unit: "minutes", secondsPerUnit: 60 }
  },
  burnGrievous: {
    label: "Grievous Burn",
    description: "3rd Degree Burn/Charred Skin",
    procedure: "Clean & Dress",
    modifier: 5,
    results: { CF: "H1", MF: "H2", MS: "H3", CS: "H4" },
    duration: { type: "injuryLevel", unitsPerLevel: 5, unit: "minutes", secondsPerUnit: 60 }
  },
  frostMinor: {
    label: "Minor Frost",
    description: "Chilled Flesh/Shivering",
    procedure: "Warming",
    modifier: 50,
    results: { CF: "H4", MF: "H5", MS: "EE", CS: "EE" },
    duration: { type: "roll", formula: "1d3", unit: "hours", secondsPerUnit: 3600 }
  },
  frostSerious: {
    label: "Serious Frost",
    description: "2nd Degree Frostbite",
    procedure: "Warming",
    modifier: 25,
    results: { CF: "H3*", MF: "H4", MS: "H5", CS: "EE" },
    duration: { type: "roll", formula: "1d3", unit: "hours", secondsPerUnit: 3600 }
  },
  frostGrievous: {
    label: "Grievous Frost",
    description: "3rd Degree Frostbite",
    procedure: "Amputate",
    modifier: 10,
    results: { CF: "G5", MF: "G4", MS: "S3", CS: "S2" },
    duration: { type: "roll", formula: "10d6", unit: "minutes", secondsPerUnit: 60 },
    amputation: true
  }
});

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

function severityLetter(injury) {
  const severity = String(injury?.system?.severity ?? "").toUpperCase();
  if (["M", "S", "G"].includes(severity.charAt(0))) return severity.charAt(0);

  const level = Number(injury?.system?.injuryLevel) || 0;
  if (level <= 1) return "M";
  if (level <= 3) return "S";
  return "G";
}

function normalizedInjuryText(injury) {
  const aspect = injury?.getFlag?.("hm3", "injuryAspect") ?? injury?.flags?.hm3?.injuryAspect ?? "";
  return [aspect, injury?.system?.notes, injury?.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * Infer the appropriate Physician 3 Treatment Table row from HM3 Injury data.
 *
 * New v14 injuries store `flags.hm3.injuryAspect`; legacy injuries fall back to
 * their notes/name. The returned key is only a suggested default: the treatment
 * confirmation dialog permits changing it when a legacy/custom Injury is unclear.
 */
export function defaultPhysicianTreatmentKey(injury) {
  const severity = severityLetter(injury);
  const text = normalizedInjuryText(injury);
  const bySeverity = prefix => severity === "M"
    ? `${prefix}Minor`
    : severity === "S"
      ? `${prefix}Serious`
      : `${prefix}Grievous`;

  if (/frost|cold|freez/.test(text)) return bySeverity("frost");
  if (/pierc|stab|bite|point|impale|poke/.test(text)) return bySeverity("stab");
  if (/edg|slash|cut|tear|gash/.test(text)) return bySeverity("cut");
  if (/fire|burn|singe|scorch|scald/.test(text)) return bySeverity("burn");
  if (/blunt|impact|bruise|fracture|crush/.test(text)) {
    if (severity === "M") return "bruise";
    if (severity === "S") return "fracture";
    return "crush";
  }

  // Historical HM3 Injury Items may not preserve aspect as structured data.
  // Cut/Tear is the least-surprising visual default, but the dialog explicitly
  // exposes the table row so the user can correct an ambiguous legacy wound.
  return bySeverity("cut");
}

export function physicianTreatmentEntry(key) {
  return PHYSICIAN_TREATMENT_TABLE[key] ?? null;
}

export function healingRateNumber(result) {
  const match = String(result ?? "").match(/^H([0-6])\*?$/i);
  return match ? Number(match[1]) : null;
}

export function treatmentHasPermanentImpairment(result) {
  return String(result ?? "").includes("*");
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

export function evaluatePhysicianTreatment({
  rollValue,
  physicianEML,
  treatmentKey,
  diagnosisModifier = 0,
  equipmentModifier = 0,
  lateDays = 0,
  additionalModifier = 0
}) {
  const entry = physicianTreatmentEntry(treatmentKey);
  if (!entry) throw new Error(`Unknown Physician Treatment Table entry: ${treatmentKey}`);

  const diagnosis = Number(diagnosisModifier) || 0;
  const equipment = Number(equipmentModifier) || 0;
  const delayedDays = Math.max(0, Math.trunc(Number(lateDays) || 0));
  const lateModifier = delayedDays * LATE_TREATMENT_PENALTY_PER_DAY;
  const situationalModifier = Number(additionalModifier) || 0;
  const totalModifier = entry.modifier + diagnosis + equipment + lateModifier + situationalModifier;
  const result = classifyTestRoll({
    total: Number(rollValue),
    target: Number(physicianEML) || 0,
    modifier: totalModifier,
    diceSides: 100
  });
  const code = resultCode(result);
  const treatmentResult = entry.results[code];

  return {
    ...result,
    rollValue: Number(rollValue),
    physicianEML: Number(physicianEML) || 0,
    resultCode: code,
    treatmentKey,
    treatmentLabel: entry.label,
    procedure: entry.procedure,
    procedureModifier: entry.modifier,
    diagnosisModifier: diagnosis,
    equipmentModifier: equipment,
    lateDays: delayedDays,
    lateModifier,
    situationalModifier,
    totalModifier,
    treatmentResult,
    healingRate: healingRateNumber(treatmentResult),
    emergencyHealing: treatmentResult === "EE",
    permanentImpairment: treatmentHasPermanentImpairment(treatmentResult),
    amputation: Boolean(entry.amputation),
    amputationWound: entry.amputation ? treatmentResult : null
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
