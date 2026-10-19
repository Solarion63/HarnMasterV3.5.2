import assert from "node:assert/strict";
import {
  calculateOpeningMasteryLevel,
  getOpeningMasteryRule,
  normalizeSkillName,
  resolveInitialSkillMastery
} from "../module/skill-opening-rules.js";

assert.equal(normalizeSkillName("  Mental   Conflict  "), "mental conflict");

// Representative multiplier rules from different skill groups.
assert.equal(calculateOpeningMasteryLevel("Condition", 17), 85, "Condition must open at SB x5");
assert.equal(calculateOpeningMasteryLevel("Climbing", 12), 48, "Climbing must open at SB x4");
assert.equal(calculateOpeningMasteryLevel("Physician", 14), 14, "Physician must open at SB x1");
assert.equal(calculateOpeningMasteryLevel("Dodge", 13), 65, "Dodge must open at SB x5");

// Script uses the table's special 70 + SB rule rather than a multiplier.
assert.equal(calculateOpeningMasteryLevel("Script", 12), 82, "Script must open at 70 + SB");

// Historical specialty Item names inherit their parent weapon OML.
assert.equal(calculateOpeningMasteryLevel("Crossbow", 12), 24, "Crossbow must inherit Bow SB x2");
assert.equal(calculateOpeningMasteryLevel("Broadsword", 13), 39, "Broadsword must inherit Sword SB x3");

// Established mastery is never overwritten by creation-time initialization.
assert.deepEqual(
  resolveInitialSkillMastery({ skillName: "Condition", skillBase: 17, masteryLevel: 72 }),
  { value: 72, initialized: false, reason: "existing-mastery" }
);

// Context-dependent and unknown skills are deliberately left unchanged.
assert.equal(getOpeningMasteryRule("Language"), null, "Language must not receive a guessed generic OML");
assert.equal(getOpeningMasteryRule("Agrik"), null, "Ritual skills must remain context-dependent");
assert.deepEqual(
  resolveInitialSkillMastery({ skillName: "Language", skillBase: 14, masteryLevel: 0 }),
  { value: 0, initialized: false, reason: "no-opening-rule" }
);
assert.deepEqual(
  resolveInitialSkillMastery({ skillName: "Custom Skill", skillBase: 14, masteryLevel: 0 }),
  { value: 0, initialized: false, reason: "no-opening-rule" }
);

// A missing or unusable Skill Base cannot produce a valid OML.
assert.equal(calculateOpeningMasteryLevel("Condition", 0), null);
assert.equal(calculateOpeningMasteryLevel("Condition", "invalid"), null);

console.log("Skill opening mastery regression tests passed.");
