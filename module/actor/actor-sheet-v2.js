import * as utility from "../utility.js";
import { onManageActiveEffect } from "../effect.js";
import { bindDocumentImagePicker } from "../document-image-picker-v14.js";
import { bindSkillControls } from "./actor-skills-v2.js";

const { DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { HTMLProseMirrorElement } = foundry.applications.elements;
const { ActorSheetV2 } = foundry.applications.sheets;
const { FormDataExtended } = foundry.applications.ux;
const { renderTemplate } = foundry.applications.handlebars;

const actorTabState = new WeakMap();
const actorFilterState = new WeakMap();

const ACTOR_FILTERS = [
  {
    input: ".skill-name-filter",
    rows: ".skill-item",
    attribute: "itemName",
    key: "skills"
  },
  {
    input: ".gear-name-filter",
    rows: ".gear-item",
    attribute: "itemName",
    key: "gear"
  },
  {
    input: ".effects-name-filter",
    rows: ".effect",
    attribute: "effectName",
    key: "effects"
  }
];

/**
 * Shared Foundry VTT v14 Actor sheet foundation.
 *
 * Owns rendering, persistence, tabs, list filtering, owned Item controls,
 * native Item drag/drop data, and lightweight bindings to existing HM3 rules.
 * Rules-specific skill, combat, and consequence logic remains isolated in its
 * dedicated modules.
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
    this.#bindFilters(root);
    this.#bindItemDrag(root);
    this.#bindAbilityControls(root);
    bindSkillControls(this, root);
    bindDocumentImagePicker(this, root);
    this.#bindInjuryRoll(root);

    const form = root.querySelector("form");
    if (form && this.isEditable) {
      this.#prepareRichTextEditors(root, form);
      form.addEventListener("change", () => this.#persistForm(form));
    }

    root.querySelectorAll("input[type='text']").forEach(input => {
      input.addEventListener("click", event => event.currentTarget.select());
    });

    if (!this.isEditable) return;

    this.#bindEffectControls(root);

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

  /**
   * Preserve HM3's container-aware gear drops while using ActorSheetV2's
   * native document-drop lifecycle for ordinary Item creation and sorting.
   *
   * @override
   */
  async _onDropItem(event, item) {
    if (!this.actor.isOwner) return null;

    const isGear = item?.type?.endsWith("gear");
    if (!isGear) {
      if (this.actor.type === "container") {
        ui.notifications.warn(
          `You may only place physical objects in a container; drop of ${item?.name ?? "Item"} refused.`
        );
        return null;
      }
      return super._onDropItem(event, item);
    }

    const destinationContainer = this.#dropContainerId(event);
    const sameActor = item.parent?.uuid === this.actor.uuid;

    if (sameActor) {
      if (item.type !== "containergear" && item.system.container !== destinationContainer) {
        await item.update({ "system.container": destinationContainer });
      }
      return super._onDropItem(event, item);
    }

    if (!item.parent) {
      const created = await super._onDropItem(event, item);
      if (created?.type?.endsWith("gear") && created.type !== "containergear") {
        await created.update({ "system.container": destinationContainer });
      }
      return created;
    }

    if (item.type === "containergear") {
      return this.#moveContainerBetweenActors(item);
    }

    const quantity = Math.max(0, Number(item.system.quantity) || 0);
    if (quantity <= 0) {
      ui.notifications.warn(`${item.name} has no quantity available to move.`);
      return null;
    }

    const moveQuantity = quantity > 1
      ? await this.#promptMoveQuantity(item, quantity)
      : 1;
    if (!moveQuantity) return null;

    return this.#moveGearBetweenActors(item, moveQuantity, destinationContainer);
  }

  #dropContainerId(event) {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest("[data-container-id]")?.dataset.containerId ?? "on-person";
  }

  async #promptMoveQuantity(item, maximum) {
    const content = await renderTemplate("systems/hm3/templates/dialog/item-qty.html", {
      itemName: item.name,
      sourceName: item.parent?.name ?? "Unknown",
      targetName: this.actor.name,
      maxItems: maximum
    });

    return DialogV2.prompt({
      window: { title: "Move Items" },
      content: content.trim(),
      ok: {
        label: "Move",
        callback: (_event, _button, dialog) => {
          const raw = dialog.element?.querySelector('[name="itemstomove"]')?.value;
          const quantity = Math.trunc(Number(raw));
          if (!Number.isFinite(quantity) || quantity <= 0) return null;
          return Math.min(quantity, maximum);
        }
      },
      rejectClose: false
    });
  }

  async #moveGearBetweenActors(item, moveQuantity, destinationContainer) {
    const sourceActor = item.parent;
    if (!sourceActor) return null;

    const target = this.actor.items.find(candidate =>
      candidate.type === item.type
      && candidate.name === item.name
      && candidate.system.container === destinationContainer
    );

    let result = target;
    if (target) {
      const targetQuantity = Number(target.system.quantity) || 0;
      await target.update({ "system.quantity": targetQuantity + moveQuantity });
    } else {
      const itemData = item.toObject();
      delete itemData._id;
      itemData.system.quantity = moveQuantity;
      itemData.system.container = destinationContainer;
      const created = await this.actor.createEmbeddedDocuments("Item", [itemData]);
      result = created[0] ?? null;
    }

    if (!result) return null;

    const sourceQuantity = Number(item.system.quantity) || 0;
    if (moveQuantity >= sourceQuantity) {
      await sourceActor.deleteEmbeddedDocuments("Item", [item.id]);
    } else {
      await item.update({ "system.quantity": sourceQuantity - moveQuantity });
    }
    return result;
  }

  async #moveContainerBetweenActors(container) {
    const sourceActor = container.parent;
    if (!sourceActor) return null;

    const childrenByContainer = new Map();
    for (const item of sourceActor.items) {
      const containerId = item.system?.container;
      if (!containerId || containerId === "on-person") continue;
      const children = childrenByContainer.get(containerId) ?? [];
      children.push(item);
      childrenByContainer.set(containerId, children);
    }

    const sourceItems = [];
    const collect = current => {
      sourceItems.push(current);
      for (const child of childrenByContainer.get(current.id) ?? []) {
        collect(child);
      }
    };
    collect(container);

    const createdIds = [];
    const idMap = new Map();
    try {
      for (const sourceItem of sourceItems) {
        const itemData = sourceItem.toObject();
        delete itemData._id;

        if (sourceItem.id === container.id) {
          itemData.system.container = "on-person";
        } else if (idMap.has(sourceItem.system?.container)) {
          itemData.system.container = idMap.get(sourceItem.system.container);
        }

        const created = await this.actor.createEmbeddedDocuments("Item", [itemData]);
        const newItem = created[0];
        if (!newItem) throw new Error(`Failed to create ${sourceItem.name}.`);
        createdIds.push(newItem.id);
        idMap.set(sourceItem.id, newItem.id);
      }
    } catch (error) {
      if (createdIds.length) {
        await this.actor.deleteEmbeddedDocuments("Item", createdIds);
      }
      console.error("HM3 | Container move failed and was rolled back", error);
      ui.notifications.error("Container move failed; no source items were removed.");
      return null;
    }

    await sourceActor.deleteEmbeddedDocuments("Item", sourceItems.map(sourceItem => sourceItem.id));
    return this.actor.items.get(idMap.get(container.id)) ?? null;
  }

  async #persistForm(form) {
    const formData = new FormDataExtended(form);
    const updateData = foundry.utils.expandObject(formData.object);
    await this.actor.update(updateData);
  }

  #prepareRichTextEditors(root, form) {
    for (const editor of Array.from(root.querySelectorAll("prose-mirror"))) {
      const replacement = HTMLProseMirrorElement.create({
        name: editor.name,
        value: editor.value,
        readonly: false,
        disabled: false,
        classes: editor.className,
        collaborate: false,
        documentUUID: this.actor.uuid,
        toggled: false
      });

      editor.replaceWith(replacement);
      replacement.addEventListener("save", () => this.#persistForm(form));
      replacement.addEventListener("change", () => this.#persistForm(form));
    }
  }

  #getItemFromControl(control) {
    const row = control.closest(".item");
    const itemId = row?.dataset.itemId;
    return itemId ? this.actor.items.get(itemId) : null;
  }

  #bindAbilityControls(root) {
    if (!["character", "creature"].includes(this.actor.type)) return;

    const runAbilityRoll = (event, macroName, label) => {
      event.preventDefault();

      const ability = event.currentTarget.dataset.ability
        ?? event.currentTarget.closest("[data-ability]")?.dataset.ability;
      if (!ability) {
        console.warn("HM3 | Ability roll control is missing its ability identifier.");
        return;
      }

      const roller = game.hm3?.macros?.[macroName];
      if (typeof roller !== "function") {
        ui.notifications.error(`${label} is unavailable.`);
        return;
      }

      const fastForward = event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
      Promise.resolve(roller(ability, fastForward, this.actor)).catch(error => {
        console.error(`HM3 | ${label} failed`, error);
        ui.notifications.error(`${label} failed. See the console for details.`);
      });
    };

    for (const control of root.querySelectorAll(".ability-d6-roll")) {
      control.addEventListener("click", event => runAbilityRoll(event, "testAbilityD6Roll", "d6 ability roll"));
    }

    for (const control of root.querySelectorAll(".ability-d100-roll")) {
      control.addEventListener("click", event => runAbilityRoll(event, "testAbilityD100Roll", "d100 ability roll"));
    }

    for (const input of root.querySelectorAll("input.ability-base")) {
      input.addEventListener("focus", event => event.currentTarget.select());
      input.addEventListener("wheel", event => {
        if (document.activeElement === event.currentTarget) event.currentTarget.blur();
      }, { passive: true });
    }
  }

  #bindEffectControls(root) {
    for (const control of root.querySelectorAll(".effect-control")) {
      control.addEventListener("click", async event => {
        event.preventDefault();

        try {
          await onManageActiveEffect(event, this.actor);
        } catch (error) {
          console.error("HM3 | Failed to manage Actor Active Effect", error);
          ui.notifications.error("The Active Effect operation failed. See the console for details.");
        }
      });
    }
  }

  #bindInjuryRoll(root) {
    if (!["character", "creature"].includes(this.actor.type)) return;

    for (const control of root.querySelectorAll(".injury-roll")) {
      control.addEventListener("click", event => {
        event.preventDefault();
        control.setAttribute("aria-disabled", "true");

        Promise.resolve(game.hm3?.macros?.injuryRoll?.(this.actor))
          .catch(error => {
            console.error("HM3 | Generic injury roll failed", error);
            ui.notifications.error("Injury roll failed. See the console for details.");
          })
          .finally(() => control.removeAttribute("aria-disabled"));
      });
    }
  }

  #bindItemDrag(root) {
    if (!this.actor.isOwner) return;

    for (const row of root.querySelectorAll(".item[data-item-id]")) {
      row.draggable = true;
      row.addEventListener("dragstart", event => {
        const itemId = row.dataset.itemId;
        const item = itemId ? this.actor.items.get(itemId) : null;
        if (!item || !event.dataTransfer) return;

        const dragData = typeof item.toDragData === "function"
          ? item.toDragData()
          : { type: "Item", uuid: item.uuid };

        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
        event.dataTransfer.effectAllowed = "copyMove";
      });
    }
  }

  #bindFilters(root) {
    const state = actorFilterState.get(this) ?? {};
    actorFilterState.set(this, state);

    for (const definition of ACTOR_FILTERS) {
      const input = root.querySelector(definition.input);
      if (!input) continue;

      const apply = value => {
        const rawValue = String(value ?? "");
        const normalized = rawValue.trim().toLowerCase();
        state[definition.key] = rawValue;

        for (const row of root.querySelectorAll(definition.rows)) {
          const name = String(row.dataset[definition.attribute] ?? "").toLowerCase();
          row.hidden = Boolean(normalized) && !name.includes(normalized);
        }
      };

      input.value = state[definition.key] ?? input.value ?? "";
      input.addEventListener("input", event => apply(event.currentTarget.value));
      apply(input.value);
    }
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
        icon: effect.img,
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

    const validTabs = new Set(tabs.map(tab => tab.dataset.tab));
    const activate = tabId => {
      const selected = validTabs.has(tabId) ? tabId : tabs[0].dataset.tab;
      actorTabState.set(this, selected);

      for (const tab of tabs) tab.classList.toggle("active", tab.dataset.tab === selected);
      for (const panel of panels) panel.classList.toggle("active", panel.dataset.tab === selected);
    };

    for (const tab of tabs) {
      tab.addEventListener("click", event => {
        event.preventDefault();
        activate(tab.dataset.tab);
      });
    }

    const selected = actorTabState.get(this)
      ?? tabs.find(tab => tab.classList.contains("active"))?.dataset.tab
      ?? this.constructor.INITIAL_TAB
      ?? tabs[0].dataset.tab;
    activate(selected);
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
