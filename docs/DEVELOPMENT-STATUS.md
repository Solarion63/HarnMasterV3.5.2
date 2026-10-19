# Development Status

- **Version:** 2.0.0-rc.3 (Foundry V14).
- **Active promotion:** PR #1, `feature/foundry-v14-master` → `master`; reconciliation PR targets the V14 development branch.
- **RC3 runtime head before integration:** `28270bbcf2022e72142749f1ee8a6e0d4cf9a851`, extensively live-tested.
- **V13 archive:** `archive/foundry-v13-master-before-v14-promotion` at `d976e5afd159476668f001a2929ffe720fc6353c`.
- **Validation:** V14 Validate System #980 and Rebuild Compendiums #345 passed; CSS output regenerated with V14 scoping intact; limited unpatched braces build-tool advisory approved until 2026-11-30; all checks required on final PR head.
- **Architecture/docs:** `system.json`, `FOUNDRY-V14-MIGRATION.md`, `DEVELOPMENT-BACKLOG.md`, `BUILDING.md`, `docs/DEVELOPMENT-STATUS.md`.
- **Next:** Pass the protected-branch integration PR checks, merge to V14 branch, verify promotion PR #1 on its exact head, then promote to `master`. Review packaging and prerelease provenance; published releases remain intact.
