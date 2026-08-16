export function getHitLocations(items) {
  const hitLocations = ["Random"];
  for (const item of items ?? []) {
    if (item.type === "armorlocation" && !hitLocations.includes(item.name)) {
      hitLocations.push(item.name);
    }
  }
  return hitLocations;
}

export function resolveHitLocation(location, aim, items, random = Math.random) {
  const normalizedAim = String(aim ?? "mid").toLowerCase();
  const armorLocations = Array.from(items ?? []).filter(item => item.type === "armorlocation");
  if (!armorLocations.length) return null;

  if (String(location).toLowerCase() !== "random") {
    return armorLocations.find(item => item.name === location) ?? null;
  }

  const totalWeight = armorLocations.reduce(
    (total, item) => total + (Number(item.system.probWeight?.[normalizedAim]) || 0),
    0
  );

  let rollWeight = totalWeight > 0
    ? Math.floor(random() * totalWeight) + 1
    : 0;

  for (const item of armorLocations) {
    rollWeight -= Number(item.system.probWeight?.[normalizedAim]) || 0;
    if (rollWeight <= 0) return item;
  }

  return armorLocations[0] ?? null;
}

export function calculateInjury({
  location,
  impact,
  aspect,
  addToCharSheet,
  aim,
  name,
  items,
  rules = {},
  random = Math.random
}) {
  const enableAmputate = Boolean(rules.amputation);
  const enableBloodloss = Boolean(rules.bloodloss);
  const enableLimbInjuries = Boolean(rules.limbInjuries);
  const numericImpact = Number(impact) || 0;

  const result = {
    type: "injury",
    isRandom: location === "Random",
    name,
    aim,
    aspect,
    location,
    impact: numericImpact,
    armorType: "None",
    armorValue: 0,
    effectiveImpact: numericImpact,
    isInjured: false,
    injuryLevel: 0,
    injuryLevelText: "NA",
    isBleeder: false,
    isFumbleRoll: false,
    isFumble: false,
    isStumbleRoll: false,
    isStumble: false,
    isAmputate: false,
    isKillShot: false,
    addToCharSheet: Boolean(addToCharSheet)
  };

  const armorLocationItem = resolveHitLocation(location, aim, items, random);
  if (!armorLocationItem) return null;

  const armorLocationData = armorLocationItem.system;
  result.location = armorLocationItem.name;
  result.armorType = armorLocationData.layers === "" ? "None" : armorLocationData.layers;

  if (aspect === "Blunt") result.armorValue = Number(armorLocationData.blunt) || 0;
  else if (aspect === "Edged") result.armorValue = Number(armorLocationData.edged) || 0;
  else if (aspect === "Piercing") result.armorValue = Number(armorLocationData.piercing) || 0;
  else result.armorValue = Number(armorLocationData.fire) || 0;

  result.effectiveImpact = Math.max(numericImpact - result.armorValue, 0);

  if (result.effectiveImpact === 0) result.injuryLevelText = "NA";
  else if (result.effectiveImpact >= 17) result.injuryLevelText = armorLocationData.effectiveImpact.ei17;
  else if (result.effectiveImpact >= 13) result.injuryLevelText = armorLocationData.effectiveImpact.ei13;
  else if (result.effectiveImpact >= 9) result.injuryLevelText = armorLocationData.effectiveImpact.ei9;
  else if (result.effectiveImpact >= 5) result.injuryLevelText = armorLocationData.effectiveImpact.ei5;
  else result.injuryLevelText = armorLocationData.effectiveImpact.ei1;

  switch (result.injuryLevelText) {
    case "M1":
      result.injuryLevel = 1;
      break;
    case "S2":
      result.injuryLevel = 2;
      break;
    case "S3":
      result.injuryLevel = 3;
      break;
    case "G4":
      result.injuryLevel = 4;
      result.isAmputate = enableAmputate && armorLocationData.isAmputate && aspect === "Edged";
      break;
    case "K4":
      result.injuryLevel = 4;
      result.isKillShot = true;
      result.isAmputate = enableAmputate && armorLocationData.isAmputate && aspect === "Edged";
      break;
    case "G5":
      result.injuryLevel = 5;
      result.isAmputate = enableAmputate && armorLocationData.isAmputate && aspect === "Edged";
      break;
    case "K5":
      result.injuryLevel = 5;
      result.isKillShot = true;
      result.isAmputate = enableAmputate && armorLocationData.isAmputate && aspect === "Edged";
      break;
    case "NA":
    default:
      result.injuryLevel = 0;
      break;
  }

  if (result.injuryLevel <= 0) return result;
  result.isInjured = true;

  result.isBleeder = enableBloodloss && result.injuryLevel >= 4 && result.aspect !== "Fire";

  if (armorLocationData.isFumble) {
    result.isFumble = enableLimbInjuries && result.injuryLevel >= 4;
    result.isFumbleRoll = enableLimbInjuries || (!result.isFumble && result.injuryLevel >= 2);
  }

  if (armorLocationData.isStumble) {
    result.isStumble = enableLimbInjuries && result.injuryLevel >= 4;
    result.isStumbleRoll = enableLimbInjuries || (!result.isStumble && result.injuryLevel >= 2);
  }

  return result;
}
