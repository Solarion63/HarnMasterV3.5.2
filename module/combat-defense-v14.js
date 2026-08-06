import { DiceHM3 } from "./dice-hm3.js";
import { meleeCombatResult, missileCombatResult } from "./combat.js";

const { renderTemplate } = foundry.applications.handlebars;

function rootsFromRender(html) {
  if (!html) return [];
  if (html instanceof HTMLElement || html instanceof DocumentFragment) return [html];
  if (Array.isArray(html)) return html.filter(root => root?.querySelectorAll);
  if (typeof html.length === "number") {
    return Array.from(html).filter(root => root?.querySelectorAll);
  }
  return html.querySelectorAll ? [html] : [];
}

function tokenFromId(id, role) {
  const token = id ? canvas.tokens.get(id) : null;
  if (!token) ui.notifications.warn(`${role} token could not be found on the active scene.`);
  return token;
}

function activeDieValues(roll) {
  const die = roll?.dice?.[0];
  if (!die) return [];
  if (Array.isArray(die.values)) return die.values;
  return Array.from(die.results ?? [])
    .filter(result => result.active !== false)
    .map(result => result.result);
}

async function createResultCard({ attacker, defender, button, defense, attackRoll, defenseRoll, combatResult, impactRoll, effectiveDML }) {
  const impactMod = Number(button.dataset.impactMod) || 0;
  const attackHit = Boolean(combatResult.outcome.atkDice);
  const chatData = {
    title: "Attack Result",
    attacker: attacker.name,
    atkTokenId: attacker.id,
    defender: defender.name,
    defTokenId: defender.id,
    attackWeapon: button.dataset.weapon,
    outnumbered: defender.actor.system?.eph?.outnumbered > 1
      ? defender.actor.system.eph.outnumbered
      : null,
    mlType: defense === "Dodge" ? "DML" : "AML",
    effAML: Number(button.dataset.effAml),
    defense,
    effDML: effectiveDML,
    attackRoll: attackRoll.rollObj.total,
    atkRollResult: attackRoll.description,
    defenseRoll: defenseRoll?.rollObj.total ?? 0,
    defRollResult: defenseRoll?.description ?? "",
    resultDesc: combatResult.desc,
    hasAttackHit: attackHit,
    addlWeaponImpact: 0,
    weaponImpact: impactMod,
    impactRoll: impactRoll ? activeDieValues(impactRoll).join(" + ") : null,
    totalImpact: impactRoll ? impactRoll.total + impactMod : 0,
    atkAim: button.dataset.aim,
    atkAspect: button.dataset.aspect,
    dta: combatResult.outcome.dta,
    isAtkStumbleRoll: combatResult.outcome.atkStumble,
    isAtkFumbleRoll: combatResult.outcome.atkFumble,
    isDefStumbleRoll: combatResult.outcome.defStumble,
    isDefFumbleRoll: combatResult.outcome.defFumble,
    visibleAtkActorId: attacker.actor.id,
    visibleDefActorId: defender.actor.id
  };

  const content = await renderTemplate("systems/hm3/templates/chat/attack-result-card.html", chatData);
  const messageData = {
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ token: attacker.document }),
    content: content.trim(),
    style: attackHit ? CONST.CHAT_MESSAGE_STYLES.ROLL : CONST.CHAT_MESSAGE_STYLES.OTHER
  };
  if (impactRoll) {
    messageData.sound = CONFIG.sounds.dice;
    messageData.rolls = [impactRoll];
  }
  await ChatMessage.create(messageData);
  return chatData;
}

function resolveCombatResult(button, attackRoll, defenseRoll, defense) {
  const attackCode = `${attackRoll.isCritical ? "c" : "m"}${attackRoll.isSuccess ? "s" : "f"}`;
  const defenseCode = defenseRoll
    ? `${defenseRoll.isCritical ? "c" : "m"}${defenseRoll.isSuccess ? "s" : "f"}`
    : null;
  const impactMod = Number(button.dataset.impactMod) || 0;
  return button.dataset.weaponType === "melee"
    ? meleeCombatResult(attackCode, defenseCode, defense.toLowerCase(), impactMod)
    : missileCombatResult(attackCode, defenseCode, defense.toLowerCase(), impactMod);
}

async function performDefense(button, defense) {
  const attacker = tokenFromId(button.dataset.atkTokenId, "Attacker");
  const defender = tokenFromId(button.dataset.defTokenId, "Defender");
  if (!attacker || !defender) return null;
  if (!defender.isOwner) {
    ui.notifications.warn(`You do not have permissions to perform this operation on ${defender.name}.`);
    return null;
  }

  const attackRoll = await DiceHM3.rollTest({
    data: {},
    diceSides: 100,
    diceNum: 1,
    modifier: 0,
    target: Number(button.dataset.effAml)
  });

  let defenseRoll = null;
  let effectiveDML = 0;
  if (defense === "Dodge") {
    const outnumberedModifier = defender.actor.system?.eph?.outnumbered > 1
      ? Math.floor(defender.actor.system.eph.outnumbered - 1) * -10
      : 0;
    effectiveDML = Number(defender.actor.system.dodge) + outnumberedModifier;
    defenseRoll = await DiceHM3.rollTest({
      data: {},
      diceSides: 100,
      diceNum: 1,
      modifier: outnumberedModifier,
      target: Number(defender.actor.system.dodge)
    });
  }

  const combatResult = resolveCombatResult(button, attackRoll, defenseRoll, defense);
  if (!combatResult) throw new Error(`HM3 | No ${button.dataset.weaponType} combat result for ${defense}.`);

  const impactRoll = combatResult.outcome.atkDice
    ? await new Roll(`${combatResult.outcome.atkDice}d6`).evaluate()
    : null;

  return createResultCard({
    attacker,
    defender,
    button,
    defense,
    attackRoll,
    defenseRoll,
    combatResult,
    impactRoll,
    effectiveDML
  });
}

function bindDefenseButton(button) {
  if (button.dataset.hm3V14DefenseBound === "1") return;
  const action = button.dataset.action;
  if (!['dodge', 'ignore'].includes(action)) return;

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    performDefense(button, action === "dodge" ? "Dodge" : "Ignore")
      .catch(error => {
        console.error(`HM3 | ${action} defense failed`, error);
        ui.notifications.error(`${action === "dodge" ? "Dodge" : "Ignore"} defense failed. See the console for details.`);
      })
      .finally(() => {
        button.disabled = false;
      });
  });
  button.dataset.hm3V14DefenseBound = "1";
}

Hooks.on("renderChatMessageHTML", (_message, html) => {
  for (const root of rootsFromRender(html)) {
    for (const button of root.querySelectorAll('.hm3.chat-card button[data-action="dodge"], .hm3.chat-card button[data-action="ignore"]')) {
      bindDefenseButton(button);
    }
  }
});
