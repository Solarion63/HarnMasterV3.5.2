# Development Status

- **Version:** `2.0.0-rc.3` (Foundry V14), now the default `master` baseline.
- **Last major phase:** PR #27 integrated the modern CSS/RC build infrastructure, followed by PR #28 promoting the verified V14 system to `master` at `65ac1173b5f18868a898cc7fbb71ac5baef7d381`. Historical migration PR #1 was closed as superseded.
- **Active phase:** RC artifact retention and safe cleanup PR; exact run ID and SHA-256 digest remain release-publishing authorities.
- **Validation:** PR #28 passed Validate System #988, Validate Build Toolchain #17, Rebuild Compendiums #346 and RC package workflow; `hm3-2.0.0-rc.3` artifact confirmed. Extensive existing RC3 live-game acceptance remains applicable to unchanged runtime code.
- **V13 archive:** `archive/foundry-v13-master-before-v14-promotion` at `d976e5afd159476668f001a2929ffe720fc6353c`. Do not delete this history or assume V13 worlds can migrate without existing versioned logic.
- **Security:** A narrowly bounded exception for build-only `braces` advisory `GHSA-vfj7-8cjw-p6xm` expires after November 30, 2026; regression tests must block other high/critical findings.
- **Key docs and authorities:** `system.json`, `FOUNDRY-V14-MIGRATION.md`, `DEVELOPMENT-BACKLOG.md`, `BUILDING.md`, `module/`, `.github/workflows/validate.yml`, `.github/workflows/package-release.yml`, `.github/workflows/dispatch-package-rc.yml`. `master` is authoritative; reconcile outdated historical docs before new phases.
- **Next action:** Verify cleanup PR and first manual dry-run, then confirm execution mode; separately repair obsolete compendium rebuild branch references. Review braces exception before expiry.
