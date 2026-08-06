const { renderTemplate } = foundry.applications.handlebars;

const processingMessages = new Set();

function rootsFromRender(html) {
  if (!html) return [];
  if (html instanceof HTMLElement || html instanceof DocumentFragment) return [html];
  if (Array.isArray(html)) return html.filter(root => root?.querySelectorAll);
  if (typeof html.length === "number") return Array.from(html).filter(root => root?.querySelectorAll);
  return html.querySelectorAll ? [html] : [];
}

function findWeapon(actor, name) {
  if (!actor || !name) return null;
  return actor.items.find(item =>
    ["weapongear", "missilegear"].includes(item.type) && item.name === name
  ) ?? null;
}

async function createBreakCard({ token, weapon, roll, broke, title }) {
  const data = {
    title,
    tokenName: token.name,
    weaponName: weapon.name,
    weaponQuality: Number(weapon.system.weaponQuality) || 0,
    weaponBroke: broke,
    rollValue: roll.total,
    actorId: token.actor.id
  };
  const content = await renderTemplate("systems/hm3/templates/chat/weapon-break-card.html", data);
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ token: token.document }),
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.ROLL,
    sound: CONFIG.sounds.dice,
    rolls: [roll]
  });
}

async function resolveWeaponBreak(message, card) {
  const attacker = canvas.tokens.get(card.dataset.atkTokenId);
  const defender = canvas.tokens.get(card.dataset.defTokenId);
  if (!attacker || !defender) {
    throw new Error("HM3 | Weapon-break tokens could not be resolved on the active scene.");
  }

  const attackWeapon = findWeapon(attacker.actor, card.dataset.attackWeapon);
  const defendWeapon = findWeapon(defender.actor, card.dataset.defendWeapon);
  if (!attackWeapon || !defendWeapon) {
    throw new Error("HM3 | Weapon-break weapons could not be resolved from the Block result.");
  }

  const attackQuality = Number(attackWeapon.system.weaponQuality) || 0;
  const defendQuality = Number(defendWeapon.system.weaponQuality) || 0;
  const attackRoll = await new Roll("3d6").evaluate();
  const defendRoll = await new Roll("3d6").evaluate();

  let attackBroke = false;
  let defendBroke = false;
  if (attackQuality <= defendQuality) {
    attackBroke = attackRoll.total > attackQuality;
    defendBroke = !attackBroke && defendRoll.total > defendQuality;
  } else {
    defendBroke = defendRoll.total > defendQuality;
    attackBroke = !defendBroke && attackRoll.total > attackQuality;
  }

  const updates = [];
  if (attackBroke) updates.push(attackWeapon.update({ "system.isEquipped": false }));
  if (defendBroke) updates.push(defendWeapon.update({ "system.isEquipped": false }));
  await Promise.all(updates);

  await createBreakCard({
    token: attacker,
    weapon: attackWeapon,
    roll: attackRoll,
    broke: attackBroke,
    title: "Attack Weapon Break Check"
  });
  await createBreakCard({
    token: defender,
    weapon: defendWeapon,
    roll: defendRoll,
    broke: defendBroke,
    title: "Defend Weapon Break Check"
  });

  await message.setFlag("hm3", "weaponBreakResolved", {
    attackWeaponId: attackWeapon.id,
    defendWeaponId: defendWeapon.id,
    attackBroke,
    defendBroke
  });
}

function shouldResolve(message, card) {
  if (!game.settings.get("hm3", "weaponDamage")) return false;
  if (message.author?.id !== game.user.id) return false;
  if (message.getFlag("hm3", "weaponBreakResolved")) return false;
  if (!card.dataset.defense?.startsWith("Block w/ ")) return false;
  return card.dataset.resultDesc === "Attack blocked.";
}

Hooks.on("renderChatMessageHTML", (message, html) => {
  if (processingMessages.has(message.id)) return;

  for (const root of rootsFromRender(html)) {
    const card = root.matches?.(".hm3.chat-card") ? root : root.querySelector?.(".hm3.chat-card");
    if (!card || !shouldResolve(message, card)) continue;

    processingMessages.add(message.id);
    resolveWeaponBreak(message, card)
      .catch(async error => {
        console.error("HM3 | Weapon-break resolution failed", error);
        ui.notifications.error("Weapon-break check failed. See the console for details.");
        try {
          await message.unsetFlag("hm3", "weaponBreakResolved");
        } catch (_flagError) {
          // The local processing guard still prevents duplicate execution this render cycle.
        }
      })
      .finally(() => processingMessages.delete(message.id));
    break;
  }
});
