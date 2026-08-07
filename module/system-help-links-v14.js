const PACK_ID = "hm3.system-help";
const UUID_PREFIX = `Compendium.${PACK_ID}.JournalEntry.`;

function getRoot(html, application) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return application?.element ?? null;
}

function getSystemHelpId(link) {
  const uuid = link?.dataset?.uuid;
  if (!uuid?.startsWith(UUID_PREFIX)) return null;
  return uuid.slice(UUID_PREFIX.length) || null;
}

function repairSystemHelpLinks(root) {
 