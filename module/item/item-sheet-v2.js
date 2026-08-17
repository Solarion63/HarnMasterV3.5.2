import { onManageActiveEffect } from "../effect.js";
import * as utility from "../utility.js";
import { bindDocumentImagePicker } from "../document-image-picker-v14.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { HTMLProseMirrorElement } = foundry.applications.elements;
const { ItemSheetV2 } = foundry.applications.sheets;
const { FormDataExtended, TextEditor } = foundry.applications.ux;
const { renderTemplate } = foundry.applications.handlebars;

const DESCRIPTION_VIEW_TEMPLATE = "systems/hm3/templates/item/item-description-view-v14.html";
const itemTabState = new WeakMap();
const itemDescriptionEditState = new WeakMap();

export class HarnMasterItemSheetV2 extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["hm3", "sheet", "item"],
    position: { width: 560, height: 550 }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;
    const actor = item.actor;

    Object.assign(context, {
      owner: item.isOwner,
      editable: this.isEditable,
      cssClass: item.isOwner ? "editable" : "locked",
      item,
      idata: item.system,
      config: CONFIG.HM3,
      itemType: item.type,
      hasActor: Boolean(actor),
      hasCombatSkills: false,
      hasRitualSkills: false,
      hasMagicSkills: false,
      descriptionEditing: Boolean(itemDescriptionEditState.get(this)),
      macroTypes: foundry.utils.deepClone(game.system.documentTypes.Macro ?? []),
      containers: { "On Person": "on-person" },
      effects: {}
    });

    if (actor && item.type !== "containergear") {
      for (const container of actor.itemTypes.containergear ?? []) context.containers[container.name] = container.id;
    }

    this.#prepareAssociatedSkills(context, actor);
    await this.#prepareEffects(context);
    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    this.#activateTabs(root);
    bindDocumentImagePicker(this, root);

    const form = root.querySelector("form");
    if (form && this.isEditable) {
      form.addEventListener("change", event => {
        if (event.target?.closest?.(".tab.description")) return;
        void this.#persistForm(form);
      });
    }

    if (itemDescriptionEditState.get(this)) {
      this.#activateRenderedDescriptionEditor(root);
    } else {
      void this.#showDescriptionView(root);
    }

    if (!this.isEditable) return;

    root.querySelectorAll("input[type='text']").forEach(input => {
      input.addEventListener("click", event => event.currentTarget.select());
    });

    root.querySelectorAll(".properties").forEach(element => {
      element.addEventListener("keypress", event => {
        if (event.key === "Enter") void this.close();
      });
    });

    root.querySelectorAll(".effect-control").forEach(control => {
      control.addEventListener("click", event => {
        event.preventDefault();
        if (this.item.isOwned) {
          ui.notifications.warn("You cannot change an Item's Effects after it is associated with an Actor. Modify the Effect from the Actor's Effects tab instead.");
          return;
        }
        return onManageActiveEffect(event, this.item);
      });
    });

    root.querySelectorAll(".armorgear-location-add").forEach(control => {
      control.addEventListener("click", event => this.#addArmorLocation(event));
    });
    root.querySelectorAll(".armorgear-location-delete").forEach(control => {
      control.addEventListener("click", event => this.#deleteArmorLocation(event));
    });
  }

  async _preClose(options) {
    itemDescriptionEditState.delete(this);
    const form = this.element?.querySelector("form");
    if (form && this.isEditable) await this.#persistForm(form);
    return super._preClose(options);
  }

  async #persistForm(form) {
    const formData = new FormDataExtended(form);
    const updateData = foundry.utils.expandObject(formData.object);
    if (updateData.system) delete updateData.system.description;
    await this.item.update(updateData);
  }

  async #showDescriptionView(root) {
    const panel = root.querySelector('.tab.description[data-tab="description"]');
    if (!panel) return;

    const implementation = TextEditor.implementation;
    const description = await implementation.enrichHTML(String(this.item.system.description ?? ""), {
      async: true,
      secrets: this.item.isOwner,
      relativeTo: this.item
    });

    panel.innerHTML = await renderTemplate(DESCRIPTION_VIEW_TEMPLATE, {
      description,
      editable: this.isEditable
    });

    panel.querySelector(".hm3-item-description-edit-button")?.addEventListener("click", event => {
      event.preventDefault();
      itemDescriptionEditState.set(this, true);
      itemTabState.set(this, "description");
      void this.render({ force: true });
    });
  }

  #activateRenderedDescriptionEditor(root) {
    const panel = root.querySelector('.tab.description[data-tab="description"]');
    if (!panel) return;

    const renderedEditor = panel.querySelector("prose-mirror");
    const descriptionValue = renderedEditor?.value ?? String(this.item.system.description ?? "");
    const replacement = HTMLProseMirrorElement.create({
      name: renderedEditor?.name ?? "system.description",
      value: descriptionValue,
      readonly: false,
      disabled: false,
      classes: renderedEditor?.className || "editor",
      collaborate: false,
      documentUUID: this.item.uuid,
      toggled: false,
      height: 320
    });

    if (renderedEditor) {
      renderedEditor.replaceWith(replacement);
    } else {
      panel.replaceChildren(replacement);
    }

    replacement.addEventListener("save", () => {
      void this.#commitDescription(replacement);
    });

    const controls = document.createElement("div");
    controls.className = "hm3-item-description-controls";
    controls.innerHTML = `
      <button type="button" class="hm3-item-description-icon-button hm3-item-description-cancel" title="Cancel Description Edit" aria-label="Cancel Description Edit">
        <i class="fas fa-times"></i>
      </button>
    `;
    panel.prepend(controls);

    controls.querySelector(".hm3-item-description-cancel")?.addEventListener("click", event => {
      event.preventDefault();
      itemDescriptionEditState.set(this, false);
      itemTabState.set(this, "description");
      void this.render({ force: true });
    });
  }

  async #commitDescription(editor) {
    await this.item.update({ "system.description": String(editor.value ?? "") });
    itemDescriptionEditState.set(this, false);
    itemTabState.set(this, "description");
    await this.render({ force: true });
  }

  #prepareAssociatedSkills(context, actor) {
    if (!actor) return;
    const skills = actor.itemTypes.skill ?? [];

    if (this.item.type === "spell") {
      context.convocations = [];
      for (const skill of skills) {
        if (skill.system.type === "Magic") {
          context.convocations.push(skill.name);
          context.hasMagicSkills = true;
        }
      }
      return;
    }

    if (this.item.type === "invocation") {
      context.dieties = [];
      for (const skill of skills) {
        if (skill.system.type === "Ritual") {
          context.dieties.push(skill.name);
          context.hasRitualSkills = true;
        }
      }
      return;
    }

    if (!["weapongear", "missilegear"].includes(this.item.type)) return;
    context.combatSkills = [this.item.type === "weapongear" ? "None" : "Throwing"];
    for (const skill of skills) {
      if (skill.system.type !== "Combat") continue;
      const name = skill.name.toLowerCase();
      if (["initiative", "dodge"].includes(name)) continue;
      context.combatSkills.push(skill.name);
      context.hasCombatSkills = true;
    }
  }

  async #prepareEffects(context) {
    for (const effect of this.item.effects) {
      await effect._getSourceName?.();
      context.effects[effect.id] = {
        source: effect.sourceName,
        duration: utility.aeDuration(effect),
        changes: utility.aeChanges(effect),
        data: {
          _id: effect.id,
          label: effect.name,
          icon: effect.img,
          disabled: effect.disabled
        }
      };
    }
  }

  #activateTabs(root) {
    const tabs = Array.from(root.querySelectorAll(".sheet-tabs [data-tab]"));
    const panels = Array.from(root.querySelectorAll(".sheet-body [data-tab]"));
    if (!tabs.length || !panels.length) return;

    const available = new Set(tabs.map(tab => tab.dataset.tab));
    const activate = tabId => {
      if (!available.has(tabId)) tabId = tabs[0].dataset.tab;
      itemTabState.set(this, tabId);
      for (const tab of tabs) tab.classList.toggle("active", tab.dataset.tab === tabId);
      for (const panel of panels) panel.classList.toggle("active", panel.dataset.tab === tabId);
    };

    for (const tab of tabs) {
      tab.addEventListener("click", event => {
        event.preventDefault();
        activate(tab.dataset.tab);
      });
    }

    const activeTab = itemTabState.get(this)
      ?? tabs.find(tab => tab.classList.contains("active"))?.dataset.tab
      ?? tabs[0].dataset.tab;
    activate(activeTab);
  }

  async #addArmorLocation(event) {
    event.preventDefault();
    const form = this.element?.querySelector("form");
    if (form) await this.#persistForm(form);
    const location = event.currentTarget.dataset.location;
    const locations = Array.from(this.item.system.locations ?? []);
    if (!locations.includes(location)) locations.push(location);
    return this.item.update({ "system.locations": locations });
  }

  async #deleteArmorLocation(event) {
    event.preventDefault();
    const form = this.element?.querySelector("form");
    if (form) await this.#persistForm(form);
    const location = event.currentTarget.dataset.location;
    const locations = Array.from(this.item.system.locations ?? []);
    const index = locations.indexOf(location);
    if (index >= 0) locations.splice(index, 1);
    return this.item.update({ "system.locations": locations });
  }
}

const ITEM_TYPES = [
  "skill", "spell", "invocation", "psionic", "weapongear", "containergear",
  "missilegear", "armorgear", "miscgear", "injury", "armorlocation", "trait"
];

export const HM3_ITEM_SHEETS_V2 = Object.fromEntries(
  ITEM_TYPES.map(type => {
    const SheetClass = class extends HarnMasterItemSheetV2 {
      static PARTS = {
        main: { template: `systems/hm3/templates/item/${type}-sheet.html` }
      };
    };

    Object.defineProperty(SheetClass, "name", {
      value: `HarnMaster${type[0].toUpperCase()}${type.slice(1)}ItemSheetV2`
    });
    return [type, SheetClass];
  })
);
