// Import Modules
import { HarnMasterActor } from "./actor/actor.js";
import { HarnMasterCharacterSheet } from "./actor/character-sheet.js";
import { HarnMasterCreatureSheet } from "./actor/creature-sheet.js";
import { HarnMasterContainerSheet } from "./actor/container-sheet.js";
import { HarnMasterCombat } from "./hm3-combat.js";
import { HarnMasterItem } from "./item/item.js";
import { HM3_ITEM_SHEETS_V2 } from "./item/item-sheet-v2.js";
import { HM3ActiveEffectConfig } from "./hm3-active-effect-config.js";
import { HM3 } from "./config.js";
import { registerSystemSettings } from "./settings.js";
import * as migrations from "./migrations.js";
import * as macros from "./macros.js";
import * as combat from "./combat.js";
import * as effect from "./effect.js";
import { DiceHM3 } from "./dice-hm3.js";

const { renderTemplate } = foundry.applications.handlebars;
const { DocumentSheetConfig } = foundry.applications.apps;
const { ActiveEffectConfig, ItemSheetV2 } = foundry.applications.sheets;
const { ActorSheet } = foundry.appv1.sheets;
const { FormDataExtended } = foundry.applications.ux;
const { Actors } = foundry.documents.collections;
const { ActiveEffect, Item } = foundry.documents;

Hooks.once("init", async function () {
    console.log(`HM3 | Initializing the HM3 Game System\n${HM3.ASCII}`);

    game.hm3 = {
        HarnMasterActor,
        HarnMasterItem,
        DiceHM3,
        config: HM3,
        macros,
        migrations
    };

    CONFIG.Combat.initiative = {
        formula: "@initiative",
        decimals: 2
    };

    CONFIG.time.roundTime = 10;
    CONFIG.time.turnTime = 0;
    CONFIG.HM3 = HM3;

    registerSystemSettings();

    CONFIG.Actor.documentClass = HarnMasterActor;
    CONFIG.Actor.typeLabels = {
        base: "Base",
        character: "Character",
        creature: "Creature",
        container: "Container"
    };

    CONFIG.Item.documentClass = HarnMasterItem;
    CONFIG.Item.typeLabels = {
        base: "Base",
        skill: "Skill",
        spell: "Spell",
        invocation: "Invocation",
        psionic: "Psionic",
        weapongear: "Melee Weapon",
        containergear: "Container",
        missilegear: "Missile Weapon",
        armorgear: "Armor",
        miscgear: "Misc. Gear",
        injury: "Injury",
        armorlocation: "Armor Location",
        trait: "Trait"
    };

    CONFIG.Combat.documentClass = HarnMasterCombat;

    // Actor sheets remain on ApplicationV1 temporarily while their larger
    // interaction surface is migrated and regression-tested.
    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("hm3", HarnMasterCharacterSheet, {
        types: ["character"],
        makeDefault: true,
        label: "Default HarnMaster Character Sheet"
    });
    Actors.registerSheet("hm3", HarnMasterCreatureSheet, {
        types: ["creature"],
        makeDefault: true,
        label: "Default HarnMaster Creature Sheet"
    });
    Actors.registerSheet("hm3", HarnMasterContainerSheet, {
        types: ["container"],
        makeDefault: true,
        label: "Default HarnMaster Container Sheet"
    });

    DocumentSheetConfig.unregisterSheet(ActiveEffect, "core", ActiveEffectConfig);
    DocumentSheetConfig.registerSheet(ActiveEffect, "hm3", HM3ActiveEffectConfig, {
        makeDefault: true,
        label: "Default HarnMaster Active Effect Sheet"
    });

    // Register one ApplicationV2 sheet class per Item subtype. Each class uses
    // the existing subtype-specific Handlebars template.
    DocumentSheetConfig.unregisterSheet(Item, "core", ItemSheetV2);
    for (const [type, SheetClass] of Object.entries(HM3_ITEM_SHEETS_V2)) {
        DocumentSheetConfig.registerSheet(Item, "hm3", SheetClass, {
            types: [type],
            makeDefault: true,
            label: `HarnMaster ${CONFIG.Item.typeLabels[type] ?? type} Item Sheet`
        });
    }

    Handlebars.registerHelper("concat", function () {
        let output = "";
        for (const argument of arguments) {
            if (typeof argument !== "object") output += argument;
        }
        return output;
    });

    Handlebars.registerHelper("toLowerCase", value => value.toLowerCase());

    // Foundry v14 uses fontDefinitions for both canvas and editor fonts.
    Object.assign(CONFIG.fontDefinitions, {
        Lakise: {
            editor: true,
            fonts: [{ urls: ["./systems/hm3/fonts/Harn-Lakise-Normal.otf"] }]
        },
        Runic: {
            editor: true,
            fonts: [{ urls: ["./systems/hm3/fonts/Harn-Runic-Normal.otf"] }]
        },
        "Lankorian Blackhand": {
            editor: true,
            fonts: [{ urls: ["./systems/hm3/fonts/Lankorian-Blackhand.otf"] }]
        }
    });
});

function bindHm3ChatButtons(message, html, context) {
    combat.displayChatActionButtons(message, html, context);

    const buttons = html.querySelectorAll(".hm3.chat-card .card-buttons button");
    for (const button of buttons) {
        if (button.dataset.hm3Bound === "1") continue;

        button.addEventListener("click", event => {
            HarnMasterActor._onChatCardAction({
                preventDefault: () => event.preventDefault(),
                currentTarget: event.currentTarget,
                target: event.target
            });
        });

        button.dataset.hm3Bound = "1";
    }
}

Hooks.on("renderChatMessageHTML", bindHm3ChatButtons);

Hooks.on("updateWorldTime", async () => {
    await effect.checkExpiredActiveEffects();
});

Hooks.on("updateCombat", async () => {
    await effect.checkExpiredActiveEffects();
});

Hooks.once("ready", async function () {
    const currentMigrationVersion = game.settings.get("hm3", "systemMigrationVersion");
    const needsMigrationVersion = "1.2.19";

    if (currentMigrationVersion) {
        const needsMigration = foundry.utils.isNewerVersion(
            needsMigrationVersion,
            currentMigrationVersion
        );

        if (needsMigration && game.user.isGM) {
            await migrations.migrateWorld();
        }
    } else {
        await game.settings.set("hm3", "systemMigrationVersion", game.system.version);
    }

    Hooks.on("hotbarDrop", (bar, data, slot) => macros.createHM3Macro(data, slot));
    HM3.ready = true;

    if (game.settings.get("hm3", "showWelcomeDialog")) {
        const showAgain = await welcomeDialog();
        await game.settings.set("hm3", "showWelcomeDialog", showAgain);
    }

    if (!game.user.can("MACRO_SCRIPT")) {
        ui.notifications.warn(
            "You do not have permission to run JavaScript macros, so all skill and esoterics macros have been disabled."
        );
    }
});

// HM3 does not roll initiative. Seed the combatant from the Actor value.
Hooks.on("preCreateCombatant", combatant => {
    if (combatant.initiative != null) return;

    const token = canvas.tokens.get(combatant.tokenId);
    if (token?.actor) {
        combatant.updateSource({ initiative: token.actor.system.initiative });
    }
});

Hooks.on("renderSceneConfig", async (app, html) => {
    const scene = app.document ?? app.object;
    if (app.renderTOTMScene) return;
    app.renderTOTMScene = true;

    let isTotm = scene.getFlag("hm3", "isTotm");
    if (typeof isTotm === "undefined") {
        if (!scene.compendium) await scene.setFlag("hm3", "isTotm", false);
        isTotm = false;
    }

    const root = html instanceof HTMLElement ? html : html?.[0];
    const gridInput = root?.querySelector("input[name='gridAlpha']");
    const formGroup = gridInput?.closest(".form-group");

    if (!formGroup || root.querySelector("#hm3-totm")) return;

    formGroup.insertAdjacentHTML(
        "afterend",
        `<div class="form-group">
            <label>Theatre of the Mind</label>
            <input id="hm3-totm" type="checkbox" name="hm3Totm" data-dtype="Boolean" ${isTotm ? "checked" : ""}>
            <p class="notes">Configure scene for Theatre of the Mind (for example, disable range calculations).</p>
        </div>`
    );
});

Hooks.on("closeSceneConfig", async (app, html) => {
    const scene = app.document ?? app.object;
    app.renderTOTMScene = false;

    if (scene.compendium) return;

    const root = html instanceof HTMLElement ? html : html?.[0];
    const checkbox = root?.querySelector("input[name='hm3Totm']");
    await scene.setFlag("hm3", "isTotm", Boolean(checkbox?.checked));
});

async function welcomeDialog() {
    const content = await renderTemplate("systems/hm3/templates/dialog/welcome.html", {});

    return foundry.appv1.api.Dialog.prompt({
        title: "Welcome!",
        content,
        label: "OK",
        callback: html => {
            const root = html instanceof HTMLElement ? html : html?.[0];
            const form = root.querySelector("#welcome");
            return new FormDataExtended(form).object.showOnStartup;
        },
        options: { jQuery: false }
    });
}

Handlebars.registerHelper("multiply", (left, right) => left * right);
Handlebars.registerHelper("endswith", (value, suffix) => value.endsWith(suffix));
