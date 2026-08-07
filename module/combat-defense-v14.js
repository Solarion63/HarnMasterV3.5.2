import { DiceHM3 } from "./dice-hm3.js";
import { meleeCombatResult, missileCombatResult } from "./combat.js";

const { DialogV2 } = foundry.applications.api;
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

function resultCode(roll) {
  return `${roll.isCritical ? "c" : "m"}${roll.isSuccess ? "s" : "f"}`;
}

function isShield(item) {
  return /shield|\bbuckler\b/i.test(item.name);
}

function isHighVelocityMissile(name) {
  return /\bbow\b|shortbow|longbow|crossbow|\bsling\b|\barrow\b|\bbolt\b|\bbullet\b/i.test(name);
}

function outnumberedModifier(actor) {
  return actor.system?.eph?.outnumbered > 1
    ? Math.floor(actor.system.eph.outnumbered - 1) * -10
    : 0;
}

async function createResultCard({
  attacker,
  defender,
  button,
  defense,
  attackRoll,
  defenseRoll,
  combatResult,
  impactRoll,
  effectiveDML,
  originalDML = effectiveDML,
  defenseModifier = 0,
  defendWeapon = null
}) {
  const impactMod = Number(button.dataset.impactMod) || 0;
  const attackHit = Boolean(combatResult.outcome.atkDice);
  const chatData = {
    title: "Attack Result",
    attacker: attacker.name,
    atkTokenId: attacker.id,
    defender: defender.name,
    defTokenId: defender.id,
    attackWeapon: button.dataset.weapon,
    defendWeapon: defendWeapon?.name ?? "",
    outnumbered: defender.actor.system?.eph?.outnumbered > 1
      ? defender.actor.system.eph.outnumbered
      : null,
    mlType: defense === "Ignore" ? "AML" : "DML",
    effAML: Number(button.dataset.effAml),
    defense: defendWeapon ? `Block w/ ${defendWeapon.name}` : defense,
    effDML: effectiveDML,
    origEML: originalDML,
    effEML: effectiveDML,
    addlModifierAbs: Math.abs(defenseModifier),
    addlModifierSign: defenseModifier < 0 ? "-" : "+",
    attackRoll: attackRoll.rollObj.total,
    atkIsCritical: attackRoll.isCritical,
    atkIsSuccess: attackRoll.isSuccess,
    atkRollResult: attackRoll.description,
    defenseRoll: defenseRoll?.rollObj.total ?? 0,
    defIsCritical: defenseRoll?.isCritical ?? false,
    defIsSuccess: defenseRoll?.isSuccess ?? false,
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
    atkWeaponBroke: false,
    defWeaponBroke: false,
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
  const attackCode = resultCode(attackRoll);
  const defenseCode = defenseRoll ? resultCode(defenseRoll) : null;
  const impactMod = Number(button.dataset.impactMod) || 0;
  return button.dataset.weaponType === "melee"
    ? meleeCombatResult(attackCode, defenseCode, defense.toLowerCase(), impactMod)
    : missileCombatResult(attackCode, defenseCode, defense.toLowerCase(), impactMod);
}

async function selectBlockWeapon(defender, attackType, attackWeaponName) {
  const equipped = defender.actor.itemTypes.weapongear.filter(item => item.system.isEquipped);
  const shields = equipped.filter(isShield);
  let available = equipped;
  let prompt = "Choose the equipped melee weapon to use for blocking.";

  if (attackType === "missile") {
    if (isHighVelocityMissile(attackWeaponName)) {
      if (!shields.length) {
        ui.notifications.warn(`${attackWeaponName} is a high-velocity missile that can only be blocked with a shield, and you don't have a shield equipped. Block defense refused.`);
        return null;
      }
      available = shields;
      prompt = `${attackWeaponName} is a high-velocity missile and can only be blocked with a shield.`;
    } else {
      prompt = `${attackWeaponName} is a low-velocity missile. Shields use full DML; other melee weapons use half DML.`;
    }
  }

  if (!available.length) {
    ui.notifications.warn(`${defender.name} has no equipped weapons that can be used for blocking.`);
    return null;
  }

  const defaultWeapon = available.reduce((best, item) =>
    !best || Number(item.system.defenseMasteryLevel) > Number(best.system.defenseMasteryLevel)
      ? item
      : best, null);
  const modifier = outnumberedModifier(defender.actor);
  const content = await renderTemplate("systems/hm3/templates/dialog/query-weapon-dialog.html", {
    prompt,
    weapons: available.map(item => item.name),
    defaultWeapon: defaultWeapon?.name,
    modifierType: "Defense",
    defaultModifier: modifier
  });

  return DialogV2.prompt({
    window: { title: `${defender.name} Select Block Weapon` },
    content: content.trim(),
    ok: {
      label: "Block",
      callback: (_event, _button, dialog) => {
        const form = dialog.element?.querySelector("form");
        if (!form) throw new Error("HM3 | Block weapon dialog form was not found.");
        const weapon = available.find(item => item.name === form.elements.weapon?.value);
        return {
          weapon,
          modifier: Number(form.elements.addlModifier?.value) || 0
        };
      }
    },
    rejectClose: false
  });
}

async function performBlock(button, attacker, defender, attackRoll) {
  const selection = await selectBlockWeapon(
    defender,
    button.dataset.weaponType,
    button.dataset.weapon
  );
  if (!selection?.weapon) return null;

  let originalDML = Number(selection.weapon.system.defenseMasteryLevel) || 5;
  if (button.dataset.weaponType === "missile" && !isShield(selection.weapon)) {
    originalDML = Math.max(Math.round(originalDML / 2), 5);
  }
  const effectiveDML = originalDML + selection.modifier;
  const defenseRoll = await DiceHM3.rollTest({
    data: {},
    diceSides: 100,
    diceNum: 1,
    modifier: selection.modifier,
    target: originalDML
  });
  const combatResult = resolveCombatResult(button, attackRoll, defenseRoll, "Block");
  if (!combatResult) throw new Error(`HM3 | No ${button.dataset.weaponType} combat result for Block.`);
  const impactRoll = combatResult.outcome.atkDice
    ? await new Roll(`${combatResult.outcome.atkDice}d6`).evaluate()
    : null;

  return createResultCard({
    attacker,
    defender,
    button,
    defense: "Block",
    attackRoll,
    defenseRoll,
    combatResult,
    impactRoll,
    effectiveDML,
    originalDML,
    defenseModifier: selection.modifier,
    defendWeapon: selection.weapon
  });
}

export async function performDefense(button, defense) {
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

  if (defense === "Block") return performBlock(button, attacker, defender, attackRoll);

  let defenseRoll = null;
  let effectiveDML = 0;
  let defenseModifier = 0;
  if (defense === "Dodge") {
    defenseModifier = outnumberedModifier(defender.actor);
    effectiveDML = Number(defender.actor.system.dodge) + defenseModifier;
    defenseRoll = await DiceHM3.rollTest({
      data: {},
      diceSides: 100,
      diceNum: 1,
      modifier: defenseModifier,
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
    effectiveDML,
    originalDML: defense === "Dodge" ? Number(defender.actor.system.dodge) : 0,
    defenseModifier
  });
}

function bindDefenseButton(button) {
  if (button.dataset.hm3V14DefenseBound === "1") return;
  const action = button.dataset.action;
  if (!["dodge", "ignore", "block"].includes(action)) return;

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    const defense = action === "dodge" ? "Dodge" : action === "block" ? "Block" : "Ignore";
    performDefense(button, defense)
      .catch(error => {
        console.error(`HM3 | ${action} defense failed`, error);
        ui.notifications.error(`${defense} defense failed. See the console for details.`);
      })
      .finally(() => {
        button.disabled = false;
      });
  });
  button.dataset.hm3V14DefenseBound = "1";
}

Hooks.on("renderChatMessageHTML", (_message, html) => {
  for (const root of rootsFromRender(html)) {
    for (const button of root.querySelectorAll(
      '.hm3.chat-card button[data-action="dodge"], .hm3.chat-card button[data-action="ignore"], .hm3.chat-card button[data-action="block"]'
    )) {
      bindDefenseButton(button);
    }
  }
});
