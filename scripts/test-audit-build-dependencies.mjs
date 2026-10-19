import assert from "node:assert/strict";
import { evaluateAudit } from "./audit-build-dependencies.mjs";

const GHSA = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const base = () => ({ vulnerabilities: {
  braces: { severity: "high", via: [{ name: "braces", severity: "high", url: GHSA }] },
  chokidar: { severity: "high", via: ["braces"] },
  "glob-watcher": { severity: "high", via: ["chokidar"] },
  gulp: { severity: "high", via: ["glob-watcher"] }
}});
const inDate = new Date("2026-10-19T00:00:00Z");
assert.equal(evaluateAudit(base(), inDate).exceptionUsed, true);
assert.deepEqual(evaluateAudit({ vulnerabilities: {} }, new Date("2026-12-03T00:00:00Z")), { exceptionUsed: false, affected: [] });
assert.equal(evaluateAudit(base(), new Date("2026-11-30T23:59:59Z")).exceptionUsed, true);
assert.throws(() => evaluateAudit(base(), new Date("2026-12-01T00:00:00Z")), /expired/);
const extra = base();
extra.vulnerabilities.evil = { severity: "high", via: [{name:"evil",severity:"high",url:"https://github.com/advisories/GHSA-other"}] };
assert.throws(() => evaluateAudit(extra, inDate), /Unapproved/);
const samePkgExtra = base();
samePkgExtra.vulnerabilities.braces.via.push({name:"braces",severity:"high",url:"https://github.com/advisories/GHSA-other"});
assert.throws(() => evaluateAudit(samePkgExtra, inDate), /Unapproved/);
const unknown = base();
unknown.vulnerabilities.other = { severity: "critical", via: ["missing"] };
assert.throws(() => evaluateAudit(unknown, inDate), /Unrecognized/);
assert.throws(() => evaluateAudit(null, inDate), /invalid/);
console.log("Security exception regression tests passed");
