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

/**
 * Correct derived Endurance when an Actor contains an uninitialized Condition
 * skill. This runs at the HM3 base-data hook after the legacy Actor calculation
 * and before derived penalties are applied.
 *
 * The legacy calculation treats the mere presence of Condition as authoritative
 * and converts ML 0 to Endurance 0, which is subsequently clamped to 1. For an
 * uninitialized Condition skill, restore the normal STR/STA/WIL-derived value
 * and recompute the dependent encumbrance values used by derived preparation.
 *
 * @param {object} actor HM3 Actor-like object with system and items data.
 * @returns {boolean} True when an uninitialized Condition value was corrected.
 */
export function repairUninitializedConditionEndurance(actor) {
    const actorData = actor?.system;
    if (!actorData?.abilities) return false;

    const condition = Array.from(actor?.items ?? []).find(item =>
        item?.type === "skill" && String(item?.name ?? "").toLowerCase() === "condition"
    );
    if (!condition) return false;

    const masteryLevel = normalizeConditionMastery(condition.system?.masteryLevel);
    actorData.condition = masteryLevel;
    if (masteryLevel > 0) return false;

    const strength = Number(actorData.abilities.strength?.base) || 0;
    const stamina = Number(actorData.abilities.stamina?.base) || 0;
    const will = Number(actorData.abilities.will?.base) || 0;
    const baseEndurance = Math.max(Math.round((strength + stamina + will) / 3), 1);

    actorData.endurance = baseEndurance;
    if (actorData.eph) actorData.eph.endurance = baseEndurance;

    const totalWeight = Number(actorData.totalWeight) || 0;
    const loadRating = Number(actorData.loadRating) || 0;
    const effectiveWeight = loadRating > 0 ? Math.max(totalWeight - loadRating, 0) : totalWeight;

    if (actorData.eph) actorData.eph.effectiveWeight = effectiveWeight;
    actorData.encumbrance = Math.floor(effectiveWeight / baseEndurance);

    return true;
}
