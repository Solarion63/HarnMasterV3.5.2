const MULTIPLIER = value => Object.freeze({ type: "multiplier", value });
const BASE_PLUS = value => Object.freeze({ type: "base-plus", value });

/**
 * Normal (non-occupation) Opening Mastery Level rules from the HM3 Skills Data
 * tables. Character-generation occupations, military careers, clerical training,
 * and Shek-Pvar training can deliberately replace these normal OMLs and are not
 * represented here.
 *
 * Skills whose OML depends on additional context, notably Language, are omitted
 * rather than guessed. Script is the core table's special 70 + SB rule.
 */
const CORE_OPENING_RULES = Object.freeze({
  // Physical skills
  acrobatics: MULTIPLIER(2),
  climbing: MULTIPLIER(4),
  condition: MULTIPLIER(5),
  dancing: MULTIPLIER(2),
  jumping: MULTIPLIER(4),
  legerdemain: MULTIPLIER(1),
  skiing: MULTIPLIER(1),
  stealth: MULTIPLIER(3),
  swimming: MULTIPLIER(1),
  throwing: MULTIPLIER(4),

  // Communication skills
  acting: MULTIPLIER(2),
  awareness: MULTIPLIER(4),
  intrigue: MULTIPLIER(3),
  lovecraft: MULTIPLIER(3),
  "mental conflict": MULTIPLIER(3),
  musician: MULTIPLIER(1),
  oratory: MULTIPLIER(2),
  rhetoric: MULTIPLIER(3),
  singing: MULTIPLIER(3),
  script: BASE_PLUS(70),

  // Combat skills
  initiative: MULTIPLIER(4),
  unarmed: MULTIPLIER(4),
  riding: MULTIPLIER(1),
  axe: MULTIPLIER(3),
  blowgun: MULTIPLIER(4),
  bow: MULTIPLIER(2),
  club: MULTIPLIER(4),
  dagger: MULTIPLIER(3),
  flail: MULTIPLIER(1),
  net: MULTIPLIER(1),
  polearm: MULTIPLIER(2),
  shield: MULTIPLIER(3),
  sling: MULTIPLIER(1),
  spear: MULTIPLIER(3),
  sword: MULTIPLIER(3),
  whip: MULTIPLIER(1),

  // Lore and craft skills
  agriculture: MULTIPLIER(2),
  alchemy: MULTIPLIER(1),
  animalcraft: MULTIPLIER(1),
  astrology: MULTIPLIER(1),
  brewing: MULTIPLIER(2),
  ceramics: MULTIPLIER(2),
  cookery: MULTIPLIER(3),
  drawing: MULTIPLIER(2),
  embalming: MULTIPLIER(1),
  engineering: MULTIPLIER(1),
  fishing: MULTIPLIER(3),
  fletching: MULTIPLIER(1),
  folklore: MULTIPLIER(3),
  foraging: MULTIPLIER(3),
  glassworking: MULTIPLIER(1),
  heraldry: MULTIPLIER(1),
  herblore: MULTIPLIER(1),
  hidework: MULTIPLIER(2),
  hunting: MULTIPLIER(2),
  inkcraft: MULTIPLIER(1),
  jewelcraft: MULTIPLIER(1),
  law: MULTIPLIER(1),
  lockcraft: MULTIPLIER(1),
  lore: MULTIPLIER(2),
  masonry: MULTIPLIER(1),
  mathematics: MULTIPLIER(1),
  metalcraft: MULTIPLIER(1),
  milling: MULTIPLIER(2),
  mining: MULTIPLIER(1),
  perfumery: MULTIPLIER(1),
  physician: MULTIPLIER(1),
  piloting: MULTIPLIER(1),
  runecraft: MULTIPLIER(1),
  seamanship: MULTIPLIER(2),
  shipwright: MULTIPLIER(1),
  survival: MULTIPLIER(3),
  tarotry: MULTIPLIER(1),
  textilecraft: MULTIPLIER(2),
  timbercraft: MULTIPLIER(2),
  tracking: MULTIPLIER(2),
  weaponcraft: MULTIPLIER(1),
  weatherlore: MULTIPLIER(3),
  woodcraft: MULTIPLIER(2),

  // Core deity Ritual skills use the normal SB x 1 OML. Clerical Ritual/4 is
  // a character-generation training rule, not the normal opening rule.
  agrik: MULTIPLIER(1),
  halea: MULTIPLIER(1),
  ilvir: MULTIPLIER(1),
  larani: MULTIPLIER(1),
  morgath: MULTIPLIER(1),
  naveh: MULTIPLIER(1),
  peoni: MULTIPLIER(1),
  sarajin: MULTIPLIER(1),
  "save-k'nor": MULTIPLIER(1),
  siem: MULTIPLIER(1)
});

/**
 * Compatibility aliases for weapon specialties historically represented by HM3
 * as separate Skill Items. Each inherits the normal OML of its parent weapon
 * skill. Lore/craft specialties are intentionally not inferred because their
 * parent skill can be ambiguous without explicit metadata.
 */
const WEAPON_SPECIALTY_PARENT = Object.freeze({
  battleaxe: "axe",
  handaxe: "axe",
  shorkana: "axe",
  pickaxe: "axe",
  sickle: "axe",
  warhammer: "axe",
  crossbow: "bow",
  hartbow: "bow",
  longbow: "bow",
  shortbow: "bow",
  mace: "club",
  maul: "club",
  morningstar: "club",
  keltan: "dagger",
  knife: "dagger",
  taburi: "dagger",
  "ball & chain": "flail",
  grainflail: "flail",
  nachakas: "flail",
  warflail: "flail",
  lance: "polearm",
  "glaive/bill": "polearm",
  glaive: "polearm",
  bill: "polearm",
  "jousting pole": "polearm",
  pike: "polearm",
  poleaxe: "polearm",
  buckler: "shield",
  "kite shield": "shield",
  "knight shield": "shield",
  "round shield": "shield",
  roundshield: "shield",
  "tower shield": "shield",
  staffslings: "sling",
  staffsling: "sling",
  javelin: "spear",
  staff: "spear",
  trident: "spear",
  "bastard sword": "sword",
  battlesword: "sword",
  broadsword: "sword",
  estoc: "sword",
  falchion: "sword",
  longknife: "sword",
  mang: "sword",
  mankar: "sword",
  shortsword: "sword",
  isagra: "whip"
});

/** Normalize a Skill Item name for rule lookup. */
export function normalizeSkillName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ");
}

/**
 * Resolve the normal OML rule for a core HM3 skill or supported weapon
 * specialty. Unknown/context-dependent skills return null rather than receiving
 * an invented rule.
 */
export function getOpeningMasteryRule(skillName) {
  const normalized = normalizeSkillName(skillName);
  const direct = CORE_OPENING_RULES[normalized];
  if (direct) return direct;

  const parentName = WEAPON_SPECIALTY_PARENT[normalized];
  return parentName ? CORE_OPENING_RULES[parentName] ?? null : null;
}

/** Calculate normal OML from a Skill name and already-calculated Skill Base. */
export function calculateOpeningMasteryLevel(skillName, skillBase) {
  const numericBase = Number(skillBase);
  if (!Number.isFinite(numericBase) || numericBase <= 0) return null;

  const rule = getOpeningMasteryRule(skillName);
  if (!rule) return null;

  switch (rule.type) {
    case "multiplier":
      return Math.round(numericBase * rule.value);
    case "base-plus":
      return Math.round(numericBase + rule.value);
    default:
      return null;
  }
}

/**
 * Determine the mastery value to store when a Skill is first embedded on an
 * Actor. A positive existing ML is always preserved. Zero/invalid ML values are
 * initialized only when a normal OML rule is known.
 */
export function resolveInitialSkillMastery({ skillName, skillBase, masteryLevel }) {
  const numericMastery = Number(masteryLevel);
  if (Number.isFinite(numericMastery) && numericMastery > 0) {
    return Object.freeze({ value: numericMastery, initialized: false, reason: "existing-mastery" });
  }

  const openingMastery = calculateOpeningMasteryLevel(skillName, skillBase);
  if (openingMastery === null) {
    return Object.freeze({
      value: Number.isFinite(numericMastery) ? numericMastery : 0,
      initialized: false,
      reason: "no-opening-rule"
    });
  }

  return Object.freeze({ value: openingMastery, initialized: true, reason: "normal-oml" });
}

export const HM3_CORE_OPENING_MASTERY_RULES = CORE_OPENING_RULES;
