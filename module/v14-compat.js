/*
 * Temporary Foundry VTT v14 compatibility bootstrap.
 *
 * The existing HM3 sheets still use ApplicationV1 globals. Foundry v14 keeps
 * those implementations under foundry.appv1, but no longer guarantees the
 * historical global names. Expose only the names required while the sheets
 * are migrated to ApplicationV2.
 *
 * Remove this file when the Actor, Active Effect, dialog, and DOM layers have
 * completed their ApplicationV2/native DOM migration.
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

class HM3LegacyElementCollection extends Array {
  find(selector) {
    return new HM3LegacyElementCollection(
      ...this.flatMap(element => Array.from(element.querySelectorAll(selector)))
    );
  }

  each(callback) {
    this.forEach((element, index) => callback(index, element));
    return this;
  }
}

if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.find) {
  Object.defineProperty(HTMLElement.prototype, "find", {
    configurable: true,
    value(selector) {
      return new HM3LegacyElementCollection(...this.querySelectorAll(selector));
    },
    writable: true
  });
}

function installLegacyGridMeasurement() {
  const grid = canvas?.grid;
  if (!grid || typeof grid.measurePath !== "function") return;

  const prototype = Object.getPrototypeOf(grid);
  if (!prototype || typeof prototype.measureDistances === "function") return;

  Object.defineProperty(prototype, "measureDistances", {
    configurable: true,
    value(segments = []) {
      return segments.map(segment => {
        const ray = segment?.ray;
        if (!ray) return 0;
        return this.measurePath([
          { x: ray.A.x, y: ray.A.y },
          { x: ray.B.x, y: ray.B.y }
        ]).distance;
      });
    },
    writable: true
  });
}

Hooks.on("canvasInit", installLegacyGridMeasurement);
Hooks.on("canvasReady", installLegacyGridMeasurement);
Hooks.once("ready", installLegacyGridMeasurement);
