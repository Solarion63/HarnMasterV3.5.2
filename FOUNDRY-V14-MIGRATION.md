# Foundry VTT v14 Migration

## Status

The `feature/foundry-v14-master` branch targets Foundry VTT **14.365** and has published release candidate **2.0.0-rc.1** for evaluation.

Current development version: **2.0.0-rc.1**

The validated release candidate is published as GitHub prerelease tag `v2.0.0-rc.1`. Continue evaluation before promoting the migration to the final 2.0.0 release.

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
- [x] Restore v13-style Spell, Ritual Invocation, and Psionic Talent row layout and typography on the Esoterics tab.
- [x] Convert live HM3 dialogs to `DialogV2` or focused v14 implementations.
- [x] Replace live nested-form assumptions in DialogV2 callbacks with direct field access.
- [x] Validate chat-card rendering and native chat actions.
- [x] Validate Actor Item sorting and container-to-container movement separately from hotbar dragging.

### Phase 4 — documents and migrations

- [x] Audit and migrate live Actor, Item, Combat, Active Effect, injury, damage, and chat-action paths used by the v14 runtime.
- [x] Replace demonstrated deprecated Active Effect change-mode access with v14 string change types.
- [x] Use native embedded-document creation for migrated Injury and Active Effect workflows.
- [x] Complete synthetic-token-specific regression coverage.
- [x] Review world migration helpers against copied legacy campaign data.
- [x] Validate all four LevelDB compendium packs through browse/import/use workflows.
- [ ] Introduce formal Foundry DataModel classes in a later architectural phase.

### Phase 5 — release validation

- [x] Test as GM, trusted player, regular player, and limited/observer access while preserving v13 ownership restrictions.
- [x] Test a copied v12/v13 campaign world through normal play workflows.
- [x] Add automated static checks and package validation.
- [x] Validate hotbar macro creation through macro execution, including Skill, automated melee, automated missile, and chooser cancellation.
- [x] Complete synthetic-token regression scenarios.
- [x] Validate longer combat progression and round-based Active Effect expiration for linked and unlinked Tokens.
- [x] Validate Invocation, Psionic Talent, and Healing workflows, including fast-forward, cancellation, Psionic improvement/SDR, and Esoterics description cards.
- [x] Validate migration and continued use of a pre-existing Active Effect from a v13 world.
- [x] Complete the final visual/UI sweep, including Actor/Item typography, Effects layout, rich-text editing, ProseMirror toolbar interaction, and Façade layout.
- [x] Complete the pre-RC repository/CI audit and remove non-deterministic compendium diagnostic-log churn.
- [x] Prepare the `2.0.0-rc.1` manifest, changelog, and deterministic manual packaging workflow.
- [x] Correct the legacy unscoped sheet-tab CSS that clipped Foundry v14 native Token Configuration tabs, and complete focused Token Configuration regression testing.
- [x] Verify the final corrected `2.0.0-rc.1` package artifact with a clean installation and smoke test.
- [x] Publish the validated release candidate as prerelease tag `v2.0.0-rc.1` from tested runtime SHA `93f6d61074d065069e8ed2f9437c5f172674f09b`.

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
- Invocation rolls work normally and with fast-forward execution.
- Psionic Talent rolls work normally and with fast-forward execution.
- Psionic improvement flag enable/disable and Skill Development Roll actions work.
- Healing rolls work normally and with fast-forward execution, and cancelling the healing dialog exits cleanly without a result or error.
- Esoterics description/chat cards for Spell, Invocation, and Psionic Talent render without duplicate level/circle/fatigue notation.
- Standalone and automated melee/missile combat flows work.
- Defense actions, counterstrike, weapon breakage, shock, stumble, fumble, DTA, and native chat actions work.
- Standalone generic damage and standalone missile attack/damage rolls work.
- Manual Injury resolution correctly produces no Injury at zero effective impact and creates an owned Injury when effective impact produces an injury result.
- Active Effect add, edit, toggle, and delete operations work without the previously observed v14 deprecation warnings.
- Round-based Active Effects decrement correctly during extended combat and expire cleanly through Foundry v14's native expiry processing.
- Expired temporary Active Effects are deleted rather than left behind as disabled rows.
- Linked and unlinked Token Active Effects expire without duplicate processing or synthetic-Actor collection errors.
- HM3's Active Effect creation workflow presents combat duration in rounds rather than Foundry-style turns.
- Hotbar Skill macro creation and execution works.
- Hotbar automated melee macro creation and execution works with an active combatant and one target.
- Hotbar automated missile macro creation and execution works, including normal missile/ammunition handling.
- Closing the melee/missile macro chooser without a selection leaves the target hotbar slot unchanged.
- GM, owner/trusted-player, observer/non-owner, and limited-user Actor-sheet permissions match the v13 ownership model in focused testing.
- Character and Possessions compendiums browse normally and Items can be added to an Actor.
- Rebuilt Esoterics and System Help LevelDB packs expose their source entries in Foundry.
- Esoterics Items can be dragged to an Actor and Ritual Invocation rolls execute successfully.
- Spell, Ritual Invocation, and Psionic Talent rows on the Esoterics tab match the intended v13-style layout and typography.
- System Help Journal entries open directly from the compendium.
- Actor-sheet Help icons open the correct System Help entries.
- Internal System Help Journal links resolve correctly after conversion to native v14 Journal pages and UUID-based compendium links.
- Synthetic/unlinked Token Actors preserve token-local state for Actor edits, Active Effects, recorded Injuries, automated melee defense/injury/consequence flows, and Active Effect expiration without modifying sibling tokens or the source Actor.
- Automated melee range handling accepts both canvas Token placeables and synthetic-Actor TokenDocuments.
- Active Effect expiration uses the native v14 duration-units API without compatibility warnings.
- Actor Item sorting persists across sheet reopen, gear moves correctly between On Person and HM3 containers, cross-Actor quantity moves and stack merging work, container subtrees move together, and Container Actors reject non-physical Item drops.
- A copied legacy campaign world migrates successfully to `2.0.0-alpha.1` with existing Actors, Items, Scenes, linked Tokens, unlinked Tokens/ActorDeltas, legacy Macros, and representative world data remaining usable after migration.
- A pre-existing Active Effect created in a v13 world survives migration to v14 and remains visible, editable, and otherwise usable after migration.
- The legacy-world migration completes without HM3 migration errors or legacy forced-deletion compatibility warnings and does not rerun after the migration version is recorded.
- Character Façade and Profile/Biography rich-text fields render existing formatted HTML, support direct ProseMirror editing and toolbar actions, persist changes, and preserve the intended side-by-side Façade image/text layout.
- The v14 native chat-message path no longer depends on the removed jQuery `.find` compatibility shim.
- Native Foundry v14 Token Configuration tabs render fully after isolating legacy HM3 sheet-tab styling; Identity, Appearance, Vision, Light, Resources, and other Token Configuration tabs remain usable without clipping.
- The final corrected `2.0.0-rc.1` artifact built from head `93f6d61074d065069e8ed2f9437c5f172674f09b` passed a clean installation and short smoke test with no observed regressions.
- The validated release candidate was published as GitHub prerelease `v2.0.0-rc.1` with the tested system package and manifest attached.
- Automated repository validation passes JSON and JavaScript syntax checks.

## Required Regression Scenarios Before Release Candidate

All explicit release-level regression scenarios, final package artifact verification, and RC publication have been completed successfully. The release candidate is now available for evaluation before promotion to final 2.0.0.

## Deferred Work

Formal Foundry DataModel classes are intentionally deferred until the v14 user-interface and document compatibility work is stable. Combining both architectural migrations would make regressions harder to isolate.

The legacy `dice-hm3.js`, `combat.js`, and portions of `macros.js` still contain older implementations. The normal v14 runtime routes live supported workflows through the native v14 modules and macro bridges. Removing or rewriting dormant legacy implementations is deferred until broader legacy-world and third-party macro compatibility testing provides enough coverage to do so safely.
