import { DiceHM3 } from "./dice-hm3.js";
import * as utility from "./utility.js";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

function currentMessageMode() {
  const mode = game.settings.get("core", "messageMode") ?? "public";
  return mode in CONFIG.ChatMessage.modes ? mode : "public";
}

function rangeModifier(range) {
  return {
    Short: 0,
    Medium: -20,
    Long: -40,
    Extreme: -80
  }[range] ?? -80;
}

async function evaluateD100(target, modifier, type, data) {
  const rollObj = await new Roll("1d100", data).evaluate();
  const baseTarget = Number(target) + Number(modifier);
  const modifiedTarget = Math.max(Math.min(baseTarget, 95), 5);
  const isCritical = rollObj.total % 5 === 0;
  const isSuccess = rollObj.total <= modifiedTarget;
  return {
    type,
    target: modifiedTarget,
    isCapped: baseTarget !== modifiedTarget,
    modifier: Number(modifier),
    rollObj,
    isCritical,
    isSuccess,
    description: `${isCritical ? "Critical" : "Marginal"} ${isSuccess ? "Success" : "Failure"}`
  };
}

function activeDieValues(roll) {
  const die = roll?.dice?.[0];
  if (!die) return [];
  if (Array.isArray(die.values)) return die.values;
  return Array.from(die.results ?? [])
    .filter(result => result.active !== false)
    .map(result => result.result);
}

DiceHM3.missileAttackDialog = async function missileAttackDialog(dialogOptions) {
  const rangeLabels = {
    [`Short (${dialogOptions.rangeShort})`]: "Short",
    [`Medium (${dialogOptions.rangeMedium})`]: "Medium",
    [`Long (${dialogOptions.rangeLong})`]: "Long",
    [`Extreme (${dialogOptions.rangeExtreme})`]: "Extreme"
  };
  const content = await renderTemplate("systems/hm3/templates/dialog/attack-dialog.html", {
    aimLocations: ["High", "Mid", "Low"],
    defaultAim: "Mid",
    defaultModifier: 0,
    target: dialogOptions.target,
    ranges: rangeLabels,
    defaultRange: Object.keys(rangeLabels).at(-1),
    rangeExceedsExtreme: false
  });

  return DialogV2.prompt({
    window: { title: dialogOptions.label ?? `${dialogOptions.name} Attack` },
    content: content.trim(),
    ok: {
      label: "Roll",
      callback: async (_event, _button, dialog) => {
        const form = dialog.element?.querySelector("form");
        if (!form) throw new Error("HM3 | Missile attack dialog form was not found.");

        const selectedLabel = form.elements.range?.value;
        const range = rangeLabels[selectedLabel] ?? "Extreme";
        const addlModifier = Number(form.elements.addlModifier?.value) || 0;
        const rm = rangeModifier(range);
        const test = await evaluateD100(
          dialogOptions.target,
          addlModifier + rm,
          dialogOptions.type,
          dialogOptions.data
        );

        return {
          type: test.type,
          origTarget: dialogOptions.target,
          range,
          rangeModifier: rm,
          addlModifier,
          modifiedTarget: Number(dialogOptions.target) + rm + addlModifier,
          isSuccess: test.isSuccess,
          isCritical: test.isCritical,
          description: test.description,
          rollObj: test.rollObj
        };
      }
    },
    rejectClose: false
  });
};

DiceHM3.missileAttackRoll = async function missileAttackRoll(rollData) {
  const speaker = rollData.speaker ?? ChatMessage.getSpeaker();
  const roll = await DiceHM3.missileAttackDialog(rollData);
  if (!roll) return null;

  const notesData = foundry.utils.mergeObject(rollData.notesData ?? {}, {
    actor: speaker.alias,
    aspect: rollData.aspect,
    range: roll.range,
    rangeModifier: roll.rangeModifier,
    addlModifier: roll.addlModifier,
    target: roll.modifiedTarget,
    isSuccess: roll.isSuccess,
    isCritical: roll.isCritical,
    isCS: roll.isSuccess && roll.isCritical,
    isMS: roll.isSuccess && !roll.isCritical,
    isMF: !roll.isSuccess && !roll.isCritical,
    isCF: !roll.isSuccess && roll.isCritical,
    roll: roll.rollObj.total
  });

  const templateData = {
    title: `${rollData.name} Attack`,
    aspect: rollData.aspect,
    range: roll.range,
    origTarget: rollData.target,
    rangeModifier: Math.abs(roll.rangeModifier),
    addlModifier: Math.abs(roll.addlModifier),
    amPlusMinus: roll.addlModifier < 0 ? "-" : "+",
    rmPlusMinus: roll.rangeModifier < 0 ? "-" : "+",
    modifiedTarget: roll.modifiedTarget,
    isSuccess: roll.isSuccess,
    isCritical: roll.isCritical,
    rollValue: roll.rollObj.total,
    description: roll.description,
    notes: rollData.notes ? utility.stringReplacer(rollData.notes, notesData) : "",
    roll
  };

  const content = await renderTemplate("systems/hm3/templates/chat/missile-attack-card.html", templateData);
  await ChatMessage.create({
    user: game.user.id,
    speaker,
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.ROLL,
    sound: CONFIG.sounds.dice,
    rolls: [roll.rollObj]
  }, {
    messageMode: currentMessageMode()
  });

  return templateData;
};

DiceHM3.missileDamageDialog = async function missileDamageDialog(dialogOptions) {
  const content = await renderTemplate("systems/hm3/templates/dialog/missile-damage-dialog.html", {
    name: dialogOptions.name,
    ranges: dialogOptions.ranges,
    defaultRange: dialogOptions.defaultRange
  });

  return DialogV2.prompt({
    window: { title: dialogOptions.label ?? `${dialogOptions.name} Missile Damage` },
    content: content.trim(),
    ok: {
      label: "Roll",
      callback: async (_event, _button, dialog) => {
        const form = dialog.element?.querySelector("form");
        if (!form) throw new Error("HM3 | Missile damage dialog form was not found.");

        const damageDice = Math.max(Number(form.elements.damageDice?.value) || 1, 1);
        return {
          type: dialogOptions.type,
          range: form.elements.range?.value ?? dialogOptions.defaultRange,
          damageDice,
          addlImpact: Number(form.elements.addlImpact?.value) || 0,
          rollObj: await new Roll(`${damageDice}d6`, dialogOptions.data).evaluate()
        };
      }
    },
    rejectClose: false
  });
};

DiceHM3.missileDamageRoll = async function missileDamageRoll(rollData) {
  const speaker = rollData.speaker ?? ChatMessage.getSpeaker();
  const ranges = {
    Short: Number(rollData.impactShort) || 0,
    Medium: Number(rollData.impactMedium) || 0,
    Long: Number(rollData.impactLong) || 0,
    Extreme: Number(rollData.impactExtreme) || 0
  };
  const roll = await DiceHM3.missileDamageDialog({
    name: rollData.name,
    ranges,
    defaultRange: rollData.defaultRange ?? "Extreme",
    data: rollData.data,
    type: "missile-damage"
  });
  if (!roll) return null;

  const rangeImpact = ranges[roll.range] ?? 0;
  const totalImpact = rangeImpact + Number(roll.addlImpact) + Number(roll.rollObj.total);
  const notesData = foundry.utils.mergeObject(rollData.notesData ?? {}, {
    actor: speaker.alias,
    aspect: rollData.aspect,
    range: roll.range,
    dice: Number(roll.damageDice),
    impact: rangeImpact,
    addlImpact: roll.addlImpact,
    totalImpact,
    roll: roll.rollObj.total
  });

  const templateData = {
    title: rollData.name ? `${rollData.name} Damage` : "Missile Damage",
    aspect: rollData.aspect,
    range: roll.range,
    damageDice: Number(roll.damageDice),
    rangeImpact,
    addlImpact: roll.addlImpact,
    totalImpact,
    impactRoll: activeDieValues(roll.rollObj).join(" + "),
    rollValue: roll.rollObj.total,
    notes: rollData.notes ? utility.stringReplacer(rollData.notes, notesData) : "",
    roll
  };

  const content = await renderTemplate("systems/hm3/templates/chat/missile-damage-card.html", templateData);
  await ChatMessage.create({
    user: game.user.id,
    speaker,
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.ROLL,
    sound: CONFIG.sounds.dice,
    rolls: [roll.rollObj]
  }, {
    messageMode: currentMessageMode()
  });

  return templateData;
};
