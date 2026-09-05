const LEGACY_OPERATOR_PREFIXES = ["-=", "=="];
const ACTOR_DELTA_FIELDS = [
  "name",
  "type",
  "img",
  "system",
  "ownership",
  "flags",
  "items",
  "effects"
];

/**
 * Return paths whose property names use Foundry's pre-v14 data-operator syntax.
 *
 * ActorDelta data created by older Foundry releases can persist keys such as
 * `-=someFlag`. Foundry v14 still recognizes those keys for compatibility, but
 * logs a deprecation stack whenever a later Actor update causes the delta to be
 * applied to its synthetic Actor. The world migration uses this helper to find
 * those stale deltas before updating any base Actors.
 *
 * @param {*} value Arbitrary source data to inspect.
 * @param {string} basePath Internal recursion path.
 * @returns {string[]} Dot paths containing legacy operator keys.
 */
export function legacyDataOperatorPaths(value, basePath = "") {
  if (value == null || typeof value !== "object") return [];

  const paths = [];
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const path = basePath ? `${basePath}.${index}` : String(index);
      paths.push(...legacyDataOperatorPaths(value[index], path));
    }
    return paths;
  }

  for (const [key, child] of Object.entries(value)) {
    const path = basePath ? `${basePath}.${key}` : key;
    if (LEGACY_OPERATOR_PREFIXES.some(prefix => key.startsWith(prefix))) {
      paths.push(path);
    }
    paths.push(...legacyDataOperatorPaths(child, path));
  }
  return paths;
}

/** Return whether arbitrary source data contains any legacy data-operator key. */
export function hasLegacyDataOperatorKeys(value) {
  return legacyDataOperatorPaths(value).length > 0;
}

/**
 * Project a full Actor source object onto the fields supported by ActorDelta.
 *
 * Rebuilding a stale ActorDelta starts from the synthetic Actor's effective
 * source so token-specific values are preserved exactly. Actor-only fields such
 * as folder, sort, prototypeToken, and _stats are intentionally excluded.
 *
 * @param {object} actorSource Full synthetic Actor source data.
 * @returns {object} ActorDelta-compatible snapshot.
 */
export function actorDeltaSnapshot(actorSource) {
  const snapshot = {};
  for (const field of ACTOR_DELTA_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(actorSource ?? {}, field)) {
      snapshot[field] = actorSource[field];
    }
  }
  return snapshot;
}
