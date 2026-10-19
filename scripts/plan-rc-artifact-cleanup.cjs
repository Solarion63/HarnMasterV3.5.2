"use strict";
const RC = /^hm3-\d+\.\d+\.\d+-rc\.\d+$/;
const LIMIT = 14 * 86400000;

function planCleanup(artifacts, runs, openPulls, now = Date.now()) {
  const open = new Set(openPulls.flatMap(p => [p.head?.sha, p.head?.ref].filter(Boolean)));
  const latest = new Map();
  for (const a of artifacts) {
    if (!RC.test(a.name || "")) continue;
    const previous = latest.get(a.name);
    if (!previous || Date.parse(a.created_at) > Date.parse(previous.created_at)) latest.set(a.name, a);
  }
  const deleteIds = [];
  const reasons = {};
  const protect = reason => { reasons[reason] = (reasons[reason] || 0) + 1; };
  for (const artifact of artifacts) {
    if (!RC.test(artifact.name || "") || artifact.expired) { protect("unrelated"); continue; }
    const run = runs.get(artifact.workflow_run?.id);
    if (!run) { protect("unknown-run"); continue; }
    if (run.event !== "push") { protect("manual-or-other"); continue; }
    if (open.has(run.head_sha) || open.has(run.head_branch)) { protect("open-pr"); continue; }
    if (latest.get(artifact.name)?.id === artifact.id) { protect("latest-rc-version"); continue; }
    if (!Number.isFinite(Date.parse(artifact.created_at)) ||
        Date.parse(artifact.created_at) > now - LIMIT) { protect("recent"); continue; }
    deleteIds.push(artifact.id);
  }
  return { deleteIds, reasons };
}

module.exports = { planCleanup };
