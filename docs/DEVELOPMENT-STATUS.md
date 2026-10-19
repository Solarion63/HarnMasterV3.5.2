# Development Status

- **Version:** 2.0.0-rc.3 (Foundry V14).
- **Last major increment:** PR #27 reconciled modern CSS/Gulp toolchain, RC dispatch, reproducible generated CSS and approved bounded npm audit exception.
- **Active promotion:** `maintenance/promote-v14-to-master` to `master`, using V14 integration tree from `feature/foundry-v14-master` head `b83ae9b2c6a31dc5ad8cca56e092a5ca84cbc692`. Historical PR #1 remains open but conflicts with master; use clean-base promotion PR.
- **RC3 acceptance:** Extensive live-play testing of V14; system and build checks passed on integrated V14 branch. Runtime changes require focused acceptance.
- **V13 archive:** `archive/foundry-v13-master-before-v14-promotion` at `d976e5afd159476668f001a2929ffe720fc6353c`.
- **Security:** Temporary CI exception for `GHSA-vfj7-8cjw-p6xm` in build-only braces dependency; expires after 2026-11-30, with regression tests and unrelated high/critical findings still blocking.
- **Architecture/docs:** `system.json`, `FOUNDRY-V14-MIGRATION.md`, `DEVELOPMENT-BACKLOG.md`, `BUILDING.md`, and build/release workflows.
- **Next:** Validate promotion PR exact head (system, CSS/audit, compendiums, packaging). Merge after required acceptance; preserve prerelease assets and V13 archive. HarnMaster artifact cleanup is separate.
