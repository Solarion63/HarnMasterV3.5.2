import fs from "node:fs/promises";
import path from "node:path";

const [, , sourceDir, outputDir] = process.argv;

if (!sourceDir || !outputDir) {
  console.error("Usage: node scripts/prepare-system-help.mjs <source-dir> <output-dir>");
  process.exit(2);
}

const PACK_UUID_PREFIX = "Compendium.hm3.system-help.JournalEntry";

// These references are stale in the legacy Help source and cannot be resolved
// directly from the current JournalEntry names/IDs.
const LEGACY_ALIASES = new Map([
  ["Effects", "Sheet - Effect Tab"],
  ["6HtyeakXK8cSTXvO", "Sheet - Profile Tab"],
  ["Sheet - Fa&ccedil;ade Tab", "Sheet - Façade Tab"]
]);

async function readSourceDocuments(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries
    .filter(entry => entry.isFile() && entry.name.endsWith(".json"))
    .map(entry => entry.name)
    .sort();

  return Promise.all(files.map(async filename => {
    const filePath = path.join(directory, filename);
    const document = JSON.parse(await fs.readFile(filePath, "utf8"));
    return { filename, document };
  }));
}

function buildLookup(sourceDocuments) {
  const lookup = new Map();
  for (const { document } of sourceDocuments) {
    lookup.set(document._id, document);
    lookup.set(document.name, document);
  }
  return lookup;
}

function migrateJournalLinks(content, lookup, sourceName) {
  let replacements = 0;
  const migrated = content.replace(
    /@JournalEntry\[([^\]]+)\](?:\{([^}]+)\})?/g,
    (match, rawTarget, explicitLabel) => {
      const target = LEGACY_ALIASES.get(rawTarget) ?? rawTarget;
      const destination = lookup.get(target);

      if (!destination) {
        throw new Error(
          `Unresolved legacy Journal link in "${sourceName}": ${match}`
        );
      }

      replacements += 1;
      const label = explicitLabel ?? destination.name;
      return `@UUID[${PACK_UUID_PREFIX}.${destination._id}]{${label}}`;
    }
  );

  return { migrated, replacements };
}

const sourceDocuments = await readSourceDocuments(sourceDir);
const lookup = buildLookup(sourceDocuments);

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

let totalReplacements = 0;

for (const { filename, document } of sourceDocuments) {
  if (typeof document.content === "string") {
    const { migrated, replacements } = migrateJournalLinks(
      document.content,
      lookup,
      document.name
    );
    document.content = migrated;
    totalReplacements += replacements;
  }

  await fs.writeFile(
    path.join(outputDir, filename),
    `${JSON.stringify(document, null, 2)}\n`,
    "utf8"
  );
}

console.log(`Prepared ${sourceDocuments.length} System Help documents.`);
console.log(`Migrated ${totalReplacements} legacy Journal links to v14 UUID links.`);

if (sourceDocuments.length !== 20) {
  throw new Error(`Expected 20 System Help documents; found ${sourceDocuments.length}.`);
}

if (totalReplacements !== 83) {
  throw new Error(`Expected to migrate 83 legacy Journal links; migrated ${totalReplacements}.`);
}
