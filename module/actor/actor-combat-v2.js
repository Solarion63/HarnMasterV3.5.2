import * as macros from "../macros.js";

const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

function itemFromControl(sheet, control) {
  const row = control.closest(".item");
  const itemId = row?.dataset.itemId;
  return itemId ? sheet.actor.items.get(itemId) : null;
}

function fastForward(event) {
  return event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
}

function runAction(label, action) {
  Promise.resolve().then(action).catch(error => {
    console.error(`HM3 | ${label} failed`, error);
    ui.notifications.error(`${label} failed. See the console for details.`);
  });
}

function bind(root, selector, label, callback) {
  for (const control of root.querySelectorAll(selector)) {
    control.addEventListener("click", event => {
      event.preventDefault();
      runAction(label, () => callback(event, control));
    });
  }
}

function getSheetToken(sheet) {
  if (sheet.actor.token) return sheet.actor.token;
  const tokens = sheet.actor.getActiveTokens(true);
  if (tokens.length === 0) {
    ui.notifications.warn("There are no tokens linked to this actor on the canvas, double-click on a specific token on the canvas.");
    return null;
  }
  if (tokens.length > 1) {
    ui.notifications.warn(`There are ${tokens.length} tokens linked to this actor on the canvas, so the acting token can't be identified.`);
    return null;
  }
  return tokens[0];
}

function getSingleTarget() {
  const targets = Array.from(game.user.targets ?? []);
  if (targets.length !== 1) {
    ui.notifications.warn("No targets selected, you must select exactly one target, combat aborted.");
    return null;
  }
  return targets[0];
}

function measureRange(sourceToken, targetToken, gridUnits = false) {
  if (canvas.scene?.getFlag("hm3", "isTotm")) return 0;

  const measurement = canvas.grid.measurePath([
    { x: sourceToken.center.x, y: sourceToken.center.y },
    { x: targetToken.center.x, y: targetToken.center.y }
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
        const result = {
          weapon: item,
          aspect: root?.querySelector('[name="weaponAspect"]')?.value ?? null,
          aim: root?.querySelector('[name="aim"]')?.value ?? null,
          addlModifier: Number(root?.querySelector('[name="addlModifier"]')?.value) || 0,
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
 * Execute the native v14 automated attack flow for an already-resolved token pair
 * and owned weapon Item. This is shared by Actor-sheet controls and the public
 * macro API so legacy world macros retain their existing command surface.
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

async function automatedAttack(sheet, control, expectedType) {
  const attacker = getSheetToken(sheet);
  const defender = getSingleTarget();
  const item = itemFromControl(sheet, control);
  if (!attacker || !defender || !item || item.type !== expectedType) return null;
  return performAutomatedAttack(attacker, defender, item);
}

function bindCombatControls(sheet, root) {
  bind(root, ".dodge-roll", "Dodge roll", event => macros.dodgeRoll(fastForward(event), sheet.actor));
  bind(root, ".shock-roll", "Shock roll", event => macros.shockRoll(fastForward(event), sheet.actor));
  bind(root, ".stumble-roll", "Stumble roll", event => macros.stumbleRoll(fastForward(event), sheet.actor));
  bind(root, ".fumble-roll", "Fumble roll", event => macros.fumbleRoll(fastForward(event), sheet.actor));
  bind(root, ".damage-roll", "Generic damage roll", () => macros.genericDamageRoll(sheet.actor));

  bind(root, ".melee-weapon-attack", "Melee combat", (_event, control) =>
    automatedAttack(sheet, control, "weapongear"));
  bind(root, ".missile-weapon-attack", "Missile combat", (_event, control) =>
    automatedAttack(sheet, control, "missilegear"));

  bind(root, ".weapon-attack-roll", "Weapon attack roll", (event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.weaponAttackRoll(item?.uuid, fastForward(event), sheet.actor);
  });
  bind(root, ".weapon-defend-roll", "Weapon defense roll", (event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.weaponDefendRoll(item?.uuid, fastForward(event), sheet.actor);
  });
  bind(root, ".weapon-damage-roll", "Weapon damage roll", (_event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.weaponDamageRoll(item?.uuid, control.dataset.aspect, sheet.actor);
  });
  bind(root, ".missile-attack-roll", "Missile attack roll", (_event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.missileAttackRoll(item?.uuid, sheet.actor);
  });
  bind(root, ".missile-damage-roll", "Missile damage roll", (_event, control) => {
    const item = itemFromControl(sheet, control);
    return macros.missileDamageRoll(item?.uuid, control.dataset.range, sheet.actor);
  });
}

for (const hook of ["renderHarnMasterCharacterSheetV2", "renderHarnMasterCreatureSheetV2"]) {
  Hooks.on(hook, (sheet, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0] ?? sheet.element;
    if (root) bindCombatControls(sheet, root);
  });
}
