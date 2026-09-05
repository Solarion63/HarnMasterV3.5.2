export const SHOCK_INJURY_HEAL_RATE = 5;

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
