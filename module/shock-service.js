import { SHOCK_INJURY_HEAL_RATE, SHOCK_STATES } from "./shock-rules.js";

const STATE_FLAG = "shockState";
const SHOCK_ITEM_FLAG = "isShock";
const MANAGED_STATUS_FLAG = "shockManagedStatus";
const RECOVERY_AVAILABLE_FLAG = "shockRecoveryAvailableAt";
const RECOVERY_REMINDER_FLAG = "shockRecoveryReminderFor";

const STATUS_DEFINITIONS = Object.freeze({
  unconscious: {
    name: "Unconscious",
    img: "icons/svg/unconscious.svg"
  },
  prone: {
    name: "Prone",
    img: "icons/svg/falling.svg"
  },
  shocked: {
    name: "Shocked",
    img: "icons/svg/daze.svg"
  }
});

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function configuredStatus(statusName) {
  const wanted = normalized(statusName);
  return (CONFIG.statusEffects ?? []).find(status => {
    const localized = game.i18n.localize(status.name ?? status.label ?? "");
    return [status.id, status.name, status.label, localized]
      .some(value => normalized(value) === wanted);
  }) ?? null;
}

function statusMatches(effect, statusName) {
  const wanted = normalized(statusName);
  const configured = configuredStatus(statusName);
  const configuredId = normalized(configured?.id);
  const effectName = normalized(effect.name ?? effect.label);
  const statuses = effect.statuses ?? new Set();
  const hasStatus = value => typeof statuses.has === "function"
    ? statuses.has(value)
    : Array.isArray(statuses) && statuses.includes(value);

  return effectName === wanted
    || hasStatus(wanted)
    || (configuredId && hasStatus(configuredId));
}

function managedStatusMatches(effect, statusName) {
  return normalized(effect.flags?.hm3?.[MANAGED_STATUS_FLAG]) === normalized(statusName);
}

async function ensureStatus(actor, statusName) {
  const existing = actor.effects.find(effect => statusMatches(effect, statusName));
  if (existing) {
    if (managedStatusMatches(existing, statusName)
      && Number(existing.showIcon) !== CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS) {
      await existing.update({ showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS });
    }
    return existing;
  }

  const configured = configuredStatus(statusName);
  const fallback = STATUS_DEFINITIONS[statusName] ?? {
    name: statusName,
    img: "icons/svg/aura.svg"
  };
  const statusId = configured?.id ?? statusName;
  const statusLabel = configured?.name ?? configured?.label ?? fallback.name;
  const effectName = game.i18n.localize(statusLabel);

  const created = await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: effectName || fallback.name,
    img: configured?.img ?? configured?.icon ?? fallback.img,
    showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS,
    statuses: [statusId],
    disabled: false,
    changes: [],
    flags: {
      hm3: {
        [MANAGED_STATUS_FLAG]: statusName
      }
    }
  }]);

  return created[0] ?? null;
}

async function removeManagedStatus(actor, statusName) {
  const ids = actor.effects
    .filter(effect => managedStatusMatches(effect, statusName))
    .map(effect => effect.id);

  if (ids.length) await actor.deleteEmbeddedDocuments("ActiveEffect", ids);
}

async function clearRecoveryFlags(actor) {
  await actor.unsetFlag("hm3", RECOVERY_AVAILABLE_FLAG);
  await actor.unsetFlag("hm3", RECOVERY_REMINDER_FLAG);
}

export class ShockService {
  static state(actor) {
    const state = actor?.getFlag?.("hm3", STATE_FLAG) ?? actor?.flags?.hm3?.[STATE_FLAG] ?? null;
    return Object.values(SHOCK_STATES).includes(state) ? state : null;
  }

  static async setState(actor, state) {
    if (!actor) return null;
    if (state == null) {
      await actor.unsetFlag("hm3", STATE_FLAG);
      return null;
    }
    if (!Object.values(SHOCK_STATES).includes(state)) {
      throw new Error(`Invalid Shock state: ${state}`);
    }
    await actor.setFlag("hm3", STATE_FLAG, state);
    return state;
  }

  static recoveryAvailableAt(actor) {
    const value = Number(actor?.getFlag?.("hm3", RECOVERY_AVAILABLE_FLAG));
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  static async scheduleOutOfCombatRecovery(actor, availableAt) {
    const numeric = Number(availableAt);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error("Shock recovery availability must be a positive world-time value.");
    }
    await actor.setFlag("hm3", RECOVERY_AVAILABLE_FLAG, numeric);
    await actor.unsetFlag("hm3", RECOVERY_REMINDER_FLAG);
    return numeric;
  }

  static recoveryReminderFor(actor) {
    return actor?.getFlag?.("hm3", RECOVERY_REMINDER_FLAG) ?? null;
  }

  static async markRecoveryReminder(actor, key) {
    await actor.setFlag("hm3", RECOVERY_REMINDER_FLAG, String(key));
  }

  static shockInjury(actor) {
    if (!actor) return null;
    return actor.items.find(item =>
      item.type === "injury"
      && (Boolean(item.flags?.hm3?.[SHOCK_ITEM_FLAG])
        || (normalized(item.name) === "shock" && Number(item.system?.injuryLevel) === 0))
    ) ?? null;
  }

  static workflowState(actor) {
    const state = this.state(actor);
    if (state === SHOCK_STATES.UNCONSCIOUS
      && !actor?.effects?.some(effect => statusMatches(effect, "unconscious"))) {
      return null;
    }
    return state ?? (this.shockInjury(actor) ? SHOCK_STATES.SHOCK : null);
  }

  static async ensureShockInjury(actor) {
    let injury = this.shockInjury(actor);
    if (injury) {
      const update = {};
      if (Number(injury.system?.healRate) !== SHOCK_INJURY_HEAL_RATE) {
        update["system.healRate"] = SHOCK_INJURY_HEAL_RATE;
      }
      if (!injury.flags?.hm3?.[SHOCK_ITEM_FLAG]) {
        update[`flags.hm3.${SHOCK_ITEM_FLAG}`] = true;
      }
      if (Object.keys(update).length) await injury.update(update);
      return injury;
    }

    const created = await actor.createEmbeddedDocuments("Item", [{
      name: "Shock",
      type: "injury",
      img: "icons/svg/daze.svg",
      system: {
        severity: "",
        injuryLevel: 0,
        healRate: SHOCK_INJURY_HEAL_RATE,
        isBleeder: false,
        notes: "Shock injury (H5). Recovery is tested every four hours."
      },
      flags: {
        hm3: {
          [SHOCK_ITEM_FLAG]: true,
          shockCreatedAt: Number(game.time?.worldTime) || 0
        }
      }
    }]);

    injury = created[0] ?? null;
    return injury;
  }

  static async enterUnconscious(actor) {
    await ensureStatus(actor, "unconscious");
    await ensureStatus(actor, "prone");
    await clearRecoveryFlags(actor);
    await this.setState(actor, SHOCK_STATES.UNCONSCIOUS);
  }

  static async markFollowUp(actor) {
    await removeManagedStatus(actor, "unconscious");
    await clearRecoveryFlags(actor);
    await this.setState(actor, SHOCK_STATES.FOLLOW_UP);
  }

  static async enterShock(actor) {
    await removeManagedStatus(actor, "unconscious");
    await clearRecoveryFlags(actor);
    const injury = await this.ensureShockInjury(actor);
    await ensureStatus(actor, "shocked");
    await this.setState(actor, SHOCK_STATES.SHOCK);
    return injury;
  }

  static async clearTransientShockState(actor) {
    await removeManagedStatus(actor, "unconscious");
    await clearRecoveryFlags(actor);
    await this.setState(actor, null);
  }

  static async cancelUnconsciousRecovery(actor) {
    if (this.workflowState(actor) !== SHOCK_STATES.UNCONSCIOUS) return false;
    await this.clearTransientShockState(actor);
    return true;
  }
}
