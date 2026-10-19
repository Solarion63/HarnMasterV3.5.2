# Development Status

- **Version / authoritative branch:** `2.0.0-rc.3` for Foundry V14 on `master`.
- **Last completed major phase:** Foundry V14 promotion via PR #28 (V13 archived), then CI maintenance PR #31 (RC artifact retention/cleanup) and PR #33 (PR-head compendium rebuild validation). Latest confirmed `master`: `2b3a89d306aa3d1f7c5d4a8537287285c566fe34`.
- **Active phase:** No implementation PR. Storage cleanup is operational; its first manual dry-run completed successfully (run #3, Actions run `39269911567`): 12 examined, 12 protected, 0 eligible, 0 deleted. Actual deletion behavior remains untested until an eligible artifact exists.
- **Validation:** PR #31 Validate System #993 passed; cleanup dry-run passed. PR #33 Validate System #996 and Rebuild Compendiums #349 passed, including exact-PR-head RC packaging. Existing RC3 live-game acceptance applies to unchanged runtime code.
- **State authorities / documentation:** `system.json`, `module/`, `FOUNDRY-V14-MIGRATION.md`, `DEVELOPMENT-BACKLOG.md`, `BUILDING.md`, `docs/ACTIONS-ARTIFACT-RETENTION.md`, `docs/COMPENDIUM-BUILD-WORKFLOW.md`. RC publisher requires tested source SHA, workflow run ID and artifact digest; protected-branch compendiums are validated, not auto-written.
- **V13 archive:** `archive/foundry-v13-master-before-v14-promotion` at `d976e5afd159476668f001a2929ffe720fc6353c`.
- **Security:** Temporary narrowly scoped build-only `braces` exception for `GHSA-vfj7-8cjw-p6xm` expires after **2026-11-30**; unrelated high/critical findings remain blocking.
- **Next:** When superseded automatic RC artifacts become eligible, inspect cleanup dry-run and execute-mode logs to establish destructive-operation acceptance. Reassess the `braces` advisory before exception expiry. Tackle any new gameplay backlog item only after auditing current code.
