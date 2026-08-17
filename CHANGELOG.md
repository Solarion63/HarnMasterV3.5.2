# Changelog

All notable changes to the HarnMaster 3 Foundry VTT system will be documented in this file.

## 2.0.0-rc.2 — In Development

### Foundry v14 Compatibility

- Registered all HM3 Actor and Item subtypes through the Foundry v14 `documentTypes` manifest configuration.
- Removed deprecated system `template.json`, which Foundry has scheduled for removal in v16.
- Added a lightweight creation-time compatibility-default layer that preserves the existing HM3 Actor/Item default field shapes without imposing strict TypeDataModel schemas on legacy documents.
- Formal Foundry TypeDataModel classes remain deferred so legacy and custom `system` fields continue to be accepted during RC2 development.
- New Character and Creature Actors now include the canonical Condition Skill by default, matching the Character compendium and expected HM3 starting Skill set.

### Item Description Editing

- Replaced the nonfunctional legacy Item Description editor activation path with native Foundry v14 ProseMirror editing owned by the shared ApplicationV2 Item sheet.
- Item descriptions remain read-only during normal use and expose a compact pencil control for deliberate editing.
- Editing supports the native ProseMirror toolbar, direct formatted-text changes, explicit Save/Cancel controls, persisted Item updates, and return to the Description tab after saving.
- Removed legacy `{{editor}}` construction from every active Item subtype template and the generic fallback template so Item rendering no longer creates obsolete editor instances before the shared v14 sheet replaces the Description content.
- Removed the abandoned dedicated Item Description editor module/template and experiment-only CSS while retaining the validated read-only and live ProseMirror presentation rules.

### Bloodloss and Physician Automation

- Implemented HârnMaster Bleeder/Bloodloss tracking for Grievous Blunt, Edge, and Point injuries.
- Each bleeding wound is represented by a separate HM3 mechanical Active Effect while accumulated Bloodloss is recorded as a single Bloodloss Injury.
- Bloodloss accrues from world-time advancement, supports multiple simultaneous bleeders, includes synthetic/unlinked Token Actors, and marks the Actor Dead when Bloodloss exceeds Endurance.
- Bleeding status synchronization now uses one configured Foundry status and one authoritative client for follow-up mutations, preventing duplicate status effects and cross-owner permission errors.
- Successful treatment stops only the selected bleeding wound, removes the generated `Bleeder` state from its source Injury, preserves unrelated Injury notes, and leaves accumulated Bloodloss unchanged.
- Added the **Advanced Physician Automation** world setting so automated medical behavior can be disabled independently of Bloodloss tracking.
- Added a small launcher macro to the canonical Physician Skill in the Character compendium. Ordinary Physician rolls remain ordinary when automation is disabled or no bleeding patient is targeted.
- Physician Bleeder treatment reuses the Skill roll that was just made and applies the rules-derived Bleeder +50 modifier, Hemophilia -40 where applicable, and the roll's existing situational modifier.
- Multiple bleeding wounds prompt the user to choose the specific wound being treated.
- Added native `system.hm3` socket handling for cross-owner treatment without requiring Socketlib. The authoritative GM validates the requesting user, healer ownership, Physician Skill, patient, bleeding effect, roll, and result before changing the patient.
- Cross-owner treatment with no active GM leaves the patient unchanged and reports that an active GM is unavailable.
- Removed the injury-card **Stop Bleeding** action. Bleeding injuries now display an informational red **Bleeding** warning; the Physician Skill is the player-facing treatment workflow.
- Removed the obsolete standalone `bloodloss-treatment-v14.js` workflow and stale `treat-bleeding` chat-action registration.

### Validation

Focused Foundry VTT 14.365 runtime testing completed for the implemented RC2 scope:

- Advanced Physician Automation enabled and disabled behavior.
- Successful and failed Bleeder treatment using the existing Physician roll.
- Multiple simultaneous bleeding wounds and targeted treatment of one wound.
- Hemophilia treatment modifier behavior.
- Player-to-player treatment through the native HM3 socket with an active GM.
- Cross-owner treatment with no active GM.
- Bleeding Active Effect removal, source Injury cleanup, generic Bleeding status cleanup, and preservation of accumulated Bloodloss.
- Player-to-player treatment completes without the earlier non-owner Active Effect permission/synchronization errors.
- Actor and representative Item creation after removal of deprecated `template.json`, including preservation of HM3 compatibility defaults.
- New Actor Condition Skill default behavior.
- Item Description read-only display, pencil activation, native ProseMirror editing, Save, Cancel, persistence, tab return, and representative Skill/Spell/Gear regression after removal of legacy Item-template editor helpers.
- Exact Item Description cleanup head `8a3177c31b6a50cc780b0491d94b52ec2f8589ea` passed focused Foundry VTT 14.365 runtime regression testing.

### Deferred

- Normal Physician wound treatment is deferred to later development and recorded in `DEVELOPMENT-BACKLOG.md`.
- Blood Regeneration is deferred pending authoritative confirmation of the exact Bloodloss Healing Rate; known success effects and five-day cadence are recorded in `DEVELOPMENT-BACKLOG.md` without inventing the missing value.

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
