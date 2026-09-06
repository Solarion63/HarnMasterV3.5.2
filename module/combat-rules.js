import { HM3 } from "./config.js";

/**
 * Resolve a HarnMaster melee combat-table result.
 *
 * This module contains rules-only combat resolution. It deliberately has no
 * Foundry UI, canvas, chat, audio, or workflow responsibilities.
 *
 * @param {String} atkResult Attack result code: "cs", "cf", "ms", or "mf"
 * @param {String|null} defResult Defense result code, or null for Ignore
 * @param {String} defense Defense type: "ignore", "block", "counterstrike", or "dodge"
 * @param {Number} atkAddlImpact Additional impact for the attacker
 * @param {Number} defAddlImpact Additional impact for a counterstriker
 * @returns {Object|null} Resolved combat outcome and display descriptions
 */
export function meleeCombatResult(atkResult, defResult, defense, atkAddlImpact = 0, defAddlImpact = 0) {
    let outcome = null;
    let index = null;
    const defenseTable = HM3.meleeCombatTable[defense];
    if (defenseTable) {
        if (defense === "ignore") {
            index = atkResult;
        } else {
            index = `${atkResult}:${defResult}`;
        }
        outcome = defenseTable[index];
    }

    if (!outcome) return null;

    const result = { outcome, desc: "Attack misses.", csDesc: "Counterstrike misses." };

    if (defense !== "counterstrike") {
        if (outcome.atkDice) {
            result.desc = `Attacker strikes for ${diceFormula(outcome.atkDice, atkAddlImpact)} impact.`;
        } else if (outcome.atkFumble && outcome.defFumble) {
            result.desc = "Both Attacker and Defender Fumble";
        } else if (outcome.atkFumble) {
            result.desc = "Attacker fumbles.";
        } else if (outcome.defFumble) {
            result.desc = "Defender fumbles.";
        } else if (outcome.defStumble && outcome.atkStumble) {
            result.desc = "Both attacker and defender stumble.";
        } else if (outcome.atkStumble) {
            result.desc = "Attacker stumbles.";
        } else if (outcome.defStumble) {
            result.desc = "Defender stumbles.";
        } else if (outcome.block) {
            result.desc = "Attack blocked.";
        } else if (outcome.dta) {
            result.desc = "Defender gains Tactical Advantage.";
        }
    } else {
        if (outcome.atkDice) {
            result.desc = `Attacker strikes for ${diceFormula(outcome.atkDice, atkAddlImpact)} impact.`;
        } else if (outcome.atkFumble) {
            result.desc = "Attacker fumbles.";
        } else if (outcome.atkStumble) {
            result.desc = "Attacker stumbles.";
        }

        if (outcome.defDice) {
            result.csDesc = `Counterstriker strikes for ${diceFormula(outcome.defDice, defAddlImpact)} impact.`;
        } else if (outcome.defFumble) {
            result.csDesc = "Counterstriker fumbles.";
        } else if (outcome.defStumble) {
            result.csDesc = "Counterstriker stumbles.";
        } else if (outcome.block) {
            result.desc = "Attacker blocked.";
            result.csDesc = "Counterstriker blocked.";
        } else if (outcome.dta) {
            result.csDesc = "Counterstriker achieves Tactical Advantage!";
        } else if (outcome.miss) {
            result.csDesc = "Counterstrike misses.";
        }
    }

    return result;
}

/**
 * Resolve a HarnMaster missile combat-table result.
 *
 * @param {String} atkResult Attack result code: "cs", "cf", "ms", or "mf"
 * @param {String|null} defResult Defense result code, or null for Ignore
 * @param {String} defense Defense type: "ignore", "block", or "dodge"
 * @param {Number} atkAddlImpact Additional missile impact
 * @returns {Object|null} Resolved combat outcome and display description
 */
export function missileCombatResult(atkResult, defResult, defense, atkAddlImpact = 0) {
    let outcome = null;
    let index = null;
    const defenseTable = HM3.missileCombatTable[defense];
    if (defenseTable) {
        if (defense === "ignore") {
            index = atkResult;
        } else {
            index = `${atkResult}:${defResult}`;
        }
        outcome = defenseTable[index];
    }

    if (!outcome) return null;

    const result = { outcome, desc: "No result" };

    if (outcome.atkDice && !outcome.defDice) {
        result.desc = `Missile strikes for ${diceFormula(outcome.atkDice, atkAddlImpact)} impact.`;
    } else if (outcome.wild) {
        result.desc = "Missile goes wild; effects at GM discretion.";
    } else if (outcome.block) {
        result.desc = "Defender blocks missile!";
    } else if (outcome.miss) {
        result.desc = "Missile missed.";
    }

    return result;
}

function diceFormula(numDice, addlImpact) {
    if (numDice <= 0) return "no";
    if (addlImpact) {
        return `${numDice}d6${addlImpact < 0 ? "-" : "+"}${Math.abs(addlImpact)}`;
    }
    return `${numDice}d6`;
}
