import assert from "node:assert/strict";
import {
  normalizeConditionMastery,
  repairUninitializedConditionEndurance,
  resolveConditionEndurance
} from "../module/actor/actor-derived-rules.js";

assert.equal(resolveConditionEndurance(12, 0), 12, "ML 0 must preserve base Endurance");
assert.equal(resolveConditionEndurance(12, undefined), 12, "missing ML must preserve base Endurance");
assert.equal(resolveConditionEndurance(12, 85), 17, "valid Condition ML must derive Endurance from ML / 5");
assert.equal(normalizeConditionMastery("85"), 85, "numeric string ML must normalize");
assert.equal(normalizeConditionMastery("invalid"), 0, "invalid ML must normalize to 0");

const makeActor = masteryLevel => ({
  system: {
    abilities: {
      strength: { base: 14 },
      stamina: { base: 12 },
      will: { base: 10 }
    },
    endurance: 1,
    condition: masteryLevel,
    totalWeight: 48,
    loadRating: 12,
    encumbrance: 36,
    eph: {
      endurance: 1,
      effectiveWeight: 36
    }
  },
  items: [
    {
      type: "skill",
      name: "Condition",
      system: { masteryLevel }
    }
  ]
});

const zeroConditionActor = makeActor(0);
assert.equal(repairUninitializedConditionEndurance(zeroConditionActor), true);
assert.equal(zeroConditionActor.system.endurance, 12, "base Endurance must be restored from STR/STA/WIL");
assert.equal(zeroConditionActor.system.eph.endurance, 12, "ephemeral Endurance must match restored value");
assert.equal(zeroConditionActor.system.eph.effectiveWeight, 36, "effective weight must be recalculated");
assert.equal(zeroConditionActor.system.encumbrance, 3, "encumbrance must use restored Endurance");
assert.equal(zeroConditionActor.system.condition, 0, "Condition presentation value remains ML 0");

const validConditionActor = makeActor(85);
validConditionActor.system.endurance = 17;
validConditionActor.system.eph.endurance = 17;
validConditionActor.system.encumbrance = 2;
assert.equal(repairUninitializedConditionEndurance(validConditionActor), false);
assert.equal(validConditionActor.system.endurance, 17, "valid Condition-derived Endurance must be preserved");
assert.equal(validConditionActor.system.encumbrance, 2, "valid Condition encumbrance must be preserved");

const noConditionActor = makeActor(0);
noConditionActor.items = [];
noConditionActor.system.endurance = 12;
assert.equal(repairUninitializedConditionEndurance(noConditionActor), false);
assert.equal(noConditionActor.system.endurance, 12, "Actors without Condition must be unchanged");

console.log("Condition endurance regression tests passed.");
