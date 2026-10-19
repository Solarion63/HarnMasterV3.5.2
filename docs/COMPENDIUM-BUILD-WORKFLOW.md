# Compendium source and build validation

The Foundry V14 source of truth is `master`. Changes to `packs/*/_source` must include the corresponding compiled LevelDB content in the same pull request. GitHub Actions does **not** push rebuilt packs to the protected default branch or to the obsolete migration branch.

## Pull-request workflow

`.github/workflows/rebuild-compendiums.yml` runs on PRs targeting `master` that change pack source, the rebuild script or this workflow.

1. Check out the **exact PR head SHA** with read-only permissions.
2. Snapshot the committed LevelDB packs and rebuild the four packs using Foundry CLI.
3. Verify document counts, help links and pack population as before.
4. Compare the *logical key/value records* of each committed pack with the regenerated pack. Diagnostic logs and LevelDB file compaction need not be byte-identical; any record-level difference fails CI.
5. Only after passing validation, package the same PR head SHA via `package-release.yml`. The package workflow remains read-only and checks pack counts.

If CI reports a mismatched compendium, rebuild locally using the same pinned Foundry CLI version, commit the resulting `packs/*` files alongside your source edits, then rerun the affected checks. Do not use the CI runner to commit to protected branches.

The validation script `scripts/verify-compendium-rebuild.mjs` creates deterministic SHA-256 digests of sorted decoded LevelDB keys and values; `scripts/test-verify-compendium-rebuild.mjs` tests the comparison helper. The original v14 runtime behavior and published prerelease artifacts are unchanged.
