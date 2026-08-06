import { DiceHM3 } from "./dice-hm3.js";

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
  if (rollData.tokenId) result.tokenId = rollData.tokenId;

  if (result.addToCharSheet) {
    await DiceHM3.createInjury(rollData.actor, result);
  }

  const templateData = foundry.utils.mergeObject({
    title: `${rollData.actor.token ? rollData.actor.token.name : rollData.actor.name} Injury`,
    visibleActorId: rollData.actor.id
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
