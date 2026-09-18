import assert from "node:assert/strict";
import {
  hasLegacyDataOperatorKeys,
  legacyDataOperatorPaths,
  modernizeLegacyDataOperators
} from "../module/migration-rules.js";

const legacyDelta = {
  flags: {
    someModule: {
      "-=overheadCost": null,
      retained: 12
    }
  },
  items: [
    {
      _id: "ITEM1",
      flags: {
        otherModule: {
          "==configuration": {
            mode: "legacy"
          }
        }
      }
    }
  ]
};

assert.equal(hasLegacyDataOperatorKeys(legacyDelta), true);
assert.deepEqual(
  legacyDataOperatorPaths(legacyDelta),
  [
    "flags.someModule.-=overheadCost",
    "items.0.flags.otherModule.==configuration"
  ],
  "nested ActorDelta operator paths must be discovered before an Actor update"
);

const deletion = Symbol("forced-deletion");
const replacementValues = [];
const modernized = modernizeLegacyDataOperators(legacyDelta, {
  deletion: () => deletion,
  replacement: value => {
    const wrapper = { forcedReplacement: value };
    replacementValues.push(wrapper);
    return wrapper;
  }
});

assert.equal(hasLegacyDataOperatorKeys(modernized), false, "modernized deltas must contain no legacy operator keys");
assert.equal(modernized.flags.someModule.overheadCost, deletion, "legacy deletion must retain deletion semantics");
assert.equal(modernized.flags.someModule.retained, 12, "unrelated ActorDelta overrides must be preserved");
assert.deepEqual(
  modernized.items[0].flags.otherModule.configuration,
  { forcedReplacement: { mode: "legacy" } },
  "legacy replacement must retain replacement semantics"
);
assert.equal(replacementValues.length, 1, "only explicit legacy replacement keys should create replacement operators");
assert.equal(
  Object.prototype.hasOwnProperty.call(legacyDelta.flags.someModule, "-=overheadCost"),
  true,
  "modernization must not mutate the original source object"
);

console.log("ActorDelta legacy data-operator regression tests passed.");
