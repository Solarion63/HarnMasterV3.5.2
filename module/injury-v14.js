import { DiceHM3 } from "./dice-hm3.js";
import { CombatAudio } from "./combat-audio.js";
import { BloodlossService } from "./bloodloss-service.js";
import { calculateInjury, getHitLocations, resolveHitLocation } from "./injury-rules.js";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

function currentMessageMode() {
  const mode = game.settings.get("core", "messageMode") ?? "public";
  return mode in CONFIG.ChatMessage.modes ? mode : "public";
}

function injuryRuleSettings() {
  return {
    amputation: game.settings.get("hm3", "amputation"),
    bloodloss: game.settings.get("hm3", "bloodloss"),
    limbInjuries: game.settings.get("hm3", "limbInjuries")
  };
}

function injuryRandom() {
  return foundry.dice.MersenneTwister.random();
}

export function _getHitLocations(items) {
  return getHitLocations(items);
}

export function _calcLocation(location, aim, items) {
  return resolveHitLocation(location, aim, items, injuryRandom);
}

export function _calcInjury(location, impact, aspect, addToCharSheet, aim, dialogOptions) {
  return calculateInjury({
    location,
    impact,
    aspect,
    addToCharSheet,
    aim,
    name: dialogOptions.name,
    items: dialogOptions.items,
    rules: injuryRuleSettings(),
    random: injuryRandom
  });
}

export async function createInjury(actor, result) {
  if (!actor || Number(result.injuryLevel) === 0) return null;

  const injuryDesc = {
    Blunt: { M: "Bruise", S: "Fracture", G: "Crush" },
    Edged: { M: "Cut", S: "Slash", G: "Gash" },
    Piercing: { M: "Poke", S: "Stab", G: "Impale" },
    Fire: { M: "Singe", S: "Burn", G: "Scorch" }
  };

  const injuryLevel = Number(result.injuryLevel) || 0;
  const severity = injuryLevel === 1 ? "M" : injuryLevel <= 3 ? "S" : "G";
  const description = injuryDesc[result.aspect]?.[severity];
  const locationName = description
    ? `${result.location} ${description}`
    : result.location;
  const notes = [`Aspect: ${result.aspect}`];
  if (result.isBleeder) notes.push("Bleeder");

  const created = await actor.createEmbeddedDocuments("Item", [{
    name: locationName,
    type: "injury",
    system: {
      severity,
      injuryLevel,
      healRate: 0,
      isBleeder: Boolean(result.isBleeder),
      notes: notes.join("; ")
    }
  }]);

  const injury = created[0] ?? null;
  if (injury && result.isBleeder) {
    await BloodlossService.startBleeding(actor, injury);
  }
  return injury;
}

export async function injuryDialog(dialogOptions) {
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
        const root = dialog.element;
        const location = root?.querySelector('[name="location"]')?.value ?? "Random";
        const impact = Number(root?.querySelector('[name="impact"]')?.value) || 0;
        const aspect = root?.querySelector('[name="aspect"]')?.value ?? "Blunt";
        const aim = root?.querySelector('[name="aim"]')?.value ?? "Mid";
        const addToCharSheet = askRecordInjury
          ? Boolean(root?.querySelector('[name="addToCharSheet"]')?.checked)
          : recordInjury === "enable";

        return calculateInjury({
          location,
          impact,
          aspect,
          addToCharSheet,
          aim,
          name: dialogOptions.name,
          items: dialogOptions.items,
          rules: injuryRuleSettings(),
          random: injuryRandom
        });
      }
    },
    rejectClose: false
  });
}

export async function injuryRoll(rollData) {
  const speaker = rollData.speaker ?? ChatMessage.getSpeaker({ actor: rollData.actor });

  let result;
  if (typeof rollData.impact === "undefined") {
    const dialogOptions = {
      hitLocations: getHitLocations(rollData.actor.items),
      data: rollData.actor.system,
      items: rollData.actor.items,
      name: rollData.actor.token ? rollData.actor.token.name : rollData.actor.name
    };
    result = await injuryDialog(dialogOptions);
  } else {
    result = calculateInjury({
      location: "Random",
      impact: rollData.impact,
      aspect: rollData.aspect,
      addToCharSheet: game.settings.get("hm3", "addInjuryToActorSheet") !== "disable",
      aim: rollData.aim,
      name: rollData.actor.token ? rollData.actor.token.name : rollData.actor.name,
      items: rollData.actor.items,
      rules: injuryRuleSettings(),
      random: injuryRandom
    });
  }

  if (!result) return null;

  const actorId = rollData.actor.id;
  const tokenId = rollData.tokenId ?? rollData.actor.token?.id ?? null;
  if (tokenId) result.tokenId = tokenId;

  if (result.addToCharSheet) {
    await createInjury(rollData.actor, result);
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

  CombatAudio.play("injury");
  return templateData;
}

Object.assign(DiceHM3, {
  _getHitLocations,
  _calcLocation,
  _calcInjury,
  createInjury,
  injuryDialog,
  injuryRoll
});
