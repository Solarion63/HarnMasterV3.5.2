const { DialogV2 } = foundry.applications.api;
const { renderTemplate } = foundry.applications.handlebars;
const { ActiveEffect } = foundry.documents;

/**
 * Manage Active Effect instances through Actor and Item sheet controls.
 *
 * Expiration itself is handled by Foundry v14's ActiveEffect registry. HM3
 * configures the registry to delete expired effects rather than duplicating
 * core expiry processing with system hooks.
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
                            origin: owner.uuid,
                            duration: {
                                value: null,
                                units: "rounds",
                                expiry: null,
                                expired: false
                            }
                        };

                        if (startType === "nowGameTime") {
                            effectData.start = ActiveEffect.getEffectStart(null);
                            effectData.duration.value = 1;
                            effectData.duration.units = "seconds";
                        } else if (startType === "nowCombat") {
                            effectData.start = ActiveEffect.getEffectStart(game.combat);
                            effectData.duration.value = 1;
                            effectData.duration.units = "rounds";
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

            if (effect.disabled) {
                return effect.update({
                    disabled: false,
                    start: ActiveEffect.getEffectStart(game.combat ?? null),
                    "duration.expired": false
                });
            }
            return effect.update({ disabled: true });
        }
    }
}
