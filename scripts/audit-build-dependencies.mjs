import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const EXCEPTION = Object.freeze({
  advisory: "GHSA-vfj7-8cjw-p6xm",
  package: "braces",
  expiresAfter: "2026-11-30"
});
const levels = new Set(["high", "critical"]);

export function evaluateAudit(report, now = new Date()) {
  if (!report || typeof report !== "object" || !report.vulnerabilities || typeof report.vulnerabilities !== "object") {
    throw new Error("npm audit returned invalid or missing vulnerability data");
  }
  const vulnerabilities = report.vulnerabilities;
  const high = Object.entries(vulnerabilities).filter(([, vulnerability]) => levels.has(vulnerability?.severity));
  if (!high.length) return { exceptionUsed: false, affected: [] };

  const endExclusive = Date.parse(EXCEPTION.expiresAfter + "T00:00:00Z") + 86400000;
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || now.getTime() >= endExclusive) {
    throw new Error("Temporary braces advisory exception expired on " + EXCEPTION.expiresAfter);
  }

  const visited = new Set();
  function validate(name, stack = new Set()) {
    if (visited.has(name)) return;
    if (stack.has(name)) throw new Error("Circular npm audit vulnerability dependency: " + name);
    const item = vulnerabilities[name];
    if (!item || typeof item !== "object" || !Array.isArray(item.via) || !item.via.length) {
      throw new Error("Unrecognized npm audit vulnerability: " + name);
    }
    const active = new Set(stack);
    active.add(name);
    for (const source of item.via) {
      if (typeof source === "string") {
        validate(source, active);
      } else if (source && typeof source === "object" && name === EXCEPTION.package &&
        source.name === EXCEPTION.package &&
        typeof source.url === "string" &&
        source.url.endsWith("/" + EXCEPTION.advisory) &&
        levels.has(source.severity)) {
        // The one approved, unpatched advisory.
      } else {
        throw new Error("Unapproved npm audit advisory or vulnerability for " + name + ": " +
          JSON.stringify(source));
      }
    }
    visited.add(name);
  }
  for (const [name] of high) validate(name);
  if (!visited.has(EXCEPTION.package)) throw new Error("Unexpected high vulnerabilities without the approved braces root");
  return { exceptionUsed: true, affected: high.map(([name]) => name).sort() };
}

function main() {
  const result = spawnSync("npm", ["audit", "--json", "--audit-level=high"], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024
  });
  if (result.error || (result.status !== 0 && result.status !== 1) || !result.stdout) {
    throw new Error("npm audit could not run: " + (result.error?.message ?? result.stderr ?? result.status));
  }
  let data;
  try { data = JSON.parse(result.stdout); } catch {
    throw new Error("npm audit did not return valid JSON");
  }
  if (data.error) throw new Error("npm audit API error: " + JSON.stringify(data.error));
  const decision = evaluateAudit(data);
  if (decision.exceptionUsed) {
    console.warn("TEMPORARY SECURITY EXCEPTION: " + EXCEPTION.advisory +
      " in development-only braces dependencies, through " + EXCEPTION.expiresAfter);
    console.warn("Affected npm audit meta-vulnerabilities: " + decision.affected.join(", "));
    console.warn("No other high/critical advisories are permitted.");
  } else {
    console.log("npm audit: no high/critical vulnerabilities. Temporary exception unused.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
