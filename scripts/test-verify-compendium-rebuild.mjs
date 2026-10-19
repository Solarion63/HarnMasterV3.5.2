import assert from "node:assert/strict";
import { digestRecords } from "./verify-compendium-rebuild.mjs";

const base = [["!folders!a","{\"name\":\"A\"}"],["!items!b","{\"name\":\"B\"}"]];
assert.equal(digestRecords(base), digestRecords(base));
assert.notEqual(digestRecords(base), digestRecords([["!folders!a","{\"name\":\"A\"}"],["!items!b","{\"name\":\"Changed\"}"]]));
assert.notEqual(digestRecords(base), digestRecords(base.slice(0,1)));
assert.notEqual(digestRecords([["ab","c"]]), digestRecords([["a","bc"]]));
console.log("Compendium record digest tests passed");
