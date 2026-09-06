import { BloodlossService } from "./bloodloss-service.js";
import { bloodRegenerationReminderNeeded } from "./bloodloss-rules.js";

const REMINDER_FLAG = "bloodRegenerationReminderFor";
let reminderProcessing = Promise.resolve();

function activeGmOwnsProcessing() {
  if (!game.user?.isGM) return false;
  const activeGms = game.users
    ?.filter(user => user.active && user.isGM)
    ?.sort((left, right) => String(left.id).localeCompare(String(right.id))) ?? [];
  return activeGms[0]?.id === game.user.id;
}

function actorsForReminderProcessing() {
  const actors = new Map();
  for (const actor of game.actors ?? []) {
    if (actor?.uuid) actors.set(actor.uuid, actor);
  }

  for (const scene of game.scenes ?? []) {
    for (const token of scene.tokens ?? []) {
      const actor = token.actor;
      if (actor?.uuid) actors.set(actor.uuid, actor);
    }
  }

  return actors.values();
}

function whisperRecipients(actor) {
  const recipients = new Set();
  for (const user of game.users ?? []) {
    if (user.isGM || actor.testUserPermission?.(user, "OWNER")) {
      recipients.add(user.id);
    }
  }
  return Array.from(recipients);
}

async function removeEmptyBloodloss(actor, item) {
  if (!item) return false;
  const bloodloss = Math.max(0, Number(item.system.injuryLevel) || 0);
  if (bloodloss > 0) return false;
  await actor.deleteEmbeddedDocuments("Item", [item.id]);
  return true;
}

async function postReminder(actor, item, windowKey) {
  const recipients = whisperRecipients(actor);
  if (!recipients.length) return false;

  const bloodloss = Math.max(0, Number(item.system.injuryLevel) || 0);
  const target = 6 * Math.max(0, Number(actor.system.endurance) || 0);
  const content = `
    <div class="hm3 chat-card blood-regeneration-reminder-card">
      <header class="card-header flexrow"><h3>Blood Regeneration Available</h3></header>
      <div class="card-content">
        <p><strong>${actor.name}</strong> may now make a Blood Regeneration Healing Roll.</p>
        <div><strong>Bloodloss:</strong> ${bloodloss} BP</div>
        <div><strong>Target:</strong> H6 × Endurance = ${target}</div>
      </div>
    </div>
  `;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: recipients,
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.OTHER
  });
  await item.setFlag("hm3", REMINDER_FLAG, windowKey);
  return true;
}

async function processActor(actor, worldTime) {
  if (!["character", "creature"].includes(actor.type)) return;
  const item = BloodlossService.bloodlossItem(actor);
  if (!item) return;
  if (await removeEmptyBloodloss(actor, item)) return;

  const reminder = bloodRegenerationReminderNeeded({
    bloodloss: item.system.injuryLevel,
    availableAt: item.getFlag("hm3", "bloodRegenerationAvailableAt"),
    lastReminderFor: item.getFlag("hm3", REMINDER_FLAG),
    worldTime
  });
  if (!reminder.needed) return;

  await postReminder(actor, item, reminder.windowKey);
}

export class BloodRegenerationReminderService {
  static async process(worldTime = Number(game.time?.worldTime) || 0) {
    if (!game.settings.get("hm3", "bloodloss")) return;
    if (!activeGmOwnsProcessing()) return;

    for (const actor of actorsForReminderProcessing()) {
      try {
        await processActor(actor, worldTime);
      } catch (error) {
        console.error(`HM3 | Blood Regeneration reminder failed for ${actor.name}.`, error);
      }
    }
  }
}

function queueReminderProcessing(worldTime) {
  reminderProcessing = reminderProcessing
    .then(() => BloodRegenerationReminderService.process(worldTime))
    .catch(error => console.error("HM3 | Blood Regeneration reminder processing failed.", error));
}

Hooks.once("ready", () => queueReminderProcessing(Number(game.time?.worldTime) || 0));
Hooks.on("updateWorldTime", worldTime => queueReminderProcessing(worldTime));
