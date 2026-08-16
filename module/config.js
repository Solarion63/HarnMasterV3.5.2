// Namespace Configuration Values
export const HM3 = {};

// ASCII Artwork
HM3.ASCII = `_   _ ___  ___ _____ 
| | | ||  \\/  ||____ |
| |_| || .  . |    / /
|  _  || |\\/| |    \\ \\
| | | || |  | |.___/ /
\\_| |_/\\_|  |_/\\____/`;

// When the system is fully ready, set this to true
HM3.ready = false;

HM3.allowedActorFlags = [];

HM3.allowedAspects = ['Edged', 'Piercing', 'Blunt'];

HM3.allowedRanges = ['Short', 'Medium', 'Long', 'Extreme'];

HM3.skillTypes = ["Craft", "Physical", "Communication", "Combat", "Magic", "Ritual"];

HM3.traitTypes = ["Physical", "Psyche"];

HM3.ITEM_TYPE_LABEL = {
    skill: {singular: 'Skill', plural: 'Skills'},
    spell: {singular: 'Spell', plural: 'Spells'},
    weapongear: {singular: 'Melee Weapon', plural: 'Melee Weapons'},
    missilegear: {singular: 'Missile', plural: 'Missiles'},
    armorgear: {singular: 'Armor', plural: 'Armor'},
    miscgear: {singular: 'Misc Item', plural: 'Misc Items'},
    containergear: {singular: 'Container', plural: 'Containers'},
    injury: {singular: 'Injury', plural: 'Injuries'},
    armorlocation: {singular: 'Armor Location', plural: 'Armor Locations'},
    trait: {singular: 'Trait', plural: 'Traits'},
    psionic: {singular: 'Psionic', plural: 'Psionics'},
    incantation: {singular: 'Ritual Incantation', plural: 'Ritual Incantations'},
};

HM3.sunsigns = ['Ulandus', 'Ulandus-Aralius', 'Aralius', 'Aralius-Feniri', 'Feniri', 'Feniri-Ahnu',
    'Ahnu', 'Ahnu-Angberelius', 'Angberelius', 'Angberelius-Nadai', 'Nadai', 'Nadai-Hirin',
    'Hirin', 'Hirin-Tarael', 'Tarael', 'Tarael-Tai', 'Tai', 'Tai-Skorus', 'Skorus',
    'Skorus-Masara', 'Masara', 'Masara-Lado', 'Lado', 'Lado-Ulandus'];

HM3.defaultCharacterSkills = [
    'Climbing', 'Condition', 'Jumping', 'Stealth', 'Throwing', 'Awareness', 'Intrigue', 'Oratory', 'Rhetoric', 'Singing',
    'Initiative', 'Unarmed', 'Dodge'];

HM3.defaultCreatureSkills = ['Awareness', 'Initiative', 'Unarmed', 'Dodge'];

HM3.injuryLocations = {
    "Custom": { impactType: "custom", probWeight: { "high": 1, "mid": 1, "low": 1 }, isStumble: false, isFumble: false, isAmputate: false, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "G5" } },
    "Skull": { impactType: "skull", probWeight: { "high": 150, "mid": 50, "low": 0 }, isStumble: false, isFumble: false, isAmputate: false, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "K4", ei17: "K5" } },
    "Face": { impactType: "face", probWeight: { "high": 150, "mid": 50, "low": 0 }, isStumble: false, isFumble: false, isAmputate: false, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "K5" } },
    "Neck": { impactType: "neck", probWeight: { "high": 150, "mid": 50, "low": 0 }, isStumble: false, isFumble: false, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "K4", ei17: "K5" } },
    "Shoulder": { impactType: "shoulder", probWeight: { "high": 60, "mid": 60, "low": 0 }, isStumble: false, isFumble: true, isAmputate: false, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "K4" } },
    "Upper Arm": { impactType: "upperarm", probWeight: { "high": 60, "mid": 30, "low": 0 }, isStumble: false, isFumble: true, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "M1", ei9: "S2", ei13: "S3", ei17: "G4" } },
    "Elbow": { impactType: "elbow", probWeight: { "high": 20, "mid": 10, "low": 0 }, isStumble: false, isFumble: true, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "G5" } },
    "Forearm": { impactType: "forearm", probWeight: { "high": 40, "mid": 20, "low": 30 }, isStumble: false, isFumble: true, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "M1", ei9: "S2", ei13: "S3", ei17: "G4" } },
    "Hand": { impactType: "hand", probWeight: { "high": 20, "mid": 20, "low": 30 }, isStumble: false, isFumble: true, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "G5" } },
    "Thorax": { impactType: "thorax", probWeight: { "high": 100, "mid": 170, "low": 70 }, isStumble: false, isFumble: false, isAmputate: false, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "K5" } },
    "Abdomen": { impactType: "abdomen", probWeight: { "high": 60, "mid": 100, "low": 100 }, isStumble: false, isFumble: false, isAmputate: false, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "K4", ei17: "K5" } },
    "Groin": { impactType: "groin", probWeight: { "high": 0, "mid": 40, "low": 60 }, isStumble: false, isFumble: false, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "G5" } },
    "Hip": { impactType: "hip", probWeight: { "high": 0, "mid": 30, "low": 70 }, isStumble: true, isFumble: false, isAmputate: false, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "K4" } },
    "Thigh": { impactType: "thigh", probWeight: { "high": 0, "mid": 40, "low": 100 }, isStumble: true, isFumble: false, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "K4" } },
    "Knee": { impactType: "knee", probWeight: { "high": 0, "mid": 10, "low": 40 }, isStumble: true, isFumble: false, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "G5" } },
    "Calf": { impactType: "calf", probWeight: { "high": 0, "mid": 30, "low": 70 }, isStumble: true, isFumble: false, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "M1", ei9: "S2", ei13: "S3", ei17: "G4" } },
    "Foot": { impactType: "foot", probWeight: { "high": 0, "mid": 20, "low": 40 }, isStumble: true, isFumble: false, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "G5" } },
    "Wing": { impactType: "wing", probWeight: { "high": 150, "mid": 50, "low": 0 }, isStumble: false, isFumble: true, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "S2", ei9: "S3", ei13: "G4", ei17: "G5" } },
    "Tentacle": { impactType: "tentacle", probWeight: { "high": 50, "mid": 150, "low": 0 }, isStumble: false, isFumble: true, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "M1", ei9: "S2", ei13: "S3", ei17: "G4" } },
    "Tail": { impactType: "tail", probWeight: { "high": 0, "mid": 50, "low": 100 }, isStumble: true, isFumble: false, isAmputate: true, effectiveImpact: { ei1: "M1", ei5: "M1", ei9: "S2", ei13: "S3", ei17: "G4" } }
};

HM3.stdSkills = {
    "Sword": { "source": "HM3 Skills 19", "skillBase": { "formula": "@str, @dex, @dex, Angberelius:3, Ahnu, Nadai" }, "type": "Combat" },
    "Axe": { "source": "HM3 Skills 19", "skillBase": { "formula": "@str, @str, @dex, Ahnu, Feniri, Angberelius" }, "type": "Combat" },
    "Bow": { "source": "HM3 Skills 19", "skillBase": { "formula": "@str, @dex, @eye, Hirin, Tarael, Nadai" }, "type": "Combat" },
    "Shield": { "source": "HM3 Skills 19", "skillBase": { "formula": "@str, @dex, @dex, Ulandus, Lado, Masara" }, "type": "Combat" },
    "Flail": { "source": "HM3 Skills 19", "skillBase": { "formula": "@dex, @dex, @dex, Hirin, Tarael, Nadai" }, "type": "Combat" },
    "Sling": { "source": "HM3 Skills 19", "skillBase": { "formula": "@dex, @dex, @eye, Hirin, Tarael, Nadai" }, "type": "Combat" },
    "Riding": { "source": "HM3 Skills 18", "skillBase": { "formula": "@dex, @agl, @wil, Ulandus, Aralius" }, "type": "Combat" },
    "Initiative": { "source": "HM3 Skills 18", "skillBase": { "formula": "@agl, @wil, @wil" }, "type": "Combat" },
    "Unarmed": { "source": "HM3 Skills 18", "skillBase": { "formula": "@str, @dex, @agl, Madada:2, Lado:2, Ulandus:2" }, "type": "Combat" },
    "Polearm": { "source": "HM3 Skills 19", "skillBase": { "formula": "@str, @str, @dex, Angberelius, Aralius" }, "type": "Combat" },
    "Dagger": { "source": "HM3 Skills 19", "skillBase": { "formula": "@dex, @dex, @eye, Angberelius:2, Nadai:2" }, "type": "Combat" },
    "Blowgun": { "source": "HM3 Skills 19", "skillBase": { "formula": "@sta, @dex, @eye, Hirin:2, Tarael, Nadai" }, "type": "Combat" },
    "Spear": { "source": "HM3 Skills 19", "skillBase": { "formula": "@str, @str, @dex, Aralius, Feniri, Ulandus" }, "type": "Combat" },
    "Net": { "source": "HM3 Skills 19", "skillBase": { "formula": "@dex, @dex, @eye, Masara, Skorus, Lado" }, "type": "Combat" },
    "Club": { "source": "HM3 Skills 19", "skillBase": { "formula": "@str, @str, @dex, Ulandus, Aralius" }, "type": "Combat" },
    "Whip": { "source": "HM3 Skills 19", "skillBase": { "formula": "@dex, @dex, @eye, Hirin, Nadai" }, "type": "Combat" },
    "Dodge": { "source": "HM3 Skills 21", "skillBase": { "formula": "@agl, @agl, @agl" }, "type": "Combat" },
    "Acting": { "source": "HM3 Skills 11", "skillBase": { "formula": "@agl, @voi, @int, Tarael, Tai" }, "type": "Communication" },
    "Intrigue": { "source": "HM3 Skills 11", "skillBase": { "formula": "@int, @aur, @wil, Tai, Tarael, Skorus" }, "type": "Communication" },
    "Awareness": { "source": "HM3 Skills 11", "skillBase": { "formula": "@eye, @hrg, @sml, Hirin:2, Tarael:2" }, "type": "Communication" },
    "Oratory": { "source": "HM3 Skills 12", "skillBase": { "formula": "@cml, @voi, @int, Tarael" }, "type": "Communication" },
    "Script": { "source": "HM3 Skills 11", "skillBase": { "formula": "@dex, @eye, @int, Tarael, Tai" }, "type": "Communication" },
    "Rhetoric": { "source": "HM3 Skills 12", "skillBase": { "formula": "@voi, @int, @wil, Tai, Tarael, Skorus" }, "type": "Communication" },
    "Language": { "source": "HM3 Skills 10", "skillBase": { "formula": "@voi, @int, @wil, Tai" }, "type": "Communication" },
    "Musician": { "source": "HM3 Skills 12", "skillBase": { "formula": "@dex, @hrg, @hrg, Masara, Angberelius" }, "type": "Communication" },
    "Mental Conflict": { "source": "HM3 Skills 13", "skillBase": { "formula": "@int, @aur, @wil, Savorya:2" }, "type": "Communication" },
    "Singing": { "source": "HM3 Skills 12", "skillBase": { "formula": "@voi, @hrg, @aur, Tarael:2, Masara" }, "type": "Communication" },
    "Climbing": { "source": "HM3 Skills 9", "skillBase": { "formula": "@str, @dex, @agl, Ulandus, Aralius" }, "type": "Physical" },
    "Condition": { "source": "HM3 Skills 9", "skillBase": { "formula": "@sta, @sta, @wil, Ulandus, Ahnu" }, "type": "Physical" },
    "Jumping": { "source": "HM3 Skills 9", "skillBase": { "formula": "@str, @str, @agl, Ulandus, Angberelius" }, "type": "Physical" },
    "Stealth": { "source": "HM3 Skills 9", "skillBase": { "formula": "@agl, @agl, @hrg, Feniri, Skorus" }, "type": "Physical" },
    "Throwing": { "source": "HM3 Skills 9", "skillBase": { "formula": "@str, @dex, @eye, Angberelius, Tarael" }, "type": "Physical" },
    "Acrobatics": { "source": "HM3 Skills 9", "skillBase": { "formula": "@str, @dex, @agl, Ulandus, Masara" }, "type": "Physical" },
    "Swimming": { "source": "HM3 Skills 9", "skillBase": { "formula": "@str, @sta, @agl, Ulandus, Feniri" }, "type": "Physical" },
    "Skiing": { "source": "HM3 Skills 9", "skillBase": { "formula": "@dex, @agl, @agl, Feniri:2, Ulandus" }, "type": "Physical" },
    "Riding": { "source": "HM3 Skills 18", "skillBase": { "formula": "@dex, @agl, @wil, Ulandus, Aralius" }, "type": "Combat" },
    "Survival": { "source": "HM3 Skills 13", "skillBase": { "formula": "@sta, @int, @aur, Ulandus, Feniri" }, "type": "Physical" },
    "Agriculture": { "source": "HM3 Skills 14", "skillBase": { "formula": "@str, @sta, @int, Ulandus, Ahnu" }, "type": "Craft" },
    "Alchemy": { "source": "HM3 Skills 16", "skillBase": { "formula": "@int, @aur, @wil, Masara, Skorus" }, "type": "Craft" },
    "Animalcraft": { "source": "HM3 Skills 14", "skillBase": { "formula": "@int, @aur, @wil, Ulandus, Aralius" }, "type": "Craft" },
    "Astrology": { "source": "HM3 Skills 16", "skillBase": { "formula": "@int, @aur, @eye, Tai, Tarael" }, "type": "Craft" },
    "Brewing": { "source": "HM3 Skills 15", "skillBase": { "formula": "@sml, @int, @wil, Feniri, Ahnu" }, "type": "Craft" },
    "Ceramics": { "source": "HM3 Skills 14", "skillBase": { "formula": "@dex, @eye, @int, Aralius, Ahnu" }, "type": "Craft" },
    "Cookery": { "source": "HM3 Skills 15", "skillBase": { "formula": "@sml, @int, @wil, Ahnu, Masara" }, "type": "Craft" },
    "Drawing": { "source": "HM3 Skills 15", "skillBase": { "formula": "@dex, @eye, @int, Tarael, Masara" }, "type": "Craft" },
    "Embalming": { "source": "HM3 Skills 15", "skillBase": { "formula": "@dex, @int, @wil, Ahnu, Feniri" }, "type": "Craft" },
    "Engineering": { "source": "HM3 Skills 15", "skillBase": { "formula": "@int, @int, @wil, Tarael, Skorus" }, "type": "Craft" },
    "Fishing": { "source": "HM3 Skills 14", "skillBase": { "formula": "@dex, @eye, @wil, Feniri, Nadai" }, "type": "Craft" },
    "Fletching": { "source": "HM3 Skills 14", "skillBase": { "formula": "@dex, @eye, @int, Tarael, Angberelius" }, "type": "Craft" },
    "Folklore": { "source": "HM3 Skills 14", "skillBase": { "formula": "@int, @int, @wil, Ulandus, Feniri" }, "type": "Craft" },
    "Foraging": { "source": "HM3 Skills 14", "skillBase": { "formula": "@sml, @int, @wil, Ulandus, Feniri" }, "type": "Craft" },
    "Glassworking": { "source": "HM3 Skills 14", "skillBase": { "formula": "@dex, @eye, @int, Aralius, Ahnu" }, "type": "Craft" },
    "Heraldry": { "source": "HM3 Skills 14", "skillBase": { "formula": "@int, @int, @wil, Tarael, Skorus" }, "type": "Craft" },
    "Herblore": { "source": "HM3 Skills 15", "skillBase": { "formula": "@sml, @int, @wil, Ulandus, Ahnu" }, "type": "Craft" },
    "Hidework": { "source": "HM3 Skills 15", "skillBase": { "formula": "@dex, @eye, @int, Ulandus, Aralius" }, "type": "Craft" },
    "Hunting": { "source": "HM3 Skills 14", "skillBase": { "formula": "@eye, @hrg, @wil, Ulandus, Feniri" }, "type": "Craft" },
    "Inkcraft": { "source": "HM3 Skills 15", "skillBase": { "formula": "@dex, @eye, @int, Tarael, Tai" }, "type": "Craft" },
    "Jewelcraft": { "source": "HM3 Skills 14", "skillBase": { "formula": "@dex, @eye, @int, Masara, Skorus" }, "type": "Craft" },
    "Law": { "source": "HM3 Skills 16", "skillBase": { "formula": "@int, @int, @wil, Tarael, Tai" }, "type": "Craft" },
    "Legerdemain": { "source": "HM3 Skills 14", "skillBase": { "formula": "@dex, @dex, @eye, Tarael, Masara" }, "type": "Craft" },
    "Lockcraft": { "source": "HM3 Skills 15", "skillBase": { "formula": "@dex, @eye, @int, Masara, Skorus" }, "type": "Craft" },
    "Lore": { "source": "HM3 Skills 16", "skillBase": { "formula": "@int, @int, @wil, Tarael, Tai" }, "type": "Craft" },
    "Lovecraft": { "source": "HM3 Skills 14", "skillBase": { "formula": "@dex, @eye, @aur, Masara, Feniri" }, "type": "Craft" },
    "Masonry": { "source": "HM3 Skills 14", "skillBase": { "formula": "@str, @dex, @int, Ulandus, Ahnu" }, "type": "Craft" },
    "Mathematics": { "source": "HM3 Skills 16", "skillBase": { "formula": "@int, @int, @wil, Tarael, Tai" }, "type": "Craft" },
    "Metalcraft": { "source": "HM3 Skills 14", "skillBase": { "formula": "@str, @dex, @int, Aralius, Ahnu" }, "type": "Craft" },
    "Milling": { "source": "HM3 Skills 15", "skillBase": { "formula": "@str, @sta, @int, Ulandus, Ahnu" }, "type": "Craft" },
    "Mining": { "source": "HM3 Skills 15", "skillBase": { "formula": "@str, @sta, @int, Ulandus, Ahnu" }, "type": "Craft" },
    "Perfumery": { "source": "HM3 Skills 15", "skillBase": { "formula": "@sml, @int, @wil, Masara, Skorus" }, "type": "Craft" },
    "Physician": { "source": "HM3 Skills 17", "skillBase": { "formula": "@dex, @eye, @int, Masara:2, Skorus, Tai" }, "type": "Craft" },
    "Piloting": { "source": "HM3 Skills 16", "skillBase": { "formula": "@dex, @eye, @int, Hirin, Tarael" }, "type": "Craft" },
    "Runecraft": { "source": "HM3 Skills 16", "skillBase": { "formula": "@dex, @eye, @int, Tarael, Tai" }, "type": "Craft" },
    "Seamanship": { "source": "HM3 Skills 15", "skillBase": { "formula": "@sta, @int, @wil, Feniri, Nadai" }, "type": "Craft" },
    "Shipwright": { "source": "HM3 Skills 15", "skillBase": { "formula": "@str, @dex, @int, Feniri, Nadai" }, "type": "Craft" },
    "Textilecraft": { "source": "HM3 Skills 14", "skillBase": { "formula": "@dex, @eye, @int, Masara, Feniri" }, "type": "Craft" },
    "Timbercraft": { "source": "HM3 Skills 14", "skillBase": { "formula": "@str, @dex, @int, Ulandus, Feniri" }, "type": "Craft" },
    "Tracking": { "source": "HM3 Skills 13", "skillBase": { "formula": "@eye, @hrg, @sml, Ulandus, Feniri" }, "type": "Craft" },
    "Weaponcraft": { "source": "HM3 Skills 14", "skillBase": { "formula": "@str, @dex, @int, Angberelius, Aralius" }, "type": "Craft" },
    "Weatherlore": { "source": "HM3 Skills 16", "skillBase": { "formula": "@eye, @int, @wil, Feniri, Nadai" }, "type": "Craft" },
    "Woodcraft": { "source": "HM3 Skills 14", "skillBase": { "formula": "@str, @dex, @int, Ulandus, Feniri" }, "type": "Craft" }
};

HM3.defaultRitualIconName = 'holy-symbol';
HM3.defaultMagicIconName = 'magic-swirl';
HM3.defaultPsionicsIconName = 'psychic-waves';
HM3.defaultMiscItemIconName = 'pouch';
HM3.defaultContainerIconName = 'chest';
HM3.defaultArmorGearIconName = 'breastplate';

HM3.armorMaterialTypes = [
    'Cloth', 'Quilt', 'Leather', 'Kurbul', 'Mail', 'Scale', 'Plate'];

HM3.armorLocationTypes = ['Skull', 'Face', 'Neck', 'Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Hand', 'Thorax', 'Abdomen',
    'Groin', 'Hip', 'Thigh', 'Knee', 'Calf', 'Foot'];

HM3.defaultArmorLocations = ['Skull', 'Face', 'Neck', 'Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Hand', 'Thorax', 'Abdomen',
    'Groin', 'Hip', 'Thigh', 'Knee', 'Calf', 'Foot'];

HM3.defaultCreatureArmorLocations = ['Skull', 'Face', 'Neck', 'Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Hand', 'Thorax', 'Abdomen',
    'Groin', 'Hip', 'Thigh', 'Knee', 'Calf', 'Foot'];

HM3.weaponAspectTypes = ['Blunt', 'Edged', 'Piercing'];

HM3.missileWeaponAspectTypes = ['Blunt', 'Edged', 'Piercing', 'Fire'];

HM3.defaultActorIconName = 'knight-silhouette';
HM3.defaultCreatureIconName = 'monster-silhouette';

HM3.itemIcons = {
    'skill': 'caduceus',
    'spell': 'magic-swirl',
    'invocation': 'holy-symbol',
    'psionic': 'psychic-waves',
    'weapongear': 'crossed-swords',
    'containergear': 'chest',
    'missilegear': 'bow-arrow',
    'armorgear': 'breastplate',
    'miscgear': 'pouch',
    'injury': 'bandage-roll',
    'armorlocation': 'shield',
    'trait': 'person'
};
