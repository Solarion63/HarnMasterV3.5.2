import { HM3 } from "./config.js";
import { repairUninitializedConditionEndurance } from "./actor/actor-derived-rules.js";

/**
 * Foundry v14-specific configuration adjustments.
 *
 * Keep these small mutations separate from the large legacy HM3 configuration
 * table so targeted compatibility changes do not require replacing config.js.
 */
if (!HM3.defaultCharacterSkills.includes("Condition")) {
  const climbingIndex = HM3.defaultCharacterSkills.indexOf("Climbing");
  const insertAt = climbingIndex >= 0 ? climbingIndex + 1 : 0;
  HM3.defaultCharacterSkills.splice(insertAt, 0, "Condition");
}

Hooks.on("hm3.onActorPrepareBaseData", actor => {
  repairUninitializedConditionEndurance(actor);
});
