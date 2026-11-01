/**
 * Creature anatomy templates for HM3.
 *
 * The Bestiary supplies natural armor values, not anatomical hit probabilities.
 * Non-humanoid weights below are OPTIONAL SYSTEM ESTIMATES, not published rules.
 * Keep this module independent of Foundry for deterministic Node-based testing.
 */
export const CREATURE_ANATOMIES = Object.freeze({
  humanoid: {
    label: "Humanoid (HM3 locations)",
    source: "HM3 existing humanoid location definitions",
    locations: [
      ["Skull", "Skull"], ["Face", "Face"], ["Neck", "Neck"],
      ["Left Shoulder", "Shoulder"], ["Right Shoulder", "Shoulder"],
      ["Left Upper Arm", "Upper Arm"], ["Right Upper Arm", "Upper Arm"],
      ["Left Elbow", "Elbow"], ["Right Elbow", "Elbow"],
      ["Left Forearm", "Forearm"], ["Right Forearm", "Forearm"],
      ["Left Hand", "Hand"], ["Right Hand", "Hand"],
      ["Thorax", "Thorax"], ["Abdomen", "Abdomen"], ["Groin", "Groin"],
      ["Left Hip", "Hip"], ["Right Hip", "Hip"],
      ["Left Thigh", "Thigh"], ["Right Thigh", "Thigh"],
      ["Left Knee", "Knee"], ["Right Knee", "Knee"],
      ["Left Calf", "Calf"], ["Right Calf", "Calf"],
      ["Left Foot", "Foot"], ["Right Foot", "Foot"]
    ]
  },
  quadruped: {
    label: "Quadruped (estimated weights)",
    source: "GM-editable system convenience; not a published hit-location table",
    locations: [
      ["Head", "Skull", [5, 2, 0]], ["Neck", "Neck", [4, 3, 1]],
      ["Chest", "Thorax", [3, 7, 4]], ["Abdomen", "Abdomen", [0, 5, 6]],
      ["Left Foreleg", "Calf", [2, 4, 4]], ["Right Foreleg", "Calf", [2, 4, 4]],
      ["Left Hindleg", "Calf", [0, 3, 6]], ["Right Hindleg", "Calf", [0, 3, 6]],
      ["Tail", "Tail", [0, 1, 2]]
    ]
  },
  avian: {
    label: "Avian (estimated weights)",
    source: "GM-editable system convenience; not a published hit-location table",
    locations: [
      ["Head", "Skull", [5, 2, 0]], ["Neck", "Neck", [4, 3, 0]],
      ["Body", "Thorax", [3, 7, 5]],
      ["Left Wing", "Wing", [3, 4, 2]], ["Right Wing", "Wing", [3, 4, 2]],
      ["Left Leg", "Calf", [0, 2, 5]], ["Right Leg", "Calf", [0, 2, 5]],
      ["Tail", "Tail", [0, 1, 3]]
    ]
  },
  serpentine: {
    label: "Serpentine (estimated weights)",
    source: "GM-editable system convenience; not a published hit-location table",
    locations: [
      ["Head", "Skull", [5, 2, 0]], ["Neck", "Neck", [3, 3, 1]],
      ["Upper Body", "Thorax", [3, 6, 3]],
      ["Mid Body", "Abdomen", [1, 7, 6]],
      ["Lower Body", "Abdomen", [0, 3, 7]],
      ["Tail", "Tail", [0, 2, 6]]
    ]
  },
  custom: {
    label: "Custom (manual locations)",
    source: "No automatic locations",
    locations: []
  }
});

/** Bestiary 3-4, HârnMaster 3.5.2: species-wide protection B/E/P/F. */
export const CREATURE_ARMOR_PRESETS = Object.freeze({
  none: { label: "None (zero protection)", protection: [0, 0, 0, 0] },
  blackWolf: { label: "Black Wolf — B4 E3 P1 F3", protection: [4, 3, 1, 3] },
  whiteWolf: { label: "White Wolf — B4 E3 P1 F3", protection: [4, 3, 1, 3] },
  blackBear: { label: "Black Bear — B5 E2 P2 F4", protection: [5, 2, 2, 4] },
  brownBear: { label: "Brown Bear — B6 E4 P3 F5", protection: [6, 4, 3, 5] },
  eagle: { label: "Eagle — B3 E2 P1 F2", protection: [3, 2, 1, 2] },
  hawk: { label: "Hawk — B1 E1 P1 F1", protection: [1, 1, 1, 1] }
});

export function validateCreatureTemplate(template) {
  if (!template || !Array.isArray(template.locations)) throw new Error("Invalid anatomy template.");
  const names = new Set();
  const totals = [0, 0, 0];
  for (const entry of template.locations) {
    const [name, type, weights] = entry;
    if (!name || !type) throw new Error("Location names and types are required.");
    const key = name.trim().toLocaleLowerCase();
    if (names.has(key)) throw new Error(`Duplicate location: ${name}`);
    names.add(key);
    if (weights !== undefined) {
      if (!Array.isArray(weights) || weights.length !== 3 || weights.some(
        weight => !Number.isFinite(weight) || weight < 0
      )) throw new Error(`Invalid probability weights for ${name}`);
      weights.forEach((weight, index) => { totals[index] += weight; });
    }
  }
  if (template.locations.some(entry => entry[2]) && totals.some(total => total <= 0)) {
    throw new Error("Each aiming zone must have at least one positive weight.");
  }
  return true;
}

/**
 * Build independent embedded Item source objects; returns [] for Custom.
 * locationTypes is CONFIG.HM3.injuryLocations, itemDefaults is game.model.Item.armorlocation.
 */
export function buildCreatureLocations({ anatomy, armor = "none", locationTypes, itemDefaults }) {
  const template = CREATURE_ANATOMIES[anatomy];
  const preset = CREATURE_ARMOR_PRESETS[armor];
  if (!template || !preset) throw new Error("Unrecognized creature anatomy or armor preset.");
  validateCreatureTemplate(template);
  return template.locations.map(([name, type, weights]) => {
    const definition = locationTypes?.[type];
    if (!definition) throw new Error(`Missing HM3 location definition: ${type}`);
    const system = structuredClone(itemDefaults ?? {});
    Object.assign(system, structuredClone(definition));
    if (weights) system.probWeight = { high: weights[0], mid: weights[1], low: weights[2] };
    const [blunt, edged, piercing, fire] = preset.protection;
    Object.assign(system, { blunt, edged, piercing, fire });
    return { name, type: "armorlocation", system };
  });
}

/** Preserve all existing locations, even if previously customized. */
export function missingCreatureLocations(generated, existing) {
  const names = new Set(Array.from(existing ?? [], item => String(item.name).trim().toLocaleLowerCase()));
  return generated.filter(item => !names.has(item.name.trim().toLocaleLowerCase()));
}
