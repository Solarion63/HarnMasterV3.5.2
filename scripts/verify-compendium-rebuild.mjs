import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ClassicLevel } from "classic-level";

export const PACKS = Object.freeze(["character", "possessions", "esoteric", "system-help"]);

export function digestRecords(records) {
  const hash = createHash("sha256");
  for (const [key, value] of records) {
    const k = Buffer.from(String(key), "utf8");
    const v = Buffer.from(String(value), "utf8");
    const lengths = Buffer.allocUnsafe(8);
    lengths.writeUInt32BE(k.length, 0);
    lengths.writeUInt32BE(v.length, 4);
    hash.update(lengths).update(k).update(v);
  }
  return hash.digest("hex");
}

export async function digestPack(path) {
  const db = new ClassicLevel(path, { valueEncoding: "utf8" });
  await db.open();
  try {
    const records = [];
    for await (const [key, value] of db.iterator()) records.push([String(key), String(value)]);
    return { digest: digestRecords(records), count: records.length };
  } finally {
    await db.close();
  }
}

export async function verifyPacks(committedDir, rebuiltDir) {
  for (const name of PACKS) {
    const original = await digestPack(resolve(committedDir, name));
    const rebuilt = await digestPack(resolve(rebuiltDir, name));
    console.log(name + ": committed " + original.count + " records, rebuilt " + rebuilt.count +
      " records; digests " + original.digest + " / " + rebuilt.digest);
    if (original.digest !== rebuilt.digest || original.count !== rebuilt.count) {
      throw new Error("Committed compendium " + name + " differs from rebuilt record content; rebuild and commit updated packs in this PR.");
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 4) {
    console.error("Usage: node verify-compendium-rebuild.mjs <committed-packs-dir> <rebuilt-packs-dir>");
    process.exitCode = 2;
  } else {
    try { await verifyPacks(process.argv[2], process.argv[3]); }
    catch (error) { console.error(error); process.exitCode = 1; }
  }
}
