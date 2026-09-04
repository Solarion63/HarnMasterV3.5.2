# HarnMaster 3 Development Backlog

This backlog records work intentionally deferred from the current Foundry VTT v14 release-candidate development. Items listed here are not part of the currently validated feature scope unless explicitly promoted into active development.

## Character and Derived-Stat Corrections

### Initialize Newly Added Skills to Opening Mastery Level

**Status:** Deferred improvement / rules-correct initialization

When a Skill is added to an Actor for the first time, initialize its Mastery Level from its calculated Skill Base and the Skill's proper Opening Mastery Level rule instead of leaving `masteryLevel` at 0.

Planned scope:

- Perform initialization when the Skill Item is first created as an embedded Item on an Actor.
- Calculate the Skill Base from the Skill formula and the Actor's current attributes.
- Apply the Skill's proper Opening Mastery Level multiplier or opening rule rather than assuming every Skill opens at exactly its Skill Base.
- Example: Condition should open at `SB × 5`, so a Condition Skill Base of 17 should initialize to ML 85.
- Do not recalculate or overwrite Mastery Level during normal Actor data preparation after initialization.
- Preserve manually assigned or previously established Mastery Levels.
- Ensure later changes to attributes or Skill Base do not silently reset an improved Skill's Mastery Level.
- Add regression coverage for newly added Skills, already-opened Skills, manually assigned ML values, and Skills with different opening multipliers.
- Keep the implementation generic so Condition and other Skills use the same initialization architecture rather than introducing Skill-specific creation hacks.

### Condition Skill with ML 0 Collapses Endurance and Physical Abilities

**Status:** Known RC2 defect / correction required

An Actor that has a `Condition` skill with `masteryLevel` 0 can have its derived Endurance forced to 1, causing Encumbrance to become abnormally large and effective Strength, Stamina, Dexterity, and Agility to display as 0 even though their stored base values are valid and nonzero.

Observed failure chain:

- Character base physical ability values remain correctly stored in Actor data.
- Normal Endurance is initially derived from Strength, Stamina, and Will.
- If a `Condition` skill exists, the current preparation logic replaces the normal Endurance calculation with `Condition masteryLevel / 5`.
- A newly added or otherwise uninitialized Condition skill with ML 0 therefore produces Endurance 0, which is then clamped to 1.
- Encumbrance is divided by this Endurance value, producing an excessive physical penalty.
- Effective Strength, Stamina, Dexterity, and Agility are then reduced to 0 by that penalty.

Planned correction:

- Preserve the normal Strength/Stamina/Will-derived Endurance when Condition is absent or not meaningfully initialized.
- Do not allow the mere presence of a Condition skill with ML 0 to overwrite a valid derived Endurance value.
- Define explicitly when Condition-derived Endurance becomes authoritative, consistent with the HârnMaster rules and existing skill-opening behavior.
- Preserve existing behavior for Actors with a valid/opened Condition mastery level.
- Add regression coverage for Actors with no Condition skill, Condition ML 0, and a valid nonzero Condition ML.
- Verify that Encumbrance and effective Strength, Stamina, Dexterity, and Agility remain correct after the change.

## Medical Automation

### Physician Diagnosis Automation

**Status:** Deferred

Add a system-owned Physician diagnosis workflow distinct from treatment so a Physician skill roll can identify or assess a targeted patient's medical condition without immediately changing injury state.

Planned scope:

- Use the Physician Skill on the healer Actor as the player-facing entry point.
- Use a targeted Character or Creature Actor as the patient when diagnosis is being attempted.
- Implement diagnosis rules and modifiers from authoritative HârnMaster sources rather than inferring or inventing medical mechanics.
- Determine which injuries, diseases, infections, complications, or other supported medical conditions are eligible for diagnosis once those condition types are represented by the system.
- Keep diagnosis separate from treatment so a successful diagnosis does not itself alter wounds, bleeding, healing rates, or other patient state.
- Define what information is revealed on Marginal Success, Critical Success, Marginal Failure, and Critical Failure according to the rules.
- Respect Foundry ownership and information visibility so diagnosis does not expose hidden GM-only medical information to unauthorized users.
- Preserve ordinary no-target Physician skill rolls when the user is making a general Physician test rather than diagnosing a patient.
- Reuse the Advanced Physician Automation world setting unless a later design review establishes a need for separate diagnosis and treatment controls.
- Integrate cleanly with Bleeder treatment and future normal wound treatment so diagnosis, stabilization, and treatment remain distinct stages of one maintainable medical architecture.
- Add regression coverage for no target, one valid target, multiple targets, ownership differences, successful and failed diagnosis outcomes, and patients with no diagnosable condition.

### Normal Physician Wound Treatment

**Status:** Deferred

Extend the system-owned Physician workflow beyond Bleeder treatment to normal wound treatment.

Planned scope:

- Use the Physician Skill on the healer Actor as the player-facing entry point.
- Use the targeted Character or Creature Actor as the patient.
- Select the Injury being treated when more than one eligible wound exists.
- Apply the HârnMaster Physician treatment rules and modifiers from authoritative rules sources.
- Preserve the Advanced Physician Automation world setting so automated treatment remains optional.
- Use the existing HM3 native socket authority model for cross-owner patient updates.
- Enforce the Physician rule that active bleeding must be stopped before normal wound treatment proceeds.
- Avoid duplicating treatment state mutations in Skill-item macros; the compendium Physician macro should remain a small launcher into system-owned services.

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

### Blood Regeneration

**Status:** Deferred pending exact rules sourcing

Known HârnMaster rule behavior already identified:

- Test `HR × Endurance` once per 5 days.
- Marginal Success reduces Bloodloss by 1 BP.
- Critical Success reduces Bloodloss by 2 BP.
- Marginal Failure and Critical Failure have no effect.

The exact Bloodloss Healing Rate value has not yet been sourced from the authoritative rules material available during RC2 development. Do not implement or guess that value until it is verified.

Future implementation should reuse the existing single Bloodloss Injury and system-owned Bloodloss service.

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

## Architecture

### Formal Foundry DataModel Classes

**Status:** Deferred

Introduce formal Foundry DataModel classes only after the v14 user-interface and legacy document compatibility work is stable. This remains intentionally separate from the current migration to reduce regression risk.
