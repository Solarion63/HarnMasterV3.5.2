import { DiceHM3 } from "./dice-hm3.js";
import * as utility from "./utility.js";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

function currentMessageMode() {
  const mode = game.settings.get("core", "messageMode") ?? "public";
  return mode in CONFIG.ChatMessage.modes ? mode : "public";
}

function activeDieValues(roll) {
  const die = roll.dice?.[0];
  if (!die) return [];
  if (Array.isArray(die.values)) return die.values;
  return Array.from(die.results ?? [])
    .filter(result => result.active !== false)
    .map(result => result.result);
}

function dialogForm(dialog) {
  return dialog?.element?.querySelector("form") ?? null;
}

async function createRollMessage({ speaker, content, roll }) {
  return ChatMessage.create({
    user: game.user.id,
    speaker,
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.ROLL,
    sound: CONFIG.sounds.dice,
    rolls: [roll]
  }, {
    messageMode: currentMessageMode()
  });
}

DiceHM3.damageDialog = async function damageDialog(dialogOptions) {
  const content = await renderTemplate(
    dialogOptions.template ?? "systems/hm3/templates/dialog/damage-dialog.html",
    {
      weapon: dialogOptions.weapon,
      damageDice: 1,
      weaponAspect: dialogOptions.weaponAspect,
      weaponAspects: dialogOptions.weaponAspects,
      addlWeaponImpact: 0
    }
  );

  return DialogV2.prompt({
    window: { title: dialogOptions.label ?? `${dialogOptions.weapon || "Other"} Damage` },
    content: content.trim(),
    ok: {
      label: "Roll",
      callback: async (_event, _button, dialog) => {
        const form = dialogForm(dialog);
        if (!form) throw new Error("HM3 | Weapon damage dialog form was not found.");

        const roll = await DiceHM3.rollTest({
          type: dialogOptions.type,
          target: 0,
          data: dialogOptions.data,
          diceSides: 6,
          diceNum: Number(form.elements.damageDice?.value) || 1,
          modifier: 0
        });

        return {
          type: roll.type,
          chosenAspect: form.elements.weaponAspect?.value,
          damageDice: Number(form.elements.damageDice?.value) || 1,
          addlWeaponImpact: Number(form.elements.addlWeaponImpact?.value) || 0,
          rollObj: roll.rollObj
        };
      }
    },
    rejectClose: false
  });
};

DiceHM3.damageRoll = async function damageRoll(rollData) {
  const speaker = rollData.speaker ?? ChatMessage.getSpeaker();
  const weapon = DiceHM3.calcWeaponAspect(rollData.weapon, rollData.data.items);
  const roll = await DiceHM3.damageDialog({
    type: "damage",
    weapon: rollData.weapon,
    weaponAspect: rollData.aspect ?? weapon.defaultAspect,
    weaponAspects: weapon.aspects,
    data: rollData.actorData
  });
  if (!roll) return null;

  const totalImpact = Number(weapon.aspects[roll.chosenAspect] ?? 0)
    + Number(roll.addlWeaponImpact)
    + Number(roll.rollObj.total);
  const notesData = foundry.utils.mergeObject(rollData.notesData ?? {}, {
    actor: speaker.alias,
    aspect: roll.chosenAspect,
    dice: Number(roll.damageDice),
    impact: weapon.aspects[roll.chosenAspect] ?? 0,
    addlImpact: roll.addlWeaponImpact,
    totalImpact,
    roll: roll.rollObj.total
  });
  const notes = rollData.notes ? utility.stringReplacer(rollData.notes, notesData) : "";
  const templateData = {
    title: rollData.weapon ? `${rollData.weapon} Damage` : "Other Weapon Damage",
    weaponAspect: roll.chosenAspect,
    damageDice: Number(roll.damageDice),
    weaponImpact: weapon.aspects[roll.chosenAspect] ?? 0,
    addlWeaponImpact: roll.addlWeaponImpact,
    totalImpact,
    impactRoll: activeDieValues(roll.rollObj).join(" + "),
    rollValue: roll.rollObj.total,
    notes,
    roll
  };

  const content = await renderTemplate("systems/hm3/templates/chat/damage-card.html", templateData);
  await createRollMessage({ speaker, content, roll: roll.rollObj });
  return templateData;
};

DiceHM3.missileAttackDialog = async function missileAttackDialog(dialogOptions) {
  const ranges = {
    [`Short (${dialogOptions.rangeShort})`]: "Short",
    [`Medium (${dialogOptions.rangeMedium})`]: "Medium",
    [`Long (${dialogOptions.rangeLong})`]: "Long",
    [`Extreme (${dialogOptions.rangeExtreme})`]: "Extreme"
  };
  const content = await renderTemplate(
    dialogOptions.template ?? "systems/hm3/templates/dialog/attack-dialog.html",
    {
      aimLocations: ["High", "Mid", "Low"],
      defaultAim: "Mid",
      target: dialogOptions.target,
      ranges,
      rangeExceedsExtreme: false,
      defaultRange: Object.keys(ranges).at(-1)
    }
  );

  return DialogV2.prompt({
    window: { title: `${dialogOptions.name} Attack` },
    content: content.trim(),
    ok: {
      label: "Roll",
      callback: async (_event, _button, dialog) => {
        const form = dialogForm(dialog);
        if (!form) throw new Error("HM3 | Missile attack dialog form was not found.");

        const selected = form.elements.range?.value;
        const range = ranges[selected] ?? "Extreme";
        const rangeModifier = { Short: 0, Medium: -20, Long: -40, Extreme: -80 }[range];
        const addlModifier = Number(form.elements.addlModifier?.value) || 0;
        const roll = await DiceHM3.rollTest({
          type: dialogOptions.type,
          target: dialogOptions.target,
          data: dialogOptions.data,
          diceSides: 100,
          diceNum: 1,
          modifier: addlModifier + rangeModifier
        });

        return {
          type: roll.type,
          origTarget: dialogOptions.target,
          range,
          rangeModifier,
          addlModifier,
          modifiedTarget: roll.target,
          isSuccess: roll.isSuccess,
          isCritical: roll.isCritical,
          description: roll.description,
          rollObj: roll.rollObj
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
  const notes = rollData.notes ? utility.stringReplacer(rollData.notes, notesData) : "";
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
    notes,
    roll
  };

  const content = await renderTemplate("systems/hm3/templates/chat/missile-attack-card.html", templateData);
  await createRollMessage({ speaker, content, roll: roll.rollObj });
  return templateData;
};

DiceHM3.missileDamageDialog = async function missileDamageDialog(dialogOptions) {
  const content = await renderTemplate(
    dialogOptions.template ?? "systems/hm3/templates/dialog/missile-damage-dialog.html",
    {
      name: dialogOptions.name,
      ranges: dialogOptions.ranges,
      defaultRange: dialogOptions.defaultRange
    }
  );

  return DialogV2.prompt({
    window: { title: `${dialogOptions.name} Missile Damage` },
    content: content.trim(),
    ok: {
      label: "Roll",
      callback: async (_event, _button, dialog) => {
        const form = dialogForm(dialog);
        if (!form) throw new Error("HM3 | Missile damage dialog form was not found.");

        const damageDice = Number(form.elements.damageDice?.value) || 1;
        const roll = await DiceHM3.rollTest({
          type: dialogOptions.type,
          target: 0,
          data: dialogOptions.data,
          diceSides: 6,
          diceNum: damageDice,
          modifier: 0
        });

        return {
          type: roll.type,
          range: form.elements.range?.value,
          damageDice,
          addlImpact: Number(form.elements.addlImpact?.value) || 0,
          rollObj: roll.rollObj
        };
      }
    },
    rejectClose: false
  });
};

DiceHM3.missileDamageRoll = async function missileDamageRoll(rollData) {
  const speaker = rollData.speaker ?? ChatMessage.getSpeaker();
  const ranges = {
    Short: rollData.impactShort,
    Medium: rollData.impactMedium,
    Long: rollData.impactLong,
    Extreme: rollData.impactExtreme
  };
  const roll = await DiceHM3.missileDamageDialog({
    type: "missile-damage",
    name: rollData.name,
    ranges,
    defaultRange: rollData.defaultRange ?? "Extreme",
    data: rollData.data
  });
  if (!roll) return null;

  const rangeImpact = Number(ranges[roll.range] ?? 0);
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
  const notes = rollData.notes ? utility.stringReplacer(rollData.notes, notesData) : "";
  const templateData = {
    title: rollData.name ? `${rollData.name} Damage` : "Missile Damage",
    aspect: rollData.aspect,
    range: roll.range,
    damageDice: Number(roll.damageDice),
    rangeImpact,
    addlImpact: roll.addlImpact,
    totalImpact,
    rollValue: roll.rollObj.total,
    notes,
    roll
  };

  const content = await renderTemplate("systems/hm3/templates/chat/missile-damage-card.html", templateData);
  await createRollMessage({ speaker, content, roll: roll.rollObj });
  return templateData;
};
