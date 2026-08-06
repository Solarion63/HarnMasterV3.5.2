const activeTabs = new WeakMap();

/**
 * Restore and retain the selected legacy Actor sheet tab across ApplicationV2
 * rerenders caused by Actor or embedded Item updates.
 *
 * @param {object} sheet The ActorSheetV2 application instance.
 * @param {HTMLElement} root The rendered application root element.
 */
export function retainActorSheetTab(sheet, root) {
  const tabs = Array.from(root.querySelectorAll(".sheet-tabs [data-tab]"));
  const panels = Array.from(root.querySelectorAll(".sheet-body [data-tab]"));
  if (!tabs.length || !panels.length) return;

  const validTabs = new Set(tabs.map(tab => tab.dataset.tab));
  const activate = tabId => {
    const selected = validTabs.has(tabId) ? tabId : tabs[0].dataset.tab;
    activeTabs.set(sheet, selected);

    for (const tab of tabs) tab.classList.toggle("active", tab.dataset.tab === selected);
    for (const panel of panels) panel.classList.toggle("active", panel.dataset.tab === selected);
  };

  for (const tab of tabs) {
    tab.addEventListener("click", () => activeTabs.set(sheet, tab.dataset.tab), { capture: true });
  }

  const selected = activeTabs.get(sheet)
    ?? tabs.find(tab => tab.classList.contains("active"))?.dataset.tab
    ?? sheet.constructor.INITIAL_TAB
    ?? tabs[0].dataset.tab;
  activate(selected);
}

function restoreRenderedTab(sheet, html) {
  const root = html instanceof HTMLElement ? html : html?.[0] ?? sheet.element;
  if (root) retainActorSheetTab(sheet, root);
}

for (const sheetName of [
  "HarnMasterCharacterSheetV2",
  "HarnMasterCreatureSheetV2",
  "HarnMasterContainerSheetV2"
]) {
  Hooks.on(`render${sheetName}`, restoreRenderedTab);
}
