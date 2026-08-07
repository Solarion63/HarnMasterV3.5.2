/*
 * Temporary Foundry VTT v14 compatibility bootstrap.
 *
 * Only the legacy macro-facing combat API still relies on historical global
 * rendering helpers and grid measurement. ApplicationV2 sheets, document
 * creation, effects, and sheet registration now use namespaced v14 APIs.
 *
 * Remove this file when the exported legacy combat helpers have been migrated
 * to native Foundry v14 APIs.
 */

const legacyGlobals = {
  Dialog: foundry.applications.api.DialogV2,
  renderTemplate: foundry.applications.handlebars.renderTemplate
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
