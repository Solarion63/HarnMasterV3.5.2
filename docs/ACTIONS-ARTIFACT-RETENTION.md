# HarnMaster GitHub Actions artifact retention

## Current policy

HarnMaster's RC publisher consumes one exact Actions artifact identified by a workflow run ID and SHA-256 digest, then publishes immutable versioned GitHub Release assets. Do not prune a pending publisher input just because another run produced the same version.

- Automatic `push` RC packages expire after **14 days**. The weekly and post-PR-close cleanup may remove them only after 14 days and only when newer output exists for that same RC version.
- Manual or called package builds retain the GitHub-supported **90-day** expiration, and the cleanup never deletes them. Use a manually dispatched build from the **runtime-tested commit SHA** as the publishing candidate.
- The cleanup also protects artifacts from open PRs, the newest artifact for each RC version, unrelated artifacts, and artifacts whose workflow metadata cannot be verified.
- GitHub Releases, their versioned assets, and the `hm3-prerelease-channel` manifest are **not** Actions artifacts and remain untouched.

## Workflow operation

`.github/workflows/cleanup-rc-artifacts.yml` runs Sundays at 04:23 UTC and after a PR closes. It may also be dispatched manually from Actions. **Manual dispatch defaults to dry-run**, reporting what would be deleted; unchecking dry-run permits deletion. The job runs safety tests, loads its deletion rules from trusted `master`, and logs candidate counts, protected reasons, deleted count, and recovered MiB. It never checks out PR source code or uses release-publishing credentials.

If an artifact needs to be retained for an upcoming release, use **Dispatch RC Package Build** with the accepted full SHA. Record the resulting run ID and artifact digest. GitHub's native retention timer still applies: if the package expires before publishing, rebuild from the accepted SHA and confirm its new digest. For long-term availability, use the published GitHub Release rather than workflow artifacts.

The cleanup safety rules and synthetic regression cases live in `scripts/plan-rc-artifact-cleanup.cjs` and `scripts/test-plan-rc-artifact-cleanup.cjs`.

## Acceptance

The first manual dry-run must pass, list retained/candidate artifacts, and make **no deletions**. Run an execute-mode check separately and inspect its results before declaring destructive cleanup acceptance. No Foundry runtime changes are involved.

## Separate workflow issue

`.github/workflows/rebuild-compendiums.yml` still checks out and pushes `feature/foundry-v14-master`; that obsolete branch targeting needs a separately reviewed fix. It is not altered by artifact cleanup.
