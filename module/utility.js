import { HM3 } from './config.js';

/**
 * Determines whether the Skill Base Formula is valid. We perform that
 * validation here so even a skill not associated with a particular
 * actor can have its formula validated.
 * 
 * A valid SB formula looks like this:
 * 
 *   "@str, @int, @sta, hirin:2, ahnu, 5"
 * 
 * meaning
 *   average STR, INT, and STA
 *   add 2 if sunsign hirin (modifier after colon ":")
 *   add 1 if sunsign ahnu (1 since no modifier specified)
 *   add 5 to result
 * 
 * A valid formula must have exactly 3 abilities, everything else is optional.
 * 
 * The result of this function is to set the "isFormulaValid" value appropriately.
 * 
 * @param {Object} item
 */
export function calcSkillBase(item) {
    const sb = item.system.skillBase;

    sb.delta = 0;
    sb.isFormulaValid = true;
    if (sb.formula === '') {
        return;
    }

    let actorData = null;
    if (item.actor?.system) {
        actorData = item.actor.system;
    }

    let numAbilities = 0;
    let sumBaseAbilities = 0;
    let sumModifiedAbilities = 0;
    let ssBonus = Number.MIN_SAFE_INTEGER;
    let modifier = 0;

    const sbParts = sb.formula.toLowerCase().split(',');

    if (sbParts.length < 3) {
        sb.isFormulaValid = false;
    } else {
        for (let param of sbParts) {
            if (!sb.isFormulaValid) break;

            param = param.trim();
            if (param != '') {
                if (param.startsWith('@')) {
                    if (param.length === 1) {
                        sb.isFormulaValid = false;
                        break;
                    }
                    if (numAbilities >= 3) {
                        sb.isFormulaValid = false;
                        break;
                    }

                    if (actorData) {
                        const paramName = param.slice(1);
                        switch (paramName) {
                            case 'str':
                                sumBaseAbilities += actorData.abilities.strength.base;
                                sumModifiedAbilities += actorData.abilities.strength.modified;
                                break;
                            case 'sta':
                                sumBaseAbilities += actorData.abilities.stamina.base;
                                sumModifiedAbilities += actorData.abilities.stamina.modified;
                                break;
                            case 'dex':
                                sumBaseAbilities += actorData.abilities.dexterity.base;
                                sumModifiedAbilities += actorData.abilities.dexterity.modified;
                                break;
                            case 'agl':
                                sumBaseAbilities += actorData.abilities.agility.base;
                                sumModifiedAbilities += actorData.abilities.agility.modified;
                                break;
                            case 'int':
                                sumBaseAbilities += actorData.abilities.intelligence.base;
                                sumModifiedAbilities += actorData.abilities.intelligence.modified;
                                break;
                            case 'aur':
                                sumBaseAbilities += actorData.abilities.aura.base;
                                sumModifiedAbilities += actorData.abilities.aura.modified;
                                break;
                            case 'wil':
                                sumBaseAbilities += actorData.abilities.will.base;
                                sumModifiedAbilities += actorData.abilities.will.modified;
                                break;
                            case 'eye':
                                sumBaseAbilities += actorData.abilities.eyesight.base;
                                sumModifiedAbilities += actorData.abilities.eyesight.modified;
                                break;
                            case 'hrg':
                                sumBaseAbilities += actorData.abilities.hearing.base;
                                sumModifiedAbilities += actorData.abilities.hearing.modified;
                                break;
                            case 'sml':
                                sumBaseAbilities += actorData.abilities.smell.base;
                                sumModifiedAbilities += actorData.abilities.smell.modified;
                                break;
                            case 'voi':
                                sumBaseAbilities += actorData.abilities.voice.base;
                                sumModifiedAbilities += actorData.abilities.voice.modified;
                                break;
                            case 'cml':
                                sumBaseAbilities += actorData.abilities.comeliness.base;
                                sumModifiedAbilities += actorData.abilities.comeliness.modified;
                                break;
                            case 'mor':
                                sumBaseAbilities += actorData.abilities.morality.base;
                                sumModifiedAbilities += actorData.abilities.morality.modified;
                                break;
                            case 'end':
                                sumBaseAbilities += actorData.abilities.endurance.base;
                                sumModifiedAbilities += actorData.abilities.endurance.modified;
                                break;
                            case 'spd':
                                sumBaseAbilities += actorData.abilities.speed.base;
                                sumModifiedAbilities += actorData.abilities.speed.modified;
                                break;
                            default:
                                sb.isFormulaValid = false;
                                return;
                        }
                    }

                    numAbilities++;
                    continue;
                }

                if (param.match(/^[a-z]/)) {
                    let ssParts = param.split(':');
                    if (ssParts.length > 2) {
                        sb.isFormulaValid = false;
                        break;
                    }
                    if (ssParts.length === 2 && !ssParts[1].trim().match(/[-+]?\d+/)) {
                        sb.isFormulaValid = false;
                        break;
                    }

                    if (actorData) {
                        let actorSS = actorData.sunsign.trim().toLowerCase().split(/[-\/]/);
                        actorSS.map(Function.prototype.call, String.prototype.trim);
                        if (actorSS.includes(ssParts[0])) {
                            ssBonus = Math.max(ssParts.length === 2 ? Number(ssParts[1].trim()) : 1, ssBonus);
                        }
                    }
                    continue;
                }

                if (param.match(/^[-+]?\d+$/)) {
                    modifier += Number(param);
                } else {
                    sb.isFormulaValid = false;
                    break;
                }
            }
        }
    }

    if (numAbilities != 3) {
        sb.isFormulaValid = false;
    }

    if (actorData && sb.isFormulaValid) {
        ssBonus = ssBonus > Number.MIN_SAFE_INTEGER ? ssBonus : 0;
        sb.value = Math.round((sumModifiedAbilities / 3) + Number.EPSILON) + ssBonus + modifier;
        if (sumBaseAbilities !== sumModifiedAbilities) {
            sb.delta = (sumModifiedAbilities / 3) - (sumBaseAbilities / 3);
        }
    }
}

export function createUniqueName(prefix, itemTypes) {
    let incr = 0;
    itemTypes.forEach(it => {
        if (prefix === it.name) {
            incr = Math.max(1, incr);
        } else {
            const match = it.name.match(`${prefix}-(\\d+)`);
            if (match) {
                const newIncr = Number(match[1]) + 1;
                incr = Math.max(newIncr, incr);
            }
        }
    });

    return incr ? `${prefix}-${incr}` : prefix;
}

/**
 * Returns the path to the appropriate image name for the specified item name.
 * @param {String} name
 */
export function getImagePath(name) {
    if (!name) return null;

    const lcName = name.toLowerCase();
    const re = /\(([^\)]+)\)/;

    for (let key of HM3.defaultItemIcons.keys()) {
        if (lcName === key) {
            return HM3.defaultItemIcons.get(key);
        }

        const match = re.exec(lcName);
        if (match && key === match[1]) {
            return HM3.defaultItemIcons.get(key);
        }

        if (lcName.startsWith(key)) {
            return HM3.defaultItemIcons.get(key);
        }
    }

    return null;
}

export function getAssocSkill(name, skillsItemArray, defaultSkill) {
    if (!name || !skillsItemArray || !skillsItemArray.length) return defaultSkill;

    const skills = skillsItemArray.map(s => s.data.name);
    const lcName = name.toLowerCase();
    const re = /\[([^\)]+)\]/i;

    let skillMatch = skills.find(s => s.toLowerCase() === lcName);
    if (skillMatch) return skillMatch;

    let subSkillMatch = re.exec(name);
    if (subSkillMatch) {
        const lcSubSkill = subSkillMatch[1].toLowerCase();
        skillMatch = skills.find(s => s.toLowerCase() === lcSubSkill);
        if (skillMatch) return skillMatch;
    }

    return defaultSkill;
}

/**
 * String replacer function that applies the `text` string replacement
 * mechanism to an arbitrary string.
 */
export function stringReplacer(template, values) {
    var keys = Object.keys(values);
    var func = Function(...keys, "return `" + template + "`;" );
    return func(...keys.map(k => values[k]));
}

/** Convert an integer into a roman numeral. */
export function romanize(num) {
    if (isNaN(num)) return NaN;
    var digits = String(+num).split(""),
        key = ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM",
            "", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC",
            "", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"],
        roman = "",
        i = 3;
    while (i--)
        roman = (key[+digits.pop() + (i * 10)] || "") + roman;
    return Array(+digits.join("") + 1).join("M") + roman;
}

/**
 * Return Active Effect duration data in the legacy HM3 view-model shape while
 * using Foundry v14's prepared duration as the sole source of truth.
 */
export function aeDuration(effect) {
    const duration = effect?.duration;
    if (!duration || duration.value === null) {
        return {
            type: "none",
            duration: null,
            remaining: null,
            label: "None"
        };
    }

    return {
        type: duration.units,
        duration: duration.value,
        remaining: duration.remaining,
        label: duration.label || (duration.expired ? "None" : String(duration.remaining))
    };
}

export function aeChanges(effect) {
    if (!effect.changes || !effect.changes.length) {
        return 'No Changes';
    }

    return effect.changes.map(ch => {
        const types = CONST.ACTIVE_EFFECT_CHANGE_TYPES;
        const key = ch.key;
        let val = 0;
        let prefix = '';
        const parts = parseAEValue(ch.value);
        if (parts.length === 2) {
            val = Number.parseInt(parts[1], 10) || 0;
            const itemName = parts[0];
            switch(key) {
                case 'system.eph.itemEMLMod':
                    prefix = `${itemName} EML`;
                    break;
                case 'system.eph.itemAMLMod':
                    prefix = `${itemName} AML`;
                    break;
                case 'system.eph.itemDMLMod':
                    prefix = `${itemName} DML`;
                    break;
            }
        } else {
            val = ch.value;
            prefix = HM3.activeEffectKey[key];
        }
        switch (ch.type) {
            case types.ADD:
                return `${prefix} ${val < 0 ? '-' : '+'} ${Math.abs(val)}`;
            case types.MULTIPLY:
                return `${prefix} x ${val}`;
            case types.OVERRIDE:
                return `${prefix} = ${val}`;
            case types.UPGRADE:
                return `${prefix} >= ${val}`;
            case types.DOWNGRADE:
                return `${prefix} <= ${val}`;
            default:
                return `${prefix} custom`;
        }
    }).join(', ');
}

export function executeMacroScript(macro, { actor, token, rollResult, rollData, item } = {}) {
    let speaker = null;
    if (!actor) {
        if (!token) {
            speaker = ChatMessage.getSpeaker();
            actor = game.actors.get(speaker.actor);
            token = actor.isToken ? actor.token : null;
        } else {
            actor = token.actor;
            speaker = ChatMessage.getSpeaker({ token: token.document });
        }
    }

    speaker = speaker || ChatMessage.getSpeaker({ actor: actor });
    token = actor.isToken && !token ? actor.token : token;
    token = token || (canvas.ready ? canvas.tokens.get(speaker.token) : null);

    const context = {
        speaker: speaker,
        actor: actor,
        token: token,
        character: game.user.character,
        rollResult: rollResult,
        scene: canvas.scene
    };

    if (rollData) context.rollData = rollData;
    if (item) context.item = item;

    const asyncFunction = macro.command.includes("await") ? "async" : "";
    const itemParam = item ? ", item" : "";
    const rollDataParam = rollData ? ", rollData" : "";
    let result = null;
    try {
        result = (new Function(`"use strict";
            return (${asyncFunction} function ({speaker, actor, token, character, rollResult ${itemParam} ${rollDataParam}}={}) {
                ${macro.command}
                });`))().call(macro, context);
    } catch (err) {
        ui.notifications.error(`There was an error in your macro syntax. See the console (F12) for details`);
        console.error(err);
    }

    return result;
}

/**
 * Parse the legacy HM3 "Item Name: value" Active Effect encoding. Foundry v14
 * may provide typed change values, so non-string values are returned intact.
 */
export function parseAEValue(value) {
    if (typeof value !== 'string') return [value];

    const lastColon = value.lastIndexOf(':');
    if (lastColon === -1) return [value];
    const preString = value.slice(0, lastColon).trim();
    const postString = value.slice(lastColon + 1).trim();
    return [preString, postString];
}
