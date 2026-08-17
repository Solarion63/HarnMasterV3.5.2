const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { HTMLProseMirrorElement } = foundry.applications.elements;

/**
 * Dedicated Foundry VTT v14 rich-text editor for Item descriptions.
 */
export class ItemDescriptionEditorV14 extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ["hm3", "item-description-editor"],
    window: {
      resizable: true
    },
    position: {
      width: 680,
      height: 520
    }
  };

  static PARTS = {
    main: {
      template: "systems/hm3/templates/item/item-description-editor-v14.html"
    }
  };

  constructor(item, { onSave = null } = {}) {
    super({ window: { title: `Edit Description: ${item.name}` } });
    this.item = item;
    this.onSave = onSave;
    this.originalDescription = String(item.system.description ?? "");
    this.saved = false;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return {
      ...context,
      description: this.originalDescription
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    const editor = root.querySelector("prose-mirror");
    if (editor) {
      const replacement = HTMLProseMirrorElement.create({
        name: "system.description",
        value: this.originalDescription,
        readonly: false,
        disabled: false,
        classes: editor.className,
        collaborate: false,
        documentUUID: this.item.uuid,
        toggled: false
      });
      editor.replaceWith(replacement);
    }

    root.querySelector('[data-action="save-description"]')?.addEventListener("click", event => {
      event.preventDefault();
      void this.#saveDescription();
    });

    root.querySelector('[data-action="cancel-description"]')?.addEventListener("click", event => {
      event.preventDefault();
      void this.close();
    });
  }

  async #saveDescription() {
    const editor = this.element?.querySelector("prose-mirror");
    if (!editor) throw new Error("HM3 | Item Description ProseMirror editor was not found.");

    await editor.save();
    const value = String(editor.value ?? "");
    await this.item.update({ "system.description": value });
    this.saved = true;
    await Promise.resolve(this.onSave?.(value));
    return this.close();
  }
}
