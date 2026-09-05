import assert from "node:assert/strict";
import {
  SHOCK_INJURY_HEAL_RATE,
  SHOCK_OUT_OF_COMBAT_RECOVERY_FORMULA,
  SHOCK_PHASES,
  SHOCK_STATES,
  resolveShockOutcome,
  shockDiceCount,
  shockPhaseForState,
  shockRecoveryAvailableAt
} from "../module/shock-rules.js";

assert.equal(SHOCK_INJURY_HEAL_RATE, 5);
assert.equal(SHOCK_OUT_OF_COMBAT_RECOVERY_FORMULA, "2d6");

assert.equal(shockDiceCount(3), 3);
assert.equal(shockDiceCount(2.9), 2);
assert.equal(shockDiceCount(0), 0);
assert.equal(shockDiceCount(-4), 0);
assert.equal(shockDiceCount("bad"), 0);

assert.equal(shockRecoveryAvailableAt(1000, 7), 1420);
assert.equal(shockRecoveryAvailableAt(-10, 2), 120);
assert.equal(shockRecoveryAvailableAt(1000, -4), 1000);

assert.equal(shockPhaseForState(null), SHOCK_PHASES.INITIAL);
assert.equal(shockPhaseForState(SHOCK_STATES.UNCONSCIOUS), SHOCK_PHASES.RECOVERY);
assert.equal(shockPhaseForState(SHOCK_STATES.FOLLOW_UP), SHOCK_PHASES.FOLLOW_UP);
assert.equal(shockPhaseForState(SHOCK_STATES.SHOCK), SHOCK_PHASES.INITIAL);

assert.deepEqual(resolveShockOutcome(SHOCK_PHASES.INITIAL, true), {
  nextState: null,
  consequence: "steady"
});
assert.deepEqual(resolveShockOutcome(SHOCK_PHASES.INITIAL, false), {
  nextState: SHOCK_STATES.UNCONSCIOUS,
  consequence: "unconscious"
});
assert.deepEqual(resolveShockOutcome(SHOCK_PHASES.RECOVERY, false), {
  nextState: SHOCK_STATES.UNCONSCIOUS,
  consequence: "remains-unconscious"
});
assert.deepEqual(resolveShockOutcome(SHOCK_PHASES.RECOVERY, true), {
  nextState: SHOCK_STATES.FOLLOW_UP,
  consequence: "follow-up-required"
});
assert.deepEqual(resolveShockOutcome(SHOCK_PHASES.FOLLOW_UP, true), {
  nextState: null,
  consequence: "recovered"
});
assert.deepEqual(resolveShockOutcome(SHOCK_PHASES.FOLLOW_UP, false), {
  nextState: SHOCK_STATES.SHOCK,
  consequence: "shock"
});
assert.throws(() => resolveShockOutcome("other", true), /Unknown Shock Roll phase/);

console.log("Shock rules regression tests passed.");
