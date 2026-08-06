import * as macros from "../macros.js";

function rootFromRender(sheet, html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return sheet.element ?? null;
}

function bindInjuryRoll(sheet, root) {
  for (const control of root.querySelectorAll(".injury-roll")) {
    if (control.dataset.hm3V14InjuryBound === "1") continue;

    control.addEventListener("click", event => {
      event.preventDefault();
      control.setAttribute("aria-disabled", "true");

      Promise.resolve(macros.injuryRoll(sheet.actor))
        .catch(error => {
          console.error("HM3 | Generic injury roll failed", error);
          ui.notifications.error("Injury roll failed. See the console for details.");
        })
        .finally(() => control.removeAttribute("aria-disabled"));
    });

    control.dataset.hm3V14InjuryBound = "1";
  }
}

for (const hook of ["renderHarnMasterCharacterSheetV2", "renderHarnMasterCreatureSheetV2"]) {
  Hooks.on(hook, (sheet, html) => {
    const root = rootFromRender(sheet, html);
    if (root) bindInjuryRoll(sheet, root);
  });
}
