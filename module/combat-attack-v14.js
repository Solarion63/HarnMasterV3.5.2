import { CombatAudio } from "./combat-audio.js";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

function tokenPlaceable(tokenOrDocument) {
  if (!tokenOrDocument) return null;
  if (tokenOrDocument.center?.x != null && tokenOrDocument.center?.y != null) {
    return tokenOrDocument;
  }

  const document = tokenOrDocument.document ?? tokenOrDocument;
  const placeable = document.object ?? (document.id ? canvas.tokens.get(document.id) : null);
  return placeable?.center?.x != null && placeable?.center?.y != null ? placeable : null;
}

function measureRange(sourceToken, targetToken, gridUnits = false) {
  if (canvas.scene?.getFlag("hm3", "isTotm")) return 0;

  const source = tokenPlaceable(sourceToken);
  const target = tokenPlaceable(targetToken);
  if (!source || !target) {
    throw new Error("HM3 | Unable to resolve token positions for range measurement.");
  }

  const measurement = canvas.grid.measurePath([
    { x: source.center.x, y: source.center.y },
    { x: target.center.x, y: target.center.y }
  ]);
  if (gridUnits) {
    return measurement.spaces ?? Math.round(measurement.distance / canvas.dimensions.distance);
  }
  return measurement.distance;
}

function meleeAspect(item) {
  const aspects = {};
  if (Number(item.system.blunt) >= 0) aspects.Blunt = Number(item.system.blunt);
  if (Number(item.system.edged) >= 0) aspects.Edged = Number(item.system.edged);
  if (Number(item.system.piercing) >= 0) aspects.Piercing = Number(item.system.piercing);
  const entries = Object.entries(aspects);
  const defaultAspect = entries.sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  return { aspects, defaultAspect };
}

async function attackDialog(attacker, defender, item, distance = null) {
  const data = {
    weapon: item.name,
    aimLocations: ["Low", "Mid", "High"],
    defaultAim: "Mid",
    defaultModifier: 0,
    title: `${attacker.name} vs. ${defender.name} Attack with ${item.name}`
  };

  if (item.type === "weapongear") {
    const aspectData = meleeAspect(item);
    if (!aspectData.defaultAspect) {
      ui.notifications.warn(`${item.name} has no available damage aspect.`);
      return null;
    }
    Object.assign(data, aspectData);
  } else {
    const ranges = {
      [`Short (${item.system.range.short})`]: Number(item.system.impact.short),
      [`Medium (${item.system.range.medium})`]: Number(item.system.impact.medium),
      [`Long (${item.system.range.long})`]: Number(item.system.impact.long),
      [`Extreme (${item.system.range.extreme})`]: Number(item.system.impact.extreme)
    };
    data.aspects = { [item.system.weaponAspect]: -1 };
    data.defaultAspect = item.system.weaponAspect;
    data.ranges = ranges;
    data.distance = distance;
    data.rangeExceedsExtreme = distance > Number(item.system.range.extreme);

    if (distance <= Number(item.system.range.short)) data.defaultRange = Object.keys(ranges)[0];
    else if (distance <= Number(item.system.range.medium)) data.defaultRange = Object.keys(ranges)[1];
    else if (distance <= Number(item.system.range.long)) data.defaultRange = Object.keys(ranges)[2];
    else data.defaultRange = Object.keys(ranges)[3];
  }

  const content = await renderTemplate("systems/hm3/templates/dialog/attack-dialog.html", data);
  return DialogV2.prompt({
    window: { title: data.title },
    content: content.trim(),
    ok: {
      label: "Attack",
      callback: (_event, _button, dialog) => {
        const root = dialog.element;
        const rangeValue = root?.querySelector('[name="range"]')?.value ?? null;
        const aim = root?.querySelector('[name="aim"]')?.value ?? "Mid";
        const manualModifier = Number(root?.querySelector('[name="addlModifier"]')?.value) || 0;
        const aimPenalty = aim === "Mid" ? 0 : -10;
        const result = {
          weapon: item,
          aspect: root?.querySelector('[name="weaponAspect"]')?.value ?? null,
          aim,
          addlModifier: manualModifier + aimPenalty,
          range: null,
          rangeMod: 0,
          rangeExceedsExtreme: Boolean(data.rangeExceedsExtreme),
          impactMod: 0
        };

        if (rangeValue) {
          if (rangeValue.startsWith("Short")) result.range = "Short";
          else if (rangeValue.startsWith("Medium")) {
            result.range = "Medium";
            result.rangeMod = -20;
          } else if (rangeValue.startsWith("Long")) {
            result.range = "Long";
            result.rangeMod = -40;
          } else {
            result.range = "Extreme";
            result.rangeMod = -80;
          }
          result.impactMod = Number(data.ranges[rangeValue]) || 0;
        } else {
          result.impactMod = Number(data.aspects[result.aspect]) || 0;
        }
        return result;
      }
    },
    rejectClose: false
  });
}

async function createAttackCard(attacker, defender, item, result, distance = null) {
  const missile = item.type === "missilegear";
  const effectiveAML = Number(item.system.attackMasteryLevel)
    + Number(result.addlModifier)
    + (missile ? Number(result.rangeMod) : 0);
  const templateData = {
    title: `${item.name} ${missile ? "Missile" : "Melee"} Attack`,
    attacker: attacker.name,
    atkTokenId: attacker.id,
    defender: defender.name,
    defTokenId: defender.id,
    weaponType: missile ? "missile" : "melee",
    weaponName: item.name,
    rangeText: result.range,
    rangeExceedsExtreme: result.rangeExceedsExtreme,
    rangeModSign: result.rangeMod < 0 ? "-" : "+",
    rangeModifierAbs: Math.abs(result.rangeMod ?? 0),
    rangeDist: distance,
    aim: result.aim,
    aspect: result.aspect,
    addlModifierAbs: Math.abs(result.addlModifier),
    addlModifierSign: result.addlModifier < 0 ? "-" : "+",
    origAML: item.system.attackMasteryLevel,
    effAML: effectiveAML,
    impactMod: result.impactMod,
    hasDodge: true,
    hasBlock: true,
    hasCounterstrike: !missile,
    hasIgnore: true,
    visibleActorId: defender.actor.id
  };

  const content = await renderTemplate("systems/hm3/templates/chat/attack-card.html", templateData);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ token: attacker.document }),
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.OTHER
  });
  CombatAudio.play("attack");
  return templateData;
}

async function consumeMissile(item) {
  if (!game.settings.get("hm3", "missileTracking")) return true;

  const quantity = Number(item.system.quantity) || 0;
  if (quantity <= 0) {
    ui.notifications.warn(`No more ${item.name} left, attack denied.`);
    return false;
  }

  await item.update({ "system.quantity": quantity - 1 });
  return true;
}

/**
 * Execute the native Foundry v14 automated attack flow for an already-resolved
 * attacker, defender, and equipped weapon Item.
 */
export async function performAutomatedAttack(attacker, defender, item) {
  if (!attacker?.actor || !defender?.actor || !item) return null;
  if (!attacker.isOwner) {
    ui.notifications.warn(`You do not have permissions to perform this operation on ${attacker.name}.`);
    return null;
  }
  if (!["weapongear", "missilegear"].includes(item.type)) return null;
  if (!item.system.isEquipped) {
    ui.notifications.warn(`${item.name} is not equipped.`);
    return null;
  }

  let distance = null;
  if (item.type === "weapongear") {
    const gridRange = measureRange(attacker, defender, true);
    if (gridRange > 1) {
      ui.notifications.warn(`Target ${defender.name} is outside of melee range for attacker ${attacker.name}; range=${gridRange}.`);
      return null;
    }
  } else {
    distance = measureRange(attacker, defender, false);
  }

  const result = await attackDialog(attacker, defender, item, distance);
  if (!result) return null;
  if (item.type === "missilegear" && !(await consumeMissile(item))) return null;
  return createAttackCard(attacker, defender, item, result, distance);
}
