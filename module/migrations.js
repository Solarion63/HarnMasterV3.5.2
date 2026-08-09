const {
  deepClone,
  expandObject,
  flattenObject,
  isObjectEmpty
} = foundry.utils;

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);

/**
 * Perform the HM3 world migration using Foundry v14 document APIs.
 *
 * The migration intentionally preserves the legacy HM3 transformations while
 * applying them to current Actor, Item, ActorDelta, and Compendium documents.
 * Every transformation is conditional so the migration is safe to rerun.
 */
export async function migrateWorld() {
  ui.notifications.info(
    `Applying HM3 System Migration for version ${game.system.version}. Please be patient and do not close your game or shut down your server.`,
    { permanent: true }
  );
  console.log("HM3 | Starting Migration");

  for (const actor of game.actors.contents) {
    await migrateDocument(actor, migrateActorData, "Actor");
  }

  for (const item of game.items.contents) {
    await migrateDocument(item, migrateItemData, "Item");
  }

  // In Foundry v14, unlinked Token overrides are ActorDelta documents. Updating
  // the synthetic Actor writes the resulting changes back to that Token's delta.
  for (const scene of game.scenes.contents) {
    for (const token of scene.tokens) {
      if (token.actorLink || !token.actor) continue;
      try {
        const updateData = migrateActorData(token.actor.toObject());
        if (!isObjectEmpty(updateData)) {
          console.log(`HM3 | Migrating unlinked Token ${token.name} in Scene ${scene.name}`);
          await token.actor.update(updateData, { enforceTypes: false });
        }
      } catch (error) {
        error.message = `Failed HM3 system migration for Token ${token.name} in Scene ${scene.name}: ${error.message}`;
        console.error(error);
      }
    }
  }

  console.log("HM3 | Migrating world Compendium Packs");
  for (const pack of game.packs) {
    if (pack.metadata.package !== "world") continue;
    if (!["Actor", "Item", "Scene"].includes(pack.documentName)) continue;

    try {
      console.log(`HM3 | Starting Migration for Pack ${pack.metadata.label}`);
      await migrateCompendium(pack);
    } catch (error) {
      error.message = `Failed HM3 migration for Compendium ${pack.metadata.label}: ${error.message}`;
      console.error(error);
    }
  }

  await game.settings.set("hm3", "systemMigrationVersion", game.system.version);
  console.log("HM3 | Migration Complete");
  ui.notifications.info(
    `HM3 System Migration to version ${game.system.version} completed!`,
    { permanent: true }
  );
}

async function migrateDocument(document, migration, label) {
  try {
    const updateData = migration(document.toObject());
    if (isObjectEmpty(updateData)) return;

    console.log(`HM3 | Migrating ${label} ${document.name}`);
    await document.update(updateData, { enforceTypes: false });
  } catch (error) {
    error.message = `Failed HM3 system migration for ${label} ${document.name}: ${error.message}`;
    console.error(error);
  }
}

/**
 * Apply HM3 migration rules to supported world Compendium documents.
 * Foundry's pack.migrate() first applies the current core/system data model;
 * HM3 then applies its historical field transformations.
 */
export async function migrateCompendium(pack) {
  if (!["Actor", "Item", "Scene"].includes(pack.documentName)) return;

  const wasLocked = pack.locked;
  await pack.configure({ locked: false });

  try {
    await pack.migrate({ notify: false });
    const documents = await pack.getDocuments();

    for (const document of documents) {
      try {
        if (document.documentName === "Actor") {
          await migrateDocument(document, migrateActorData, "Compendium Actor");
        } else if (document.documentName === "Item") {
          await migrateDocument(document, migrateItemData, "Compendium Item");
        } else if (document.documentName === "Scene") {
          for (const token of document.tokens) {
            if (token.actorLink || !token.actor) continue;
            const updateData = migrateActorData(token.actor.toObject());
            if (!isObjectEmpty(updateData)) {
              await token.actor.update(updateData, { enforceTypes: false });
            }
          }
        }
      } catch (error) {
        error.message = `Failed HM3 system migration for ${document.documentName} ${document.name} in pack ${pack.collection}: ${error.message}`;
        console.error(error);
      }
    }
  } finally {
    await pack.configure({ locked: wasLocked });
  }

  console.log(`HM3 | Migrated ${pack.documentName} documents in Compendium ${pack.collection}`);
}

/**
 * Produce an update object for one Actor or synthetic Actor.
 */
export function migrateActorData(actor) {
  const updateData = {};
  const actorData = actor?.system ?? {};
  const abilities = actorData.abilities ?? {};

  for (const ability of [
    "strength", "stamina", "dexterity", "agility", "intelligence", "aura",
    "will", "eyesight", "hearing", "smell", "voice", "morality"
  ]) {
    if (hasOwn(abilities[ability], "effective")) {
      updateData[`system.abilities.${ability}.-=effective`] = null;
    }
  }

  if (hasOwn(abilities, "comliness")) {
    updateData["system.abilities.comeliness.base"] = abilities.comliness?.base ?? 0;
    updateData["system.abilities.-=comliness"] = null;
  }

  for (const ability of ["endurance", "speed", "touch", "frame"]) {
    if (!hasOwn(abilities, ability)) continue;
    const value = abilities[ability]?.base;
    if (value) updateData[`flags.hm-gold.ability-${ability}`] = value;
    updateData[`system.abilities.-=${ability}`] = null;
  }

  for (const field of [
    "dodge", "initiative", "endurance", "universalPenalty", "physicalPenalty",
    "totalInjuryLevels", "hasCondition", "encumbrance", "totalWeight"
  ]) {
    if (hasOwn(actorData, field)) updateData[`system.-=${field}`] = null;
  }

  if (hasOwn(actorData.move, "effective")) {
    updateData["system.move.-=effective"] = null;
  }

  if (!hasOwn(actorData, "macros") || !hasOwn(actorData.macros, "type")) {
    updateData["system.macros.command"] = actorData.macros?.command ?? "";
    updateData["system.macros.type"] = "script";
  }

  migrateRemoveDeprecated(actor, updateData);

  const actorItems = Array.isArray(actor?.items) ? actor.items : [];
  const itemUpdates = actorItems.reduce((updates, item) => {
    const itemData = typeof item?.toObject === "function" ? item.toObject() : item;
    const itemUpdate = migrateItemData(itemData);
    if (isObjectEmpty(itemUpdate)) return updates;

    itemUpdate._id = itemData._id;
    updates.push(expandObject(itemUpdate));
    return updates;
  }, []);

  if (itemUpdates.length) updateData.items = itemUpdates;
  return updateData;
}

/**
 * Produce an update object for one Item.
 */
export function migrateItemData(item) {
  const updateData = {};
  const system = item?.system ?? {};

  if (!hasOwn(system.macros, "type")) {
    updateData["system.macros.command"] = system.macros?.command ?? "";
    updateData["system.macros.type"] = "script";
  }

  if (item?.type === "weapongear") {
    if (hasOwn(system, "squeeze")) {
      if (system.squeeze) updateData["flags.hm-gold.squeeze-impact"] = system.squeeze;
      updateData["system.-=squeeze"] = null;
    }
    if (hasOwn(system, "tear")) {
      if (system.tear) updateData["flags.hm-gold.tear-impact"] = system.tear;
      updateData["system.-=tear"] = null;
    }
  }

  if (item?.type === "missilegear") {
    const range = system.range ?? {};
    const impact = system.impact ?? {};

    for (const field of ["extreme64", "extreme128", "extreme256"]) {
      if (hasOwn(range, field)) updateData[`system.range.-=${field}`] = null;
    }

    if (hasOwn(impact, "extreme64")) {
      if (impact.extreme64) {
        updateData["flags.hm-gold.range4-impact"] = impact.short;
        updateData["flags.hm-gold.range8-impact"] = impact.medium;
        updateData["flags.hm-gold.range16-impact"] = impact.long;
        updateData["flags.hm-gold.range32-impact"] = impact.extreme;
        updateData["flags.hm-gold.range64-impact"] = impact.extreme64;
      }
      updateData["system.impact.-=extreme64"] = null;
    }

    for (const field of ["extreme128", "extreme256"]) {
      if (!hasOwn(impact, field)) continue;
      if (impact[field]) {
        const suffix = field.replace("extreme", "");
        updateData[`flags.hm-gold.range${suffix}-impact`] = impact[field];
      }
      updateData[`system.impact.-=${field}`] = null;
    }
  }

  if (item?.type === "armorgear") {
    const protection = system.protection ?? {};
    for (const field of ["squeeze", "tear"]) {
      if (!hasOwn(protection, field)) continue;
      if (protection[field]) updateData[`flags.hm-gold.${field}`] = protection[field];
      updateData[`system.protection.-=${field}`] = null;
    }
  }

  if (item?.type === "armorlocation") {
    for (const field of ["squeeze", "tear"]) {
      if (!hasOwn(system, field)) continue;
      if (system[field]) updateData[`flags.hm-gold.${field}`] = system[field];
      updateData[`system.-=${field}`] = null;
    }

    const probWeight = system.probWeight ?? {};
    if (hasOwn(probWeight, "arms")) {
      if (probWeight.arms) updateData["flags.hm-gold.probweight-arms"] = probWeight.arms;
      updateData["system.probWeight.-=arms"] = null;
    }
  }

  migrateRemoveDeprecated(item, updateData);
  return updateData;
}

/**
 * Retained helper for callers which need a serializable Scene update. Foundry
 * v14 uses token.delta rather than the legacy token.actorData structure.
 */
export function migrateSceneData(scene) {
  const tokens = (scene?.tokens ?? []).map(sourceToken => {
    const token = deepClone(
      typeof sourceToken?.toObject === "function" ? sourceToken.toObject() : sourceToken
    );

    if (token.actorLink || !token.delta) return token;

    const delta = token.delta;
    const actorLike = {
      system: delta.system ?? {},
      items: delta.items ?? [],
      flags: delta.flags ?? {}
    };
    const updateData = migrateActorData(actorLike);
    if (isObjectEmpty(updateData)) return token;

    // ActorDelta data can accept the same system update syntax when persisted as
    // a Document. For serialized Scene data, expand and merge the straightforward
    // field additions; deletion directives are left for the live ActorDelta path.
    const additions = Object.fromEntries(
      Object.entries(updateData).filter(([key]) => !key.includes(".-="))
    );
    foundry.utils.mergeObject(delta, expandObject(additions), { inplace: true });
    return token;
  });

  return { tokens };
}

/**
 * Remove fields explicitly marked by legacy `_deprecated: true` markers.
 */
function migrateRemoveDeprecated(entity, updateData) {
  const flat = flattenObject(entity ?? {});
  const deprecatedParents = Object.entries(flat)
    .filter(([key, value]) => key.endsWith("_deprecated") && value === true)
    .map(([key]) => key.split(".").slice(0, -1).join("."));

  for (const parent of deprecatedParents) {
    if (!parent.startsWith("system.")) continue;
    const parts = parent.split(".");
    parts[parts.length - 1] = `-=${parts.at(-1)}`;
    updateData[parts.join(".")] = null;
  }
}

/**
 * Purge non-HM3 flags from a Compendium while preserving its lock state.
 */
export async function purgeFlags(pack) {
  const cleanFlags = flags => flags?.hm3 ? { hm3: flags.hm3 } : {};
  const wasLocked = pack.locked;
  await pack.configure({ locked: false });

  try {
    const documents = await pack.getDocuments();
    for (const document of documents) {
      const update = { flags: cleanFlags(document.flags) };
      if (pack.documentName === "Actor") {
        update.items = document.items.map(item => {
          const source = item.toObject();
          source.flags = cleanFlags(source.flags);
          return source;
        });
      }
      await document.update(update, { recursive: false });
      console.log(`HM3 | Purged flags from ${document.name}`);
    }
  } finally {
    await pack.configure({ locked: wasLocked });
  }
}
