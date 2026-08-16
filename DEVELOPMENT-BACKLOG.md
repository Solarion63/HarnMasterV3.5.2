# HarnMaster 3 Development Backlog

This backlog records work intentionally deferred from the current Foundry VTT v14 release-candidate development. Items listed here are not part of the currently validated feature scope unless explicitly promoted into active development.

## Medical Automation

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

### Blood Regeneration

**Status:** Deferred pending exact rules sourcing

Known HârnMaster rule behavior already identified:

- Test `HR × Endurance` once per 5 days.
- Marginal Success reduces Bloodloss by 1 BP.
- Critical Success reduces Bloodloss by 2 BP.
- Marginal Failure and Critical Failure have no effect.

The exact Bloodloss Healing Rate value has not yet been sourced from the authoritative rules material available during RC2 development. Do not implement or guess that value until it is verified.

Future implementation should reuse the existing single Bloodloss Injury and system-owned Bloodloss service.

## Architecture

### Formal Foundry DataModel Classes

**Status:** Deferred

Introduce formal Foundry DataModel classes only after the v14 user-interface and legacy document compatibility work is stable. This remains intentionally separate from the current migration to reduce regression risk.

### Remaining Legacy Dice Runtime Cleanup

**Status:** Deferred

Continue extracting required rules calculations from `dice-hm3.js` into focused v14-era modules before removing obsolete Foundry-facing implementations or runtime compatibility behavior. Preserve public macro names where world compatibility requires them.
