# Changelog

All notable changes to the HarnMaster 3 Foundry VTT system will be documented in this file.

## 2.0.0-rc.1 — Foundry VTT v14 Release Candidate

### Compatibility

- Targets Foundry VTT 14.365.
- Migrates the system from the v13 runtime baseline to Foundry's v14 ApplicationV2 and document APIs.
- Preserves existing HarnMaster rules behavior and legacy world data where covered by the migration and regression tests.

### Actor and Item Sheets

- Migrated Character, Creature, Container, and all HM3 Item sheets to ApplicationV2.
- Restored Actor tab retention, filters, owned Item controls, drag/drop sorting, container movement, Carry/Equip state, and image selection.
- Restored v13-style sheet typography and layout across Skills, Esoterics, Effects, Gear, traits, Item tabs, and combat presentation.
- Restored editable formatted Façade and Profile/Biography content using Foundry v14 ProseMirror, including functional formatting toolbars and persisted edits.
- Preserved the intended side-by-side Façade portrait and public-description layout.

### Rolls, Combat, and Macros

- Migrated standard ability, Skill, Spell, Invocation, Psionic, Healing, injury, damage, melee, and missile workflows to v14-compatible implementations.
- Migrated automated defense, counterstrike, weapon breakage, shock, stumble, fumble, DTA, and chat-card actions.
- Preserved fast-forward modifier behavior for supported rolls.
- Restored hotbar macro creation and execution for Skills, automated melee, and automated missile attacks.
- Preserved chooser cancellation without overwriting the target hotbar slot.

### Active Effects

- Migrated Active Effect editing and duration handling to Foundry v14 APIs.
- Preserved HM3 round-based temporary-effect behavior.
- Uses Foundry v14 native expiry processing for linked and unlinked Tokens.
- Migrates legacy deletion semantics to v14 forced-deletion operators.
- Preserves pre-existing Active Effects from tested v13 worlds.

### Compendiums and System Help

- Rebuilt Esoterics and System Help as populated v14 LevelDB packs.
- Converted legacy System Help Journal content to native v14 Journal pages.
- Converted internal System Help references to working UUID-based compendium links.
- Added automated pack source-count, size, and compiled-link verification.
- Removed non-deterministic LevelDB diagnostic logs from committed generated pack output.

### Legacy World Migration

- Modernized migration handling for current Actors, Items, Scenes, world compendiums, linked Tokens, and unlinked Token ActorDeltas.
- Migration completion is failure-safe and records the system migration version only after successful completion.
- Tested a copied legacy campaign world through migration and representative normal-play workflows.

### Validation

Focused Foundry 14.365 regression coverage completed for:

- GM, owner/trusted-player, observer/non-owner, and limited-user permissions.
- Character, Creature, Container, and Item creation/editing.
- Synthetic and unlinked Token behavior.
- Actor Item sorting and container movement.
- All four compendiums through browse/import/use workflows.
- Extended combat and round-based Active Effect expiration.
- Invocation, Psionic, Healing, and Esoterics description-card workflows.
- Migrated pre-existing Active Effects.
- Final visual/UI sweep of Actor and Item sheets.

### Deferred

- Formal Foundry DataModel classes remain deferred to a later architectural phase.
- Dormant legacy implementations in older dice/combat/macro modules are retained for compatibility until broader third-party macro and legacy-world coverage supports safe removal.
