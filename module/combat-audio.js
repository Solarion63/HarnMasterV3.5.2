const SOUND_SETTING_KEYS = {
  attack: "combatSoundAttack",
  dodge: "combatSoundDodge",
  block: "combatSoundBlock",
  injury: "combatSoundInjury"
};

const CORE_SOUND_CANDIDATES = {
  attack: ["dice", "notification", "notify"],
  dodge: ["notification", "notify", "dice"],
  block: ["lock", "dice", "notification", "notify"],
  injury: ["notify", "notification", "dice"]
};

function configuredPath(kind) {
  const key = SOUND_SETTING_KEYS[kind];
  if (!key || !game?.settings?.settings?.has(`hm3.${key}`)) return "";
  return String(game.settings.get("hm3", key) ?? "").trim();
}

function corePath(kind) {
  for (const key of CORE_SOUND_CANDIDATES[kind] ?? []) {
    const path = CONFIG.sounds?.[key];
    if (typeof path === "string" && path.trim()) return path;
  }
  return "";
}

export class CombatAudio {
  static resolve(kind) {
    return configuredPath(kind) || corePath(kind);
  }

  static play(kind, { broadcast = true } = {}) {
    if (!game.settings.get("hm3", "combatAudio")) return null;

    const src = CombatAudio.resolve(kind);
    if (!src) {
      console.warn(`HM3 | No combat audio source is available for ${kind}.`);
      return null;
    }

    const AudioHelper = foundry.audio?.AudioHelper;
    if (typeof AudioHelper?.play !== "function") {
      console.warn(`HM3 | Foundry AudioHelper is unavailable; ${kind} audio was skipped.`);
      return null;
    }

    try {
      return AudioHelper.play({
        src,
        autoplay: true,
        loop: false,
        channel: "interface"
      }, broadcast);
    } catch (error) {
      console.warn(`HM3 | ${kind} audio playback failed; gameplay continued normally.`, error);
      return null;
    }
  }
}
