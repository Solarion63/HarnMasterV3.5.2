const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

function tokenPlaceable(tokenOrDocument) {
  if (!tokenOrDocument) return null;
  if (tokenOrDocument.center?.x != null && tokenOrDocument.center?.y != null) {
    return tokenOrDocument;
  }

  const document = tokenOrDocument.document ?? tokenOrDocument;
  const placeable = document.object ?? (