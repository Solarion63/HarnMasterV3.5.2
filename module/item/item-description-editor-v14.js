const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { HTMLProseMirrorElement } = foundry.applications.elements;

const DESCRIPTION_EDITOR_TEMPLATE = "systems/hm3/templates/item/item-description-editor-v14.html";

/**
 * Dedicated Foundry VTT v14 rich-text editor for Item descriptions.
 *
 * Keeping the editor in its own ApplicationV2 gives Pro