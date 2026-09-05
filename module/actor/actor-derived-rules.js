/**
 * Resolve the Endurance value to use when a Condition skill is present.
 *
 * A Condition skill only replaces the normal STR/STA/WIL-derived Endurance
 * after it has a meaningful positive Mastery Level. Newly added or otherwise
 * uninitialized Condition skills can legitimately exist with ML 0; those must
 * not collapse Endurance to 1 through the downstream safety clamp.
 *
 * @param {number} baseEndurance Endurance derived from the Actor's abilities.
 * @param {number|string|null|undefined} masteryLevel Condition Mastery Level.
 * @returns {number} Condition-derived Endurance when ML is positive, otherwise
 *   the supplied base Endurance.
 */
export function resolveConditionEndurance(baseEndurance, masteryLevel) {
    const numericMastery = Number(masteryLevel);
    if (!Number.isFinite(numericMastery) || numericMastery <= 0) return baseEndurance;
    return Math.round(numericMastery / 5);
}

/**
 * Normalize Condition Mastery Level for Actor presentation data.
 *
 * @param {number|string|null|undefined} masteryLevel Condition Mastery Level.
 * @returns {number} A finite numeric mastery value, or 0 when invalid.
 */
export function normalizeConditionMastery(masteryLevel) {
    const numericMastery = Number(masteryLevel);
    return Number.isFinite(numericMastery) ? numericMastery : 0;
}
