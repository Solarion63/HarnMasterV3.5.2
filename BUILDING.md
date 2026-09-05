# Building HarnMaster 3

This document describes the local CSS build toolchain used by the repository.

## Requirements

- Node.js 22 or newer is recommended for development and CI parity.
- npm 10 or newer is recommended.

## Install dependencies

Use the committed lockfile for a reproducible install:

```bash
npm ci
```

The build dependencies are development-only and are not required by Foundry VTT at runtime.

## Compile CSS

Compile all SCSS sources into the committed `css/` output:

```bash
npm run build
```

`npm run compile` is an alias for the same one-time build.

The pipeline uses:

- Gulp 5
- Dart Sass through `gulp-sass`
- Autoprefixer

The repository commits generated CSS so release packages do not need Node.js or the Sass toolchain installed.

## Watch SCSS during development

```bash
npm run watch
```

This performs an initial build and then recompiles when files under `scss/` change.

## CI validation

`.github/workflows/build.yml` performs the following checks when build inputs change:

1. installs dependencies with `npm ci`;
2. compiles the SCSS sources;
3. verifies the generated `css/` output exactly matches the committed files; and
4. runs `npm audit --audit-level=high`.

If CI reports that generated CSS is stale, run `npm run build` locally and commit the resulting `css/` changes.

## Sass module migration note

The current SCSS source still uses Sass `@import`. Dart Sass currently supports it but emits deprecation warnings because `@import` is scheduled for removal in Dart Sass 3. A separate source-level migration to `@use` / `@forward` should be performed before adopting Dart Sass 3. That migration is intentionally separate from the dependency/toolchain upgrade so stylesheet behavior can be reviewed independently.
