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
- [ ] Confirm the system reaches the `ready` hook without errors in Foundry v14.

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
- [ ] Validate chat-card actions after rerender and reload.

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

The migrated Item sheet currently includes:

- ApplicationV2 form submission and close-on-submit behavior.
- Existing tab markup and subtype templates.
- Container, combat-skill, ritual-skill, and magic-skill context preparation.
- Active Effect create, toggle, edit, and delete controls.
- Armor-location add and delete controls.
- Native DOM event handling for text selection and Enter-to-submit behavior.

It still requires live Foundry v14 regression testing for editor fields, tabs, owned Items, Active Effects, and every Item subtype.

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
