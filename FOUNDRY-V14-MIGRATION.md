# Foundry VTT v14 Migration

## Status

The `feature/foundry-v14-master` branch targets Foundry VTT **14.365** and remains an alpha migration branch rather than a production release.

Current development version: **2.0.0-alpha.1**

Always test with a copied world. Do not open the only copy of an established campaign world with an alpha build.

## Migration Principles

1. Preserve HârnMaster rules behavior and existing document data.
2. Migrate infrastructure separately from rules changes.
3. Replace deprecated user-interface APIs with ApplicationV2 and namespaced v14 APIs.
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

- [x] Convert the shared Actor sheet to `ActorSheetV2` with `HandlebarsApplicationMixin`.
- [x] Convert character, creature, and container sheets.
- [x] Convert the Item sheet to `ItemSheetV2`.
- [x] Convert Active Effect configuration.
- [x] Preserve limited-sheet and ownership behavior in the migrated sheet architecture.

### Phase 3 — interactions and dialogs

- [x] Convert Actor sheet listeners to native DOM handlers under the ApplicationV2 lifecycle.
- [x] Restore owned-Item drag data for hotbar macro creation.
- [x] Restore legacy Actor-sheet controls omitted during the initial ApplicationV2 conversion, including Carry/Equip, esoteric rolls, healing, description-to-chat, and Help links.
- [x] Restore v13-style Carry/Equip visual state feedback on the Gear tab.
- [x] Convert live HM3 dialogs to `DialogV2` or focused v14 implementations.
- [x] Replace live nested-form assumptions in DialogV2 callbacks with direct field access.
- [x] Validate chat-card rendering and native chat actions.
- [ ] Validate Actor Item sorting and container-to-container movement separately from hotbar dragging.

### Phase 4 — documents and migrations

- [x] Audit and migrate live Actor, Item, Combat, Active Effect, injury, damage, and chat-action paths used by the v14 runtime.
- [x] Replace demonstrated deprecated Active Effect change-mode access with v14 string change types.
- [x] Use native embedded-document creation for migrated Injury and Active Effect workflows.
- [ ] Complete synthetic-token-specific regression coverage.
- [ ] Review world migration helpers against copied legacy campaign data.
- [ ] Validate all four LevelDB compendium packs through import/use workflows.
- [ ] Introduce formal Foundry DataModel classes in a later architectural phase.

### Phase 5 — release validation

- [ ] Test as GM, trusted player, and regular player.
- [ ] Test a copied v12/v13 campaign world through normal play workflows.
- [x] Add automated static checks and package validation.
- [x] Validate hotbar macro creation through macro execution, including Skill, automated melee, automated missile, and chooser cancellation.
- [ ] Complete synthetic-token and compendium regression scenarios.
- [ ] Publish a release candidate only after legacy-world migration testing succeeds.

## ApplicationV2 and Runtime Architecture

The migrated system now uses ApplicationV2 for Actor and Item sheets while preserving the existing HM3 templates and rules presentation.

The base Actor sheet directly owns intrinsic sheet behavior such as persistence, tabs, filters, owned-Item drag data, ability bindings, Active Effect controls, Injury controls, and shared image-picker integration. Skill and combat logic remain modular where they represent real HM3 subsystem behavior rather than render-hook glue.

The Item sheet uses one lightweight ApplicationV2 subclass per HM3 Item subtype so the existing subtype-specific Handlebars templates remain available without combining them into a monolithic template.

Dedicated v14 modules remain for rules-heavy behavior including standard dice rolls, combat rolls, injury, damage, missile rolls, defense, counterstrike, weapon breakage, combat consequences, DTA, chat actions, and macro compatibility.

The Actor creation adapter remains separate because it overrides the Foundry document-creation workflow and preserves HM3's option to initialize default skills and armor locations.

## Live Validation Completed

Testing in Foundry VTT 14.365 has confirmed the following on the migration branch:

- System startup reaches the canvas without a manifest error.
- Character, Creature, and Container creation dialogs operate correctly, including default initialization choices and cancellation.
- Character, Creature, Container, and Item ApplicationV2 sheets render and persist edits.
- Actor tab retention and Skill/Gear/Effects filtering survive rerenders.
- Carry and Equip controls update owned Gear state correctly and reproduce the v13 visual feedback for inactive/carried/equipped states.
- Actor and Item image selection works through the shared v14 image-picker implementation.
- Ability d6/d100 rolls work, including fast-forward modifier-key behavior.
- Skill rolls and Skill Development Roll/disable-flag handling work.
- Spell roll execution works from the migrated Actor sheet.
- Standalone and automated melee/missile combat flows work.
- Defense actions, counterstrike, weapon breakage, shock, stumble, fumble, DTA, and native chat actions work.
- Standalone generic damage and standalone missile attack/damage rolls work.
- Manual Injury resolution correctly produces no Injury at zero effective impact and creates an owned Injury when effective impact produces an injury result.
- Active Effect add, edit, toggle, and delete operations work without the previously observed v14 deprecation warnings.
- Hotbar Skill macro creation and execution works.
- Hotbar automated melee macro creation and execution works with an active combatant and one target.
- Hotbar automated missile macro creation and execution works, including normal missile/ammunition handling.
- Closing the melee/missile macro chooser without a selection leaves the target hotbar slot unchanged.
- The v14 native chat-message path no longer depends on the removed jQuery `.find` compatibility shim.
- Automated repository validation passes JSON and JavaScript syntax checks.

## Required Regression Scenarios Before Release Candidate

The following areas still need explicit release-level validation even though related runtime paths are already working:

- GM, trusted-player, and regular-player permissions and ownership restrictions.
- A copied v12/v13 campaign world, including existing Actors, Items, Active Effects, macros, and scenes.
- Synthetic-token Actors and unlinked Token Active Effects.
- Actor Item sorting and container movement.
- Compendium browsing, import, and use for Character, Possessions, Esoterics, and System Help packs.
- Initiative/combat-turn progression with effect expiration over a longer combat sequence.
- Less frequently used invocation, psionic, and healing workflows under migrated sheets.

## Deferred Work

Formal Foundry DataModel classes are intentionally deferred until the v14 user-interface and document compatibility work is stable. Combining both architectural migrations would make regressions harder to isolate.

The legacy `dice-hm3.js`, `combat.js`, and portions of `macros.js` still contain older implementations. The normal v14 runtime routes live supported workflows through the native v14 modules and macro bridges. Removing or rewriting dormant legacy implementations is deferred until broader legacy-world and third-party macro compatibility testing provides enough coverage to do so safely.
