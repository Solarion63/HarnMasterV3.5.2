import { DiceHM3 } from "./dice-hm3.js";
import * as utility from "./utility.js";
import { weaponAspectData } from "./dice-rules.js";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

function currentMessageMode() {
  const mode = game.settings.get("core", "messageMode") ?? "public";
  return mode in CONFIG.ChatMessage.modes ? mode : "public";
}

function activeDieValues(roll) {
  const die = roll?.dice?.[0];
  if (!die) return [];
  if (Array.isArray(die.values)) return die.values;
  return Array.from(die.results ?? [])
    .filter(result => result.active !== false)
    .map(result => result.result);
}

DiceHM3.damageDialog = async function damageDialog(dialogOptions) {
  const content = await renderTemplate("systems/hm3/templates/dialog/damage-dialog.html", {
    weapon: dialogOptions.weapon,
    damageDice: 1,
    weaponAspect: dialogOptions.weaponAspect,
    weaponAspects: dialogOptions.weaponAspects,
    addlWeaponImpact: 0
  });

  return DialogV2.prompt({
    window: { title: dialogOptions.label ?? `${dialogOptions.weapon || "Other Weapon"} Damage` },
    content: content.trim(),
    ok: {
      label: "Roll",
      callback: async (_event, _button, dialog) => {
        const root = dialog.element;
        const damageDice = Math.max(Number(root?.querySelector('[name="damageDice"]')?.value) || 1, 1);
        const chosenAspect = root?.querySelector('[name="weaponAspect"]')?.value ?? dialogOptions.weaponAspect;
        const addlWeaponImpact = Number(root?.querySelector('[name="addlWeaponImpact"]')?.value) || 0;
        const rollObj = await new Roll(`${damageDice}d6`).evaluate();

        return {
          type: dialogOptions.type,
          chosenAspect,
          damageDice,
          addlWeaponImpact,
          rollObj
        };
      }
    },
    rejectClose: false
  });
};

DiceHM3.damageRoll = async function damageRoll(rollData) {
  const speaker = rollData.speaker ?? ChatMessage.getSpeaker();
  const weapon = weaponAspectData(rollData.weapon, rollData.data.items);
  const roll = await DiceHM3.damageDialog({
    type: "damage",
    label: rollData.weapon ? `${rollData.weapon} Damage` : "Other Weapon Damage",
    weapon: rollData.weapon,
    weaponAspect: rollData.aspect ?? weapon.defaultAspect,
    weaponAspects: weapon.aspects,
    data: rollData.actorData
  });
  if (!roll) return null;

  const weaponImpact = Number(weapon.aspects[roll.chosenAspect]) || 0;
  const totalImpact = weaponImpact + roll.addlWeaponImpact + roll.rollObj.total;
  const notesData = foundry.utils.mergeObject(rollData.notesData ?? {}, {
    actor: speaker.alias,
    aspect: roll.chosenAspect,
    dice: Number(roll.damageDice),
    impact: weaponImpact,
    addlImpact: roll.addlWeaponImpact,
    totalImpact,
    roll: roll.rollObj.total
  });

  const templateData = {
    title: rollData.weapon ? `${rollData.weapon} Damage` : "Other Weapon Damage",
    weaponAspect: roll.chosenAspect,
    damageDice: Number(roll.damageDice),
    weaponImpact,
    addlWeaponImpact: roll.addlWeaponImpact,
    totalImpact,
    impactRoll: activeDieValues(roll.rollObj).join(" + "),
    rollValue: roll.rollObj.total,
    notes: rollData.notes ? utility.stringReplacer(rollData.notes, notesData) : "",
    roll
  };

  const content = await renderTemplate("systems/hm3/templates/chat/damage-card.html", templateData);
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
