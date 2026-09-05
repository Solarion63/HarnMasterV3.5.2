const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_DAY = 24 * 60 * 60;

/** HârnMaster Bloodloss Healing Rate. */
export const BLOODLOSS_HEAL_RATE = 6;

/** Blood Regeneration is tested once every five days. */
export const BLOOD_REGENERATION_INTERVAL_SECONDS = 5 * SECONDS_PER_DAY;

export function elapsedBleeding({ lastProcessedWorldTime, worldTime, rate = 1 }) {
  const start = Number(lastProcessedWorldTime);
  const end = Number(worldTime);
  const bleedRate = Math.max(0, Number(rate) || 0);

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || bleedRate <= 0) {
    return {
      minutes: 0,
      bloodloss: 0,
      nextProcessedWorldTime: Number.isFinite(start) ? start : end
    };
  }

  const minutes = Math.floor((end - start) / SECONDS_PER_MINUTE);
  return {
    minutes,
    bloodloss: minutes * bleedRate,
    nextProcessedWorldTime: start + (minutes * SECONDS_PER_MINUTE)
  };
}

export function bloodlossIsFatal(bloodloss, endurance) {
  return Math.max(0, Number(bloodloss) || 0) > Math.max(0, Number(endurance) || 0);
}

/**
 * Return the Blood Point reduction produced by a Blood Regeneration result.
 * Accept both the historical upper-case hook result codes and lower-case rule
 * codes so the rules layer does not depend on presentation conventions.
 */
export function bloodRegenerationReduction(resultCode) {
  const code = String(resultCode ?? "").trim().toLowerCase();
  if (code === "cs") return 2;
  if (code === "ms") return 1;
  return 0;
}

/**
 * Apply a Blood Regeneration result to a Bloodloss total without allowing the
 * value to fall below zero.
 */
export function resolveBloodRegeneration({ bloodloss, resultCode }) {
  const previousBloodloss = Math.max(0, Number(bloodloss) || 0);
  const requestedReduction = bloodRegenerationReduction(resultCode);
  const reduction = Math.min(previousBloodloss, requestedReduction);
  return {
    previousBloodloss,
    requestedReduction,
    reduction,
    totalBloodloss: previousBloodloss - reduction
  };
}

/**
 * Determine whether another Blood Regeneration roll is available yet.
 * Missing/invalid availability metadata is treated as eligible so Actors from
 * worlds created before this automation are not forced to wait an extra five
 * days simply because they were upgraded.
 */
export function bloodRegenerationEligibility({ availableAt, worldTime }) {
  const now = Number(worldTime);
  const next = Number(availableAt);
  if (!Number.isFinite(now) || !Number.isFinite(next) || next <= now) {
    return { eligible: true, remainingSeconds: 0 };
  }
  return {
    eligible: false,
    remainingSeconds: Math.max(0, next - now)
  };
}
