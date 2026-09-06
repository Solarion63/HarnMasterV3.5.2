import {
  legacyDataOperatorPaths,
  modernizeLegacyDataOperators
} from "./migration-rules.js";

const {
  deepClone,
  expandObject,
  flattenObject,
  isEmpty
} = foundry.utils;

const { ForcedDeletion, ForcedReplacement } = foundry.data.operators;
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object ?? {}, key);

/**
 * Mark one document field for deletion using Foundry v14's native data-field
 * operator instead of the deprecated "-=field" update-key syntax.
 */
function deleteField(updateData, path) {
  updateData[path] = new ForcedDeletion();
}

/**
 * Replace legacy data-operator property names within one ActorDelta before any
 * base Actor update can cause Foundry to apply that delta to its synthetic
 * Actor. This is important because Actor updates automatically propagate to
 * dependent unlinked Tokens.
 */
async function migrateActorDeltaOperators(token, label, failures = []) {
  const delta = token?.delta;
  if (!delta) return true;

  const source = delta.toObject();
  const legacyPaths = legacyDataOperatorPaths(source);
  if (!legacyPaths.length) return true;

  try {
    const modernized = modernizeLegacyDataOperators(source, {
      deletion: () => new ForcedDeletion(),
      replacement: value => ForcedReplacement.create(value)
    });

    console.log(
      `HM3 | Modernizing ${legacyPaths.length} legacy ActorDelta data operator(s) for ${label}`,
      legacyPaths
    );

    // Replace the complete ActorDelta instead of recursively merging it. A
    // recursive merge would leave the old "-=field" property beside the new
    // v14 operator and the next synthetic-Actor refresh would warn again.
    await token.update({
      delta: ForcedReplacement.create(modernized)
    });
    return true;
  } catch (error) {
    recordFailure(failures, error, `${label} ActorDelta`);
    return false;
  }
}

/**
 * Normalize all world-scene ActorDeltas before migrating world Actors.
 *
 * Base Actor updates refresh dependent unlinked Tokens synchronously. Therefore
 * stale ActorDelta operator keys must be modernized first or Foundry v14 emits
 * the legacy forced-deletion compatibility warning during Actor.update().
 */
async function migrateWorldActorDeltaOperators(failures = []) {
  for (const scene of game.scenes.contents) {
    for (const token of scene.tokens) {
      if (token.actorLink || !token.delta) continue;
      await migrateActorDeltaOperators(
        token,
        `Token ${token.name} in Scene ${scene.name}`,
        failures
      );
    }
  }
}

/**
 * Perform the HM3 world migration using Foundry v14 document APIs.
 *
 * The migration is deliberately idempotent. The migration version is advanced
 * only after every supported world document and world Compendium is processed
 * without an HM3 migration error.
 */
export async function migrateWorld() {
  ui.notifications.info(
    `Applying HM3 System Migration for version ${game.system.version}. Please be patient and do not close your game or shut down your server.`,
    { permanent: true }
  );
  console.log("HM3 | Starting Migration");

  const failures = [];

  // Actor updates automatically refresh all dependent synthetic Actors. Clean
  // old ActorDelta operators first so those refreshes never encounter legacy
  // "-=field" or "==field" keys from pre-v14 world data.
  await migrateWorldActorDeltaOperators(failures);

  for (const actor of game.actors.contents) {
    await migrateDocument(actor, migrateActorData, "Actor", failures);
  }

  for (const item of game.items.contents) {
    await migrateDocument(item, migrateItemData, "Item", failures);
  }

  // Foundry v14 stores unlinked Token overrides in ActorDelta documents. The
  // synthetic Actor is the supported document surface for applying migrations.
  for (const scene of game.scenes.contents) {
    for (const token of scene.tokens) {
      if (token.actorLink || !token.actor) continue;
      try {
        const updateData = migrateActorData(token.actor.toObject());
        if (!isEmpty(updateData)) {
          console.log(`HM3 | Migrating unlinked Token ${token.name} in Scene ${scene.name}`);
          await token.actor.update(updateData, { enforceTypes: false });
        }
      } catch (error) {
        recordFailure(
          failures,
          error,
          `Token ${token.name} in Scene ${scene.name}`
        );
      }
    }
  }

  console.log("HM3 | Migrating world Compendium Packs");
  for (const pack of game.packs) {
    if (pack.metadata.package !== "world") continue;
    if (!["Actor", "Item", "Scene"].includes(pack.documentName)) continue;

    try {
      console.log(`HM3 | Starting Migration for Pack ${pack.metadata.label}`);
      await migrateCompendium(pack, failures);
    } catch (error) {
      recordFailure(failures, error, `Compendium ${pack.metadata.label}`);
    }
  }

  if (failures.length) {
    console.error(`HM3 | Migration incomplete: ${failures.length} error(s) occurred.`, failures);
    ui.notifications.error(
      `HM3 System Migration encountered ${failures.length} error(s). The world migration version was not advanced. Review the console before continuing.`,
      { permanent: true }
    );
    return { success: false, failures };
  }

  await game.settings.set("hm3", "systemMigrationVersion", game.system.version);
  console.log("HM3 | Migration Complete");
  ui.notifications.info(
    `HM3 System Migration to version ${game.system.version} completed!`,
    { permanent: true }
  );
  return { success: true, failures: [] };
}

function recordFailure(failures, error, label) {
  const migrationError = error instanceof Error ? error : new Error(String(error));
  migrationError.message = `Failed HM3 system migration for ${label}: ${migrationError.message}`;
  failures.push({ label, error: migrationError });
  console.error(migrationError);
}

async function migrateDocument(document, migration, label, failures = []) {
  try {
    const updateData = migration(document.toObject());
    if (isEmpty(updateData)) return true;

    console.log(`HM3 | Migrating ${label} ${document.name}`);
    await document.update(updateData, { enforceTypes: false });
    return true;
  } catch (error) {
    recordFailure(failures, error, `${label} ${document.name}`);
    return false;
  }
}

/**
 * Apply HM3 migration rules to supported world Compendium documents.
 */
export async function migrateCompendium(pack, failures = []) {
  if (!["Actor", "Item", "Scene"].includes(pack.documentName)) return;

  const wasLocked = pack.locked;
  await pack.configure({ locked: false });

  try {
    await pack.migrate({ notify: false });
    const documents = await pack.getDocuments();

    for (const document of documents) {
      if (document.documentName === "Actor") {
        await migrateDocument(document, migrateActorData, "Compendium Actor", failures);
      } else if (document.documentName === "Item") {
        await migrateDocument(document, migrateItemData, "Compendium Item", failures);
      } else if (document.documentName === "Scene") {
        for (const token of document.tokens) {
          if (token.actorLink || !token.actor) continue;
          await migrateActorDeltaOperators(
            token,
            `unlinked Token ${token.name} in Compendium Scene ${document.name}`,
            failures
          );
          try {
            const updateData = migrateActorData(token.actor.toObject());
            if (!isEmpty(updateData)) {
              await token.actor.update(updateData, { enforceTypes: false });
            }
          } catch (error) {
            recordFailure(
              failures,
              error,
              `unlinked Token ${token.name} in Compendium Scene ${document.name}`
            );
          }
        }
      }
    }
  } finally {
    await pack.configure({ locked: wasLocked });
  }

  console.log(`HM3 | Migrated ${pack.documentName} documents in Compendium ${pack.collection}`);
}

/** Produce an update object for one Actor or synthetic Actor. */
export function migrateActorData(actor) {
  const updateData = {};
  const actorData = actor?.system ?? {};
  const abilities = actorData.abilities ?? {};

  for (const ability of [
    "strength", "stamina", "dexterity", "agility", "intelligence", "aura",
    "will", "eyesight", "hearing", "smell", "voice", "morality"
  ]) {
    if (hasOwn(abilities[ability], "effective")) {
      deleteField(updateData, `system.abilities.${ability}.effective`);
    }
  }

  if (hasOwn(abilities, "comliness")) {
    updateData["system.abilities.comeliness.base"] = abilities.comliness?.base ?? 0;
    deleteField(updateData, "system.abilities.comliness");
  }

  for (const ability of ["endurance", "speed", "touch", "frame"]) {
    if (!hasOwn(abilities, ability)) continue;
    const value = abilities[ability]?.base;
    if (value) updateData[`flags.hm-gold.ability-${ability}`] = value;
    deleteField(updateData, `system.abilities.${ability}`);
  }

  for (const field of [
    "dodge", "initiative", "endurance", "universalPenalty", "physicalPenalty",
    "totalInjuryLevels", "hasCondition", "encumbrance", "totalWeight"
  ]) {
    if (hasOwn(actorData, field)) deleteField(updateData, `system.${field}`);
  }

  if (hasOwn(actorData.move, "effective")) {
    deleteField(updateData, "system.move.effective");
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
    if (isEmpty(itemUpdate)) return updates;

    itemUpdate._id = itemData._id;
    updates.push(expandObject(itemUpdate));
    return updates;
  }, []);

  if (itemUpdates.length) updateData.items = itemUpdates;
  return updateData;
}

/** Produce an update object for one Item. */
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
      deleteField(updateData, "system.squeeze");
    }
    if (hasOwn(system, "tear")) {
      if (system.tear) updateData["flags.hm-gold.tear-impact"] = system.tear;
      deleteField(updateData, "system.tear");
    }
  }

  if (item?.type === "missilegear") {
    const range = system.range ?? {};
    const impact = system.impact ?? {};

    for (const field of ["extreme64", "extreme128", "extreme256"]) {
      if (hasOwn(range, field)) deleteField(updateData, `system.range.${field}`);
    }

    if (hasOwn(impact, "extreme64")) {
      if (impact.extreme64) {
        updateData["flags.hm-gold.range4-impact"] = impact.short;
        updateData["flags.hm-gold.range8-impact"] = impact.medium;
        updateData["flags.hm-gold.range16-impact"] = impact.long;
        updateData["flags.hm-gold.range32-impact"] = impact.extreme;
        updateData["flags.hm-gold.range64-impact"] = impact.extreme64;
      }
      deleteField(updateData, "system.impact.extreme64");
    }

    for (const field of ["extreme128", "extreme256"]) {
      if (!hasOwn(impact, field)) continue;
      if (impact[field]) {
        const suffix = field.replace("extreme", "");
        updateData[`flags.hm-gold.range${suffix}-impact`] = impact[field];
      }
      deleteField(updateData, `system.impact.${field}`);
    }
  }

  if (item?.type === "armorgear") {
    const protection = system.protection ?? {};
    for (const field of ["squeeze", "tear"]) {
      if (!hasOwn(protection, field)) continue;
      if (protection[field]) updateData[`flags.hm-gold.${field}`] = protection[field];
      deleteField(updateData, `system.protection.${field}`);
    }
  }

  if (item?.type === "armorlocation") {
    for (const field of ["squeeze", "tear"]) {
      if (!hasOwn(system, field)) continue;
      if (system[field]) updateData[`flags.hm-gold.${field}`] = system[field];
      deleteField(updateData, `system.${field}`);
    }

    const probWeight = system.probWeight ?? {};
    if (hasOwn(probWeight, "arms")) {
      if (probWeight.arms) updateData["flags.hm-gold.probweight-arms"] = probWeight.arms;
      deleteField(updateData, "system.probWeight.arms");
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
    if (isEmpty(updateData)) return token;

    const additions = Object.fromEntries(
      Object.entries(updateData).filter(([, value]) => !(value instanceof ForcedDeletion))
    );
    foundry.utils.mergeObject(delta, expandObject(additions), { inplace: true });
    return token;
  });

  return { tokens };
}

/** Remove fields explicitly marked by legacy `_deprecated: true` markers. */
function migrateRemoveDeprecated(entity, updateData) {
  const flat = flattenObject(entity ?? {});
  const deprecatedParents = Object.entries(flat)
    .filter(([key, value]) => key.endsWith("_deprecated") && value === true)
    .map(([key]) => key.split(".").slice(0, -1).join("."));

  for (const parent of deprecatedParents) {
    if (!parent.startsWith("system.")) continue;
    deleteField(updateData, parent);
  }
}

/** Purge non-HM3 flags from a Compendium while preserving its lock state. */
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
