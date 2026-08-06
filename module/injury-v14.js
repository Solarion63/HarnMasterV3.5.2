import { DiceHM3 } from "./dice-hm3.js";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

function currentMessageMode() {
  const mode = game.settings.get("core", "messageMode") ?? "public";
  return mode in CONFIG.ChatMessage.modes ? mode : "public";
}

async function playInjuryAudio() {
  if (!game.settings.get("hm3", "combatAudio")) return;

  const audioHelper = foundry.audio?.AudioHelper;
  if (typeof audioHelper?.play !== "function") {
    console.warn("HM3 | Foundry audio helper is unavailable; injury audio was skipped.");
    return;
  }

  try {
    await audioHelper.play({
      src: "systems/hm3/audio/grunt1.ogg",
      autoplay: true,
      loop: false
    }, true);
  } catch (error) {
    console.warn("HM3 | Injury audio playback failed; injury processing completed normally.", error);
  }
}

DiceHM3._calcLocation = function calcLocation(location, aim, items) {
  const normalizedAim = String(aim ?? "mid").toLowerCase();
  const armorLocations = items.filter(item => item.type === "armorlocation");
  if (!armorLocations.length) return null;

  if (String(location).toLowerCase() !== "random") {
    return armorLocations.find(item => item.name === location) ?? null;
  }

  const totalWeight = armorLocations.reduce(
    (total, item) => total + (Number(item.system.probWeight?.[normalizedAim]) || 0),
    0
  );
  if (totalWeight <= 0) return armorLocations[0];

  let rollWeight = Math.floor(foundry.dice.MersenneTwister.random() * totalWeight) + 1;
  for (const item of armorLocations) {
    rollWeight -= Number(item.system.probWeight?.[normalizedAim]) || 0;
    if (rollWeight <= 0) return item;
  }

  return armorLocations.at(-1) ?? null;
};

DiceHM3.injuryDialog = async function injuryDialog(dialogOptions) {
  const recordInjury = game.settings.get("hm3", "addInjuryToActorSheet");
  const askRecordInjury = recordInjury === "ask";
  const content = await renderTemplate("systems/hm3/templates/dialog/injury-dialog.html", {
    aim: "mid",
    location: "Random",
    impact: 0,
    aspect: "Blunt",
    askRecordInjury,
    hitLocations: dialogOptions.hitLocations
  });

  return DialogV2.prompt({
    window: { title: dialogOptions.label ?? `${dialogOptions.name} Injury` },
    content: content.trim(),
    ok: {
      label: "Determine Injury",
      callback: (_event, _button, dialog) => {
        const form = dialog.element?.querySelector("form");
        if (!form) throw new Error("HM3 | Injury dialog form was not found.");

        const addToCharSheet = askRecordInjury
          ? Boolean(form.elements.addToCharSheet?.checked)
          : recordInjury === "enable";

        return DiceHM3._calcInjury(
          form.elements.location?.value ?? "Random",
          Number(form.elements.impact?.value) || 0,
          form.elements.aspect?.value ?? "Blunt",
          addToCharSheet,
          form.elements.aim?.value ?? "mid",
          dialogOptions
        );
      }
    },
    rejectClose: false
  });
};

DiceHM3.injuryRoll = async function injuryRoll(rollData) {
  const speaker = rollData.speaker ?? ChatMessage.getSpeaker({ actor: rollData.actor });

  let result;
  if (typeof rollData.impact === "undefined") {
    const dialogOptions = {
      hitLocations: DiceHM3._getHitLocations(rollData.actor.items),
      data: rollData.actor.system,
      items: rollData.actor.items,
      name: rollData.actor.token ? rollData.actor.token.name : rollData.actor.name
    };
    result = await DiceHM3.injuryDialog(dialogOptions);
  } else {
    result = DiceHM3._calcInjury(
      "Random",
      rollData.impact,
      rollData.aspect,
      game.settings.get("hm3", "addInjuryToActorSheet") !== "disable",
      rollData.aim,
      rollData
    );
  }

  if (!result) return null;

  const actorId = rollData.actor.id;
  const tokenId = rollData.tokenId ?? rollData.actor.token?.id ?? null;
  if (tokenId) result.tokenId = tokenId;

  if (result.addToCharSheet) {
    await DiceHM3.createInjury(rollData.actor, result);
  }

  const templateData = foundry.utils.mergeObject({
    title: `${rollData.actor.token ? rollData.actor.token.name : rollData.actor.name} Injury`,
    actorId,
    tokenId,
    visibleActorId: actorId
  }, result);

  const content = await renderTemplate("systems/hm3/templates/chat/injury-card.html", templateData);
  await ChatMessage.create({
    user: game.user.id,
    speaker,
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.OTHER,
    sound: CONFIG.sounds.notify
  }, {
    messageMode: currentMessageMode()
  });

  await playInjuryAudio();
  return templateData;
};
