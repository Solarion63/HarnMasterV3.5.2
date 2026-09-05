import { DiceHM3 } from "./dice-hm3.js";
import * as utility from "./utility.js";
import { HM3 } from "./config.js";
import { getItem } from "./item-lookup.js";

async function getItemAndActor(itemName, myActor, type) {
    let result = { actor: myActor, item: null, speaker: ChatMessage.getSpeaker() };
    if (itemName) {
        result.item = await getItem(itemName, type, myActor);
        if (!result.item) return null;
        myActor = result.item.actor || myActor;

        if (result.item.type !== type) {
            ui.notifications.warn(
                `Ignoring ${HM3.ITEM_TYPE_LABEL[type].singular} test because ${result.item.name} is not a ${HM3.ITEM_TYPE_LABEL[type].singular}`
            );
            return null;
        }
    }

    result.actor = myActor;
    result = getActor(result);
    if (!result) {
        ui.notifications.warn("No actor for this action could be determined.");
        return null;
    }
    return result;
}

export async function skillRoll(itemName, noDialog = false, myActor = null) {
    const itemInfo = await getItemAndActor(itemName, myActor, "skill");
    if (!itemInfo) return null;
    const { actor, item, speaker } = itemInfo;

    const stdRollData = {
        type: `skill-${item.name}`,
        label: `${item.name} Skill Test`,
        target: item.system.effectiveMasteryLevel,
        notesData: {
            up: actor.system.universalPenalty,
            pp: actor.system.physicalPenalty,
            il: actor.system.eph.totalInjuryLevels || 0,
            fatigue: actor.system.eph.fatigue,
            eml: item.system.effectiveMasteryLevel,
            ml: item.system.masteryLevel,
            sb: item.system.skillBase.value,
            si: item.system.skillIndex
        },
        speaker,
        fastforward: noDialog,
        notes: item.system.notes
    };
    if (actor.isToken) stdRollData.token = actor.token.id;
    else stdRollData.actor = actor.id;

    if (!Hooks.call("hm3.preSkillRoll", stdRollData, actor, item)) return null;
    const result = await DiceHM3.d100StdRoll(stdRollData);
    if (result) {
        item.runCustomMacro(result);
        callOnHooks("hm3.onSkillRoll", actor, result, stdRollData, item);
    }
    return result;
}

export async function castSpellRoll(itemName, noDialog = false, myActor = null) {
    const itemInfo = await getItemAndActor(itemName, myActor, "spell");
    if (!itemInfo) return null;
    const { actor, item, speaker } = itemInfo;

    const stdRollData = {
        type: `spell-${item.name}`,
        label: `Casting ${item.name}`,
        target: item.system.effectiveMasteryLevel,
        notesData: {
            up: actor.system.universalPenalty,
            pp: actor.system.physicalPenalty,
            il: actor.system.eph.totalInjuryLevels || 0,
            fatigue: actor.system.eph.fatigue,
            eml: item.system.effectiveMasteryLevel,
            ml: item.system.masteryLevel,
            sb: item.system.skillBase,
            si: item.system.skillIndex,
            spellName: item.name,
            convocation: item.system.convocation,
            level: item.system.level
        },
        speaker,
        fastforward: noDialog,
        notes: item.system.notes
    };
    if (actor.isToken) stdRollData.token = actor.token.id;
    else stdRollData.actor = actor.id;

    if (!Hooks.call("hm3.preSpellRoll", stdRollData, actor, item)) return null;
    const result = await DiceHM3.d100StdRoll(stdRollData);
    if (result) {
        item.runCustomMacro(result);
        callOnHooks("hm3.onSpellRoll", actor, result, stdRollData, item);
    }
    return result;
}

export async function invokeRitualRoll(itemName, noDialog = false, myActor = null) {
    const itemInfo = await getItemAndActor(itemName, myActor, "invocation");
    if (!itemInfo) return null;
    const { actor, item, speaker } = itemInfo;

    const stdRollData = {
        type: `invocation-${item.name}`,
        label: `Invoking ${item.name} Ritual`,
        target: item.system.effectiveMasteryLevel,
        notesData: {
            up: actor.system.universalPenalty,
            pp: actor.system.physicalPenalty,
            il: actor.system.eph.totalInjuryLevels || 0,
            fatigue: actor.system.eph.fatigue,
            eml: item.system.effectiveMasteryLevel,
            ml: item.system.masteryLevel,
            sb: item.system.skillBase,
            si: item.system.skillIndex,
            invocationName: item.name,
            diety: item.system.diety,
            circle: item.system.circle
        },
        speaker,
        fastforward: noDialog,
        notes: item.system.notes
    };
    if (actor.isToken) stdRollData.token = actor.token.id;
    else stdRollData.actor = actor.id;

    if (!Hooks.call("hm3.preInvocationRoll", stdRollData, actor, item)) return null;
    const result = await DiceHM3.d100StdRoll(stdRollData);
    if (result) {
        item.runCustomMacro(result);
        callOnHooks("hm3.onInvocationRoll", actor, result, stdRollData, item);
    }
    return result;
}

export async function usePsionicRoll(itemName, noDialog = false, myActor = null) {
    const itemInfo = await getItemAndActor(itemName, myActor, "psionic");
    if (!itemInfo) return null;
    const { actor, item, speaker } = itemInfo;

    const stdRollData = {
        type: `psionic-${item.name}`,
        label: `Using ${item.name} Talent`,
        target: item.system.effectiveMasteryLevel,
        notesData: {
            up: actor.system.universalPenalty,
            pp: actor.system.physicalPenalty,
            il: actor.system.eph.totalInjuryLevels || 0,
            fatigue: actor.system.eph.fatigue,
            eml: item.system.effectiveMasteryLevel,
            ml: item.system.masteryLevel,
            sb: item.system.skillBase.value,
            si: item.system.skillIndex,
            psionicName: item.name,
            fatigueCost: item.system.fatigue
        },
        speaker,
        fastforward: noDialog,
        notes: item.system.notes
    };
    if (actor.isToken) stdRollData.token = actor.token.id;
    else stdRollData.actor = actor.id;

    if (!Hooks.call("hm3.prePsionicsRoll", stdRollData, actor, item)) return null;
    const result = await DiceHM3.d100StdRoll(stdRollData);
    if (result) {
        item.runCustomMacro(result);
        callOnHooks("hm3.onPsionicsRoll", actor, result, stdRollData, item);
    }
    return result;
}

export async function testAbilityD6Roll(ability, noDialog = false, myActor = null) {
    const actorInfo = getActor({ actor: myActor, item: null, speaker: ChatMessage.getSpeaker() });
    if (!actorInfo) return null;

    let abilities;
    if (["character", "creature"].includes(actorInfo.actor.type)) {
        abilities = Object.keys(actorInfo.actor.system?.abilities ?? {});
    } else {
        ui.notifications.warn(`${actorInfo.actor.name} does not have ability scores.`);
        return null;
    }
    if (!ability || !abilities.includes(ability)) return null;

    const stdRollData = {
        type: `${ability}-d6`,
        label: `d6 ${ability[0].toUpperCase()}${ability.slice(1)} Roll`,
        target: actorInfo.actor.system.abilities[ability].effective,
        numdice: 3,
        notesData: {},
        speaker: actorInfo.speaker,
        fastforward: noDialog,
        notes: ""
    };
    if (actorInfo.actor.isToken) stdRollData.token = actorInfo.actor.token.id;
    else stdRollData.actor = actorInfo.actor.id;

    if (!Hooks.call("hm3.preAbilityRollD6", stdRollData, actorInfo.actor)) return null;
    const result = await DiceHM3.d6Roll(stdRollData);
    if (result) {
        actorInfo.actor.runCustomMacro(result);
        callOnHooks("hm3.onAbilityRollD6", actorInfo.actor, result, stdRollData);
    }
    return result;
}

export async function testAbilityD100Roll(ability, noDialog = false, myActor = null, multiplier = 5) {
    const actorInfo = getActor({ actor: myActor, item: null, speaker: ChatMessage.getSpeaker() });
    if (!actorInfo) return null;

    let abilities;
    if (["character", "creature"].includes(actorInfo.actor.type)) {
        abilities = Object.keys(actorInfo.actor.system?.abilities ?? {});
    } else {
        ui.notifications.warn(`${actorInfo.actor.name} does not have ability scores.`);
        return null;
    }
    if (!ability || !abilities.includes(ability)) return null;

    const stdRollData = {
        type: `${ability}-d100`,
        label: `d100 ${ability[0].toUpperCase()}${ability.slice(1)} Roll`,
        target: Math.max(5, actorInfo.actor.system.abilities[ability].effective * multiplier),
        notesData: {},
        speaker: actorInfo.speaker,
        fastforward: noDialog,
        notes: ""
    };
    if (actorInfo.actor.isToken) stdRollData.token = actorInfo.actor.token.id;
    else stdRollData.actor = actorInfo.actor.id;

    if (!Hooks.call("hm3.preAbilityRollD100", stdRollData, actorInfo.actor)) return null;
    const result = await DiceHM3.d100StdRoll(stdRollData);
    if (result) {
        actorInfo.actor.runCustomMacro(result);
        callOnHooks("hm3.onAbilityRollD100", actorInfo.actor, result, stdRollData);
    }
    return result;
}

export async function weaponDamageRoll(itemName, aspect = null, myActor = null) {
    if (aspect && !HM3.allowedAspects.includes(aspect)) {
        ui.notifications.warn(`Invalid aspect requested on damage roll: ${aspect}`);
        return null;
    }

    const itemInfo = await getItemAndActor(itemName, myActor, "weapongear");
    if (!itemInfo) return null;
    const { actor, item, speaker } = itemInfo;
    const rollData = {
        notesData: {
            up: actor.system.universalPenalty,
            pp: actor.system.physicalPenalty,
            il: actor.system.eph.totalInjuryLevels || 0,
            fatigue: actor.system.eph.fatigue,
            weaponName: item.name
        },
        weapon: item.name,
        data: actor,
        speaker,
        aspect,
        notes: item.system.notes
    };
    if (actor.isToken) rollData.token = actor.token.id;
    else rollData.actor = actor.id;

    if (!Hooks.call("hm3.preDamageRoll", rollData, actor)) return null;
    const result = await DiceHM3.damageRoll(rollData);
    if (result) callOnHooks("hm3.onDamageRoll", actor, result, rollData);
    return result;
}

export async function missileDamageRoll(itemName, range = null, myActor = null) {
    myActor &&= myActor instanceof Actor ? myActor : await fromUuid(myActor);
    if (range && !HM3.allowedRanges.includes(range)) {
        ui.notifications.warn(`Invalid range requested on damage roll: ${range}`);
        return null;
    }

    const itemInfo = await getItemAndActor(itemName, myActor, "missilegear");
    if (!itemInfo) return null;
    const { actor, item, speaker } = itemInfo;
    const rollData = {
        notesData: {
            up: actor.system.universalPenalty,
            pp: actor.system.physicalPenalty,
            il: actor.system.eph.totalInjuryLevels || 0,
            fatigue: actor.system.eph.fatigue,
            missileName: item.name,
            aspect: item.system.weaponAspect
        },
        name: item.name,
        aspect: item.system.weaponAspect,
        defaultRange: range,
        impactShort: item.system.impact.short,
        impactMedium: item.system.impact.medium,
        impactLong: item.system.impact.long,
        impactExtreme: item.system.impact.extreme,
        data: actor,
        speaker,
        notes: item.system.notes
    };
    if (actor.isToken) rollData.token = actor.token.id;
    else rollData.actor = actor.id;

    if (!Hooks.call("hm3.preMissileDamageRoll", rollData, actor, item)) return null;
    const result = await DiceHM3.missileDamageRoll(rollData);
    if (result) callOnHooks("hm3.onMissileDamageRoll", actor, result, rollData, item);
    return result;
}

export async function weaponAttackRoll(itemName, noDialog = false, myActor = null) {
    const itemInfo = await getItemAndActor(itemName, myActor, "weapongear");
    if (!itemInfo) return null;
    const { actor, item, speaker } = itemInfo;
    const stdRollData = {
        label: `${item.name} Attack`,
        target: item.system.attackMasteryLevel,
        notesData: {
            up: actor.system.universalPenalty,
            pp: actor.system.physicalPenalty,
            il: actor.system.eph.totalInjuryLevels || 0,
            fatigue: actor.system.eph.fatigue,
            ml: item.system.masteryLevel,
            sb: item.system.skillBase,
            si: item.system.skillIndex,
            weaponName: item.name,
            attack: item.system.attack,
            atkMod: item.system.attackModifier,
            aml: item.system.attackMasteryLevel
        },
        speaker,
        fastforward: noDialog,
        notes: item.system.notes
    };
    if (actor.isToken) stdRollData.token = actor.token.id;
    else stdRollData.actor = actor.id;

    if (!Hooks.call("hm3.preWeaponAttackRoll", stdRollData, actor, item)) return null;
    const result = await DiceHM3.d100StdRoll(stdRollData);
    if (result) callOnHooks("hm3.onWeaponAttackRoll", actor, result, stdRollData, item);
    return result;
}

export async function weaponDefendRoll(itemName, noDialog = false, myActor = null) {
    const itemInfo = await getItemAndActor(itemName, myActor, "weapongear");
    if (!itemInfo) return null;
    const { actor, item, speaker } = itemInfo;
    const outnumberedMod = actor.system?.eph?.outnumbered > 1
        ? Math.floor(actor.system.eph.outnumbered - 1) * -10
        : 0;
    const stdRollData = {
        label: `${item.name} Defense`,
        target: item.system.defenseMasteryLevel,
        modifier: outnumberedMod,
        notesData: {
            up: actor.system.universalPenalty,
            pp: actor.system.physicalPenalty,
            il: actor.system.eph.totalInjuryLevels || 0,
            fatigue: actor.system.eph.fatigue,
            ml: item.system.masteryLevel,
            sb: item.system.skillBase,
            si: item.system.skillIndex,
            weaponName: item.name,
            defense: item.system.defense,
            dml: item.system.defenseMasteryLevel
        },
        speaker,
        fastforward: noDialog,
        notes: item.system.notes
    };
    if (actor.isToken) stdRollData.token = actor.token.id;
    else stdRollData.actor = actor.id;

    if (!Hooks.call("hm3.preWeaponDefendRoll", stdRollData, actor, item)) return null;
    const result = await DiceHM3.d100StdRoll(stdRollData);
    if (result) callOnHooks("hm3.onWeaponDefendRoll", actor, result, stdRollData, item);
    return result;
}

export async function missileAttackRoll(itemName, myActor = null) {
    const itemInfo = await getItemAndActor(itemName, myActor, "missilegear");
    if (!itemInfo) return null;
    const { actor, item, speaker } = itemInfo;
    const rollData = {
        notesData: {
            up: actor.system.universalPenalty,
            pp: actor.system.physicalPenalty,
            il: actor.system.eph.totalInjuryLevels || 0,
            fatigue: actor.system.eph.fatigue,
            missileName: item.name
        },
        name: item.name,
        target: item.system.attackMasteryLevel,
        aspect: item.system.weaponAspect,
        rangeShort: item.system.range.short,
        rangeMedium: item.system.range.medium,
        rangeLong: item.system.range.long,
        rangeExtreme: item.system.range.extreme,
        data: item,
        speaker,
        notes: item.system.notes
    };
    if (actor.isToken) rollData.token = actor.token.id;
    else rollData.actor = actor.id;

    if (!Hooks.call("hm3.preMissileAttackRoll", rollData, actor, item)) return null;
    const result = await DiceHM3.missileAttackRoll(rollData);
    if (result) callOnHooks("hm3.onMissileAttackRoll", actor, result, rollData, item);
    return result;
}

export async function injuryRoll(myActor = null, rollData = {}) {
    const actorInfo = getActor({ actor: myActor, item: null, speaker: ChatMessage.getSpeaker() });
    if (!actorInfo) return null;

    rollData.notesData = {};
    rollData.actor = actorInfo.actor;
    rollData.speaker = actorInfo.speaker;
    rollData.name = actorInfo.actor.token ? actorInfo.actor.token.name : actorInfo.actor.name;
    rollData.notes = "";

    if (!Hooks.call("hm3.preInjuryRoll", rollData, actorInfo.actor)) return null;
    const result = await DiceHM3.injuryRoll(rollData);
    if (result) callOnHooks("hm3.onInjuryRoll", actorInfo.actor, result, rollData);
    return result;
}

export async function healingRoll(itemName, noDialog = false, myActor = null) {
    const itemInfo = await getItemAndActor(itemName, myActor, "injury");
    if (!itemInfo) return null;
    const { actor, item, speaker } = itemInfo;
    const stdRollData = {
        type: "healing",
        label: `${item.name} Healing Roll`,
        target: item.system.healRate * actor.system.endurance,
        notesData: {
            up: actor.system.universalPenalty,
            pp: actor.system.physicalPenalty,
            il: actor.system.eph.totalInjuryLevels || 0,
            fatigue: actor.system.eph.fatigue,
            endurance: actor.system.endurance,
            injuryName: item.name,
            healRate: item.system.healRate
        },
        speaker,
        fastforward: noDialog,
        notes: item.system.notes
    };
    if (actor.isToken) stdRollData.token = actor.token.id;
    else stdRollData.actor = actor.id;

    if (!Hooks.call("hm3.preHealingRoll", stdRollData, actor, item)) return null;
    const result = await DiceHM3.d100StdRoll(stdRollData);
    if (result) {
        item.runCustomMacro(result);
        callOnHooks("hm3.onHealingRoll", actor, result, stdRollData, item);
    }
    return result;
}

export async function dodgeRoll(noDialog = false, myActor = null) {
    const actorInfo = getActor({ actor: myActor, item: null, speaker: ChatMessage.getSpeaker() });
    if (!actorInfo) return null;
    const stdRollData = {
        type: "dodge",
        label: "Dodge Roll",
        target: actorInfo.actor.system.dodge,
        notesData: {},
        speaker: actorInfo.speaker,
        fastforward: noDialog,
        notes: ""
    };
    if (actorInfo.actor.isToken) stdRollData.token = actorInfo.actor.token.id;
    else stdRollData.actor = actorInfo.actor.id;

    if (!Hooks.call("hm3.preDodgeRoll", stdRollData, actorInfo.actor)) return null;
    const result = await DiceHM3.d100StdRoll(stdRollData);
    if (result) callOnHooks("hm3.onDodgeRoll", actorInfo.actor, result, stdRollData);
    return result;
}

export async function shockRoll(noDialog = false, myActor = null) {
    const actorInfo = getActor({ actor: myActor, item: null, speaker: ChatMessage.getSpeaker() });
    if (!actorInfo) return null;
    const stdRollData = {
        type: "shock",
        label: "Shock Roll",
        target: actorInfo.actor.system.endurance,
        numdice: actorInfo.actor.system.universalPenalty,
        notesData: {},
        speaker: actorInfo.speaker,
        fastforward: noDialog,
        notes: ""
    };
    if (actorInfo.actor.isToken) stdRollData.token = actorInfo.actor.token.id;
    else stdRollData.actor = actorInfo.actor.id;

    if (!Hooks.call("hm3.preShockRoll", stdRollData, actorInfo.actor)) return null;
    const result = await DiceHM3.d6Roll(stdRollData);
    if (result) {
        actorInfo.actor.runCustomMacro(result);
        callOnHooks("hm3.onShockRoll", actorInfo.actor, result, stdRollData);
    }
    return result;
}

export async function stumbleRoll(noDialog = false, myActor = null) {
    const actorInfo = getActor({ actor: myActor, item: null, speaker: ChatMessage.getSpeaker() });
    if (!actorInfo) return null;
    const stdRollData = {
        type: "stumble",
        label: `${actorInfo.actor.isToken ? actorInfo.actor.token.name : actorInfo.actor.name} Stumble Roll`,
        target: actorInfo.actor.system.eph.stumbleTarget,
        numdice: 3,
        notesData: {},
        speaker: actorInfo.speaker,
        fastforward: noDialog,
        notes: ""
    };
    if (actorInfo.actor.isToken) stdRollData.token = actorInfo.actor.token.id;
    else stdRollData.actor = actorInfo.actor.id;

    if (!Hooks.call("hm3.preStumbleRoll", stdRollData, actorInfo.actor)) return null;
    const result = await DiceHM3.d6Roll(stdRollData);
    if (result) {
        actorInfo.actor.runCustomMacro(result);
        callOnHooks("hm3.onStumbleRoll", actorInfo.actor, result, stdRollData);
    }
    return result;
}

export async function fumbleRoll(noDialog = false, myActor = null) {
    const actorInfo = getActor({ actor: myActor, item: null, speaker: ChatMessage.getSpeaker() });
    if (!actorInfo) return null;
    const stdRollData = {
        type: "fumble",
        label: `${actorInfo.actor.isToken ? actorInfo.actor.token.name : actorInfo.actor.name} Fumble Roll`,
        target: actorInfo.actor.system.eph.fumbleTarget,
        numdice: 3,
        notesData: {},
        speaker: actorInfo.speaker,
        fastforward: noDialog,
        notes: ""
    };
    if (actorInfo.actor.isToken) stdRollData.token = actorInfo.actor.token.id;
    else stdRollData.actor = actorInfo.actor.id;

    if (!Hooks.call("hm3.preFumbleRoll", stdRollData, actorInfo.actor)) return null;
    const result = await DiceHM3.d6Roll(stdRollData);
    if (result) {
        actorInfo.actor.runCustomMacro(result);
        callOnHooks("hm3.onFumbleRoll", actorInfo.actor, result, stdRollData);
    }
    return result;
}

export async function genericDamageRoll(myActor = null) {
    const actorInfo = getActor({ actor: myActor, item: null, speaker: ChatMessage.getSpeaker() });
    if (!actorInfo) return null;
    const rollData = {
        weapon: "",
        data: actorInfo.actor,
        speaker: actorInfo.speaker,
        notesData: {},
        notes: ""
    };
    if (actorInfo.actor.isToken) rollData.token = actorInfo.actor.token.id;
    else rollData.actor = actorInfo.actor.id;

    if (!Hooks.call("hm3.preDamageRoll", rollData, actorInfo.actor)) return null;
    const result = await DiceHM3.damageRoll(rollData);
    if (result) callOnHooks("hm3.onDamageRoll", actorInfo.actor, result, rollData);
    return result;
}

export async function changeFatigue(newValue, myActor = null) {
    const actorInfo = getActor({ actor: myActor, item: null, speaker: ChatMessage.getSpeaker() });
    if (!actorInfo) return null;

    const updateData = {};
    if (/^\s*[+-]/.test(newValue)) {
        const changeValue = parseInt(newValue, 10);
        if (!Number.isNaN(changeValue)) {
            updateData["system.fatigue"] = Math.max(actorInfo.actor.system.fatigue + changeValue, 0);
        }
    } else {
        const value = parseInt(newValue, 10);
        if (!Number.isNaN(value)) updateData["system.fatigue"] = value;
    }
    if (typeof updateData["system.fatigue"] !== "undefined") await actorInfo.actor.update(updateData);
    return true;
}

// Public name retained for compatibility with existing world macros.
export async function changeMissileQuanity(missileName, newValue, myActor = null) {
    myActor &&= myActor instanceof Actor ? myActor : await fromUuid(myActor);
    const missile = await getItem(missileName, "missilegear", myActor);
    if (!missile) return null;

    const actorInfo = getActor({
        actor: missile.parent ?? myActor,
        item: missile,
        speaker: ChatMessage.getSpeaker({ actor: missile.parent ?? myActor })
    });
    if (!actorInfo) return null;

    const updateData = {};
    if (/^\s*[+-]/.test(newValue)) {
        const changeValue = parseInt(newValue, 10);
        if (!Number.isNaN(changeValue)) {
            updateData["system.quantity"] = Math.max(Number(missile.system.quantity) + changeValue, 0);
        }
    } else {
        const value = parseInt(newValue, 10);
        if (!Number.isNaN(value)) updateData["system.quantity"] = value;
    }
    if (typeof updateData["system.quantity"] !== "undefined") await missile.update(updateData);
    return true;
}

export async function setSkillDevelopmentFlag(skillName, myActor = null) {
    myActor &&= myActor instanceof Actor ? myActor : await fromUuid(myActor);
    const skill = await getItem(skillName, "skill", myActor);
    if (!skill) return null;

    const actorInfo = getActor({
        actor: skill.parent ?? myActor,
        item: skill,
        speaker: ChatMessage.getSpeaker({ actor: skill.parent ?? myActor })
    });
    if (!actorInfo) return null;
    if (!skill.system.improveFlag) await skill.update({ "system.improveFlag": true });
    return true;
}

function getActor({ item, actor, speaker } = {}) {
    const result = { item, actor, speaker };
    if (item?.actor) {
        result.actor = item.actor;
        result.speaker = ChatMessage.getSpeaker({ actor: result.actor });
    } else if (result.actor instanceof Actor) {
        result.speaker ||= ChatMessage.getSpeaker({ actor: result.actor });
    } else {
        if (!result.actor) {
            result.speaker = speaker ?? ChatMessage.getSpeaker();
            if (result.speaker?.token) result.actor = canvas.tokens.get(result.speaker.token)?.actor ?? null;
            else if (result.speaker?.actor) result.actor = game.actors.get(result.speaker.actor) ?? null;
        } else {
            result.actor = fromUuidSync(result.actor);
            result.speaker = ChatMessage.getSpeaker({ actor: result.actor });
        }
    }

    if (!result.actor) {
        ui.notifications.warn("No actor selected, roll ignored.");
        return null;
    }
    if (!result.actor.isOwner) {
        ui.notifications.warn(`You do not have permissions to control ${result.actor.name}.`);
        return null;
    }
    return result;
}

export function callOnHooks(hook, actor, result, rollData, item = null) {
    const rollResult = {
        type: result.type,
        title: result.title,
        origTarget: result.origTarget,
        modifier: (result.plusMinus === "-" ? -1 : 1) * result.modifier,
        modifiedTarget: result.modifiedTarget,
        rollValue: result.rollValue,
        isSuccess: result.isSuccess,
        isCritical: result.isCritical,
        result: result.isSuccess
            ? (result.isCritical ? "CS" : "MS")
            : (result.isCritical ? "CF" : "MF"),
        description: result.description,
        notes: result.notes
    };

    const foundMacro = game.macros.getName(hook);
    if (foundMacro && !foundMacro.hasPlayerOwner) {
        const token = actor?.isToken ? actor.token : null;
        utility.executeMacroScript(foundMacro, { actor, token, rollResult, rollData, item });
    }

    if (item) return Hooks.call(hook, actor, rollResult, rollData, item);
    return Hooks.call(hook, actor, rollResult, rollData);
}
