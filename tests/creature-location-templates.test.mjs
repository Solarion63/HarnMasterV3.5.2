import test from "node:test";
import assert from "node:assert/strict";
import {
  CREATURE_ANATOMIES,
  CREATURE_ARMOR_PRESETS,
  buildCreatureLocations,
  missingCreatureLocations,
  validateCreatureTemplate
} from "../module/actor/creature-location-templates.js";

const types = Object.fromEntries(
  ["Skull", "Face", "Neck", "Shoulder", "Upper Arm", "Elbow",
   "Forearm", "Hand", "Thorax", "Abdomen", "Groin", "Hip", "Thigh",
   "Knee", "Calf", "Foot", "Wing", "Tail"].map(name => [
    name,
    { impactType: name.toLowerCase(), probWeight: { high: 1, mid: 1, low: 1 },
      effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "G5" } }
  ])
);
const build = (anatomy, armor = "none") => buildCreatureLocations({
  anatomy, armor, locationTypes: types,
  itemDefaults: { layers: "", armorQuality: 0, notes: "" }
});

test("each predefined anatomical template validates", () => {
  for (const template of Object.values(CREATURE_ANATOMIES)) {
    assert.equal(validateCreatureTemplate(template), true);
  }
});

test("quadruped anatomy produces distinct persistent-ready Items", () => {
  const items = build("quadruped", "blackWolf");
  assert.equal(items.length, 9);
  assert.equal(new Set(items.map(item => item.name)).size, items.length);
  assert.ok(items.every(item => item.type === "armorlocation"));
  assert.ok(items.every(item => item.system.blunt === 4 && item.system.edged === 3 &&
    item.system.piercing === 1 && item.system.fire === 3));
  assert.deepEqual(items[0].system.probWeight, { high: 5, mid: 2, low: 0 });
  items[0].system.blunt = 99;
  assert.equal(items[1].system.blunt, 4, "item data must be independent");
});

test("avian and serpentine zones have positive total weights", () => {
  for (const anatomy of ["avian", "serpentine"]) {
    const items = build(anatomy);
    for (const zone of ["high", "mid", "low"]) {
      assert.ok(items.reduce((sum, item) => sum + item.system.probWeight[zone], 0) > 0);
    }
  }
});

test("humanoid uses existing HM3 definitions without changing their weights", () => {
  const items = build("humanoid");
  assert.equal(items.length, 27);
  assert.equal(items[0].name, "Skull");
  assert.deepEqual(items[0].system.probWeight, { high: 1, mid: 1, low: 1 });
});

test("custom template never creates Items", () => {
  assert.deepEqual(build("custom"), []);
});

test("reapplying a template is idempotent and respects custom armor", () => {
  const generated = build("quadruped", "blackWolf");
  const existing = [{ ...generated[0], system: { ...generated[0].system, blunt: 99 } }];
  const missing = missingCreatureLocations(generated, existing);
  assert.equal(missing.length, generated.length - 1);
  assert.equal(existing[0].system.blunt, 99);
  assert.deepEqual(missingCreatureLocations(generated, [...existing, ...missing]), []);
  assert.deepEqual(missingCreatureLocations(generated, [{ name: "head" }]).length, generated.length - 1);
});

test("bad weights and duplicate location names are rejected", () => {
  assert.throws(() => validateCreatureTemplate({ locations: [
    ["Head", "Skull", [-1, 1, 1]]
  ] }), /Invalid probability/);
  assert.throws(() => validateCreatureTemplate({ locations: [
    ["Head", "Skull", [1, 1, 1]], ["head", "Skull", [1, 1, 1]]
  ] }), /Duplicate/);
  assert.throws(() => validateCreatureTemplate({ locations: [
    ["Head", "Skull", [1, 0, 1]]
  ] }), /positive weight/);
});

test("verified species protection preset mappings remain fixed", () => {
  const expected = {
    blackWolf: [4, 3, 1, 3], whiteWolf: [4, 3, 1, 3],
    blackBear: [5, 2, 2, 4], brownBear: [6, 4, 3, 5],
    eagle: [3, 2, 1, 2], hawk: [1, 1, 1, 1]
  };
  for (const [key, values] of Object.entries(expected)) {
    assert.deepEqual(CREATURE_ARMOR_PRESETS[key].protection, values);
  }
});
