import * as utility from "../utility.js";

const { DialogV2 } = foundry.applications.api;
const { HTMLProseMirrorElement } = foundry.applications.elements;
const { renderTemplate } = foundry.applications.handlebars;

const READ_ONLY_ACTION_SELECTOR = [
  ".skill-roll",
  ".spell-roll",
  ".invocation-roll",
  ".psionic-roll",
  ".ability-d6-roll",
  ".ability-d100-roll",
  ".weapon-damage-roll",
  ".missile-damage-roll",
  ".melee-weapon-attack",
  ".missile-weapon-attack",
  ".weapon-attack-roll",
  ".weapon-defend-roll",
  ".missile-attack-roll",
  ".injury-roll",
  ".healing-roll",
  ".dodge-roll",
  ".shock-roll",
  ".stumble-roll",
  ".fumble-roll",
  ".damage-roll",
  ".item-carry",
  ".item-equip",
  ".item-improve",
  ".item-dumpdesc",
  ".more-info"
].join(",");

function rootFromRender(sheet, html) {
  if (html instanceof HTMLElement) return html;
  if (html?.[0] instanceof HTMLElement) return html[0];
  return sheet.element ?? null;
}

function itemFromControl(sheet, control) {
  const row = control.closest(".item");
  const itemId = row?.dataset.itemId;
  return itemId ? sheet.actor.items.get(itemId) : null;
}

function fastForward(event) {
  return event.shiftKey || event.altKey || event.ctrlKey || event.metaKey;
}

function run(label, action) {
  Promise.resolve().then(action).catch(error => {
    console.error(`HM3 | ${label} failed`, error);
    ui.notifications.error(`${label} failed. See the console for details.`);
  });
}

function bindReadOnlyGuard(root) {
  root.addEventListener("click", event => {
    const control = event.target?.closest?.(READ_ONLY_ACTION_SELECTOR);
    if (!control || !root.contains(control)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, { capture: true });
}

function bindRoll(root, selector, label, macroName, sheet) {
  for (const control of root.querySelectorAll(selector)) {
    control.addEventListener("click", event => {
      event.preventDefault();
      const item = itemFromControl(sheet, control);
      if (!item) {
        ui.notifications.warn("The selected Item could not be found on this Actor.");
        return;
      }

      const macro = game.hm3?.macros?.[macroName];
      if (typeof macro !== "function") {
        ui.notifications.error(`${label} is unavailable.`);
        return;
      }

      run(label, () => macro(item.uuid, fastForward(event), sheet.actor));
    });
  }
}

function formatEsotericSubtitle(name, level) {
  const normalizedName = String(name ?? "").trim();
  const normalizedLevel = String(level ?? "").trim();
  if (!normalizedLevel) return normalizedName;

  const suffix = `(${normalizedLevel})`;
  return normalizedName.toLocaleLowerCase().endsWith(suffix.toLocaleLowerCase())
    ? normalizedName
    : `${normalizedName} ${suffix}`;
}

async function postEsotericDescription(sheet, control) {
  const item = itemFromControl(sheet, control);
  if (!item || !["spell", "invocation", "psionic"].includes(item.type)) return null;

  const data = item.system;
  const chatData = {
    desc: data.description,
    notes: data.notes || null,
    fatigue: item.type === "psionic" ? data.fatigue : null
  };

  let level;
  if (item.type === "spell") {
    level = utility.romanize(data.level);
    chatData.title = `${data.convocation} Spell`;
  } else if (item.type === "invocation") {
    level = utility.romanize(data.circle);
    chatData.title = `${data.diety ?? data.deity ?? ""} Invocation`;
  } else {
    level = `F${data.fatigue}`;
    chatData.title = "Psionic Talent";
  }

  chatData.subtitle = formatEsotericSubtitle(item.name, level);

  const content = await renderTemplate("systems/hm3/templates/chat/esoteric-desc-card.html", chatData);
  return ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor: sheet.actor }),
    content: content.trim(),
    style: CONST.CHAT_MESSAGE_STYLES.OTHER
  });
}

async function openHelp(control) {
  const journalEntry = control.dataset.journalEntry;
  if (!journalEntry) return null;

  const pack = game.packs.get("hm3.system-help")
    ?? game.packs.find(candidate => candidate.collection === "hm3.system-help");
  if (!pack) {
    ui.notifications.warn("The HarnMaster System Help compendium is unavailable.");
    return null;
  }

  const documents = await pack.getDocuments();
  const article = documents.find(document => document.name === journalEntry);
  if (!article) {
    console.error(`HM3 | Can't find journal entry with name "${journalEntry}".`);
    ui.notifications.warn(`Help article "${journalEntry}" could not be found.`);
    return null;
  }

  return article.sheet.render(true, { editable: false });
}

function bindRichTextEditors(sheet, root) {
  for (const legacyContent of root.querySelectorAll(".editor-content[data-edit]")) {
    const fieldPath = legacyContent.dataset.edit;
    if (!fieldPath) continue;

    const value = foundry.utils.getProperty(sheet.actor, fieldPath)
      ?? foundry.utils.getProperty(sheet.actor.toObject(false), fieldPath)
      ?? "";

    const editor = HTMLProseMirrorElement.create({
      name: fieldPath,
      value: String(value),
      readonly: false,
      disabled: false,
      collaborate: false,
      documentUUID: sheet.actor.uuid,
      toggled: false
    });

    legacyContent.replaceWith(editor);

    let lastSaved = String(value);
    const persist = async () => {
      const current = String(editor.value ?? "");
      if (current === lastSaved) return;
      await sheet.actor.update({ [fieldPath]: current });
      lastSaved = current;
    };

    editor.addEventListener("save", () => run("Save Actor rich text", persist));
    editor.addEventListener("change", () => run("Save Actor rich text", persist));
    editor.addEventListener("focusout", event => {
      if (editor.contains(event.relatedTarget)) return;
      run("Save Actor rich text", persist);
    });
  }
}

function bindActorInteractions(sheet, root) {
  // v13 only activated Actor-sheet action listeners on editable sheets. Several
  // v14 controllers bind independently during rendering, so explicitly block
  // those actions for Observer/Limited users to preserve the original model.
  if (!sheet.isEditable) {
    bindReadOnlyGuard(root);
    return;
  }

  bindRichTextEditors(sheet, root);
  bindRoll(root, ".spell-roll", "Spell roll", "castSpellRoll", sheet);
  bindRoll(root, ".invocation-roll", "Invocation roll", "invokeRitualRoll", sheet);
  bindRoll(root, ".psionic-roll", "Psionic roll", "usePsionicRoll", sheet);
  bindRoll(root, ".healing-roll", "Healing roll", "healingRoll", sheet);

  for (const control of root.querySelectorAll(".item-carry")) {
    control.addEventListener("click", event => {
      event.preventDefault();
      const item = itemFromControl(sheet, control);
      if (!item?.type?.endsWith("gear")) return;
      run("Carry toggle", () => item.update({ "system.isCarried": !item.system.isCarried }));
    });
  }

  for (const control of root.querySelectorAll(".item-equip")) {
    control.addEventListener("click", event => {
      event.preventDefault();
      const item = itemFromControl(sheet, control);
      if (!item?.type?.endsWith("gear")) return;
      run("Equip toggle", () => item.update({ "system.isEquipped": !item.system.isEquipped }));
    });
  }

  for (const control of root.querySelectorAll(".psionic .item-improve")) {
    control.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      const item = itemFromControl(sheet, control);
      if (!item || item.type !== "psionic") return;

      if (!item.system.improveFlag) {
        run("Psionic improvement toggle", () => item.update({ "system.improveFlag": true }));
        return;
      }

      run("Psionic improvement action", () => DialogV2.wait({
        window: { title: "Skill Development Toggle" },
        content: "<p>Do you want to perform a Skill Development Roll (SDR), or just disable the flag?</p>",
        buttons: [
          {
            action: "roll",
            label: "Perform SDR",
            default: true,
            callback: () => sheet.actor.constructor.skillDevRoll(item)
          },
          {
            action: "disable",
            label: "Disable Flag",
            callback: () => item.update({ "system.improveFlag": false })
          }
        ],
        rejectClose: false
      }));
    });
  }

  for (const control of root.querySelectorAll(".item-dumpdesc")) {
    control.addEventListener("click", event => {
      event.preventDefault();
      run("Post esoteric description", () => postEsotericDescription(sheet, control));
    });
  }

  for (const control of root.querySelectorAll(".more-info")) {
    control.addEventListener("click", event => {
      event.preventDefault();
      run("Open System Help", () => openHelp(control));
    });
  }
}

for (const hook of [
  "renderHarnMasterCharacterSheetV2",
  "renderHarnMasterCreatureSheetV2",
  "renderHarnMasterContainerSheetV2"
]) {
  Hooks.on(hook, (sheet, html) => {
    const root = rootFromRender(sheet, html);
    if (root) bindActorInteractions(sheet, root);
  });
}
