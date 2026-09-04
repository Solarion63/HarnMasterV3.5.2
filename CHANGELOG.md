# Changelog

All notable changes to the HarnMaster 3 Foundry VTT system will be documented in this file.

## 2.0.0-rc.3 — Release Candidate

### Physician Diagnosis

- Added rules-based Physician Diagnosis before normal wound Treatment.
- Targeted Physician use now selects the patient and Injury before the Skill roll; no-target use remains an ordinary Physician Skill roll.
- Diagnosis is optional and records its result on the selected Injury under `flags.hm3.physicianDiagnosis`.
- Marginal Success records +10 EML to the later Treatment Roll and Critical Success records +30 EML.
- Failed Diagnosis records the HârnMaster -10 to -30 discretionary Treatment penalty range without inventing a fixed penalty.
- Already-diagnosed Injuries are excluded from another normal Diagnosis attempt; the local and GM-authoritative services also reject attempts to overwrite an existing diagnosis.
- Diagnosis presentation is derived from structured Injury flags and does not modify user-editable Injury notes.
- Injury sheets show a read-only Physician Diagnosis summary.

### Physician Wound Treatment

- Added normal Physician wound Treatment using the HârnMaster Physician 3 Treatment Table.
- Active Bleeders retain priority and must be stopped before normal wounds can be treated.
- The workflow explicitly selects an untreated Injury, then offers Diagnose, Treat, or Cancel as appropriate before any roll is made.
- An undiagnosed Injury may be treated directly because Diagnosis is optional.
- Treatment configuration shows the inferred Treatment Table entry and allows correction for legacy or ambiguous Injuries.
- Successful Diagnosis modifiers, failed-Diagnosis penalties, equipment/supplies modifiers, and the -5 EML per delayed day after the first 24 hours are incorporated into the actual HM3 Physician roll target.
- Exactly one Treatment Roll is permitted per Injury regardless of CF, MF, MS, or CS.
- Treatment results persist under `flags.hm3.physicianTreatment`; numeric H1-H6 results also update `system.healRate`.
- EE is preserved explicitly as emergency healing in one day without later Healing Rolls.
- Asterisked Healing Rates retain a pending permanent-impairment marker for later resolution.
- Grievous Frost records its amputation result and required follow-up wound rather than treating the result as an ordinary Healing Rate.
- Procedure duration is rolled and recorded according to the Physician rules, but Foundry world time is not advanced automatically.
- Legacy `flags.hm3.treated` records from the historical standalone macro are respected.
- New v14 Injuries record structured aspect and creation world time to improve Treatment Table inference and delayed-treatment defaults.
- Cross-owner Treatment uses the native `system.hm3` GM-authoritative socket; no Socketlib dependency is required.
- Actor Injury rows and Injury sheets derive Treatment status from structured flags without polluting editable notes.
- Physician Injury-selection and Treatment-configuration dialogs use compact, workflow-specific sizing.

### Physician Workflow Reliability

- Explicit Injury selection is shown even when only one eligible wound exists, giving the user a clear Cancel path before rolling.
- Cancelling Injury selection, Diagnose/Treat selection, Treatment configuration, or the subsequent Physician roll releases workflow state cleanly.
- Repeated Physician use after a completed Diagnosis or Treatment no longer becomes stuck in an "action already in progress" state.
- Migrated Physician Skills with a blank historical custom macro still use the system-owned pre/post Skill-roll workflow.
- The historical Physician macro remains a compatibility launcher and cannot duplicate a system-managed medical action.

### Validation

Focused Foundry VTT 14.365 runtime testing completed for the RC3 Physician scope, including:

- Ordinary no-target Physician rolls and Advanced Physician Automation disabled behavior.
- No-injury, multiple-target, and all-diagnosed/all-treated guard paths.
- One and multiple eligible Injury selection.
- Explicit cancellation at every Physician workflow dialog and at the Skill-roll dialog.
- Repeat Physician use after completed Diagnosis and Treatment.
- Diagnosis MS/CS modifiers and MF/CF discretionary penalty handling.
- Treatment Table resolution across representative Bruise, Fracture, Crush, Cut/Tear, Stab/Bite, Burn, and Frost entries.
- CF/MF/MS/CS Treatment results all consuming the Injury's single Treatment Roll.
- EE, asterisked permanent-impairment results, and Grievous Frost amputation results.
- Procedure-duration recording without automatic world-time advancement.
- Player-to-player/cross-owner Diagnosis and Treatment through the native HM3 socket with an active GM.
- Cross-owner requests without an active GM leaving patient state unchanged.
- Compact Injury-selection and Treatment-dialog presentation.

## 2.0.0-rc.2 — Foundry VTT v14 Release Candidate

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
