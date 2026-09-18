const RESULT_LABELS = Object.freeze({
  CS: "Critical Success",
  MS: "Marginal Success",
  MF: "Marginal Failure",
  CF: "Critical Failure"
});

const PHYSICIAN_DIALOG_WIDTHS = Object.freeze({
  injurySelection: 440,
  treatmentConfiguration: 500
});

function diagnosisData(injury) {
  if (!injury) return null;
  if (typeof injury.getFlag === "function") {
    return injury.getFlag("hm3", "physicianDiagnosis") ?? null;
  }
  return injury.flags?.hm3?.physicianDiagnosis ?? null;
}

function treatmentData(injury) {
  if (!injury) return null;
  if (typeof injury.getFlag === "function") {
    return injury.getFlag("hm3", "physicianTreatment") ?? null;
  }
  return injury.flags?.hm3?.physicianTreatment ?? null;
}

function legacyTreated(injury) {
  if (!injury) return false;
  const value = typeof injury.getFlag === "function"
    ? injury.getFlag("hm3", "treated")
    : injury.flags?.hm3?.treated;
  return value === true || String(value).toLowerCase() === "treated";
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

export function physicianTreatmentPresentation(injury) {
  const treatment = treatmentData(injury);
  if (!treatment) {
    if (!legacyTreated(injury)) return null;
    return {
      treatment: null,
      resultCode: "",
      resultLabel: "Legacy treatment",
      healerName: String(injury.getFlag?.("hm3", "treatedBy") ?? "Unknown physician"),
      treatmentResult: String(injury.getFlag?.("hm3", "hrText") ?? "Treated"),
      compactStatus: "Treated (legacy record)",
      chooserStatus: "Already treated",
      detailText: "This injury was marked treated by the historical Physician macro."
    };
  }

  const resultCode = String(treatment.resultCode ?? "").toUpperCase();
  const resultLabel = RESULT_LABELS[resultCode] ?? (resultCode || "Unknown");
  const healerName = String(treatment.healerName ?? "Unknown physician");
  const treatmentResult = String(treatment.treatmentResult ?? "Unknown");
  const procedure = String(treatment.procedure ?? "Treatment");
  const durationText = String(treatment.durationText ?? "");
  const compactStatus = `Treated: ${resultCode} → ${treatmentResult} — ${healerName}`;
  const detailParts = [
    `${procedure}; ${resultLabel} (${resultCode}) → ${treatmentResult}`,
    durationText ? `Duration: ${durationText}` : null,
    treatment.permanentImpairment ? "Permanent impairment pending after healing" : null,
    treatment.amputation ? `Amputation creates a new ${treatment.amputationWound} wound to treat` : null
  ].filter(Boolean);

  return {
    treatment,
    resultCode,
    resultLabel,
    healerName,
    treatmentResult,
    procedure,
    durationText,
    compactStatus,
    chooserStatus: `Already treated (${resultCode} → ${treatmentResult}) by ${healerName}`,
    detailText: detailParts.join("; ")
  };
}

export function physicianDiagnosisChooserLabel(injury) {
  const presentation = physicianDiagnosisPresentation(injury);
  return presentation
    ? `${injury.name} — ${presentation.chooserStatus}`
    : `${injury.name} — Not diagnosed`;
}

export function physicianWoundChooserLabel(injury) {
  const diagnosis = physicianDiagnosisPresentation(injury);
  const treatment = physicianTreatmentPresentation(injury);
  const diagnosisText = diagnosis ? diagnosis.chooserStatus : "Not diagnosed";
  const treatmentText = treatment ? treatment.chooserStatus : "Not treated";
  return `${injury.name} — ${diagnosisText}; ${treatmentText}`;
}

function appendMedicalStatusToActorInjuryNotes(app, element) {
  const actor = app?.actor;
  if (!actor || !["character", "creature"].includes(actor.type)) return;

  for (const row of element.querySelectorAll(".injuries-list [data-item-id]")) {
    const injury = actor.items.get(row.dataset.itemId);
    if (!injury || injury.type !== "injury" || isBloodlossInjury(injury)) continue;

    const notes = row.querySelector(".injury-notes");
    if (!notes) continue;

    const diagnosis = physicianDiagnosisPresentation(injury);
    if (diagnosis && !notes.querySelector(".hm3-physician-diagnosis-status")) {
      if (notes.textContent?.trim()) notes.append(document.createTextNode("; "));
      const status = document.createElement("span");
      status.className = "hm3-physician-diagnosis-status";
      status.textContent = diagnosis.compactStatus;
      status.title = `Physician Diagnosis — ${diagnosis.resultLabel}; Treatment ${diagnosis.treatmentLabel}`;
      notes.append(status);
    }

    const treatment = physicianTreatmentPresentation(injury);
    if (treatment && !notes.querySelector(".hm3-physician-treatment-status")) {
      if (notes.textContent?.trim()) notes.append(document.createTextNode("; "));
      const status = document.createElement("span");
      status.className = "hm3-physician-treatment-status";
      status.textContent = treatment.compactStatus;
      status.title = treatment.detailText;
      notes.append(status);
    }
  }
}

function addMedicalBlocksToInjurySheet(app, element) {
  const injury = app?.item;
  if (!injury || injury.type !== "injury" || isBloodlossInjury(injury)) return;

  element.querySelector(".hm3-physician-diagnosis-summary")?.remove();
  element.querySelector(".hm3-physician-treatment-summary")?.remove();
  const notes = element.querySelector("#injury-notes");
  if (!notes) return;

  const diagnosis = physicianDiagnosisPresentation(injury);
  const diagnosisBlock = document.createElement("div");
  diagnosisBlock.className = "resource hm3-physician-diagnosis-summary";
  const diagnosisLabel = document.createElement("label");
  diagnosisLabel.className = "resource-label";
  diagnosisLabel.textContent = "Physician Diagnosis";
  const diagnosisDetails = document.createElement("div");
  diagnosisDetails.className = "hm3-physician-diagnosis-details";
  if (!diagnosis) {
    diagnosisDetails.textContent = "Not diagnosed.";
  } else {
    diagnosisDetails.innerHTML = "";
    for (const text of [
      `Diagnosed by: ${diagnosis.healerName}`,
      `Result: ${diagnosis.resultLabel} (${diagnosis.resultCode})`,
      diagnosis.isSuccess
        ? `Treatment modifier: ${diagnosis.treatmentLabel}`
        : `Treatment penalty: ${diagnosis.treatmentLabel}`
    ]) {
      const line = document.createElement("div");
      line.textContent = text;
      diagnosisDetails.append(line);
    }
  }
  diagnosisBlock.append(diagnosisLabel, diagnosisDetails);
  notes.insertAdjacentElement("afterend", diagnosisBlock);

  const treatment = physicianTreatmentPresentation(injury);
  const treatmentBlock = document.createElement("div");
  treatmentBlock.className = "resource hm3-physician-treatment-summary";
  const treatmentLabel = document.createElement("label");
  treatmentLabel.className = "resource-label";
  treatmentLabel.textContent = "Physician Treatment";
  const treatmentDetails = document.createElement("div");
  treatmentDetails.className = "hm3-physician-treatment-details";
  if (!treatment) {
    treatmentDetails.textContent = "No Treatment Roll recorded.";
  } else if (!treatment.treatment) {
    treatmentDetails.textContent = treatment.detailText;
  } else {
    const data = treatment.treatment;
    const lines = [
      `Treated by: ${treatment.healerName}`,
      `Procedure: ${treatment.procedure}`,
      `Result: ${treatment.resultLabel} (${treatment.resultCode}) → ${treatment.treatmentResult}`,
      `Treatment target: ${data.modifiedTarget}`,
      treatment.durationText ? `Procedure time: ${treatment.durationText}` : null,
      data.emergencyHealing ? "EE: injury heals in one day; no Healing Rolls required." : null,
      data.permanentImpairment ? "Permanent 1d3 attribute reduction is pending after the injury heals." : null,
      data.amputation ? `Amputation result: create a new ${data.amputationWound} wound and treat it separately.` : null
    ].filter(Boolean);
    for (const text of lines) {
      const line = document.createElement("div");
      line.textContent = text;
      treatmentDetails.append(line);
    }
  }
  treatmentBlock.append(treatmentLabel, treatmentDetails);
  diagnosisBlock.insertAdjacentElement("afterend", treatmentBlock);
}

/**
 * Keep the two data-entry-heavy Physician dialogs compact without changing
 * global Foundry dialog sizing. The field names are owned by the Physician
 * workflow, so unrelated DialogV2 instances are unaffected.
 */
function compactPhysicianDialog(app, element) {
  if (!(app instanceof foundry.applications.api.DialogV2)) return;
  const root = element?.querySelector ? element : app.element;
  if (!root) return;

  let width = null;
  if (root.querySelector('[name="medicalInjury"]')) {
    width = PHYSICIAN_DIALOG_WIDTHS.injurySelection;
  } else if (root.querySelector('[name="treatmentKey"]')) {
    width = PHYSICIAN_DIALOG_WIDTHS.treatmentConfiguration;
  }
  if (!width || Math.round(Number(app.position?.width)) === width) return;
  app.setPosition({ width });
}

Hooks.on("renderApplicationV2", (app, element) => {
  if (game.system?.id !== "hm3") return;
  compactPhysicianDialog(app, element);
  if (app?.actor) appendMedicalStatusToActorInjuryNotes(app, element);
  if (app?.item) addMedicalBlocksToInjurySheet(app, element);
});
