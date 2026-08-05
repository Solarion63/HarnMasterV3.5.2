/*
 * Temporary Foundry VTT v14 compatibility bootstrap.
 *
 * The existing HM3 sheets still use ApplicationV1 globals. Foundry v14 keeps
 * those implementations under foundry.appv1, but no longer guarantees the
 * historical global names. Expose only the names required while the sheets
 * are migrated to ApplicationV2.
 *
 * Remove this file when the Actor, Item, Active Effect, and dialog layers have
 * completed their ApplicationV2 migration.
 */

const legacyGlobals = {
  ActorSheet: foundry.appv1.sheets.ActorSheet,
  ItemSheet: foundry.appv1.sheets.ItemSheet,
  ActiveEffectConfig: foundry.applications.sheets.ActiveEffectConfig,
  Dialog: foundry.applications.api.DialogV2,
  FormDataExtended: foundry.applications.ux.FormDataExtended,
  renderTemplate: foundry.applications.handlebars.renderTemplate,
  Actors: foundry.documents.collections.Actors,
  Items: foundry.documents.collections.Items,
  DocumentSheetConfig: foundry.applications.apps.DocumentSheetConfig
};

for (const [name, implementation] of Object.entries(legacyGlobals)) {
  if (!implementation) {
    console.warn(`HM3 | Foundry v14 compatibility API is unavailable: ${name}`);
    continue;
  }

  if (!(name in globalThis)) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: implementation,
      writable: false
    });
  }
}
