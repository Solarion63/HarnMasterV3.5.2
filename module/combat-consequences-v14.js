import * as macros from "./macros.js";
import { shockRoll } from "./shock-workflow-v14.js";

function rootsFromRender(html) {
  if (!html) return [];
  if (html instanceof HTMLElement || html instanceof DocumentFragment) return [html];
  if (Array.isArray(html)) return html.filter(root => root?.querySelectorAll);
  if (typeof html.length === "number") return Array.from(html).filter(root => root?.querySelectorAll);
  return html.querySelectorAll ? [html] : [];
}

function resolveActor(button) {
  if (button.dataset.actorUuid) {
    const actor = fromUuidSync(button.dataset.actorUuid);
    if (!actor) {
      ui.notifications.warn("The actor for this Shock recovery could not be found.");
      return null;
    }
    return actor;
  }

  if (button.dataset.tokenId) {
    const token = canvas.tokens.get(button.dataset.tokenId);
    if (!token) {
      ui.notifications.warn("The token for this combat consequence could not be found on the active scene.");
      return null;
    }
    return token.actor;
  }

  if (button.dataset.actorId) {
    const actor = game.actors.get(button.dataset.actorId);
    if (!actor) {
      ui.notifications.warn("The actor for this combat consequence could not be found.");
      return null;
    }
    return actor;
  }

  ui.notifications.warn("No actor or token was recorded for this combat consequence.");
  return null;
}

async function performConsequence(button) {
  const actor = resolveActor(button);
  if (!actor) return null;
  if (!actor.isOwner) {
    ui.notifications.warn(`You do not have permission to roll this consequence for ${actor.name}.`);
    return null;
  }

  switch (button.dataset.action) {
    case "shock":
    case "shock-recovery":
      return shockRoll(false, actor);
    case "stumble":
      return macros.stumbleRoll(false, actor);
    case "fumble":
      return macros.fumbleRoll(false, actor);
    default:
      return null;
  }
}

function bindConsequenceButton(button) {
  if (button.dataset.hm3V14ConsequenceBound === "1") return;

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopImmediatePropagation();
    button.disabled = true;

    const label = button.dataset.action
      .split("-")
      .map(part => part[0].toUpperCase() + part.slice(1))
      .join(" ");
    performConsequence(button)
      .catch(error => {
        console.error(`HM3 | ${label} consequence failed`, error);
        ui.notifications.error(`${label} roll failed. See the console for details.`);
      })
      .finally(() => {
        button.disabled = false;
      });
  });

  button.dataset.hm3V14ConsequenceBound = "1";
}

Hooks.on("renderChatMessageHTML", (_message, html) => {
  for (const root of rootsFromRender(html)) {
    for (const button of root.querySelectorAll(
      '.hm3.chat-card button[data-action="shock"], .hm3.chat-card button[data-action="shock-recovery"], .hm3.chat-card button[data-action="stumble"], .hm3.chat-card button[data-action="fumble"]'
    )) {
      bindConsequenceButton(button);
    }
  }
});
