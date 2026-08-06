/*
 * Temporary Foundry VTT v14 compatibility bootstrap.
 *
 * The existing HM3 sheets still use ApplicationV1 globals. Foundry v14 keeps
 * those implementations under foundry.appv1, but no longer guarantees the
 * historical global names. Expose only the names required while the sheets
 * are migrated to ApplicationV2.
 *
 * Remove this file when the Actor, Active Effect, dialog, and chat layers have
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

/**
 * Restore the legacy chat-message type names still referenced by automated
 * combat declarations. Their numeric values are identical to v14 message
 * styles, allowing the old code to reach ChatMessage creation where Foundry's
 * compatibility normalization can handle the deprecated `type` field.
 */
if (!CONST.CHAT_MESSAGE_TYPES) {
  Object.defineProperty(CONST, "CHAT_MESSAGE_TYPES", {
    configurable: true,
    value: {
      OTHER: CONST.CHAT_MESSAGE_STYLES.OTHER,
      OOC: CONST.CHAT_MESSAGE_STYLES.OOC,
      IC: CONST.CHAT_MESSAGE_STYLES.IC,
      EMOTE: CONST.CHAT_MESSAGE_STYLES.EMOTE,
      WHISPER: CONST.CHAT_MESSAGE_STYLES.WHISPER,
      ROLL: CONST.CHAT_MESSAGE_STYLES.ROLL
    },
    writable: false
  });
}

/**
 * A deliberately small jQuery-style collection used only by legacy HM3 chat
 * rendering code. Foundry v14 passes a native HTMLElement to
 * renderChatMessageHTML, while the pre-v14 combat helper expects find/each.
 */
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

/**
 * Restore the pre-v14 canvas.grid.measureDistances contract used by HM3.
 * Installing it on the grid prototype is more reliable than decorating one
 * canvas grid instance because Foundry may replace that instance while loading
 * or switching scenes.
 */
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
