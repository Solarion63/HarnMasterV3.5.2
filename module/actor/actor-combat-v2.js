import * as macros from "../macros.js";
import { performAutomatedAttack } from "../combat-attack-v14.js";

function itemFromControl(sheet, control) {
  const row = control.closest(".item");
  const itemId = row?.dataset.itemId;
  return itemId ? sheet.actor.items.get(itemId) : null;
}

function fastForward(event) {
  return event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
}

function runAction(label, action) {
  Promise.resolve().then(action).catch(error => {
    console.error(`HM3 | ${label} failed`, error);
    ui.notifications.error(`${label} failed. See the console for details.`);
  });
}

function bind(root, selector, label, callback) {
  for (const control of root.querySelectorAll(selector)) {
    control.addEventListener("click", event => {
      event.preventDefault();
      runAction(label, () => callback(event, control));
    });
  }
}

function getSheetToken(sheet) {
  if (sheet.actor.token) return sheet.actor.token;
  const tokens = sheet.actor.getActiveTokens(true);
  if (tokens.length === 0) {
    ui.notifications.warn("There are no tokens linked to this actor on the canvas, double-click on a specific token on the canvas.");
    return null;
  }
  if (tokens.length > 1) {
    ui.notifications.warn(`There are ${tokens.length} tokens linked to this actor on the canvas, so the acting token can't be identified.`);
    return null;
  }
  return tokens[0];
}

function getSingleTarget() {
  const targets = Array.from(game.user.targets ?? []);
  if (targets.length !== 1) {
    ui.notifications.warn("No targets selected, you must select exactly one target, combat aborted.");
    return null;
  }
  return targets[0];
}

async function automatedAttack(sheet, control, expectedType) {
  const attacker = getSheetToken(sheet);
  const defender = getSingleTarget();
  const item = itemFromControl(sheet, control);
  if (!attacker || !defender || !item || item.type !== expectedType) return null;
  return performAutomatedAttack(attacker, defender, item);
}

function bindCombatControls(sheet, root) {
  bind(root, ".dodge-roll", "Dodge roll", event => macros.dodgeRoll(fastForward(event), sheet.actor));
  bind(root, ".shock-roll", "Shock roll", event => macros.shockRoll(fastForward(event), sheet.actor));
  bind(root, ".stumble-roll", "Stumble roll", event => macros.stumbleRoll(fastForward(event), sheet.actor));
  bind(root, ".fumble-roll", "Fumble roll", event => macros.fumbleRoll(fastForward(event), sheet.actor));
  bind(root, ".damage-roll", "Generic damage roll", () => macros.genericDamageRoll(sheet.actor));

  bind(root, ".melee-weapon-attack", "Melee combat", (_event, control) =>
    automatedAttack(sheet, control, "weapongear"));
  bind(root, ".missile-weapon-attack", "Missile combat", (_event, control) =>
    automatedAttack(sheet, control, "missilegear"));

  bind(root, ".weapon-attack-roll", "Weapon attack roll", (event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.weaponAttackRoll(item?.uuid, fastForward(event), sheet.actor);
  });
  bind(root, ".weapon-defend-roll", "Weapon defense roll", (event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.weaponDefendRoll(item?.uuid, fastForward(event), sheet.actor);
  });
  bind(root, ".weapon-damage-roll", "Weapon damage roll", (_event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.weaponDamageRoll(item?.uuid, control.dataset.aspect, sheet.actor);
  });
  bind(root, ".missile-attack-roll", "Missile attack roll", (_event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.missileAttackRoll(item?.uuid, sheet.actor);
  });
  bind(root, ".missile-damage-roll", "Missile damage roll", (_event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.missileDamageRoll(item?.uuid, control.dataset.range, sheet.actor);
  });
}

for (const hook of ["renderHarnMasterCharacterSheetV2", "renderHarnMasterCreatureSheetV2"]) {
  Hooks.on(hook, (sheet, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0] ?? sheet.element;
    if (root) bindCombatControls(sheet, root);
  });
}
