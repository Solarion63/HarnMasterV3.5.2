import assert from "node:assert/strict";
import {
  BLOODLOSS_HEAL_RATE,
  BLOOD_REGENERATION_INTERVAL_SECONDS,
  bloodRegenerationEligibility,
  bloodRegenerationReduction,
  resolveBloodRegeneration
} from "../module/bloodloss-rules.js";

assert.equal(BLOODLOSS_HEAL_RATE, 6, "Bloodloss must use the authoritative H6 Healing Rate");
assert.equal(
  BLOOD_REGENERATION_INTERVAL_SECONDS,
  5 * 24 * 60 * 60,
  "Blood Regeneration must use a five-day interval"
);

assert.equal(bloodRegenerationReduction("CS"), 2, "Critical Success must regenerate 2 BP");
assert.equal(bloodRegenerationReduction("cs"), 2, "lower-case Critical Success must be accepted");
assert.equal(bloodRegenerationReduction("MS"), 1, "Marginal Success must regenerate 1 BP");
assert.equal(bloodRegenerationReduction("MF"), 0, "Marginal Failure must not regenerate BP");
assert.equal(bloodRegenerationReduction("CF"), 0, "Critical Failure must not regenerate BP");

assert.deepEqual(
  resolveBloodRegeneration({ bloodloss: 7, resultCode: "MS" }),
  {
    previousBloodloss: 7,
    requestedReduction: 1,
    reduction: 1,
    totalBloodloss: 6
  },
  "Marginal Success must reduce Bloodloss by exactly 1 BP"
);

assert.deepEqual(
  resolveBloodRegeneration({ bloodloss: 1, resultCode: "CS" }),
  {
    previousBloodloss: 1,
    requestedReduction: 2,
    reduction: 1,
    totalBloodloss: 0
  },
  "Blood Regeneration must clamp at zero instead of producing negative Bloodloss"
);

assert.deepEqual(
  resolveBloodRegeneration({ bloodloss: 7, resultCode: "CF" }),
  {
    previousBloodloss: 7,
    requestedReduction: 0,
    reduction: 0,
    totalBloodloss: 7
  },
  "failed Blood Regeneration rolls must leave Bloodloss unchanged"
);

assert.deepEqual(
  bloodRegenerationEligibility({ availableAt: undefined, worldTime: 1000 }),
  { eligible: true, remainingSeconds: 0 },
  "legacy Bloodloss Injuries without cadence metadata must be immediately eligible"
);
assert.deepEqual(
  bloodRegenerationEligibility({ availableAt: 1000, worldTime: 1000 }),
  { eligible: true, remainingSeconds: 0 },
  "a roll becomes eligible exactly at the five-day boundary"
);
assert.deepEqual(
  bloodRegenerationEligibility({ availableAt: 1500, worldTime: 1000 }),
  { eligible: false, remainingSeconds: 500 },
  "a future availability time must report the remaining cooldown"
);

console.log("Blood Regeneration regression tests passed.");
