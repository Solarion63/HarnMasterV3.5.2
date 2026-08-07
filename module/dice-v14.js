import { DiceHM3 } from "./dice-hm3.js";
import * as utility from "./utility.js";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

function dieValues(roll) {
  const die = roll.dice?.[0];
  if (!die) return [];
  if (Array.isArray(die.values)) return die.values;
  return Array.from(die.results ?? [])
    .filter(result => result.active !== false)
    .map(result => result.result);
}

function currentMessageMode() {
  const mode = game.settings.get("core", "messageMode") ?? "public";
  return mode in CONFIG.ChatMessage.modes ? mode : "public";
}

function actorForRoll(rollData, speaker) {
  if (rollData.token) return canvas.tokens.get(rollData.token)?.actor ?? null;
  if (rollData.actor) return game.actors.get(rollData.actor) ?? null;
  if (speaker?.token) return canvas.tokens.get(speaker.token)?.actor ?? null;
  if (speaker?.actor) return game.actors.get(speaker.actor) ?? null;
  return null;
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

DiceHM3.rollTest = async function rollTest(testData) {
  const diceType = testData.diceSides === 6 ? "d6" : "d100";
  const numDice = testData.diceNum > 0 ? testData.diceNum : 1;
  const diceSpec = `${numDice}${diceType}`;
  const roll = await new Roll(diceSpec, testData.data).evaluate();

  const modifier = Number(testData.modifier) || 0;
  const baseTargetNum = Number(testData.target) + modifier;
  const targetNum = Math.max(Math.min(baseTargetNum, 95), 5);
  let isCritical = roll.total % 5 === 0;
  let isSuccess;
  let description;

  if (diceType === "d100") {
    isSuccess = roll.total <= targetNum;
    description = `${isCritical ? "Critical" : "Marginal"} ${isSuccess ? "Success" : "Failure"}`;
  } else {
    isCritical = false;
    isSuccess = roll.total <= targetNum;
    description = isSuccess ? "Success" : "Failure";
  }

  return {
    type: testData.type,
    target: targetNum,
    isCapped: baseTargetNum !== targetNum,
    modifier,
    rollObj: roll,
    isSuccess,
    isCritical,
    description
  };
};

async function standardDialog(dialogOptions, diceSides, diceNum) {
  const template = dialogOptions.template ?? "systems/hm3/templates/dialog/standard-test-dialog.html";
  const content = await renderTemplate(template, {
    target: dialogOptions.target,
    modifier: dialogOptions.modifier
  });

  return DialogV2.prompt({
    window: { title: dialogOptions.label },
    content: content.trim(),
    ok: {
      label: "Roll",
      callback: (_event, _button, dialog) => {
        const modifier = dialog.element?.querySelector('[name="modifier"]')?.value ?? 0;
        return DiceHM3.rollTest({
          type: dialogOptions.type,
          target: dialogOptions.target,
          data: null,
          diceSides,
          diceNum,
          modifier
        });
      }
    },
    rejectClose: false
  });
}

DiceHM3.d100StdDialog = function d100StdDialog(dialogOptions) {
  return standardDialog(dialogOptions, 100, 1);
};

DiceHM3.d6Dialog = function d6Dialog(dialogOptions) {
  return standardDialog(dialogOptions, 6, Number(dialogOptions.numdice) || 1);
};

DiceHM3.d100StdRoll = async function d100StdRoll(rollData) {
  const speaker = rollData.speaker ?? ChatMessage.getSpeaker();
  const dialogOptions = {
    type: rollData.type,
    target: rollData.target,
    label: rollData.label,
    modifier: rollData.modifier ?? 0
  };

  const roll = rollData.fastforward
    ? await DiceHM3.rollTest({
      type: rollData.type,
      diceSides: 100,
      diceNum: 1,
      modifier: rollData.modifier ?? 0,
      target: rollData.target
    })
    : await DiceHM3.d100StdDialog(dialogOptions);

  if (!roll) return null;

  const notesData = foundry.utils.mergeObject(rollData.notesData ?? {}, {
    actor: speaker.alias,
    target: rollData.target,
    modifier: rollData.modifier,
    roll: roll.rollObj.total,
    rollText: roll.description,
    isSuccess: roll.isSuccess,
    isCritical: roll.isCritical,
    isCS: roll.isSuccess && roll.isCritical,
    isMS: roll.isSuccess && !roll.isCritical,
    isMF: !roll.isSuccess && !roll.isCritical,
    isCF: !roll.isSuccess && roll.isCritical
  });
  const notes = rollData.notes ? utility.stringReplacer(rollData.notes, notesData) : "";
  const templateData = {
    type: roll.type,
    title: rollData.label,
    origTarget: rollData.target,
    modifier: Math.abs(roll.modifier),
    plusMinus: roll.modifier < 0 ? "-" : "+",
    modifiedTarget: roll.target,
    isSuccess: roll.isSuccess,
    isCritical: roll.isCritical,
    rollValue: roll.rollObj.total,
    rollResult: roll.rollObj.total,
    showResult: false,
    description: roll.description,
    notes,
    roll
  };

  const content = await renderTemplate("systems/hm3/templates/chat/standard-test-card.html", templateData);
  await createRollMessage({ speaker, content, roll: roll.rollObj });
  return templateData;
};

DiceHM3.d6Roll = async function d6Roll(rollData) {
  const speaker = rollData.speaker ?? ChatMessage.getSpeaker();
  const dialogOptions = {
    type: rollData.type,
    target: Number(rollData.target),
    label: rollData.label,
    modifier: rollData.modifier ?? 0,
    numdice: Number(rollData.numdice),
    items: rollData.items
  };

  const roll = rollData.fastforward
    ? await DiceHM3.rollTest({
      type: rollData.type,
      diceSides: 6,
      diceNum: Number(rollData.numdice),
      modifier: rollData.modifier ?? 0,
      target: rollData.target
    })
    : await DiceHM3.d6Dialog(dialogOptions);

  if (!roll) return null;

  const values = dieValues(roll.rollObj);
  const notesData = foundry.utils.mergeObject(rollData.notesData ?? {}, {
    actor: speaker.alias,
    target: rollData.target,
    roll: roll.rollObj.total,
    rollText: roll.description,
    isSuccess: roll.isSuccess
  });
  const notes = rollData.notes ? utility.stringReplacer(rollData.notes, notesData) : "";
  const actor = actorForRoll(rollData, speaker);
  const templateData = {
    type: rollData.type,
    title: rollData.label,
    origTarget: rollData.target,
    modifier: roll.modifier,
    modifiedTarget: roll.target,
    isSuccess: roll.isSuccess,
    rollValue: roll.rollObj.total,
    rollResult: values.join(" + "),
    showResult: values.length > 1,
    description: roll.description,
    notes,
    roll,
    runCustomMacro: result => actor?.runCustomMacro(result)
  };

  const content = await renderTemplate("systems/hm3/templates/chat/standard-test-card.html", templateData);
  await createRollMessage({ speaker, content, roll: roll.rollObj });
  return templateData;
};

DiceHM3.sdrRoll = async function sdrRoll(item) {
  const speaker = ChatMessage.getSpeaker({ actor: item.actor });
  const skillBase = Number(item.system.skillBase?.value) || 0;
  const roll = await new Roll("1d100 + @sb", { sb: skillBase }).evaluate();
  const isSuccess = roll.total > Number(item.system.masteryLevel);
  const specialization = item.name.match(/\(([^)]+)\)/);

  const templateData = {
    title: `${item.name} Skill Development Roll`,
    origTarget: item.system.masteryLevel,
    modifier: 0,
    modifiedTarget: item.system.masteryLevel,
    isSuccess,
    rollValue: roll.total,
    rollResult: roll.result,
    showResult: true,
    description: isSuccess ? "Success" : "Failure",
    notes: "",
    sdrIncr: isSuccess ? (specialization ? 2 : 1) : 0
  };

  if (specialization && isSuccess) {
    templateData.notes = `Since this is a specialized skill of ${specialization[1]}, ML will be increased by 2`;
  }

  const content = await renderTemplate("systems/hm3/templates/chat/standard-test-card.html", templateData);
  await createRollMessage({ speaker, content, roll });
  return templateData;
};
