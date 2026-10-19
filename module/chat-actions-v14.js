const NATIVE_COMBAT_ACTIONS = new Set([
  "dodge",
  "ignore",
  "block",
  "counterstrike",
  "shock",
  "stumble",
  "fumble",
  "dta-attack"
]);

function rootsFromRender(html) {
  if (!html) return [];
  if (html instanceof HTMLElement || html instanceof DocumentFragment) return [html];
  if (Array.isArray(html)) return html.filter(root => root?.querySelectorAll);
  if (typeof html.length === "number") return Array.from(html).filter(root => root?.querySelectorAll);
  return html.querySelectorAll ? [html] : [];
}

/**
 * Mark combat actions already owned by native v14 modules so the remaining
 * legacy HM3 chat dispatcher does not attach a redundant click listener.
 *
 * Remove this transition module when the legacy dispatcher is retired.
 */
Hooks.on("renderChatMessageHTML", (_message, html) => {
  for (const root of rootsFromRender(html)) {
    for (const button of root.querySelectorAll(".hm3.chat-card button[data-action]")) {
      if (NATIVE_COMBAT_ACTIONS.has(button.dataset.action)) {
        button.dataset.hm3Bound = "1";
      }
    }
  }
});
