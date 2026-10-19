/**
 * Resolve an Item by UUID or, when a name is supplied, from a specific Actor.
 *
 * This is a document-resolution helper only. It has no combat workflow or UI
 * responsibilities beyond reporting resolution problems to the user.
 *
 * @param {Item|string} itemRef Item document, UUID, or item name
 * @param {string} type Expected Item type
 * @param {Actor|null} actor Actor to search when itemRef is a name
 * @returns {Promise<Item|null>}
 */
export async function getItem(itemRef, type, actor) {
    if (!itemRef) {
        ui.notifications.warn("No item name was specified. You must specify an item name.");
        return null;
    }

    if (itemRef instanceof Item) {
        return itemRef;
    }

    let item = null;
    if (typeof itemRef === "string") {
        try {
            item = await fromUuid(itemRef);
        } catch (_error) {
            // A plain item name is expected to fail UUID resolution.
        }
    }

    if (!item) {
        if (!actor || typeof actor !== "object") {
            ui.notifications.warn("No actor was selected. You must select an actor.");
            return null;
        }

        const itemName = String(itemRef);
        const normalizedName = itemName.toLowerCase();
        const matches = actor.items.filter(candidate =>
            candidate.type === type && candidate.name.toLowerCase() === normalizedName
        );

        if (matches.length > 1) {
            ui.notifications.warn(
                `Your controlled Actor ${actor.name} has more than one ${type} with name ${itemName}. ` +
                `The first matched ${type} will be chosen.`
            );
        } else if (matches.length === 0) {
            ui.notifications.warn(`Your controlled Actor does not have a ${type} named ${itemName}`);
            return null;
        }
        item = matches[0];
    }

    if (!item) {
        ui.notifications.warn(`The item ${itemRef} was not found`);
        return null;
    }

    return item;
}
