import assert from "node:assert/strict";
import {
  SHOCK_INJURY_HEAL_RATE,
  SHOCK_OUT_OF_COMBAT_RECOVERY_FORMULA,
  SHOCK_PHASES,
  SHOCK_RECOVERY_INTERVAL_SECONDS,
  SHOCK_STATES,
  resolveShockOutcome,
  resolveShockRecovery,
  shockDiceCount,
  shockInjuryRecoveryEligibility,
  shockPhaseForState,
  shockRecoveryAvailableAt,
  shockRecoveryHealRateDelta,
  shockRecoveryPhysicianBonus,
  shockRecoveryResultCode,
  shockRecoveryTarget
} from "../module/shock-rules.js";
import { ShockService } from "../module/shock-service.js";

assert.equal(SHOCK_INJURY_HEAL_RATE, 5);
assert.equal(SHOCK_OUT_OF_COMBAT_RECOVERY_FORMULA, "2d6");
assert.equal(SHOCK_RECOVERY_INTERVAL_SECONDS, 4 * 60 * 60);

assert.equal(shockDiceCount(3), 3);
assert.equal(shockDiceCount(2.9), 2);
assert.equal(shockDiceCount(0), 0);
assert.equal(shockDiceCount(-4), 0);
assert.equal(shockDiceCount("bad"), 0);

assert.equal(shockRecoveryAvailableAt(1000, 7), 1420);
assert.equal(shockRecoveryAvailableAt(-10, 2), 110);
assert.equal(shockRecoveryAvailableAt(1000, -4), 1000);
assert.equal(shockRecoveryAvailableAt("bad", 2), 120);

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

assert.equal(shockRecoveryPhysicianBonus(71), 35);
assert.deepEqual(shockRecoveryTarget({
  healRate: 5,
  endurance: 12,
  physicianEML: 60
}), {
  baseTarget: 60,
  physicianBonus: 30,
  target: 90,
  isCapped: false
});
assert.deepEqual(shockRecoveryTarget({
  healRate: 5,
  endurance: 12,
  physicianEML: 80
}), {
  baseTarget: 60,
  physicianBonus: 40,
  target: 95,
  isCapped: true
});

assert.equal(shockRecoveryResultCode({ isSuccess: true, isCritical: true }), "CS");
assert.equal(shockRecoveryResultCode({ isSuccess: true, isCritical: false }), "MS");
assert.equal(shockRecoveryResultCode({ isSuccess: false, isCritical: false }), "MF");
assert.equal(shockRecoveryResultCode({ isSuccess: false, isCritical: true }), "CF");
assert.equal(shockRecoveryHealRateDelta("CF"), -2);
assert.equal(shockRecoveryHealRateDelta("MF"), -1);
assert.equal(shockRecoveryHealRateDelta("MS"), 1);
assert.equal(shockRecoveryHealRateDelta("CS"), 2);

assert.deepEqual(resolveShockRecovery({ healRate: 5, resultCode: "MF" }), {
  previousHealRate: 5,
  resultCode: "MF",
  healRateDelta: -1,
  healRate: 4,
  recovered: false,
  dead: false
});
assert.deepEqual(resolveShockRecovery({ healRate: 5, resultCode: "MS" }), {
  previousHealRate: 5,
  resultCode: "MS",
  healRateDelta: 1,
  healRate: 6,
  recovered: true,
  dead: false
});
assert.deepEqual(resolveShockRecovery({ healRate: 1, resultCode: "CF" }), {
  previousHealRate: 1,
  resultCode: "CF",
  healRateDelta: -2,
  healRate: 0,
  recovered: false,
  dead: true
});

assert.deepEqual(shockInjuryRecoveryEligibility({
  availableAt: 20000,
  createdAt: 1000,
  worldTime: 19900
}), {
  eligible: false,
  availableAt: 20000,
  remainingSeconds: 100,
  legacy: false
});
assert.deepEqual(shockInjuryRecoveryEligibility({
  availableAt: null,
  createdAt: 1000,
  worldTime: 15400
}), {
  eligible: true,
  availableAt: 15400,
  remainingSeconds: 0,
  legacy: true
});
assert.deepEqual(shockInjuryRecoveryEligibility({
  availableAt: null,
  createdAt: null,
  worldTime: -500
}), {
  eligible: true,
  availableAt: -500,
  remainingSeconds: 0,
  legacy: true
});

function mockShockActor(initialFlags = {}) {
  const flags = new Map(Object.entries(initialFlags));
  return {
    flags: { hm3: {} },
    effects: [
      { id: "unconscious", name: "Unconscious", statuses: new Set() },
      { id: "prone", name: "Prone", statuses: new Set() }
    ],
    getFlag(scope, key) {
      assert.equal(scope, "hm3");
      return flags.get(key);
    },
    async setFlag(scope, key, value) {
      assert.equal(scope, "hm3");
      flags.set(key, value);
      return value;
    },
    async unsetFlag(scope, key) {
      assert.equal(scope, "hm3");
      flags.delete(key);
    },
    async deleteEmbeddedDocuments() {
      throw new Error("No managed effects should be deleted in this regression test.");
    }
  };
}

globalThis.CONFIG = { statusEffects: [] };
globalThis.game = {
  i18n: { localize: value => value },
  time: { worldTime: 0 },
  combats: []
};
globalThis.CONST = { ACTIVE_EFFECT_SHOW_ICON: { ALWAYS: 2 } };

const recoveryActor = mockShockActor();
assert.equal(ShockService.recoveryDiceCount(recoveryActor), null);
assert.equal(await ShockService.ensureRecoveryDiceCount(recoveryActor, 4), 4);
assert.equal(ShockService.recoveryDiceCount(recoveryActor), 4);
assert.equal(await ShockService.ensureRecoveryDiceCount(recoveryActor, 7), 4,
  "Recovery dice must remain fixed after the initial failed Shock Roll.");

await ShockService.enterUnconscious(recoveryActor, 5);
assert.equal(ShockService.recoveryDiceCount(recoveryActor), 5,
  "Initial Shock failure must store its dice count for combat recovery.");
await ShockService.enterUnconscious(recoveryActor);
assert.equal(ShockService.recoveryDiceCount(recoveryActor), 5,
  "A failed recovery must preserve the original recovery dice count.");

await ShockService.markFollowUp(recoveryActor);
assert.equal(ShockService.recoveryDiceCount(recoveryActor), null,
  "Recovery dice state must clear when consciousness is regained.");

const compatibilityActor = mockShockActor();
assert.equal(await ShockService.ensureRecoveryDiceCount(compatibilityActor, 3.9), 3,
  "Legacy unconscious states without stored dice should capture a one-time fallback.");
assert.equal(await ShockService.ensureRecoveryDiceCount(compatibilityActor, 6), 3,
  "The compatibility fallback must become fixed after first capture.");

await assert.rejects(
  () => ShockService.setRecoveryDiceCount(mockShockActor(), 0),
  /at least 1d6/
);

console.log("Shock rules regression tests passed.");
