/**
 * Public compatibility facade for the historical game.hm3.DiceHM3 API.
 *
 * Foundry v14 implementations are attached by the focused dice modules loaded
 * before hm3.js. Keep this class intentionally small so legacy macros can retain
 * the DiceHM3 namespace without preserving obsolete Foundry v12/v13 workflows.
 */
export class DiceHM3 {
  /**
   * Return a weighted random legacy hit-location name.
   *
   * This method remains on DiceHM3 because it is part of the historical public
   * API and does not have a newer workflow-specific replacement.
   */
  static hitLocation(items, aim) {
    const hitAim = aim === "high" || aim === "low" ? aim : "mid";
    const rollValue = Math.floor(foundry.dice.MersenneTwister.random() * 100) + 1;
    let remaining = rollValue;
    let result = `Unknown (roll=${rollValue})`;

    for (const item of items ?? []) {
      if (remaining <= 0) break;
      if (item.type !== "hitlocation") continue;

      const weight = Number(item.system.probWeight?.[hitAim]) || 0;
      if (weight === 0) continue;

      remaining -= weight;
      if (remaining <= 0) {
        result = item.name;
        break;
      }
    }

    return result;
  }
}
