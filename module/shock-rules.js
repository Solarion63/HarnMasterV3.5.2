import { modifiedTarget } from "./dice-rules.js";

const SECONDS_PER_HOUR = 60 * 60;

export const SHOCK_INJURY_HEAL_RATE = 5;
export const SHOCK_OUT_OF_COMBAT_RECOVERY_FORMULA = "2d6";
export const SHOCK_RECOVERY_INTERVAL_SECONDS = 4 * SECONDS_PER_HOUR;

export const SHOCK_STATES = Object.freeze({
  UNCONSCIOUS: "unconscious",
  FOLLOW_UP: "follow-up",
  SHOCK: "shock"
});

export const SHOCK_PHASES = Object.freeze({
  INITIAL: "initial",
  RECOVERY: "recovery",
  FOLLOW_UP: "follow-up"
});

function finiteOptionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function shockDiceCount(universalPenalty) {
  const value = Number(universalPenalty);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function shockPhaseForState(state) {
  switch (state) {
    case SHOCK_STATES.UNCONSCIOUS:
      return SHOCK_PHASES.RECOVERY;
    case SHOCK_STATES.FOLLOW_UP:
      return SHOCK_PHASES.FOLLOW_UP;
    default:
      return SHOCK_PHASES.INITIAL;
  }
}

export function shockRecoveryAvailableAt(worldTime, durationMinutes) {
  const numericWorldTime = Number(worldTime);
  const now = Number.isFinite(numericWorldTime) ? numericWorldTime : 0;
  const minutes = Math.max(0, Number(durationMinutes) || 0);
  return now + (minutes * 60);
}

export function shockRecoveryBaseTarget(healRate, endurance) {
  const hr = Math.max(0, Math.min(6, Math.trunc(Number(healRate) || 0)));
  const end = Math.max(0, Number(endurance) || 0);
  return hr * end;
}

export function shockRecoveryPhysicianBonus(physicianEML) {
  return Math.floor(Math.max(0, Number(physicianEML) || 0) / 2);
}

export function shockRecoveryTarget({ healRate, endurance, physicianEML = 0 }) {
  const baseTarget = shockRecoveryBaseTarget(healRate, endurance);
  const physicianBonus = shockRecoveryPhysicianBonus(physicianEML);
  const resolved = modifiedTarget(baseTarget, physicianBonus);
  return {
    baseTarget,
    physicianBonus,
    target: resolved.target,
    isCapped: resolved.isCapped
  };
}

export function shockRecoveryResultCode(result) {
  const success = Boolean(result?.isSuccess);
  const critical = Boolean(result?.isCritical);
  if (success) return critical ? "CS" : "MS";
  return critical ? "CF" : "MF";
}

export function shockRecoveryHealRateDelta(resultCode) {
  switch (String(resultCode ?? "").toUpperCase()) {
    case "CF": return -2;
    case "MF": return -1;
    case "MS": return 1;
    case "CS": return 2;
    default:
      throw new Error(`Unknown Shock Recovery result: ${resultCode}`);
  }
}

export function resolveShockRecovery({ healRate, resultCode }) {
  const previousHealRate = Math.max(0, Math.min(6, Math.trunc(Number(healRate) || 0)));
  const healRateDelta = shockRecoveryHealRateDelta(resultCode);
  const nextHealRate = Math.max(0, Math.min(6, previousHealRate + healRateDelta));
  return {
    previousHealRate,
    resultCode: String(resultCode ?? "").toUpperCase(),
    healRateDelta,
    healRate: nextHealRate,
    recovered: nextHealRate >= 6,
    dead: nextHealRate <= 0
  };
}

export function shockInjuryRecoveryEligibility({
  availableAt,
  createdAt,
  worldTime
}) {
  const numericWorldTime = Number(worldTime);
  const now = Number.isFinite(numericWorldTime) ? numericWorldTime : 0;
  const storedAvailableAt = finiteOptionalNumber(availableAt);
  const storedCreatedAt = finiteOptionalNumber(createdAt);
  const legacy = storedAvailableAt == null;
  const nextAvailableAt = storedAvailableAt
    ?? (storedCreatedAt != null ? storedCreatedAt + SHOCK_RECOVERY_INTERVAL_SECONDS : now);

  return {
    eligible: now >= nextAvailableAt,
    availableAt: nextAvailableAt,
    remainingSeconds: Math.max(0, nextAvailableAt - now),
    legacy
  };
}

export function resolveShockOutcome(phase, isSuccess) {
  const success = Boolean(isSuccess);

  switch (phase) {
    case SHOCK_PHASES.INITIAL:
      return success
        ? { nextState: null, consequence: "steady" }
        : { nextState: SHOCK_STATES.UNCONSCIOUS, consequence: "unconscious" };

    case SHOCK_PHASES.RECOVERY:
      return success
        ? { nextState: SHOCK_STATES.FOLLOW_UP, consequence: "follow-up-required" }
        : { nextState: SHOCK_STATES.UNCONSCIOUS, consequence: "remains-unconscious" };

    case SHOCK_PHASES.FOLLOW_UP:
      return success
        ? { nextState: null, consequence: "recovered" }
        : { nextState: SHOCK_STATES.SHOCK, consequence: "shock" };

    default:
      throw new Error(`Unknown Shock Roll phase: ${phase}`);
  }
}
