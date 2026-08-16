import { getItem } from "./item-lookup.js";
import { performAutomatedAttack } from "./combat-attack-v14.js";
import { performDefense } from "./combat-defense-v14.js";
import { performCounterstrike } from "./combat-counterstrike-v14.js";

function canvasToken(token) {
  if (!token) return null;
  if (token.documentName === "Token" && token.object) return token.object;
  if (token.actor && token.center) return token;
  const id = typeof token === "string" ? token : token.id;
  return id ? canvas.tokens.get(id) : null;
}

function currentCombatantToken(myToken = null, forceAllow = false) {
  const requested = canvasToken(myToken);
  if (requested && (game.user.isGM || forceAllow)) {
    return { token: requested, actor: requested.actor };
  }

  const combatant = game.combat?.combatant;
  if (!combatant) {
    ui.notifications.warn("No active combatant.");
    return null;
  }

  const tokenId = combatant.tokenId ?? combatant.token?.id;
  const token = canvas.tokens.get(tokenId);
  if (!token?.actor) {
    ui.notifications.warn("The active combatant token could not be found on the canvas.");
    return null;
  }

  if (requested && requested.id !== token.id) {
    ui.notifications.warn(`${requested.name} cannot perform that action at this time.`);
    return null;
  }

  if (!token.actor.isOwner) {
    ui.notifications.warn(`You do not have permissions to control ${token.name}.`);
    return null;
  }

  return { token, actor: token.actor };
}

function singleTarget(combatant) {
  const targets = Array.from(game.user.targets ?? []);
  if (targets.length !== 1) {
    ui.notifications.warn("You must select exactly one target, combat aborted.");
    return null;
  }

  const target = targets[0];
  if (combatant?.token && target.id === combatant.token.id) {
    ui.notifications.warn("The combatant cannot attack itself, combat aborted.");
    return null;
  }
  return target;
}

function tokenPair(atkTokenId, defTokenId) {
  const attacker = canvas.tokens.get(atkTokenId);
  const defender = canvas.tokens.get(defTokenId);
  if (!attacker) {
    ui.notifications.warn(`Attacker token ${atkTokenId} could not be found on the active scene.`);
    return null;
  }
  if (!defender) {
    ui.notifications.warn(`Defender token ${defTokenId} could not be found on the active scene.`);
    return null;
  }
  return { attacker, defender };
}

function defenseButtonData(atkTokenId, defTokenId, type, weaponName, effAML, aim, aspect, impactMod) {
  return {
    dataset: {
      atkTokenId,
      defTokenId,
      weaponType: type,
      weapon: weaponName,
      effAml: String(effAML),
      aim,
      aspect,
      impactMod: String(impactMod ?? 0)
    }
  };
}

export async function weaponAttack(itemName = null, noDialog = false, myToken = null, forceAllow = false) {
  const combatant = currentCombatantToken(myToken, forceAllow);
  if (!combatant) return null;
  const targetToken = singleTarget(combatant);
  if (!targetToken) return null;

  const weapon = itemName ? await getItem(itemName, "weapongear", combatant.actor) : null;
  if (!weapon) {
    ui.notifications.warn("No melee weapon was specified for automated combat.");
    return null;
  }

  if (!Hooks.call("hm3.preMeleeAttack", combatant, targetToken, weapon)) return null;
  const result = await performAutomatedAttack(combatant.token, targetToken, weapon);
  Hooks.call("hm3.onMeleeAttack", result, combatant, targetToken, weapon);
  return result;
}

export async function missileAttack(itemName = null, noDialog = false, myToken = null, forceAllow = false) {
  const combatant = currentCombatantToken(myToken, forceAllow);
  if (!combatant) return null;
  const targetToken = singleTarget(combatant);
  if (!targetToken) return null;

  const missile = itemName ? await getItem(itemName, "missilegear", combatant.actor) : null;
  if (!missile) {
    ui.notifications.warn("No missile weapon was specified for automated combat.");
    return null;
  }

  if (!Hooks.call("hm3.preMissileAttack", combatant, targetToken, missile)) return null;
  const result = await performAutomatedAttack(combatant.token, targetToken, missile);
  Hooks.call("hm3.onMissileAttack", result, combatant, targetToken, missile);
  return result;
}

export async function dodgeResume(atkTokenId, defTokenId, type, weaponName, effAML, aim, aspect, impactMod) {
  const pair = tokenPair(atkTokenId, defTokenId);
  if (!pair) return null;
  const { attacker, defender } = pair;
  if (!Hooks.call("hm3.preDodgeResume", attacker, defender, type, weaponName, effAML, aim, aspect, impactMod)) return null;

  const result = await performDefense(
    defenseButtonData(atkTokenId, defTokenId, type, weaponName, effAML, aim, aspect, impactMod),
    "Dodge"
  );
  Hooks.call("hm3.onDodgeResume", result, attacker, defender, type, weaponName, effAML, aim, aspect, impactMod);
  return result;
}

export async function blockResume(atkTokenId, defTokenId, type, weaponName, effAML, aim, aspect, impactMod) {
  const pair = tokenPair(atkTokenId, defTokenId);
  if (!pair) return null;
  const { attacker, defender } = pair;
  if (!Hooks.call("hm3.preBlockResume", attacker, defender, type, weaponName, effAML, aim, aspect, impactMod)) return null;

  const result = await performDefense(
    defenseButtonData(atkTokenId, defTokenId, type, weaponName, effAML, aim, aspect, impactMod),
    "Block"
  );
  Hooks.call("hm3.onBlockResume", result, attacker, defender, type, weaponName, effAML, aim, aspect, impactMod);
  return result;
}

export async function ignoreResume(atkTokenId, defTokenId, type, weaponName, effAML, aim, aspect, impactMod) {
  const pair = tokenPair(atkTokenId, defTokenId);
  if (!pair) return null;
  const { attacker, defender } = pair;
  if (!Hooks.call("hm3.preIgnoreResume", attacker, defender, type, weaponName, effAML, aim, aspect, impactMod)) return null;

  const result = await performDefense(
    defenseButtonData(atkTokenId, defTokenId, type, weaponName, effAML, aim, aspect, impactMod),
    "Ignore"
  );
  Hooks.call("hm3.onIgnoreResume", result, attacker, defender, type, weaponName, effAML, aim, aspect, impactMod);
  return result;
}

export async function meleeCounterstrikeResume(atkTokenId, defTokenId, atkWeaponName, atkEffAML, atkAim, atkAspect, atkImpactMod) {
  const pair = tokenPair(atkTokenId, defTokenId);
  if (!pair) return null;
  const { attacker, defender } = pair;
  if (!Hooks.call("hm3.preMeleeCounterstrikeResume", attacker, defender, atkWeaponName, atkEffAML, atkAim, atkAspect, atkImpactMod)) return null;

  const nativeResult = await performCounterstrike(
    defenseButtonData(atkTokenId, defTokenId, "melee", atkWeaponName, atkEffAML, atkAim, atkAspect, atkImpactMod)
  );
  const result = nativeResult
    ? { atk: nativeResult.attack, cs: nativeResult.counterstrike }
    : null;
  Hooks.call("hm3.onMeleeCounterstrikeResume", result, attacker, defender, atkWeaponName, atkEffAML, atkAim, atkAspect, atkImpactMod);
  return result;
}

const nativeCombatMacros = {
  weaponAttack,
  missileAttack,
  dodgeResume,
  blockResume,
  ignoreResume,
  meleeCounterstrikeResume
};

Hooks.once("init", () => {
  if (!game.hm3?.macros) return;
  game.hm3.macros = {
    ...game.hm3.macros,
    ...nativeCombatMacros
  };
});
