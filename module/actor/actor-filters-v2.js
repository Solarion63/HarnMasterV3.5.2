const filterState = new WeakMap();

const FILTERS = [
  {
    input: ".skill-name-filter",
    rows: ".skill-item",
    attribute: "itemName",
    key: "skills"
  },
  {
    input: ".gear-name-filter",
    rows: ".gear-item",
    attribute: "itemName",
    key: "gear"
  },
  {
    input: ".effects-name-filter",
    rows: ".effect",
    attribute: "effectName",
    key: "effects"
  }
];

/**
 * Bind and restore the Actor sheet's name filters after each ApplicationV2
 * render. Filter state remains local to the open sheet instance.
 *
 * @param {object} sheet The ActorSheetV2 application instance.
 * @param {HTMLElement} root The rendered application root.
 */
function bindActorFilters(sheet, root) {
  const state = filterState.get(sheet) ?? {};
  filterState.set(sheet, state);

  for (const definition of FILTERS) {
    const input = root.querySelector(definition.input);
    if (!input) continue;

    const apply = value => {
      const normalized = String(value ?? "").trim().toLowerCase();
      state[definition.key] = String(value ?? "");

      for (const row of root.querySelectorAll(definition.rows)) {
        const name = String(row.dataset[definition.attribute] ?? "").toLowerCase();
        row.hidden = Boolean(normalized) && !name.includes(normalized);
      }
    };

    input.value = state[definition.key] ?? input.value ?? "";
    input.addEventListener("input", event => apply(event.currentTarget.value));
    apply(input.value);
  }
}

for (const hook of [
  "renderHarnMasterCharacterSheetV2",
  "renderHarnMasterCreatureSheetV2",
  "renderHarnMasterContainerSheetV2"
]) {
  Hooks.on(hook, (sheet, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0] ?? sheet.element;
    if (root) bindActorFilters(sheet, root);
  });
}
