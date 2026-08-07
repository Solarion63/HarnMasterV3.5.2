const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * Manage Active Effect instances through Actor and Item sheet controls.
 *
 * @param {MouseEvent} event The left-click event on the effect control.
 * @param {Actor|Item} owner The owning document which manages this effect.
 */
export async function onManageActiveEffect(event, owner) {
    event.preventDefault();
    const control = event.currentTarget;
    const row = control.closest("li");
    const effectId = row?.dataset.effectId;
    const effect = effectId ? owner.effects.get(effectId) : null;

    switch (control.dataset.action) {
        case "create": {
            const dialogData = {
                gameTime: game.time.worldTime
            };
            if (game.combat) {
                dialogData.combatId = game.combat.id;
                dialogData.combatRound = game.combat.round;
                dialogData.combatTurn = game.combat.turn;
            }

            const content = await renderTemplate(
                "systems/hm3/templates/dialog/active-effect-start.html",
                dialogData
            );

            return DialogV2.prompt({
                window: { title: "Select Start Time" },
                content,
                ok: {
                    label: "OK",
                    callback: async (_event, _button, dialog) => {
                        const startType = dialog.element
                            ?.querySelector('[name="startType"]:checked')
                            ?.value ?? "unspecified";

                        const effectData = {
                            name: "New Effect",
                            img: "icons/svg/aura.svg",
                            origin: owner.uuid
                        };

                        if (startType === "nowGameTime") {
                            effectData["duration.startTime"] = dialogData.gameTime;
                            effectData["duration.seconds"] = 1;
                        } else if (startType === "nowCombat") {
                            effectData["duration.combat"] = dialogData.combatId;
                            effectData["duration.startRound"] = dialogData.combatRound;
                            effectData["duration.startTurn"] = dialogData.combatTurn;
                            effectData["duration.rounds"] = 1;
                            effectData["duration.turns"] = 0;
                        }

                        const created = await owner.createEmbeddedDocuments(
                            "ActiveEffect",
                            [effectData]
                        );
                        return created[0] ?? null;
                    }
                },
                rejectClose: false
            });
        }

        case "edit":
            return effect?.sheet.render(true);

        case "delete":
            return effect?.delete();

        case "toggle": {
            if (!effect) return null;

            const updateData = {};
            if (effect.disabled) {
                updateData.disabled = false;
                updateData["duration.startTime"] = game.time.worldTime;
                if (game.combat) {
                    updateData["duration.startRound"] = game.combat.round;
                    updateData["duration.startTurn"] = game.combat.turn;
                }
            } else {
                updateData.disabled = true;
            }
            return effect.update(updateData);
        }
    }
}

/**
 * Search all Actors and unlinked Tokens owned by the user and disable Active
 * Effects whose duration has expired.
 */
export async function checkExpiredActiveEffects() {
    for (const actor of game.actors.values()) {
        if (actor.isOwner && actor.effects?.size) {
            await disableExpiredAE(actor);
        }
    }

    for (const token of canvas.tokens.ownedTokens.values()) {
        if (!token.document.actorLink && token.actor?.effects?.size) {
            await disableExpiredAE(token.actor);
        }
    }
}

/**
 * Disable expired Active Effects for a single Actor.
 *
 * @param {Actor} actor
 */
async function disableExpiredAE(actor) {
    for (const effect of actor.effects.values()) {
        if (effect.disabled) continue;

        const duration = effect.duration;
        if (duration.units !== "none" && duration.remaining <= 0) {
            await effect.update({ disabled: true });
        }
    }
}
