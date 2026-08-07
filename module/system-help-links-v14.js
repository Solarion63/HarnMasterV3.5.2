const PACK_ID = "hm3.system-help";
const UUID_PREFIX = `Compendium.${PACK_ID}.JournalEntry.`;
const LINK_SELECTOR = `a.content-link[data-uuid^="${UUID_PREFIX}"]`;

function getSystemHelpId(link) {
  const uuid = link?.dataset?.uuid;
  if (!uuid?.startsWith(UUID_PREFIX)) return null;
  return uuid.slice(UUID_PREFIX.length) || null;
}

function packHasDocument(pack, documentId) {
  if (!pack || !documentId) return false;
  return Boolean(pack.index?.get?.(documentId) ?? pack.index?.has?.(documentId));
}

function repairSystemHelpLinks(root = document) {
  const pack = game.packs.get(PACK_ID);
  if (!pack) return;

  for (const link of root.querySelectorAll?.(LINK_SELECTOR) ?? []) {
    const documentId = getSystemHelpId(link);
    if (!packHasDocument(pack, documentId)) continue;

    link.classList.remove("broken");
    link.removeAttribute("aria-disabled");
  }
}

async function openSystemHelpLink(link) {
  const documentId = getSystemHelpId(link);
  if (!documentId) return;

  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    ui.notifications.warn("The HarnMaster System Help compendium is unavailable.");
    return;
  }

  const journal = await pack.getDocument(documentId);
  if (!journal) {
    ui.notifications.warn("The referenced HarnMaster System Help article could not be found.");
    return;
  }

  link.classList.remove("broken");
  await journal.sheet.render(true, { editable: false });
}

Hooks.once("ready", () => {
  repairSystemHelpLinks();

  document.addEventListener("click", event => {
    const link = event.target?.closest?.(LINK_SELECTOR);
    if (!link) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    void openSystemHelpLink(link).catch(error => {
      console.error("HM3 | System Help link failed", error);
      ui.notifications.error("System Help link failed. See the console for details.");
    });
  }, { capture: true });

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;

        if (node.matches?.(LINK_SELECTOR)) repairSystemHelpLinks(node.parentElement ?? node);
        else if (node.querySelector?.(LINK_SELECTOR)) repairSystemHelpLinks(node);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
});
