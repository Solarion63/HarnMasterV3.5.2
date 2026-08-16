import { DiceHM3 } from "./dice-hm3.js";
import { meleeCombatResult } from "./combat-rules.js";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

function rootsFromRender(html) {
  if (!html) return [];
  if (html instanceof HTMLElement || html instanceof DocumentFragment) return [html];
  if (Array.isArray(html)) return html.filter(root => root?.querySelectorAll);
  if (typeof html.length === "number") return Array.from(html).filter(root => root?.querySelectorAll);
  return html.querySelectorAll ? [html] : [];
}

function tokenFromId(id, role) {
  const token = id ? canvas.tokens.get(id) : null;
  if (!token) ui.notifications.warn(`${role} token could not be found on the active scene.`);
  return token;
}

function resultCode(roll) {
  return `${roll.isCritical ? "c" : "m"}${roll.isSuccess ? "s" : "f"}`;
}

function activeDieValues(roll) {
  const die = roll?.dice?.[0];
  if (!die) return [];
  if (Array.isArray(die.values)) return die.values;
  return Array.from(die.results ?? [])
    .filter(result => result.active !== false)
    .map(result => result.result);
}

function outnumberedModifier(actor) {
  return actor.system?.eph?.outnumbered > 1
    ? Math.floor(actor.system.eph.outnumbered - 1) * -10
    : 0;
}

function weaponAspects(item) {
  const aspects = {};
  if (Number(item.system.blunt) >= 0) aspects.Blunt = Number(item.system.blunt);
  if (Number(item.system.edged) >= 0) aspects.Edged = Number(item.system.edged);
  if (Number(item.system.piercing) >= 0) aspects.Piercing = Number(item.system.piercing);
  const defaultAspect = Object.entries(aspects)
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  return { aspects, defaultAspect };
}

function defaultCounterstrikeWeapon(weapons) {
  return weapons.reduce((best, item) => {
    const impacts = [item.system.blunt, item.system.edged, item.system.piercing].map(Number);
    const maxImpact = Math.max(...impacts);
    const bestImpact = best
      ? Math.max(Number(best.system.blunt), Number(best.system.edged), Number(best.system.piercing))
      : -Infinity;
    return maxImpact > bestImpact ? item : best;
  }, null);
}

async function selectWeapon(defender, weapons) {
  const defaultWeapon = defaultCounterstrikeWeapon(weapons);
  const content = await renderTemplate("systems/hm3/templates/dialog/query-weapon-dialog.html", {
    prompt: "Choose the equipped melee weapon to use for the counterstrike.",
    weapons: weapons.map(item => item.name),
    defaultWeapon: defaultWeapon?.name
  });

  return DialogV2.prompt({
    window: { title: `${defender.name} Select Counterstrike Weapon` },
    content: content.trim(),
    ok: {
      label: "Continue",
      callback: (_event, _button, dialog) => {
        const form = dialog.element?.querySelector("form");
        if (!form) throw new Error("HM3 | Counterstrike weapon form was not found.");
        return weapons.find(item => item.name === form.elements.weapon?.value) ?? null;
      }
    },
    rejectClose: false
  });
}

async function configureCounterstrike(attacker, defender, weapon) {
  const aspectData = weaponAspects(weapon);
  if (!aspectData.defaultAspect) {
    ui.notifications.warn(`${weapon.name} has no available damage aspect.`);
    return null;
  }

  const defaultModifier = outnumberedModifier(defender.actor);
  const dialogData = {
    title: `${defender.name} vs. ${attacker.name} Counterstrike with ${weapon.name}`,
    weapon: weapon.name,
    aimLocations: ["Low", "Mid", "High"],
    defaultAim: "Mid",
    defaultModifier,
    ...aspectData
  };
  const content = await renderTemplate("systems/hm3/templates/dialog/attack-dialog.html", dialogData);

  return DialogV2.prompt({
    window: { title: dialogData.title },
    content: content.trim(),
    ok: {
      label: "Counterstrike",
      callback: (_event, _button, dialog) => {
        const form = dialog.element?.querySelector("form");
        if (!form) throw new Error("HM3 | Counterstrike attack form was not found.");
        const aspect = form.elements.weaponAspect?.value ?? dialogData.defaultAspect;
        const modifier = Number(form.elements.addlModifier?.value) || 0;
        return {
          weapon,
          aspect,
          aim: form.elements.aim?.value ?? "Mid",
          modifier,
          impactMod: Number(dialogData.aspects[aspect]) || 0
        };
      }
    },
    rejectClose: false
  });
}

async function createCounterstrikeCard({
  title,
  attacker,
  defender,
  attackWeapon,
  defense,
  effectiveAML,
  attackRoll,
  resultDescription,
  impactRoll,
  impactMod,
  aim,
  aspect,
  outcome,
  visibleAttacker,
  visibleDefender,
  modifier = 0,
  originalAML = effectiveAML
}) {
  const hit = Boolean(impactRoll);
  const chatData = {
    title,
    attacker: attacker.name,
    atkTokenId: attacker.id,
    defender: defender.name,
    defTokenId: defender.id,
    attackWeapon,
    mlType: "AML",
    defense,
    origEML: originalAML,
    effEML: effectiveAML,
    effAML: effectiveAML,
    effDML: 0,
    addlModifierAbs: Math.abs(modifier),
    addlModifierSign: modifier < 0 ? "-" : "+",
    attackRoll: attackRoll.rollObj.total,
    atkIsCritical: attackRoll.isCritical,
    atkIsSuccess: attackRoll.isSuccess,
    atkRollResult: attackRoll.description,
    defenseRoll: 0,
    defRollResult: "",
    resultDesc: resultDescription,
    hasAttackHit: hit,
    addlWeaponImpact: 0,
    weaponImpact: impactMod,
    impactRoll: impactRoll ? activeDieValues(impactRoll).join(" + ") : null,
    totalImpact: impactRoll ? impactRoll.total + Number(impactMod) : 0,
    atkAim: aim,
    atkAspect: aspect,
    dta: outcome.dta,
    isAtkStumbleRoll: outcome.atkStumble,
    isAtkFumbleRoll: outcome.atkFumble,
    isDefStumbleRoll: null,
    isDefFumbleRoll: null,
    visibleAtkActorId: visibleAttacker.actor.id,
    visibleDefActorId: visibleDefender.actor.id
  };

  const content = await renderTemplate("systems/hm3/templates/chat/attack-result-card.html", chatData);
  const messageData = {
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ token: attacker.document }),
    content: content.trim(),
    style: hit ? CONST.CHAT_MESSAGE_STYLES.ROLL : CONST.CHAT_MESSAGE_STYLES.OTHER
  };
  if (impactRoll) {
    messageData.sound = CONFIG.sounds.dice;
    messageData.rolls = [impactRoll];
  }
  await ChatMessage.create(messageData);
  return chatData;
}

/**
 * Resolve Counterstrike from the dataset used by HM3 attack-card buttons.
 * Exported so the public macro API can route legacy resume calls through the
 * same v14 implementation used by chat-card buttons.
 */
export async function performCounterstrike(button) {
  const attacker = tokenFromId(button.dataset.atkTokenId, "Attacker");
  const defender = tokenFromId(button.dataset.defTokenId, "Defender");
  if (!attacker || !defender) return null;
  if (!defender.isOwner) {
    ui.notifications.warn(`You do not have permissions to perform this operation on ${defender.name}.`);
    return null;
  }

  const weapons = defender.actor.itemTypes.weapongear.filter(item => item.system.isEquipped);
  if (!weapons.length) {
    ui.notifications.warn(`${defender.name} has no equipped melee weapons. Counterstrike refused.`);
    return null;
  }

  const weapon = await selectWeapon(defender, weapons);
  if (!weapon) return null;
  const counterstrike = await configureCounterstrike(attacker, defender, weapon);
  if (!counterstrike) return null;

  const attackRoll = await DiceHM3.rollTest({
    data: {},
    diceSides: 100,
    diceNum: 1,
    modifier: 0,
    target: Number(button.dataset.effAml)
  });
  const counterstrikeRoll = await DiceHM3.rollTest({
    data: {},
    diceSides: 100,
    diceNum: 1,
    modifier: counterstrike.modifier,
    target: Number(weapon.system.attackMasteryLevel)
  });

  const combatResult = meleeCombatResult(
    resultCode(attackRoll),
    resultCode(counterstrikeRoll),
    "counterstrike",
    Number(button.dataset.impactMod) || 0,
    counterstrike.impactMod
  );
  if (!combatResult) throw new Error("HM3 | No melee combat result for Counterstrike.");

  const attackImpactRoll = combatResult.outcome.atkDice
    ? await new Roll(`${combatResult.outcome.atkDice}d6`).evaluate()
    : null;
  const counterstrikeImpactRoll = combatResult.outcome.defDice
    ? await new Roll(`${combatResult.outcome.defDice}d6`).evaluate()
    : null;

  const attackCard = await createCounterstrikeCard({
    title: "Attack Result",
    attacker,
    defender,
    attackWeapon: button.dataset.weapon,
    defense: "Counterstrike",
    effectiveAML: Number(button.dataset.effAml),
    attackRoll,
    resultDescription: combatResult.desc,
    impactRoll: attackImpactRoll,
    impactMod: Number(button.dataset.impactMod) || 0,
    aim: button.dataset.aim,
    aspect: button.dataset.aspect,
    outcome: {
      ...combatResult.outcome,
      atkStumble: combatResult.outcome.atkStumble,
      atkFumble: combatResult.outcome.atkFumble
    },
    visibleAttacker: attacker,
    visibleDefender: defender
  });

  const counterstrikeCard = await createCounterstrikeCard({
    title: "Counterstrike Result",
    attacker: defender,
    defender: attacker,
    attackWeapon: weapon.name,
    defense: "Counterstrike",
    originalAML: Number(weapon.system.attackMasteryLevel),
    effectiveAML: Number(weapon.system.attackMasteryLevel) + counterstrike.modifier,
    modifier: counterstrike.modifier,
    attackRoll: counterstrikeRoll,
    resultDescription: combatResult.csDesc,
    impactRoll: counterstrikeImpactRoll,
    impactMod: counterstrike.impactMod,
    aim: counterstrike.aim,
    aspect: counterstrike.aspect,
    outcome: {
      dta: combatResult.outcome.dta,
      atkStumble: combatResult.outcome.defStumble,
      atkFumble: combatResult.outcome.defFumble
    },
    visibleAttacker: defender,
    visibleDefender: attacker
  });

  return { attack: attackCard, counterstrike: counterstrikeCard };
}

function bindCounterstrikeButton(button) {
  if (button.dataset.hm3V14CounterstrikeBound === "1") return;
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    performCounterstrike(button)
      .catch(error => {
        console.error("HM3 | Counterstrike defense failed", error);
        ui.notifications.error("Counterstrike defense failed. See the console for details.");
      })
      .finally(() => {
        button.disabled = false;
      });
  });
  button.dataset.hm3V14CounterstrikeBound = "1";
}

Hooks.on("renderChatMessageHTML", (_message, html) => {
  for (const root of rootsFromRender(html)) {
    for (const button of root.querySelectorAll('.hm3.chat-card button[data-action="counterstrike"]')) {
      bindCounterstrikeButton(button);
    }
  }
});
