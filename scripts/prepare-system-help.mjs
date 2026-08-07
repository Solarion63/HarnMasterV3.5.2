import crypto from "node:crypto";
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

      // Match the serialization produced by Foundry v14 when a JournalEntry is
      // dragged onto selected rich-text content. The outer UUID is the stable
      // compendium target; preserving the original JournalEntry expression as
      // the label reproduces the known-good editor output exactly.
      const label = explicitLabel ?? `@JournalEntry[${rawTarget}]`;
      return `@UUID[${PACK_UUID_PREFIX}.${destination._id}]{${label}}`;
    }
  );

  return { migrated, replacements };
}

function stablePageId(documentId, kind) {
  // Foundry document IDs are 16 characters. Hex is valid, deterministic, and
  // avoids generating different embedded-page IDs on every pack rebuild.
  return crypto
    .createHash("sha256")
    .update(`${documentId}:${kind}`)
    .digest("hex")
    .slice(0, 16);
}

function pageKey(documentId, pageId) {
  return `!journal.pages!${documentId}.${pageId}`;
}

function makeImagePage(document) {
  if (!document.img) return null;

  const pageId = stablePageId(document._id, "image");
  return {
    name: `Figure: ${document.name}`,
    type: "image",
    src: document.img,
    title: {
      show: false,
      level: 1
    },
    _id: pageId,
    system: {},
    image: {},
    text: {
      format: 1
    },
    video: {
      controls: true,
      volume: 0.5
    },
    category: null,
    sort: 0,
    flags: {},
    ownership: {
      default: -1
    },
    _key: pageKey(document._id, pageId)
  };
}

function makeTextPage(document, content) {
  const pageId = stablePageId(document._id, "text");
  return {
    name: document.name,
    type: "text",
    title: {
      show: false,
      level: 1
    },
    text: {
      format: 1,
      content
    },
    _id: pageId,
    system: {},
    image: {},
    video: {
      controls: true,
      volume: 0.5
    },
    src: null,
    category: null,
    sort: document.img ? 1 : 0,
    flags: {},
    ownership: {
      default: -1
    },
    _key: pageKey(document._id, pageId)
  };
}

function makeV14Journal(document, content) {
  const pages = [];
  const imagePage = makeImagePage(document);
  if (imagePage) pages.push(imagePage);
  pages.push(makeTextPage(document, content));

  return {
    _id: document._id,
    name: document.name,
    folder: document.folder || null,
    flags: document.flags ?? {},
    pages,
    categories: [],
    ownership: {
      default: 0
    },
    _key: document._key ?? `!journal!${document._id}`
  };
}

const sourceDocuments = await readSourceDocuments(sourceDir);
const lookup = buildLookup(sourceDocuments);

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

let totalReplacements = 0;

for (const { filename, document } of sourceDocuments) {
  const legacyContent = typeof document.content === "string" ? document.content : "";
  const { migrated, replacements } = migrateJournalLinks(
    legacyContent,
    lookup,
    document.name
  );
  totalReplacements += replacements;

  const preparedDocument = makeV14Journal(document, migrated);

  await fs.writeFile(
    path.join(outputDir, filename),
    `${JSON.stringify(preparedDocument, null, 2)}\n`,
    "utf8"
  );
}

console.log(`Prepared ${sourceDocuments.length} native v14 System Help documents.`);
console.log(`Migrated ${totalReplacements} legacy Journal links to v14 UUID links.`);

if (sourceDocuments.length !== 20) {
  throw new Error(`Expected 20 System Help documents; found ${sourceDocuments.length}.`);
}

if (totalReplacements !== 83) {
  throw new Error(`Expected to migrate 83 legacy Journal links; migrated ${totalReplacements}.`);
}
