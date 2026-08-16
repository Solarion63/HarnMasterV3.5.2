const MIN_D100_TARGET = 5;
const MAX_D100_TARGET = 95;

/**
 * Apply an HM3 modifier to a target and enforce the standard d100 limits.
 * d6 tests intentionally do not use the d100 5/95 cap.
 */
export function modifiedTarget(target, modifier = 0, diceSides = 100) {
  const rawTarget = Number(target) + (Number(modifier) || 0);
  if (Number(diceSides) !== 100) {
    return { target: rawTarget, isCapped: false };
  }

  const targetValue = Math.max(Math.min(rawTarget, MAX_D100_TARGET), MIN_D100_TARGET);
  return {
    target: targetValue,
    isCapped: rawTarget !== targetValue
  };
}

/**
 * Classify an evaluated HM3 test roll without any Foundry presentation logic.
 */
export function classifyTestRoll({ total, target, modifier = 0, diceSides = 100 }) {
  const resolved = modifiedTarget(target, modifier, diceSides);
  const d100 = Number(diceSides) === 100;
  const isCritical = d100 && Number(total) % 5 === 0;
  const isSuccess = Number(total) <= resolved.target;

  return {
    target: resolved.target,
    isCapped: resolved.isCapped,
    modifier: Number(modifier) || 0,
    isSuccess,
    isCritical,
    description: d100
      ? `${isCritical ? "Critical" : "Marginal"} ${isSuccess ? "Success" : "Failure"}`
      : (isSuccess ? "Success" : "Failure")
  };
}

/**
 * Return the available damage aspects and default aspect for a melee weapon.
 * This preserves the original HM3 tie-breaking order: Piercing, Edged, Blunt.
 */
export function weaponAspectData(weaponName, items) {
  const result = {
    defaultAspect: "Other",
    aspects: {
      Blunt: 0,
      Edged: 0,
      Piercing: 0,
      Fire: 0,
      Other: 0
    }
  };

  for (const item of items ?? []) {
    if (item.type !== "weapongear" || item.name !== weaponName) continue;

    const blunt = Number(item.system.blunt) || 0;
    const edged = Number(item.system.edged) || 0;
    const piercing = Number(item.system.piercing) || 0;
    const maxImpact = Math.max(blunt, piercing, edged, 0);

    result.aspects.Blunt = blunt;
    result.aspects.Edged = edged;
    result.aspects.Piercing = piercing;

    if (maxImpact === piercing) result.defaultAspect = "Piercing";
    else if (maxImpact === edged) result.defaultAspect = "Edged";
    else if (maxImpact === blunt) result.defaultAspect = "Blunt";
    else result.defaultAspect = "Other";
    break;
  }

  return result;
}
