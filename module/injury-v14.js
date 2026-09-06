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

function injuryDescription(result) {
  const injuryDesc = {
    Blunt: { M: "Bruise", S: "Fracture", G: "Crush" },
    Edged: { M: "Cut", S: "Slash", G: "Gash" },
    Piercing: { M: "Poke", S: "Stab", G: "Impale" },
    Fire: { M: "Singe", S: "Burn", G: "Scorch" }
  };
  const injuryLevel = Number(result.injuryLevel) || 0;
  const severity = injuryLevel === 1 ? "M" : injuryLevel <= 3 ? "S" : "G";
  return {
    severity,
    description: injuryDesc[result.aspect]?.[severity]
  };
}

function injuryName(result) {
  const { description } = injuryDescription(result);
  return description ? `${result.location} ${description}` : result.location;
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

  const injuryLevel = Number(result.injuryLevel) || 0;
  const { severity } = injuryDescription(result);
  const locationName = injuryName(result);
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
    },
    flags: {
      hm3: {
        injuryAspect: result.aspect,
        injuryCreatedAt: Number(game.time?.worldTime) || 0
      }
    }
  }]);

  const injury = created[0] ?? null;
  if (injury && result.isBleeder) {
    const effect = await BloodlossService.startBleeding(actor, injury);
    if (effect) result.bleedingEffectId = effect.id;
  }
  return injury;
}

async function createUnrecordedBleedingEffect(actor, result) {
  if (!result.isBleeder) return null;
  const source = {
    id: `unrecorded-${foundry.utils.randomID()}`,
    name: injuryName(result)
  };
  const effect = await BloodlossService.startBleeding(actor, source);
  if (effect) result.bleedingEffectId = effect.id;
  return effect;
}

export async function injuryDialog(dialogOptions) {
  const recordInjury = game.settings.get("hm3", "addInjuryToActorSheet");
  const askRecordInjury = recordInjury === "ask";
  const content = await renderTemplate("systems/hm3/templates/dialog/injury-dialog.html", {
    aim: "Mid",
    location: "Random",
    impact: 0,
    aspect: "Blunt",
    askRecordInjury,
    hitLocations: dialogOptions.hitLocations
  });

  // DialogV2.input owns the surrounding form and returns FormDataExtended.
  // The template therefore contains fields only, not a nested <form> element.
  const formData = await DialogV2.input({
    window: { title: dialogOptions.label ?? `${dialogOptions.name} Injury` },
    content: content.trim(),
    ok: { label: "Determine Injury" },
    rejectClose: false
  });
  if (!formData) return null;

  const data = formData.object ?? Object.fromEntries(formData.entries());
  const location = data.location ?? "Random";
  const impact = Number(data.impact) || 0;
  const aspect = data.aspect ?? "Blunt";
  const aim = data.aim ?? "Mid";
  const addToCharSheet = askRecordInjury
    ? Boolean(data.addToCharSheet)
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
  if (typeof result !== "object" || Array.isArray(result)) {
    throw new Error("HM3 injury dialog returned an invalid result.");
  }

  const actorId = rollData.actor.id;
  const tokenId = rollData.tokenId ?? rollData.actor.token?.id ?? null;
  if (tokenId) result.tokenId = tokenId;

  if (result.addToCharSheet) {
    await createInjury(rollData.actor, result);
  } else if (result.isBleeder) {
    await createUnrecordedBleedingEffect(rollData.actor, result);
  }

  const templateData = {
    ...result,
    title: `${rollData.actor.token ? rollData.actor.token.name : rollData.actor.name} Injury`,
    actorId,
    tokenId,
    visibleActorId: actorId
  };

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
