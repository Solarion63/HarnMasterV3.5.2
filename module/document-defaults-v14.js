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

function mergedDefaults(factory, document) {
  if (!factory) return null;
  const defaults = factory();
  const current = document._source?.system ?? document.system ?? {};
  return foundry.utils.mergeObject(defaults, clone(current), {
    inplace: false,
    overwrite: true,
    insertKeys: true,
    insertValues: true
  });
}

function applyActorDefaults(actor) {
  const system = mergedDefaults(ACTOR_DEFAULT_FACTORIES[actor.type], actor);
  if (system) actor.updateSource({ system });
}

function applyItemDefaults(item) {
  const system = mergedDefaults(ITEM_DEFAULT_FACTORIES[item.type], item);
  if (system) item.updateSource({ system });
}

Hooks.on("preCreateActor", actor => applyActorDefaults(actor));
Hooks.on("preCreateItem", item => applyItemDefaults(item));

export const HM3_DOCUMENT_DEFAULTS = Object.freeze({
  actorTypes: Object.freeze(Object.keys(ACTOR_DEFAULT_FACTORIES)),
  itemTypes: Object.freeze(Object.keys(ITEM_DEFAULT_FACTORIES))
});
