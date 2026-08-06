# Foundry VTT v14 Migration

## Status

The `feature/foundry-v14-master` branch targets Foundry VTT **14.365** and is not yet intended for production worlds.

Current development version: **2.0.0-alpha.1**

Always test with a copied world. Do not open the only copy of an established campaign world with an alpha build.

## Migration Principles

1. Preserve HârnMaster rules behavior and existing document data.
2. Migrate infrastructure separately from rules changes.
3. Replace deprecated user-interface APIs with ApplicationV2.
4. Keep world migrations versioned and idempotent.
5. Validate character, creature, container, combat, macro, and compendium workflows before release.

## Work Phases

### Phase 1 — v14 baseline

- [x] Create a dedicated migration branch from the v13 baseline.
- [x] Set the manifest minimum and verified versions to Foundry 14.365.
- [x] Update repository metadata for the private Solarion63 repository.
- [x] Remove obsolete global API references from system initialization.
- [x] Remove TinyMCE-specific configuration.
- [x] Add automated JSON and JavaScript syntax validation.
- [x] Confirm the system reaches the canvas and `ready` hook in Foundry v14.365.

### Phase 2 — ApplicationV2 sheets

- [ ] Convert the shared Actor sheet to `ActorSheetV2` with `HandlebarsApplicationMixin`.
- [ ] Convert character, creature, and container sheets.
- [x] Convert the Item sheet to `ItemSheetV2`.
- [ ] Convert Active Effect configuration.
- [ ] Preserve limited-sheet and ownership behavior.

### Phase 3 — interactions and dialogs

- [ ] Convert Actor sheet listeners to ApplicationV2 actions and native DOM handlers.
- [ ] Validate Item drag, drop, sorting, and container movement.
- [ ] Convert legacy dialogs to `DialogV2` or focused ApplicationV2 dialogs.
- [x] Validate chat-card rendering after rerender and reload.

### Phase 4 — documents and migrations

- [ ] Audit Actor, Item, Combat, Active Effect, and synthetic-token behavior.
- [ ] Replace obsolete document-data access patterns.
- [ ] Update migration helpers for v14 document structures.
- [ ] Validate all four LevelDB compendium packs.

### Phase 5 — release validation

- [ ] Test as GM, trusted player, and regular player.
- [ ] Test a copied v12/v13 campaign world.
- [x] Add automated static checks and package validation.
- [ ] Publish a release candidate only after migration testing succeeds.

## Item Sheet Migration Notes

The Item sheet now uses `ItemSheetV2` and `HandlebarsApplicationMixin`. One lightweight subclass is registered for each HM3 Item subtype so the existing subtype-specific Handlebars templates remain available without combining them into a new monolithic template.

Implemented behavior includes:

- Existing HM3 subtype templates and visual styling adapted to ApplicationV2.
- Native tab handling.
- Explicit persistence for nested legacy forms on field change and sheet close.
- Container, combat-skill, ritual-skill, and magic-skill context preparation.
- Active Effect controls.
- Armor-location add and delete controls.
- Native DOM event handling.

### Live validation completed

Testing in Foundry VTT 14.365 confirmed:

- The system loads without a manifest error.
- A test world reaches the canvas.
- World Items can be created.
- Item sheets open and render.
- Item names and system fields persist after closing and reopening.
- The migrated sheet styling and tabs render successfully.
- The v14 native chat-message hook no longer throws the legacy `html.find` error.

Further subtype-specific testing remains part of final regression testing, especially rich-text editors, Active Effects, owned Items, and permission-restricted users.

## Required Regression Scenarios

- Character, creature, and container creation and editing.
- Every Item type, including owned and world Items.
- Gear ordering, quantity transfers, and container movement.
- Active Effects and derived values.
- Skill, ability, spell, ritual, psionic, healing, and weapon rolls.
- Melee and missile combat, damage, injury, and chat actions.
- Initiative, combat turns, and expired effects.
- Hotbar macro creation and execution.
- Synthetic-token Actors.
- Compendium import and legacy-world migration.

## Deferred Work

Formal Foundry DataModel classes are intentionally deferred until the v14 user-interface and document compatibility work is stable. Combining both architectural migrations would make regressions harder to isolate.
