import { onManageActiveEffect } from "../effect.js";

/**
 * Bind native DOM handlers for Active Effect controls rendered by the legacy
 * HM3 Actor templates inside ActorSheetV2.
 *
 * @param {object} sheet The ActorSheetV2 application instance.
 * @param {HTMLElement} root The rendered application root.
 */
function bindActorEffectControls(sheet, root) {
  if (!sheet.isEditable) return;

  for (const control of root.querySelectorAll(".effect-control")) {
    control.addEventListener("click", async event => {
      event.preventDefault();

      try {
        await onManageActiveEffect(event, sheet.actor);
      } catch (error) {
        console.error("HM3 | Failed to manage Actor Active Effect", error);
        ui.notifications.error("The Active Effect operation failed. See the console for details.");
      }
    });
  }
}

for (const hook of [
  "renderHarnMasterCharacterSheetV2",
  "renderHarnMasterCreatureSheetV2",
  "renderHarnMasterContainerSheetV2"
]) {
  Hooks.on(hook, (sheet, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0] ?? sheet.element;
    if (root) bindActorEffectControls(sheet, root);
  });
}
