import * as utility from "../utility.js";

const { DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const { FormDataExtended } = foundry.applications.ux;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * Shared Foundry VTT v14 Actor sheet foundation.
 *
 * This stage migrates rendering, persistence, tabs, and basic owned Item
 * controls. Rolls, filters, effects, and drag-and-drop are migrated separately.
 */
export class HarnMasterActorSheetV2 extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["hm3", "sheet", "actor"],
    window: {
      resizable: true
    },
    position: {
      width: 780,
      height: 640
    }
  };

  static INITIAL_TAB = "facade";

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actorDocument = this.actor;
    const actor = actorDocument.toObject(false);

    Object.assign(context, {
      owner: actorDocument.isOwner,
      limited: actorDocument.limited,
      editable: this.isEditable,
      cssClass: actorDocument.isOwner ? "editable" : "locked",
      isCharacter: actorDocument.type === "character",
      isCreature: actorDocument.type === "creature",
      isContainer: actorDocument.type === "container",
      config: CONFIG.HM3,
      customSunSign: game.settings.get("hm3", "customSunSign"),
      actor,
      actorDocument,
      items: Array.from(actorDocument.items).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
      adata: actorDocument.system,
      labels: actorDocument.labels ?? {},
      filters: this._filters ?? {},
      macroTypes: foundry.utils.deepClone(game.system.documentTypes.Macro ?? []),
      dtypes: ["String", "Number", "Boolean"],
      containers: {},
      gearTypes: {
        armorgear: "Armor",
        weapongear: "Melee Wpn",
        missilegear: "Missile Wpn",
        miscgear: "Misc. Gear",
        containergear: "Container"
      },
      effects: {}
    });

    this.#prepareContainers(context);
    await this.#prepareEffects(context);

    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);

    const root = this.element;
    if (!root) return;

    this.#activateTabs(root);

    const form = root.querySelector("form");
    if (form && this.isEditable) {
      form.addEventListener("change", () => this.#persistForm(form));
    }

    root.querySelectorAll("input[type='text']").forEach(input => {
      input.addEventListener("click", event => event.currentTarget.select());
    });

    if (!this.isEditable) return;

    root.querySelectorAll(".item-create").forEach(control => {
      control.addEventListener("click", event => this.#onItemCreate(event));
    });

    root.querySelectorAll(".item-edit").forEach(control => {
      control.addEventListener("click", event => this.#onItemEdit(event));
    });

    root.querySelectorAll(".item-delete").forEach(control => {
      control.addEventListener("click", event => this.#onItemDelete(event));
    });
  }

  /** @override */
  async _preClose(options) {
    const form = this.element?.querySelector("form");
    if (form && this.isEditable) await this.#persistForm(form);
    return super._preClose(options);
  }

  async #persistForm(form) {
    const formData = new FormDataExtended(form);
    const updateData = foundry.utils.expandObject(formData.object);
    await this.actor.update(updateData);
  }

  #getItemFromControl(control) {
    const row = control.closest(".item");
    const itemId = row?.dataset.itemId;
    return itemId ? this.actor.items.get(itemId) : null;
  }

  async #onItemEdit(event) {
    event.preventDefault();
    const item = this.#getItemFromControl(event.currentTarget);
    if (!item) {
      ui.notifications.warn("The selected Item could not be found on this Actor.");
      return null;
    }

    return item.sheet.render(true);
  }

  async #onItemDelete(event) {
    event.preventDefault();
    const item = this.#getItemFromControl(event.currentTarget);
    if (!item) {
      ui.notifications.warn("The selected Item could not be found on this Actor.");
      return null;
    }

    return item.delete();
  }

  async #onItemCreate(event) {
    event.preventDefault();
    const dataset = foundry.utils.deepClone(event.currentTarget.dataset);

    let extraList = [];
    let extraLabel = null;
    let name;

    if (dataset.type === "skill" && dataset.skilltype) {
      name = utility.createUniqueName(`New ${dataset.skilltype} Skill`, this.actor.itemTypes.skill);
    } else if (dataset.type === "trait" && dataset.traittype) {
      name = utility.createUniqueName(`New ${dataset.traittype} Trait`, this.actor.itemTypes.trait);
    } else if (dataset.type?.endsWith("gear")) {
      name = "New Gear";
      extraList = ["Misc. Gear", "Armor", "Melee Weapon", "Missile Weapon", "Container"];
      extraLabel = "Gear Type";
    } else {
      const names = {
        armorlocation: ["New Location", "armorlocation"],
        injury: ["New Injury", "injury"],
        spell: ["New Spell", "spell"],
        invocation: ["New Invocation", "invocation"],
        psionic: ["New Psionic", "psionic"]
      };
      const definition = names[dataset.type];
      if (!definition) {
        console.error(`HM3 | Can't create item: unknown item type '${dataset.type}'`);
        return null;
      }
      name = utility.createUniqueName(definition[0], this.actor.itemTypes[definition[1]]);
    }

    const content = await renderTemplate("systems/hm3/templates/dialog/create-item.html", {
      type: dataset.type,
      title: name,
      placeholder: name,
      extraList,
      extraLabel
    });

    return DialogV2.prompt({
      window: { title: name },
      content,
      ok: {
        label: "Create",
        callback: async (_event, _button, dialog) => {
          const root = dialog.element;
          const nameInput = root?.querySelector?.("[name='name']");
          const extraInput = root?.querySelector?.("[name='extra_value']");
          if (!nameInput) throw new Error("HM3 | Create Item dialog fields were not found.");

          const updateData = {
            name: nameInput.value || name,
            type: dataset.type
          };
          const extraValue = extraInput?.value;

          if (dataset.type === "gear") {
            const gearTypes = {
              Container: "containergear",
              Armor: "armorgear",
              "Melee Weapon": "weapongear",
              "Missile Weapon": "missilegear",
              "Misc. Gear": "miscgear"
            };
            updateData.type = gearTypes[extraValue] ?? "miscgear";
          }

          if (dataset.type === "skill") updateData["system.type"] = dataset.skilltype;
          else if (dataset.type === "trait") updateData["system.type"] = dataset.traittype;
          else if (dataset.type?.endsWith("gear")) {
            updateData["system.container"] = dataset.containerId ?? "on-person";
          } else if (dataset.type === "spell") updateData["system.convocation"] = extraValue;
          else if (dataset.type === "invocation") updateData["system.diety"] = extraValue;

          const items = await this.actor.createEmbeddedDocuments("Item", [updateData]);
          const created = items[0];
          if (!created) {
            throw new Error(
              `Error creating Item '${updateData.name}' of type '${updateData.type}' on Actor '${this.actor.name}'.`
            );
          }

          created.sheet.render(true);
          return created;
        }
      },
      rejectClose: false
    });
  }

  #prepareContainers(context) {
    let capacityMax = 0;
    let capacityValue = 0;

    if (this.actor.type === "character") {
      capacityMax = (context.adata.endurance ?? 0) * 10;
      capacityValue = context.adata.eph?.totalGearWeight ?? 0;
    } else if (this.actor.type === "creature") {
      capacityMax = (context.adata.loadRating ?? 0) + ((context.adata.endurance ?? 0) * 10);
      capacityValue = context.adata.eph?.totalGearWeight ?? 0;
    } else if (this.actor.type === "container") {
      capacityMax = context.adata.capacity?.max ?? 0;
      capacityValue = context.adata.capacity?.value ?? 0;
    }

    context.containers["on-person"] = {
      name: "On Person",
      type: "containergear",
      system: {
        container: "on-person",
        capacity: {
          max: capacityMax,
          value: capacityValue
        }
      }
    };

    for (const item of this.actor.items) {
      if (item.type === "containergear") context.containers[item.id] = item;
    }
  }

  async #prepareEffects(context) {
    for (const effect of this.actor.effects) {
      await effect._getSourceName?.();
      context.effects[effect.id] = {
        id: effect.id,
        label: effect.name,
        sourceName: effect.sourceName,
        duration: utility.aeDuration(effect),
        source: effect,
        changes: utility.aeChanges(effect),
        disabled: effect.disabled
      };
    }
  }

  #activateTabs(root) {
    const tabs = Array.from(root.querySelectorAll(".sheet-tabs [data-tab]"));
    const panels = Array.from(root.querySelectorAll(".sheet-body [data-tab]"));
    if (!tabs.length || !panels.length) return;

    const activate = tabId => {
      for (const tab of tabs) tab.classList.toggle("active", tab.dataset.tab === tabId);
      for (const panel of panels) panel.classList.toggle("active", panel.dataset.tab === tabId);
    };

    for (const tab of tabs) {
      tab.addEventListener("click", event => {
        event.preventDefault();
        activate(tab.dataset.tab);
      });
    }

    const activeTab = tabs.find(tab => tab.classList.contains("active"))?.dataset.tab
      ?? this.constructor.INITIAL_TAB
      ?? tabs[0].dataset.tab;
    activate(activeTab);
  }
}

export class HarnMasterCharacterSheetV2 extends HarnMasterActorSheetV2 {
  static DEFAULT_OPTIONS = {
    classes: ["hm3", "sheet", "actor", "character"],
    position: { width: 780, height: 640 }
  };

  static PARTS = {
    main: {
      template: "systems/hm3/templates/actor/character-sheet.html"
    }
  };

  async _renderHTML(context, options) {
    this.constructor.PARTS.main.template = (!game.user.isGM && this.actor.limited)
      ? "systems/hm3/templates/actor/character-limited.html"
      : "systems/hm3/templates/actor/character-sheet.html";
    return super._renderHTML(context, options);
  }
}

export class HarnMasterCreatureSheetV2 extends HarnMasterActorSheetV2 {
  static DEFAULT_OPTIONS = {
    classes: ["hm3", "sheet", "actor", "creature"],
    position: { width: 780, height: 640 }
  };

  static PARTS = {
    main: {
      template: "systems/hm3/templates/actor/creature-sheet.html"
    }
  };

  async _renderHTML(context, options) {
    this.constructor.PARTS.main.template = (!game.user.isGM && this.actor.limited)
      ? "systems/hm3/templates/actor/creature-limited.html"
      : "systems/hm3/templates/actor/creature-sheet.html";
    return super._renderHTML(context, options);
  }
}

export class HarnMasterContainerSheetV2 extends HarnMasterActorSheetV2 {
  static DEFAULT_OPTIONS = {
    classes: ["hm3", "sheet", "actor", "container"],
    position: { width: 700, height: 640 }
  };

  static PARTS = {
    main: {
      template: "systems/hm3/templates/actor/container-sheet.html"
    }
  };

  async _renderHTML(context, options) {
    this.constructor.PARTS.main.template = (!game.user.isGM && this.actor.limited)
      ? "systems/hm3/templates/actor/container-limited.html"
      : "systems/hm3/templates/actor/container-sheet.html";
    return super._renderHTML(context, options);
  }
}
