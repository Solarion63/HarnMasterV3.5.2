import { HarnMasterActor } from "./actor.js";
import * as macros from "../macros.js";

const { DialogV2 } = foundry.applications.api;

function itemFromControl(sheet, control) {
  const row = control.closest(".item");
  const itemId = row?.dataset.itemId;
  return itemId ? sheet.actor.items.get(itemId) : null;
}

async function rollSkill(sheet, event) {
  event.preventDefault();
  const item = itemFromControl(sheet, event.currentTarget);
  if (!item) {
    ui.notifications.warn("The selected Skill could not be found on this Actor.");
    return null;
  }

  const fastForward = event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
  return macros.skillRoll(item.uuid, fastForward, sheet.actor);
}

async function toggleImprove(sheet, event) {
  event.preventDefault();
  event.stopPropagation();

  const item = itemFromControl(sheet, event.currentTarget);
  if (!item || item.type !== "skill") return null;

  if (!item.system.improveFlag) {
    return item.update({ "system.improveFlag": true });
  }

  return DialogV2.wait({
    window: { title: "Skill Development Toggle" },
    content: "<p>Do you want to perform a Skill Development Roll (SDR), or just disable the flag?</p>",
    buttons: [
      {
        action: "roll",
        label: "Perform SDR",
        default: true,
        callback: () => HarnMasterActor.skillDevRoll(item)
      },
      {
        action: "disable",
        label: "Disable Flag",
        callback: () => item.update({ "system.improveFlag": false })
      }
    ],
    rejectClose: false
  });
}

/**
 * Bind Skill roll and development controls for a rendered Actor sheet.
 *
 * Skill-specific behavior remains here while the Actor sheet owns the render
 * lifecycle and explicitly invokes this controller.
 *
 * @param {object} sheet The ActorSheetV2 instance.
 * @param {HTMLElement} root The rendered sheet root.
 */
export function bindSkillControls(sheet, root) {
  if (!["character", "creature"].includes(sheet.actor.type)) return;

  for (const control of root.querySelectorAll(".skill-roll")) {
    control.addEventListener("click", event => {
      rollSkill(sheet, event).catch(error => {
        console.error("HM3 | Skill roll failed", error);
        ui.notifications.error("The Skill roll failed. See the console for details.");
      });
    });
  }

  if (!sheet.isEditable) return;

  for (const control of root.querySelectorAll(".item-improve")) {
    control.addEventListener("click", event => {
      toggleImprove(sheet, event).catch(error => {
        console.error("HM3 | Skill development action failed", error);
        ui.notifications.error("The Skill development action failed. See the console for details.");
      });
    });
  }
}
