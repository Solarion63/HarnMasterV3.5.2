const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

function rootsFromRender(html) {
  if (!html) return [];
  if (html instanceof HTMLElement || html instanceof DocumentFragment) return [html];
  if (Array.isArray(html)) return html.filter(root => root?.querySelectorAll);
  if (typeof html.length === "number") return Array.from(html).filter(root => root?.querySelectorAll);
  return html.querySelectorAll ? [html] : [];
}

function tokenFromId(id, role) {
  const token = id ? canvas.tokens.get(id) : null;
  if (!token) ui.notifications.warn(`${role} token could not be found on the active scene.`);
  return token;
}

function measureMeleeRange(attacker, defender) {
  if (canvas.scene?.getFlag("hm3", "isTotm")) return 0;
  const measurement = canvas.grid.measurePath([
    { x: attacker.center.x, y: attacker.center.y },
    { x: defender.center.x, y: defender.center.y }
  ]);
  return measurement.spaces ?? Math.round(measurement.distance / canvas.dimensions.distance);
}

function weaponAspects(item) {
  const aspects = {};
  if (Number(item.system.blunt) >= 0) aspects.Blunt = Number(item.system.blunt);
  if (Number(item.system.edged) >= 0) aspects.Edged = Number(item.system.edged);
  if (Number(item.system.piercing) >= 0) aspects.Piercing = Number(item.system.piercing);
  const defaultAspect = Object.entries(aspects)
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
  return { aspects, defaultAspect };
}

function defaultWeapon(weapons) {
  return weapons.reduce((best, item) =>
    !best || Number(item.system.attackMasteryLevel) > Number(best.system.attackMasteryLevel)
      ? item
      : best, null);
}

async function selectWeapon(attacker) {
  const weapons = attacker.actor.itemTypes.weapongear.filter(item => item.system.isEquipped);
  if (!weapons.length) {
    ui.notifications.warn(`${attacker.name} has no equipped melee weapons. DTA attack refused.`);
    return null;
  }

  const preferred = defaultWeapon(weapons);
  const content = await renderTemplate("systems/hm3/templates/dialog/query-weapon-dialog.html", {
    prompt: "Choose the equipped melee weapon to use for the tactical advantage attack.",
    weapons: weapons.map(item => item.name),
    defaultWeapon: preferred?.name
  });

  return DialogV2.prompt({
    window: { title: `${attacker.name} Select DTA Weapon` },
    content: content.trim(),
    ok: {
      label: "Continue",
      callback: (_event, _button, dialog) => {
        const form = dialog.element?.querySelector("form");
        if (!form) throw new Error("HM3 | DTA weapon form was not found.");
        return weapons.find(item => item.name === form.elements.weapon?.value) ?? null;
      }
    },
    rejectClose: false
  });
}

async function configureAttack(attacker, defender, weapon) {
  const aspectData = weaponAspects(weapon);
  if (!aspectData.defaultAspect) {
    ui.notifications.warn(`${weapon.name} has no available damage aspect.`);
    return null;
  }

  const dialogData = {
    title: `${attacker.name} DTA Attack vs. ${defender.name} with ${weapon.name}`,
    weapon: weapon.name,
    aimLocations: ["Low", "Mid", "High"],
    defaultAim: "Mid",
    defaultModifier: 0,
    ...aspectData
  };
  const content = await renderTemplate("systems/hm3/templates/dialog/attack-dialog.html", dialogData);

  return DialogV2.prompt({
    window: { title: dialogData.title },
    content: content.trim(),
    ok: {
      label: "Attack",
      callback: (_event, _button, dialog) => {
        const form = dialog.element?.querySelector("form");
        if (!form) throw new Error("HM3 | DTA attack form was not found.");
        const aspect = form.elements.weaponAspect?.value ?? dialogData.defaultAspect;
        return {
          aim: form.elements.aim?.value ?? "Mid",
          aspect,
          addlModifier: Number(form.elements.addlModifier?.value) || 0,
          impactMod: Number(dialogData.aspects[aspect]) || 0
        };
      }
    },
    rejectClose: false
  });
}

async function createAttackCard(attacker, defender, weapon, attack) {
  const effectiveAML = Number(weapon.system.attackMasteryLevel) + attack.addlModifier;
  const data = {
    title: `${weapon.name} DTA Melee Attack`,
    notes: "Tactical Advantage Attack",
    attacker: attacker.name,
    atkTokenId: attacker.id,
    defender: defender.name,
    defTokenId: defender.id,
    weaponType: "melee",
    weaponName: weapon.name,
    aim: attack.aim,
    aspect: attack.aspect,
    addlModifierAbs: Math.abs(attack.addlModifier),
    addlModifierSign: attack.addlModifier < 0 ? "-" : "+",
    origAML: weapon.system.attackMasteryLevel,
    effAML: effectiveAML,
    impactMod: attack.impactMod,
    hasDodge: true,
    hasBlock: true,
    hasCounterstrike: true,
    hasIgnore: true,
    visibleActorId: defender.actor.id
  };

  const content = await renderTemplate("systems/hm3/templates/chat/attack-card.html", data);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ token: attacker.document }),
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.OTHER
  });
  return data;
}

async function performDtaAttack(button) {
  const attacker = tokenFromId(button.dataset.atkTokenId, "DTA attacker");
  const defender = tokenFromId(button.dataset.defTokenId, "DTA defender");
  if (!attacker || !defender) return null;
  if (!attacker.isOwner) {
    ui.notifications.warn(`You do not have permission to initiate a DTA attack for ${attacker.name}.`);
    return null;
  }

  const range = measureMeleeRange(attacker, defender);
  if (range > 1) {
    ui.notifications.warn(`Target ${defender.name} is outside melee range for ${attacker.name}; range=${range}.`);
    return null;
  }

  const weapon = await selectWeapon(attacker);
  if (!weapon) return null;
  const attack = await configureAttack(attacker, defender, weapon);
  if (!attack) return null;
  return createAttackCard(attacker, defender, weapon, attack);
}

function bindDtaButton(button) {
  if (button.dataset.hm3V14DtaBound === "1") return;

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;
    performDtaAttack(button)
      .catch(error => {
        console.error("HM3 | DTA attack failed", error);
        ui.notifications.error("DTA attack failed. See the console for details.");
      })
      .finally(() => {
        button.disabled = false;
      });
  });

  button.dataset.hm3V14DtaBound = "1";
}

Hooks.on("renderChatMessageHTML", (_message, html) => {
  for (const root of rootsFromRender(html)) {
    for (const button of root.querySelectorAll('.hm3.chat-card button[data-action="dta-attack"]')) {
      bindDtaButton(button);
    }
  }
});
