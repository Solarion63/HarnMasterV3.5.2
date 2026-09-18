# HarnMaster 3 Development Backlog

This backlog records work intentionally deferred from the current Foundry VTT v14 release-candidate development. Items listed here are not part of the currently validated feature scope unless explicitly promoted into active development.

## Medical Automation

### Bloodloss Death Chat Notification

**Status:** Post-release improvement

When an Actor dies from Bloodloss, create a GM-only chat notification in addition to the existing console logging.

Planned scope:

- Trigger the notification only when the Bloodloss workflow determines that the Actor has died.
- Identify the affected Actor clearly in the message.
- Restrict visibility to GMs so player-facing information does not change unintentionally.
- Keep the existing console logging for diagnostic value.
- Avoid duplicate death notifications if the same Bloodloss state is processed more than once.

### Physician Treatment Range Enforcement

**Status:** Post-release improvement

Require the healer to be within one hex of the targeted patient when using the automated Physician treatment workflow.

Planned scope:

- Apply the range requirement when a patient is targeted for treatment.
- Measure token-to-token distance using Foundry v14-supported grid measurement APIs.
- Permit treatment only when the healer and patient are within one hex of each other.
- Provide a clear user-facing warning when the patient is out of range.
- Preserve the existing no-target Physician skill-roll behavior; ordinary Physician rolls without a treatment target should continue to work normally.
- Preserve the existing ownership/socket authority model for treatment updates.

### Physician Rules Gaps

**Status:** Deferred rules-completion work

Normal Physician treatment is implemented, but the following rules remain to be automated or completed:

- apply the Creature treatment penalty of -10 unless the healer has Veterinary Medicine;
- enforce the self-treatment restrictions for Grievous injuries and Shock;
- create the appropriate post-amputation wound automatically where required;
- complete the NT-column behavior where applicable;
- add the recurring wound Healing Roll workflow and later Infection/impairment handling;
- remove the remaining duplicate/hard-coded late-treatment `-5 per day` logic by centralizing that rule;
- review cross-owner treatment wording so requested/authoritative treatment messages are consistently presented.

## Combat Improvements

### Unified Counterstrike Result Presentation

**Status:** Post-release improvement

Improve Counterstrike result presentation without changing HârnMaster combat resolution rules.

Current historical behavior, preserved from the pre-v14 system, creates separate Attack Result and Counterstrike Result cards and leaves the defender column blank on each card. A post-release improvement should present the exchange more clearly as one opposed combat result.

Planned scope:

- Display both the original attacker and counterstriker on the same result card.
- Show each combatant's weapon.
- Show the effective AML/EML used for each roll.
- Show both d100 rolls.
- Show each roll's Critical/Marginal Success/Failure classification.
- Clearly show the resulting combat-table outcome and any impact rolls.
- Preserve the existing melee combat table, counterstrike modifiers, stumble/fumble consequences, DTA behavior, weapon-break behavior, and injury workflow.
- Treat this as a presentation improvement rather than a rules change.

### Unequip Dropped Weapon After Failed Fumble Roll

**Status:** Post-release improvement

When a Fumble Roll indicates that the weapon or other item used in the attack or defense has been fumbled and dropped, automatically mark that item as unequipped.

Planned scope:

- Carry the originating attack/defense item identity into the Fumble Roll workflow.
- Determine from the HârnMaster fumble result whether the item was actually dropped before mutating equipment state.
- When the result indicates a dropped item, set that Item's equipped state to false.
- Apply this consistently whether the fumble originated from an attack, block, counterstrike, or other weapon-using combat path where the rules call for the item to be dropped.
- Preserve ownership/socket authority requirements for Actor/Item updates.
- Do not unequip the item for fumble results that do not actually cause it to be dropped.

## Build and Repository Maintenance

### Migrate Sass `@import` to `@use` / `@forward`

**Status:** Deferred build-maintenance work

The CSS toolchain has been modernized to Gulp 5, Dart Sass, `gulp-sass` 6, and `gulp-autoprefixer` 10. Dart Sass still reports deprecation warnings for the existing SCSS `@import` graph.

Planned scope:

- migrate the SCSS module graph to `@use` / `@forward` without changing rendered Foundry styling;
- preserve current variable, mixin, and selector behavior;
- keep compiled `css/hm3.css` deterministic and committed;
- use the existing `Validate Build Toolchain` workflow to require a clean reproducible build;
- treat stylesheet-source restructuring separately from gameplay/runtime changes.

### GitHub Actions Runtime Versions

**Status:** Deferred repository maintenance

GitHub currently reports that some pinned GitHub-maintained actions target deprecated Node runtimes and are being forced onto newer runtimes by hosted runners.

Planned scope:

- adopt supported major versions of GitHub-maintained actions as they become available;
- keep repository workflows on a supported Node version;
- preserve the current read-only default workflow permissions and explicit least-privilege permissions;
- verify release packaging and validation workflows after any action-version changes.

## Architecture

### Formal Foundry DataModel Classes

**Status:** Deferred

Introduce formal Foundry DataModel classes only after the v14 user-interface and legacy document compatibility work is stable. This remains intentionally separate from the current migration to reduce regression risk.

## Completed During RC4 Development

The following backlog items have been completed and removed from active work:

- **Condition Skill with ML 0 Collapses Endurance and Physical Abilities** — fixed in PR #14; ML 0 Condition no longer replaces valid ability-derived Endurance.
- **Initialize Newly Added Skills to Opening Mastery Level** — implemented in PR #15 with generic normal-OML initialization and preservation of established ML values.
- **CSS build-toolchain modernization / Dependabot dependency cleanup** — completed in PR #16 with a modern Node 22-compatible toolchain, regenerated lockfile, reproducible build validation, and zero high-severity npm audit findings at merge time.
- **Blood Regeneration** — implemented in PR #18 using the system-owned Bloodloss Injury and Bloodloss service. Bloodloss now uses H6, regeneration tests `6 × Endurance` once per five days, MS/CS reduce Bloodloss by 1/2 BP, failed rolls have no effect, resolved Bloodloss Injuries are removed at 0 BP, and owners/GMs receive a one-time private reminder when a new regeneration roll becomes available.
- **Legacy ActorDelta migration operators** — fixed in PR #20; pre-v14 `-=field` / `==field` operator keys in unlinked Token ActorDeltas are normalized before base Actor updates, preventing Foundry v14 migration warnings while preserving token-specific overrides.
