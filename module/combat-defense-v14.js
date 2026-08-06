import { DiceHM3 } from "./dice-hm3.js";
import { meleeCombatResult, missileCombatResult } from "./combat.js";

const { renderTemplate } = foundry.applications.handlebars;

function rootsFromRender(html) {
  if (!html) return [];
  if (html instanceof HTMLElement || html instanceof DocumentFragment) return [html];
  if (Array.isArray(html)) return html.filter(root => root?.querySelector