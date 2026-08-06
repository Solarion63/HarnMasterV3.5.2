import * as macros from "../macros.js";

function itemFromControl(sheet, control) {
  const row = control.closest(".item");
  const itemId = row?.dataset.itemId;
  return itemId ? sheet.actor.items.get(itemId) : null;
}

function fastForward(event) {
  return event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
}

function runAction(label, action) {
  Promise.resolve()
    .then(action)
    .catch(error => {
      console.error(`HM3 | ${label} failed`, error);
      ui.notifications.error(`${label} failed. See the console for details.`);
    });
}

function bind(sheet, root, selector, label, callback) {
  for (const control of root.querySelectorAll(selector)) {
    control.addEventListener("click", event => {
      event.preventDefault();
      runAction(label, () => callback(event, control));
    });
  }
}

function bindCombatControls(sheet, root) {
  bind(sheet, root, ".dodge-roll", "Dodge roll", event =>
    macros.dodgeRoll(fastForward(event), sheet.actor));

  bind(sheet, root, ".shock-roll", "Shock roll", event =>
    macros.shockRoll(fastForward(event), sheet.actor));

  bind(sheet, root, ".stumble-roll", "Stumble roll", event =>
    macros.stumbleRoll(fastForward(event), sheet.actor));

  bind(sheet, root, ".fumble-roll", "Fumble roll", event =>
    macros.fumbleRoll(fastForward(event), sheet.actor));

  bind(sheet, root, ".damage-roll", "Generic damage roll", () =>
    macros.genericDamageRoll(sheet.actor));

  bind(sheet, root, ".weapon-attack-roll", "Weapon attack roll", (event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.weaponAttackRoll(item?.uuid, fastForward(event), sheet.actor);
  });

  bind(sheet, root, ".weapon-defend-roll", "Weapon defense roll", (event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.weaponDefendRoll(item?.uuid, fastForward(event), sheet.actor);
  });

  bind(sheet, root, ".weapon-damage-roll", "Weapon damage roll", (_event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.weaponDamageRoll(item?.uuid, control.dataset.aspect, sheet.actor);
  });

  bind(sheet, root, ".missile-attack-roll", "Missile attack roll", (_event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.missileAttackRoll(item?.uuid, sheet.actor);
  });

  bind(sheet, root, ".missile-damage-roll", "Missile damage roll", (_event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.missileDamageRoll(item?.uuid, control.dataset.range, sheet.actor);
  });
}

for (const hook of [
  "renderHarnMasterCharacterSheetV2",
  "renderHarnMasterCreatureSheetV2"
]) {
  Hooks.on(hook, (sheet, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0] ?? sheet.element;
    if (root) bindCombatControls(sheet, root);
  });
}
