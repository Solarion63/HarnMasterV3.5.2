import * as macros from "../macros.js";

/**
 * Bind the legacy HM3 ability roll controls rendered inside ActorSheetV2.
 * Modifier keys preserve the existing fast-forward behavior.
 *
 * @param {object} sheet The ActorSheetV2 application instance.
 * @param {HTMLElement} root The rendered application root.
 */
function bindAbilityControls(sheet, root) {
  const roll = (event, roller) => {
    event.preventDefault();

    const ability = event.currentTarget.dataset.ability
      ?? event.currentTarget.closest("[data-ability]")?.dataset.ability;
    if (!ability) {
      console.warn("HM3 | Ability roll control is missing its ability identifier.");
      return null;
    }

    const fastForward = event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
    return roller(ability, fastForward, sheet.actor);
  };

  for (const control of root.querySelectorAll(".ability-d6-roll")) {
    control.addEventListener("click", event => {
      try {
        return roll(event, macros.testAbilityD6Roll);
      } catch (error) {
        console.error("HM3 | d6 ability roll failed", error);
        ui.notifications.error("The d6 ability roll failed. See the console for details.");
        return null;
      }
    });
  }

  for (const control of root.querySelectorAll(".ability-d100-roll")) {
    control.addEventListener("click", event => {
      try {
        return roll(event, macros.testAbilityD100Roll);
      } catch (error) {
        console.error("HM3 | d100 ability roll failed", error);
        ui.notifications.error("The d100 ability roll failed. See the console for details.");
        return null;
      }
    });
  }

  for (const input of root.querySelectorAll("input.ability-base")) {
    input.addEventListener("focus", event => event.currentTarget.select());
    input.addEventListener("wheel", event => {
      if (document.activeElement === event.currentTarget) event.currentTarget.blur();
    }, { passive: true });
  }
}

for (const hook of [
  "renderHarnMasterCharacterSheetV2",
  "renderHarnMasterCreatureSheetV2"
]) {
  Hooks.on(hook, (sheet, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0] ?? sheet.element;
    if (root) bindAbilityControls(sheet, root);
  });
}
