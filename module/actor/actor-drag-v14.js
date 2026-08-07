function renderRoot(sheet, html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return sheet.element ?? null;
}

function itemFromRow(sheet, row) {
  const itemId = row?.dataset.itemId;
  return itemId ? sheet.actor.items.get(itemId) : null;
}

function bindItemDrag(sheet, html) {
  if (!sheet.actor?.isOwner) return;

  const root = renderRoot(sheet, html);
  if (!root) return;

  for (const row of root.querySelectorAll(".item[data-item-id]")) {
    if (row.dataset.hm3DragBound === "1") continue;

    row.draggable = true;
    row.addEventListener("dragstart", event => {
      const item = itemFromRow(sheet, row);
      if (!item || !event.dataTransfer) return;

      const dragData = typeof item.toDragData === "function"
        ? item.toDragData()
        : { type: "Item", uuid: item.uuid };

      event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
      event.dataTransfer.effectAllowed = "copyMove";
    });

    row.dataset.hm3DragBound = "1";
  }
}

for (const hook of [
  "renderHarnMasterCharacterSheetV2",
  "renderHarnMasterCreatureSheetV2",
  "renderHarnMasterContainerSheetV2"
]) {
  Hooks.on(hook, bindItemDrag);
}
