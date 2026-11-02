# HarnMaster 3 — Character Sheet Walkthrough

**Documentation home for this repository:** [HarnMaster 3 for Foundry VTT](../README.md) · **Foundry V14 RC3**.

> **About these pictures:** These 13 screenshots were inherited from the original HarnMaster project. They have been preserved, **not captured from the current V14 interface**. The explanations below describe the historical interface and call out where current workflows require the V14 documentation. Every screenshot links directly to an image stored in **this repository**—not to an upstream wiki or third-party image host.

## Clickable fields and dice rolls

On the original character sheet, clicking many roll controls opened a configuration dialog for modifiers or additional information. Holding **Shift**, **Ctrl**, or **Alt** sometimes allowed a roll to use defaults, but dialogs could still appear when information was required. The V14 system still includes clickable rolls and macro workflows; available fast-forward behavior depends on the particular action.

## Facade tab and character header

The Facade tab provides outwardly observable information and a portrait. The always-visible character header presents summary statistics and penalties, including physical and universal penalties, mobility and the character's Shock-related status. The precise V14 header layout differs from this historical image.

![Original HarnMaster Facade tab and header](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/facade-and-header-tab.jpg)

## Profile tab

The Profile tab presents abilities and the character's descriptive information. The original UI displayed base ability values alongside effective values affected by penalties, with clickable roll controls.

![Original HarnMaster Profile tab](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/profile-tab.jpg)

## Skills tab

Skills are grouped by type. The historical Skills tab lists Skill Base (**SB**), Mastery Level (**ML**) and Effective Mastery Level (**EML**), which reflects applicable penalties. Rolls are invoked from the skill row.

![Original HarnMaster Skills tab](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/skills-tab.jpg)

### Magic and ritual skills

Magic skills are organized by convocation. Ritual skill entries can be associated with religions/deities, with piety recorded separately for each. See the current [README](../README.md) for V14 functionality and restrictions.

![Original Magic and Ritual Skills section](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/skills-magic-ritual.jpg)

### Skill detail dialog

The original Skill detail screen allowed direct ML input and a formula for calculating SB. A formula could refer to abilities, a sun sign and a constant modifier. For example, a formula with `@str`, `@dex` and `@agl` combined the relevant ability values. The current parser is authoritative for exact supported formula syntax.

![Original Skill Detail dialog](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/skills-detail.jpg)

## Combat tab

The original Combat tab collects melee and missile weapons, injuries, armor locations and common roll controls. A general Damage roll is distinct from a weapon-specific Damage roll.

![Original Combat tab](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/combat-tab.jpg)

### Melee and missile weapons

Weapon rows provide attack, defense and damage actions where appropriate. Bows and similar weapons can have distinct melee and missile entries, with quantities and inventory weight managed according to the represented Item.

### Injuries and armor locations

Injury records affect penalties and Shock-related checks. Armor-location data is used with hit-location probability weights and equipped protective gear. The current V14 system also supports configurable Shock automation and Physician Diagnosis/Treatment workflows; see the [changelog](../CHANGELOG.md) for implemented details rather than treating this screenshot as a current treatment interface.

## Esoterics tab

This tab displays spells, ritual invocations and psionic talents. The system can roll casting and invocation actions and derive applicable EML; V14 behavior is subject to the relevant Item and permissions.

![Original Esoterics tab](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/esoterics-tab.jpg)

## Gear tab

The historical Gear tab displays carried and equipped items, including armor and other gear. **Carried** and **equipped** are distinct states: an Item stored elsewhere should not count as being worn, and carried load affects encumbrance.

![Original Gear tab](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/gear-tab.jpg)

## Macro tab

The legacy screenshot shows a macro-oriented interface. V14 additionally supports creating hotbar macros from owned Items, with choices for certain weapon or missile actions. Foundry permissions control whether script macros are available.

![Original Macro tab](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/macro-tab.jpg)

## Effects tab

Active Effects can change applicable values and may be enabled, disabled or time-limited depending on their configuration. The active V14 implementation uses Foundry's native effect system and V14-compatible sheets.

![Original Effects tab](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/effects-tab.jpg)

## Dice-roll chat cards

### Attack and defense

The original chat cards show attack rolls, defense selections and associated roll results. V14 includes system-managed combat resolution and consequences that extend beyond the historical presentation.

![Original Attack and Defense chat results](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/chat-atkdef-rolls.jpg)

### Damage and injury

Damage results identify the effect of an attack; an Injury roll considers the target's hit-location weights and armor and can create an Injury document. Actual behavior is governed by current system settings and roll workflow.

![Original Damage and Injury chat results](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/chat-dmginjury-rolls.jpg)

## System settings

The original settings screen is included for reference. Current V14 options include settings affecting Shock, Bloodloss, Physician automation and other optional rules; the choices and layout may differ from the screenshot.

![Original HarnMaster system settings](https://raw.githubusercontent.com/Solarion63/HarnMasterV3.5.2/master/images/help/hm3-settings.jpg)

## Origins, accuracy and maintenance

This document is a **local, maintained replacement for the broken-image reference** in the original [upstream wiki walkthrough](https://github.com/toastygm/HarnMaster-3-FoundryVTT/wiki/FoundryVTT-HarnMaster-Walkthrough). That upstream wiki page was last edited in **2021**, is outside this repository, and cannot be changed by merging PRs here. Its original wording and supplementary pages remain historical sources rather than maintained V14 instructions.

All 13 images already existed in `images/help/`; none were regenerated. Additional software and artwork credits are preserved in [Third-Party Notices](../THIRD_PARTY_NOTICES.md). For verified current features, use the [README](../README.md), [changelog](../CHANGELOG.md), and [development backlog](../DEVELOPMENT-BACKLOG.md).
