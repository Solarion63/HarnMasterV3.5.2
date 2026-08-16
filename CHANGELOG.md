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
- Scoped legacy HM3 sheet-tab styling so native Foundry v14 configuration sheets retain their standard tab dimensions and are not clipped.

### Rolls, Combat, and Macros

- Migrated standard ability, Skill, Spell, Invocation, Psionic, Healing, injury, damage, melee, and missile workflows to v14-compatible implementations.
- Migrated automated defense, counterstrike, weapon breakage, shock, stumble, fumble, DTA, and chat-card actions.
- Preserved fast-forward modifier behavior for supported rolls.
- Restored hotbar macro creation and execution for Skills, automated melee, and automated missile attacks.
- Preserved chooser cancellation without overwriting the target hotbar slot.
- Extracted pure HârnMaster combat-table resolution into `combat-rules.js` and removed the legacy `combat.js` workflow implementation.
- Preserved the public `game.hm3.macros` combat API while routing it directly to native v14 attack, defense, and Counterstrike implementations.
- Moved shared Item resolution into `item-lookup.js` and removed the obsolete runtime combat-macro override layer.
- Restored the -10 aimed-attack modifier for High/Low automated melee, missile, and Counterstrike attacks; Mid remains unmodified and the penalty stacks with other modifiers.

### Active Effects

- Migrated Active Effect editing and duration handling to Foundry v14 APIs.
- Preserved HM3 round-based temporary-effect behavior.
- Uses Foundry v14 native expiry processing for linked and unlinked Tokens.
- Migrates legacy deletion semantics to v14 forced-deletion operators.
- Preserves pre-existing Active Effects from tested v13 worlds.

### Compendiums and System Help

- Rebuilt Character, Possessions, Esoterics, and System Help as populated v14 LevelDB packs.
- Converted legacy System Help Journal content to native v14 Journal pages.
- Converted internal System Help references to working UUID-based compendium links.
- Added automated source and compiled-document verification for all four packs, including folder documents where present.
- Added RC package verification that refuses to package empty or incomplete compiled packs.
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
- Clean installation of the packaged `2.0.0-rc.1` artifact, with all four compendiums visible, populated, and individually openable without observed errors.
- Focused Token Configuration regression testing after the sheet-tab CSS isolation fix; the full native tab row renders correctly and tested tabs remain usable without clipping or errors.
- Clean installation of combat-refactor artifact `9265458224` from exact runtime SHA `d114d2587f63241b3d8728abc919c81a98b0f6b9`; HM3 loaded without console errors, all Game Settings registered, and Actor sheets rendered normally.
- Automated melee, automated missile, and Counterstrike aim testing: Mid applies no penalty, High/Low apply exactly -10, and the aim penalty stacks correctly with other modifiers.

### Deferred

- Formal Foundry DataModel classes remain deferred to a later architectural phase.
- The remaining major legacy-runtime cleanup target is `dice-hm3.js`; required rules calculations will be extracted before obsolete Foundry-facing implementations and runtime patching are removed.
