# README verification report — 2026-10-19

This report checks the current HarnMaster 3 Foundry V14 README revision against `master` code, manifest, packaging workflows, git history, legacy README attributions, and selected external links. Repository code and previously accepted runtime results are the behavioral authority. Where an external service or original asset's license provenance could not be independently verified, no new attribution or compatibility guarantee is asserted.

## Behavior and feature verification

| Claim / topic | Evidence on master | README action |
|---|---|---|
| Supported engine and package | `system.json` version `2.0.0-rc.3`, `compatibility.minimum=14`, verified `14.365`, V14 ES modules | State supported V14 baseline and explicitly identify release-candidate status |
| Actor types and sheet access | `system.json` Actor types character/creature/container; `module/hm3.js` registers three V14 sheets; `module/actor/actor-sheet-v2.js` checks ownership/limited | Retain core descriptions; identify V14 sheets |
| Combat and active effects | V14 modules under `module/` and registrations in `system.json` | Retain but avoid claiming complete rules automation |
| Skills, esoterics and macros | `system.json` Item types, `module/macro-create-v14.js`, `module/hm3.js` exposes `game.hm3.macros` | Clarify permission requirements and workflow-specific dialog behavior |
| Endurance/Condition | `module/actor/actor-derived-rules.js` only uses positive Condition ML for substitution | Explain uninitialized Condition exception |
| Physician diagnosis and wound treatment | `module/physician-workflow-v14.js`, `module/medical-service.js`, settings and RC3 `CHANGELOG.md` | Add features with caveats about settings and GM authority |
| Shock and Bloodloss | `module/shock-*.js`, `module/bloodloss-service.js`, `module/blood-regeneration-v14.js`, `module/settings.js` | Include configured/optional automation and recovery behaviors |
| Compendiums | Four named packs in `system.json` | List all four packs |
| Dice So Nice | Historical README asserted compatibility; no fresh installed-module integration or version compatibility check performed | Treat as historical claim only, not guaranteed tested compatibility |
| Modifier fast-forward | Historical README and upstream walkthrough explicitly permit required dialogs to remain | Correct blanket claim |
| Build instructions | `BUILDING.md`, `package.json`, `.github/workflows/package-release.yml`, `docs/COMPENDIUM-BUILD-WORKFLOW.md` | Remove obsolete Bash/rsync packaging script; link authoritative process |

## Link check

| Link/role | Result and handling |
|---|---|
| `github.com/Solarion63/HarnMasterV3.5.2` and issues | Repo is authoritative; current manifest points to this repository; README badges retargeted |
| Manifest `.../releases/download/hm3-prerelease-channel/system.json` | URL is specified by the live `system.json` and publication workflow; GitHub release tag exists. README uses exact manifest URL. An actual Foundry installation was not performed in this documentation pass |
| Versioned release URL | GitHub release tags `v2.0.0-rc.1`, `rc.2` and `rc.3` exist; release page points to current repository |
| `toastygm/HarnMaster-3-FoundryVTT` | Historic upstream project, retained as explicit upstream credit only |
| `toastygm.github.io/HarnMaster-3-FoundryVTT/` | Public upstream walkthrough resolves; clearly labeled upstream/historical rather than documentation maintained for this fork |
| Upstream GitHub wiki walkthrough | Public page resolves; labeled historical |
| Upstream wiki `/Modules` | Could not reliably verify content/availability; excluded from current recommended-module endorsements |
| `columbiagames.com/harn/` | Public product page resolves; switched link to HTTPS |
| `foundryvtt.com` | Official website is the user-facing resource |
| Internal `BUILDING.md`, `CHANGELOG.md`, `DEVELOPMENT-BACKLOG.md`, `FOUNDRY-V14-MIGRATION.md`, `docs/*` and `LICENSE` | Verified filenames in current repository |
| CC BY-NC-SA 3.0 AU original font license URL | Existing citation preserved; original specific license endpoint did not yield a reliable independent retrieval during this audit |

## Attribution and license review

- `system.json` author entries: **Toasty**, **Valcorin**. Both retained unchanged.
- GitHub commit history on this repository shows commits attributed to accounts/names including `Solarion63`, `toastygm`, `valcorin` and `Tom Rodriguez`. Those labels are reported as they appear in Git history, not merged into assumed real-world identities. README acknowledges present maintenance by the `Solarion63` account and links to original upstream project.
- `LICENSE` contains GPL-3.0 text. `THIRD_PARTY_NOTICES.md` separately identifies Hârn/game terminology, icon sources, and font notices. The README separates source licensing from asset licensing.
- Current repository includes `images/icons/svg` (420 SVG files), `images/icons/png` (10 PNG files), other imagery, and three font files. **No exhaustive individual SVG/PNG provenance audit was possible**, so the historic artist list is preserved without claiming every attribution is independently reverified.
- All historical creator credits were transferred **verbatim** from the prior README to `THIRD_PARTY_NOTICES.md` (including duplicated 'Throw by Jakob Vogel', not silently deduplicated). Original font-specific notices remain in the notices document.
- The former README grouped Noun Project and Game-Icons.net under one licensing statement; the updated notices qualify that individual assets' applicable terms govern rather than assuming a single license for every asset.
- Original creators and copyright holders are credited without asserting endorsement of this fork.

## Remaining verification limits

1. Compatibility with optional third-party Foundry modules, including Dice So Nice, requires a targeted runtime check before declaring a verified version range.
2. Each icon's exact creator, source page and license would require a separate file-by-file provenance audit; credits must not be removed meanwhile.
3. External upstream wiki pages and web resources may change independently of this project.
4. The RC3 manifest URL comes from published GitHub release configuration; this documentation-only review did not perform a fresh Foundry client installation.

No Foundry runtime or world/Actor data was modified by this documentation audit.
