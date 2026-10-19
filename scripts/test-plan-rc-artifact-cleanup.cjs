"use strict";
const assert = require("node:assert/strict");
const { planCleanup } = require("./plan-rc-artifact-cleanup.cjs");
const day = 86400000, now = Date.parse("2026-10-19T12:00:00Z");
const artifact = (id, rc, age, run) => ({
  id, name: "hm3-2.0.0-rc." + rc, created_at: new Date(now - age * day).toISOString(),
  workflow_run: { id: run }, expired: false
});
const artifacts = [
  artifact(1,3,35,10), artifact(2,3,20,11), artifact(3,3,2,12),
  artifact(4,2,30,13), artifact(5,2,25,14),
  artifact(6,4,30,15), artifact(7,4,20,16),
  { ...artifact(8,3,40,17), name: "toolchain-generated-files" }
];
const runs = new Map(artifacts.map(a => [a.workflow_run.id, {
  event: "push", head_sha: "sha" + a.workflow_run.id, head_branch: "feature/closed"
}]));
runs.get(15).event = "workflow_dispatch";
runs.get(13).head_branch = "feature/open";
assert.deepEqual(planCleanup(artifacts,runs,[{head:{ref:"feature/open"}}],now).deleteIds,[1,2]);
assert.deepEqual(planCleanup(artifacts,new Map(),[],now).deleteIds,[]);
assert.deepEqual(planCleanup([artifact(90,7,35,90)],new Map([[90,{event:"push"}]]),[],now).deleteIds,[]);
assert.deepEqual(planCleanup([artifact(91,7,35,91),artifact(92,7,1,92)],
  new Map([[91,{event:"workflow_dispatch"}],[92,{event:"push"}]]),[],now).deleteIds,[]);
assert.deepEqual(planCleanup([artifact(93,7,35,93),artifact(94,7,1,94)],
  new Map([[93,{event:"push",head_sha:"abc"}],[94,{event:"push",head_sha:"xyz"}]]),
  [{head:{sha:"abc"}}],now).deleteIds,[]);
console.log("RC cleanup plan tests passed");
