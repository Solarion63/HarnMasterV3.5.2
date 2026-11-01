# Creature hit-location templates (Foundry V14)

Creature Actors initially have **no armor/hit locations**. This is intentional: different creatures have different anatomies. The **Template** action on the Creature **Combat → Armor Locations** header can create the missing embedded `armorlocation` Items without changing the combat engine or existing locations.

This feature was implemented and runtime accepted in [PR #39](https://github.com/Solarion63/HarnMasterV3.5.2/pull/39). It is on `master`; inclusion in a packaged release depends on the release manifest and package you install.

## Use

1. Create or open a **Creature** Actor for which you have editing permission (normally as GM).
2. Select **Combat → Armor Locations → Template**.
3. Choose an **Anatomy** and an optional **Natural armor** preset.
4. Click **Add Missing Locations**.
5. Review the resulting rows. Open individual location Items to customize their **Prob. Weight** (High/Mid/Low), B/E/P/F protection, and injury effects.
6. Close and reopen the Actor to verify persistence. Use a normal injury roll with each aiming zone to check the resulting distribution.

**Example — Black Wolf:** Select **Quadruped (estimated weights)** and **Black Wolf — B4 E3 P1 F3**. The system adds Head, Neck, Chest, Abdomen, Left/Right Foreleg, Left/Right Hindleg, and Tail, each with the Bestiary-specified natural protection.

The **+ Add** action remains available to create individual custom locations. The **Custom (manual locations)** template deliberately creates no Items; use **+ Add** to define your own anatomy.

## Available anatomy templates

| Anatomy | Generated locations | Probability weight source |
| --- | ---: | --- |
| Humanoid | 26 | Existing HM3 humanoid location definitions |
| Quadruped | 9 | System-estimated High/Mid/Low weights |
| Avian | 8 | System-estimated High/Mid/Low weights |
| Serpentine | 6 | System-estimated High/Mid/Low weights |
| Custom | 0 | Manual entry |

These templates describe anatomy, **not species**. Choose an anatomy and natural armor separately. An unusual creature may require manual edits or its own custom location setup.

## Bestiary natural-armor presets

The values are from **HârnMaster v3.5.2, Bestiary pp. 3–4** and apply uniformly to *newly created* locations.

| Natural armor preset | B | E | P | F |
| --- | ---: | ---: | ---: | ---: |
| None (default) | 0 | 0 | 0 | 0 |
| Black Wolf | 4 | 3 | 1 | 3 |
| White Wolf | 4 | 3 | 1 | 3 |
| Black Bear | 5 | 2 | 2 | 4 |
| Brown Bear | 6 | 4 | 3 | 5 |
| Eagle | 3 | 2 | 1 | 2 |
| Hawk | 1 | 1 | 1 | 1 |

The Bestiary supplies these **natural protection** values, but the reviewed species tables do **not** provide matching per-species High/Mid/Low hit-location distributions. Do not treat the generic non-humanoid weights as official published rules.

## Probability weights: relative values, not percentages

Each location has three independently configurable weights, one each for **High**, **Mid**, and **Low** aiming. During a random-location injury roll, the system sums the positive weights for the chosen aiming zone and selects proportionally.

For a given zone, a location with weight `w` has selection probability `w / sum(all location weights in that zone)`. **Weights do not need to sum to 100.** At least one positive weight must exist for every aiming zone you intend to use. Zero weight means a location cannot be randomly selected in that aiming zone; an explicitly selected location remains available.

The current non-humanoid templates include nonnegative, nonzero-per-zone estimated weights. Review and modify them for species-specific use. The existing injury engine determines injury effects using the generated location's HM3 location type and its editable injury threshold table; natural armor is subtracted by attack aspect as usual.

## Safety, limitations, and existing Actors

- **Add only:** Applying a template creates an Item only if its location name is not already present on the Actor. Matching names are compared case-insensitively. Existing protection, weights, injury data, notes, and Items are preserved.
- **No replacement mode:** There is no automatic overwrite/reset of existing locations. To substantially change anatomy, edit or remove locations deliberately, preferably after backing up the Actor/world.
- **No retroactive armor update:** Selecting a different armor preset on an Actor whose locations already exist will not update their protection. Edit those locations individually.
- **No automatic inference:** The Actor name or `Species` field does not automatically select an anatomy or armor preset.
- **No migration:** Existing Creature and Character Actors are not automatically populated or modified.
- **Not the complete Bestiary:** Only the named armor presets are currently bundled. No automatic Bestiary skill, attack, movement, or creature-size setup is implied.
- **Character behavior unchanged:** Character creation continues to use its existing humanoid hit-location defaults.
- **Permissions:** Template application requires an editable Creature Actor; the resulting Items are stored as embedded Actor Items.

## Architecture and verification

| Area | Implementation |
| --- | --- |
| Template data, preset data, and validation | `module/actor/creature-location-templates.js` |
| V14 template action and Item creation | `module/actor/actor-sheet-v2.js` |
| Combat-tab button | `templates/actor/creature-sheet.html` |
| Creature Combat layout | `css/hm3-v14-combat.css` |
| Injury selection | `module/injury-rules.js` (unchanged) |
| Automated tests | `tests/creature-location-templates.test.mjs` |
| CI checks | `.github/workflows/creature-templates.yml` |

Automated tests cover template validation, species armor mappings, Item creation, positive zone totals for the estimated templates, and preserving existing locations. The V14 GM runtime acceptance for PR #39 was completed before the squash merge.

When troubleshooting, verify the **installed system package** includes the feature: a merge to `master` alone does not update an already installed release-candidate package. As a first check, open a Creature's Combat tab and look for the **Template** control beside **+ Add**.

## Rules reference

- **HârnMaster Rules v3.5.2**, Bestiary 1: natural armor format and notes on creature statistics.
- **HârnMaster Rules v3.5.2**, Bestiary 3–4: animal natural armor values.
- **HM3 system** `module/config.js`: established humanoid location weights/injury outcomes.

The HârnMaster rules remain the authoritative source when adapting an anatomy or species.
