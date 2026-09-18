const LEGACY_OPERATOR_PREFIXES = ["-=", "=="];

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
 * Replace legacy `-=field` / `==field` property names with caller-provided
 * modern Foundry data operators while preserving every other value verbatim.
 *
 * The callbacks keep this rules helper independent of the Foundry runtime so it
 * can be covered by Node regression tests.
 *
 * @param {*} value Source value to modernize.
 * @param {object} operators Operator factory callbacks.
 * @param {Function} operators.deletion Create a modern forced-deletion value.
 * @param {Function} operators.replacement Create a modern forced-replacement value.
 * @returns {*} A recursively modernized copy.
 */
export function modernizeLegacyDataOperators(value, { deletion, replacement }) {
  if (value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map(entry => modernizeLegacyDataOperators(entry, { deletion, replacement }));
  }

  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith("-=")) {
      result[key.slice(2)] = deletion();
      continue;
    }
    if (key.startsWith("==")) {
      result[key.slice(2)] = replacement(
        modernizeLegacyDataOperators(child, { deletion, replacement })
      );
      continue;
    }
    result[key] = modernizeLegacyDataOperators(child, { deletion, replacement });
  }
  return result;
}
