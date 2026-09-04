const RESULT_LABELS = Object.freeze({
  CS: "Critical Success",
  MS: "Marginal Success",
  MF: "Marginal Failure",
  CF: "Critical Failure"
});

function diagnosisData(injury) {
  if (!injury) return null;
  if (typeof injury.getFlag === "function") {
    return injury.getFlag("hm3", "physicianDiagnosis") ?? null;
  }
  return injury.flags?.hm3?.physicianDiagnosis ?? null;
}

function isBloodlossInjury(injury) {
  if (!injury || injury.type !== "injury") return false;
  if (typeof injury.getFlag === "function" && injury.getFlag("hm3", "bloodloss") === true) return true;
  if (injury.flags?.hm3?.bloodloss === true) return true;
  if (injury.system?.isBloodloss === true) return true;
  return String(injury.name ?? "").toLowerCase() === "bloodloss";
}

function signedModifier(value) {
  const number = Number(value) || 0;
  return `${number >= 0 ? "+" : ""}${number}`;
}

/**
 * Convert the persistent Physician diagnosis flag into presentation-only text.
 *
 * The Injury flag remains the authoritative state. These strings are derived at
 * render time so diagnosis text never pollutes or duplicates user-editable
 * Injury notes.
 */
export function physicianDiagnosisPresentation(injury) {
  const diagnosis = diagnosisData(injury);
  if (!diagnosis) return null;

  const resultCode = String(diagnosis.resultCode ?? "").toUpperCase();
  const resultLabel = RESULT_LABELS[resultCode] ?? (resultCode || "Unknown");
  const healerName = String(diagnosis.healerName ?? "Unknown physician");
  const isSuccess = ["CS", "MS"].includes(resultCode);

  if (isSuccess) {
    const treatmentModifier = Number(diagnosis.treatmentModifier) || 0;
    const modifierText = `${signedModifier(treatmentModifier)} Treatment`;
    return {
      diagnosis,
      resultCode,
      resultLabel,
      healerName,
      isSuccess,
      treatmentModifier,
      compactStatus: `Diagnosed: ${resultCode} (${modifierText}) — ${healerName}`,
      chooserStatus: `Diagnosed ${resultCode} (${signedModifier(treatmentModifier)}) by ${healerName}`,
      treatmentLabel: `${signedModifier(treatmentModifier)} EML`
    };
  }

  const minimum = Math.abs(Number(diagnosis.failurePenaltyMin) || 10);
  const maximum = Math.abs(Number(diagnosis.failurePenaltyMax) || 30);
  const penaltyText = `-${minimum} to -${maximum}`;
  return {
    diagnosis,
    resultCode,
    resultLabel,
    healerName,
    isSuccess,
    treatmentModifier: null,
    compactStatus: `Diagnosis: ${resultCode} (${penaltyText} Treatment, GM) — ${healerName}`,
    chooserStatus: `Diagnosis ${resultCode} (${penaltyText}) by ${healerName}`,
    treatmentLabel: `${penaltyText} EML (GM discretion)`
  };
}

export function physicianDiagnosisChooserLabel(injury) {
  const presentation = physicianDiagnosisPresentation(injury);
  return presentation
    ? `${injury.name} — ${presentation.chooserStatus}`
    : `${injury.name} — Not diagnosed`;
}

function appendDiagnosisToActorInjuryNotes(app, element) {
  const actor = app?.actor;
  if (!actor || !["character", "creature"].includes(actor.type)) return;

  for (const row of element.querySelectorAll(".injuries-list [data-item-id]")) {
    const injury = actor.items.get(row.dataset.itemId);
    if (!injury || injury.type !== "injury" || isBloodlossInjury(injury)) continue;

    const notes = row.querySelector(".injury-notes");
    if (!notes || notes.querySelector(".hm3-physician-diagnosis-status")) continue;

    const presentation = physicianDiagnosisPresentation(injury);
    if (!presentation) continue;

    if (notes.textContent?.trim()) notes.append(document.createTextNode("; "));
    const status = document.createElement("span");
    status.className = "hm3-physician-diagnosis-status";
    status.textContent = presentation.compactStatus;
    status.title = `Physician Diagnosis — ${presentation.resultLabel}; Treatment ${presentation.treatmentLabel}`;
    notes.append(status);
  }
}

function addDiagnosisBlockToInjurySheet(app, element) {
  const injury = app?.item;
  if (!injury || injury.type !== "injury" || isBloodlossInjury(injury)) return;

  element.querySelector(".hm3-physician-diagnosis-summary")?.remove();
  const notes = element.querySelector("#injury-notes");
  if (!notes) return;

  const presentation = physicianDiagnosisPresentation(injury);
  const block = document.createElement("div");
  block.className = "resource hm3-physician-diagnosis-summary";

  const label = document.createElement("label");
  label.className = "resource-label";
  label.textContent = "Physician Diagnosis";
  block.append(label);

  const details = document.createElement("div");
  details.className = "hm3-physician-diagnosis-details";

  if (!presentation) {
    details.textContent = "Not diagnosed.";
  } else {
    const by = document.createElement("div");
    by.textContent = `Diagnosed by: ${presentation.healerName}`;
    const result = document.createElement("div");
    result.textContent = `Result: ${presentation.resultLabel} (${presentation.resultCode})`;
    const treatment = document.createElement("div");
    treatment.textContent = presentation.isSuccess
      ? `Treatment modifier: ${presentation.treatmentLabel}`
      : `Treatment penalty: ${presentation.treatmentLabel}`;
    details.append(by, result, treatment);
  }

  block.append(details);
  notes.insertAdjacentElement("afterend", block);
}

Hooks.on("renderApplicationV2", (app, element) => {
  if (game.system?.id !== "hm3") return;
  if (app?.actor) appendDiagnosisToActorInjuryNotes(app, element);
  if (app?.item) addDiagnosisBlockToInjurySheet(app, element);
});
