const { DialogV2 } = foundry.applications.api;
const { Macro } = foundry.documents;

function macroName(item, suffix) {
  return item.actor ? `${item.actor.name}'s ${item.name} ${suffix}` : `${item.name} ${suffix}`;
}

async function assignMacro(name, command, slot, img, flags = { "hm3.itemMacro": false }) {
  let macro = game.macros.find(existing => existing.name === name && existing.command === command);
  if (!macro) {
    macro = await Macro.create({
      name,
      type: "script",
      img,
      command,
      flags
    });
  }
  await game.user.assignHotbarMacro(macro, slot);
  return macro;
}

async function chooseWeaponMacro(item, slot) {
  const uuid = item.uuid;
  const choices = [
    {
      action: "automated",
      label: "Automated Combat",
      name: `${item.name} Automated Combat`,
      command: `await game.hm3.macros.weaponAttack("${uuid}");`
    },
    {
      action: "attack",
      label: "Attack",
      name: macroName(item, "Attack Roll"),
      command: `await game.hm3.macros.weaponAttackRoll("${uuid}");`
    },
    {
      action: "defend",
      label: "Defend",
      name: macroName(item, "Defend Roll"),
      command: `await game.hm3.macros.weaponDefendRoll("${uuid}");`
    },
    {
      action: "damage",
      label: "Damage",
      name: macroName(item, "Damage Roll"),
      command: `await game.hm3.macros.weaponDamageRoll("${uuid}");`
    }
  ];

  const buttons = choices.map(choice => ({
    action: choice.action,
    label: choice.label,
    callback: async () => assignMacro(choice.name, choice.command, slot, item.img)
  }));

  return DialogV2.wait({
    window: { title: "Select Weapon Macro" },
    content: "<p>Select the type of weapon macro to create:</p>",
    buttons,
    close: () => false
  });
}

async function chooseMissileMacro(item, slot) {
  const uuid = item.uuid;
  const choices = [
    {
      action: "automated",
      label: "Automated Combat",
      name: `${item.name} Automated Combat`,
      command: `await game.hm3.macros.missileAttack("${uuid}");`
    },
    {
      action: "attack",
      label: "Attack",
      name: macroName(item, "Attack Roll"),
      command: `await game.hm3.macros.missileAttackRoll("${uuid}");`
    },
    {
      action: "damage",
      label: "Damage",
      name: macroName(item, "Damage Roll"),
      command: `await game.hm3.macros.missileDamageRoll("${uuid}");`
    }
  ];

  const buttons = choices.map(choice => ({
    action: choice.action,
    label: choice.label,
    callback: async () => assignMacro(choice.name, choice.command, slot, item.img)
  }));

  return DialogV2.wait({
    window: { title: "Select Missile Macro" },
    content: "<p>Select the type of missile macro to create:</p>",
    buttons,
    close: () => false
  });
}

async function simpleItemMacro(item, slot) {
  let suffix;
  switch (item.type) {
    case "skill":
      suffix = `skillRoll("${item.uuid}");`;
      break;
    case "psionic":
      suffix = `usePsionicRoll("${item.uuid}");`;
      break;
    case "spell":
      suffix = `castSpellRoll("${item.uuid}");`;
      break;
    case "invocation":
      suffix = `invokeRitualRoll("${item.uuid}");`;
      break;
    case "injury":
      suffix = `healingRoll("${item.uuid}");`;
      break;
    default:
      return null;
  }

  const name = item.actor ? `${item.actor.name}'s ${item.name}` : item.name;
  return assignMacro(
    name,
    `await game.hm3.macros.${suffix}`,
    slot,
    item.img
  );
}

export async function createHM3Macro(data, slot) {
  if (data.type !== "Item") return true;

  const item = data.uuid ? await fromUuid(data.uuid) : null;
  if (!item?.system) {
    ui.notifications.warn("No macro exists for that type of object.");
    return false;
  }

  if (item.type === "weapongear") {
    await chooseWeaponMacro(item, slot);
    return false;
  }
  if (item.type === "missilegear") {
    await chooseMissileMacro(item, slot);
    return false;
  }

  await simpleItemMacro(item, slot);
  return false;
}

Hooks.once("init", () => {
  if (!game.hm3?.macros) return;
  game.hm3.macros = {
    ...game.hm3.macros,
    createHM3Macro
  };
});
