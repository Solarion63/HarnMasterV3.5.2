import { HarnMasterActor } from "./actor.js";

const { DialogV2 } = foundry.applications.api;
const { FormDataExtended } = foundry.applications.ux;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * Foundry v14 implementation of the HM3 Actor creation dialog.
 *
 * This preserves the legacy HM3 option to initialize default skills and armor
 * locations while avoiding the historical global Dialog/renderTemplate/form
 * compatibility aliases.
 */
HarnMasterActor.createDialog = async function createDialogV14(
  data = {},
  { parent = null, pack = null, types, ...options } = {}
) {
  if (this.hasTypeData && types) {
    if (types.length === 0) {
      throw new Error("The array of sub-types to restrict to must not be empty");
    }
    for (const type of types) {
      if ((type === CONST.BASE_DOCUMENT_TYPE) || !this.TYPES.includes(type)) {
        throw new Error(`Invalid ${this.documentName} sub-type: "${type}"`);
      }
    }
  }

  const documentTypes = this.TYPES.filter(type =>
    (type !== CONST.BASE_DOCUMENT_TYPE) && (types?.includes(type) !== false)
  );

  let collection;
  if (!parent) {
    collection = pack ? game.packs.get(pack) : game.collections.get(this.documentName);
  }

  const folders = collection?._formatFolderSelectOptions() ?? [];
  const label = game.i18n.localize(this.metadata.label);
  const title = game.i18n.format("DOCUMENT.Create", { type: label });

  let defaultType = CONFIG[this.documentName]?.defaultType;
  if (!defaultType || (types?.includes(defaultType) === false)) defaultType = documentTypes[0];
  const initialType = data.type || defaultType;

  const content = await renderTemplate("templates/sidebar/document-create.html", {
    folders,
    name: data.name || "",
    defaultName: this.implementation.defaultName({ type: initialType, parent, pack }),
    folder: data.folder,
    hasFolders: folders.length > 1,
    type: initialType,
    types: Object.fromEntries(documentTypes.map(type => {
      const typeLabel = CONFIG[this.documentName]?.typeLabels?.[type] ?? type;
      return [
        type,
        game.i18n.has(typeLabel) ? game.i18n.localize(typeLabel) : type
      ];
    }).sort((a, b) => a[1].localeCompare(b[1], game.i18n.lang))),
    hasTypes: this.hasTypeData,
    content: `<div class="form-group">
      <label class="init-checkbox">Initialize default skills &amp; locations</label>
      <input type="checkbox" name="initDefaults" checked />
    </div>`
  });

  return DialogV2.prompt({
    window: { title },
    content,
    ok: {
      label: title,
      callback: async (_event, _button, dialog) => {
        const form = dialog.element?.querySelector("form");
        if (!form) throw new Error("HM3 | Actor creation form was not found.");

        const formData = new FormDataExtended(form);
        foundry.utils.mergeObject(data, formData.object, { inplace: true });

        if (!data.folder) delete data.folder;
        if (documentTypes.length === 1) data.type = documentTypes[0];
        if (!data.name?.trim()) {
          data.name = this.implementation.defaultName({
            type: data.type || initialType,
            parent,
            pack
          });
        }

        const createOptions = { parent, pack, renderSheet: true };
        if (!data.initDefaults) createOptions.skipDefaults = true;
        delete data.initDefaults;

        return this.create(data, createOptions);
      }
    },
    rejectClose: false,
    ...options
  });
};
