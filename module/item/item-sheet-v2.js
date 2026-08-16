import { onManageActiveEffect } from "../effect.js";
import * as utility from "../utility.js";
import { bindDocumentImagePicker } from "../document-image-picker-v14.js";

const { DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { HTMLProseMirrorElement } = foundry.applications.elements;
const { ItemSheetV2 } = foundry.applications.sheets;
const { FormDataExtended, TextEditor }