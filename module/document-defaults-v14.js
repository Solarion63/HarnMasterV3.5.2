import { HarnMasterActor } from "./actor/actor.js";
import { HarnMasterItem } from "./item/item.js";
import * as utility from "./utility.js";
import { resolveInitialSkillMastery } from "./skill-opening-rules.js";

const ABILITY_NAMES = [
  "strength", "stamina", "dexterity", "agility", "intelligence", "aura",
  "will", "eyesight", "hearing", "smell", "voice", "comeliness", "morality"
];

function clone(value) {
  return foundry.utils.deepClone(value);
}

function baseActorDefaults() {
  return {
    bioImage: "systems/hm3/images/svg/knight-silhouette.svg",
    species: "",
    fatigue: 0,
    sunsign: "",
    abilities: Object.fromEntries(ABILITY_NAMES.map(name => [name, { base: 0 }])),
    move: { base: 0 },
    shockIndex: { max: 100, value: 100 },
    description: "***INIT***",
    biography: "",
    macros: { type: "script", command: "" }
  };
}

const ACTOR_DEFAULT_FACTORIES = {
  character: () => ({
    ...baseActorDefaults(),
    gender: "",
    occupation: ""
  }),
  creature: () => ({
    ...baseActorDefaults(),
    loadRating: 0
  }),
  container: () => ({
    bioImage: "systems/hm3/images/icons/svg/chest.svg",
    description: "",
    macros: {},
    capacity: { max: 0 }
  })
};

function baseItemDefaults() {
  return {
    notes: "",
    description: "",
    source: "",
    macros: { type: "script", command: "" }
  };
}

function gearDefaults() {
  return {
    quantity: 1,
    value: 0,
    weight: 0,
    isCarried: true,
    isEquipped: true,
    container: "on-person",
    arcane: {
      isArtifact: false,
      isAttuned: false,
      charges: -1,
      ego: 0
    }
  };
}

function weaponDefaults() {
  return {
    assocSkill: "None",
    weaponQuality: 0,
    attackMasteryLevel: 0
  };
}

const ITEM_DEFAULT_FACTORIES = {
  skill: () => ({
    ...baseItemDefaults(),
    type: "Craft",
    skillBase: { value: 0, formula: "", isFormulaValid: true },
    masteryLevel: 0,
    effectiveMasteryLevel: 0,
    ritual: { piety: 0 },
    improveFlag: false
  }),
  spell: () => ({
    ...baseItemDefaults(),
    convocation: "",
    level: 1,
    effectiveMasteryLevel: 0
  }),
  invocation: () => ({
    ...baseItemDefaults(),
    diety: "",
    circle: 1,
    effectiveMasteryLevel: 0
  }),
  psionic: () => ({
    ...baseItemDefaults(),
    skillBase: { value: 0, formula: "", isFormulaValid: true },
    masteryLevel: 0,
    effectiveMasteryLevel: 0,
    improveFlag: false,
    fatigue: 0
  }),
  weapongear: () => ({
    ...baseItemDefaults(), ...gearDefaults(), ...weaponDefaults(),
    attack: 0,
    defense: 0,
    attackModifier: 0,
    blunt: 0,
    edged: 0,
    piercing: 0,
    defenseMasteryLevel: 0
  }),
  missilegear: () => ({
    ...baseItemDefaults(), ...gearDefaults(), ...weaponDefaults(),
    weaponAspect: "Piercing",
    attackModifier: 0,
    range: { short: 0, medium: 0, long: 0, extreme: 0 },
    impact: { short: 0, medium: 0, long: 0, extreme: 0 }
  }),
  armorgear: () => ({
    ...baseItemDefaults(), ...gearDefaults(),
    material: "",
    armorQuality: 0,
    locations: [],
    protection: { blunt: 0, edged: 0, piercing: 0, fire: 0 },
    size: 6
  }),
  miscgear: () => ({ ...baseItemDefaults(), ...gearDefaults() }),
  containergear: () => ({
    ...baseItemDefaults(), ...gearDefaults(),
    capacity: { max: 1, value: 0 }
  }),
  injury: () => ({
    ...baseItemDefaults(),
    healRate: 0,
    injuryLevel: 0,
    severity: ""
  }),
  armorlocation: () => ({
    layers: "",
    armorQuality: 0,
    blunt: 0,
    edged: 0,
    piercing: 0,
    fire: 0,
    isFumble: false,
    isStumble: false,
    isAmputate: false,
    impactType: "custom",
    effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "G5" },
    probWeight: { high: 1, mid: 1, low: 1 }
  }),
  trait: () => ({
    ...baseItemDefaults(),
    type: "Physical"
  })
};

function sourceData(data) {
  if (data?.toObject instanceof Function) return data.toObject();
  return clone(data ?? {});
}

function withDefaults(data, factories) {
  const prepared = sourceData(data);
  const factory = factories[prepared.type];
  if (!factory) return prepared;

  prepared.system = foundry.utils.mergeObject(factory(), clone(prepared.system ?? {}), {
    inplace: false,
    overwrite: true,
    insertKeys: true,
    insertValues: true
  });
  return prepared;
}

export function withActorDefaults(data) {
  return withDefaults(data, ACTOR_DEFAULT_FACTORIES);
}

export function withItemDefaults(data) {
  return withDefaults(data, ITEM_DEFAULT_FACTORIES);
}

/**
 * Initialize a newly embedded Skill from its current Actor-derived Skill Base.
 *
 * This is deliberately a creation-time operation. Once a Skill has a positive
 * Mastery Level, later Actor attribute or Skill Base changes must not reset the
 * established ML. Skills whose normal opening rule requires additional context
 * (for example Language) are left unchanged rather than guessed.
 */
export function withInitialSkillMastery(data, context = {}) {
  const prepared = data;
  if (prepared?.type !== "skill" || !context.parent?.system) return prepared;

  // Reuse the existing HM3 Skill Base formula engine against the fully-defaulted
  // source object before Foundry constructs the embedded Item document.
  utility.calcSkillBase({
    system: prepared.system,
    actor: context.parent
  });

  const initial = resolveInitialSkillMastery({
    skillName: prepared.name,
    skillBase: prepared.system.skillBase?.value,
    masteryLevel: prepared.system.masteryLevel
  });

  if (initial.initialized) prepared.system.masteryLevel = initial.value;
  return prepared;
}

function installCreateDefaults(DocumentClass, prepare, finalize = null) {
  const nativeCreateDocuments = DocumentClass.createDocuments;
  DocumentClass.createDocuments = function hm3CreateDocumentsWithDefaults(data = [], context = {}) {
    const prepareEntry = entry => {
      const prepared = prepare(entry);
      return finalize ? finalize(prepared, context) : prepared;
    };
    const prepared = Array.isArray(data)
      ? data.map(prepareEntry)
      : prepareEntry(data);
    return nativeCreateDocuments.call(this, prepared, context);
  };
}

// Foundry constructs Documents and runs data preparation before preCreate hooks.
// Apply the legacy template.json defaults to source data before construction so
// HM3 prepareBaseData/prepareData always receives the same shape it historically
// received, while leaving arbitrary legacy/custom system keys unrestricted.
installCreateDefaults(HarnMasterActor, withActorDefaults);
installCreateDefaults(HarnMasterItem, withItemDefaults, withInitialSkillMastery);

export const HM3_DOCUMENT_DEFAULTS = Object.freeze({
  actorTypes: Object.freeze(Object.keys(ACTOR_DEFAULT_FACTORIES)),
  itemTypes: Object.freeze(Object.keys(ITEM_DEFAULT_FACTORIES))
});
