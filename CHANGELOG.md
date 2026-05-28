# Changelog

All notable changes to `medieval-hexagon-gameboard` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

From version 1.0.0 onward, release-please populates this file from Conventional Commits on `main`. Pre-1.0 entries below are summarized from git history.

## [Unreleased]

### Removed

- **BREAKING:** Dropped the `medieval-hexagon-gameboard/examples/simple-rpg-usage` package subpath. SimpleRPG is a test driver, not a published example; its TypeScript source, JSON fixtures, and compiled module no longer ship in the npm tarball. SimpleRPG evidence stays reachable through the bundled CLI (`medieval-hexagon-gameboard coverage --json` / `doctor --coverage`). The in-repo driver moved to `tests/integration/simple-rpg/simple-rpg.ts` with fixtures under `tests/integration/simple-rpg/fixtures/`; e2e harness skeleton at `tests/e2e/simple-rpg/` will be fleshed out by PRD `RS1`-`RS3` (PRD R4).

### Added

- Astro Starlight docs site at `docs-site/` with 1,107 reference pages generated from JSDoc via `starlight-typedoc` (PRD F-Site-1 through F-Site-6).
- `safeResolveOutput()` jails every CLI `--out*` flag's resolved path inside `cwd`; `extract` requires `--force` to wipe a non-empty destination (PRD C1).
- `useStableOptions()` hook in `src/react/react.ts` hash-stabilizes the 8 selector hooks' option objects so caller-supplied fresh literals stop busting `useMemo` (PRD B7).
- `gameboardPlanIndex(plan)` helper memoizes `tilesByKey` + `placementsByTile` per plan via a module-local WeakMap; 6 in-call rebuilds in `coordinates/layout.ts` + `interop/interop.ts` now hit O(1) lookups (PRD B4).
- `loadFreeManifest()` async accessor ships alongside the eager `freeManifest` export (PRD B2b).
- Structured error taxonomy: `GameboardError` base + 6 subclasses (`GameboardValidationError`, `GameboardManifestError`, `GameboardScenarioError`, `GameboardRuntimeError`, `GameboardCliError`, `GameboardIoError`). 152 throw sites migrated (PRD D2).
- Coverage instrumentation across unit + browser + e2e harnesses with merged report (PRD R6).
- Coverage ratchet threshold at current baseline; CI fails on regressions (PRD A8).
- Manifest drift gate (`pnpm test:manifest-drift`) + warm-start bench (`pnpm bench:warm-start`) (PRD A3b).
- CI install-once + node_modules artifact pattern shared across jobs (PRD A9).
- `noUncheckedIndexedAccess: true` in tsconfig.base.json; 125 type errors closed (PRD A2a).
- pnpm audit `--prod --audit-level=high` gate; dependency-review-action; semgrep p/owasp-top-ten + p/nodejs SAST (PRD A4 / A7).
- Co-located unit tests under `src/<domain>/__tests__/` matching the R2 decomposition (PRD R3b).

### Changed

- Single-package layout: monorepo dropped in favor of root-level package (PRD R1). 587 files moved out of `packages/medieval-hexagon-gameboard/`.
- `src/` decomposed into 20 domain sub-packages with barrel-only cross-domain imports enforced by Biome `noRestrictedImports` (PRD R2 + R3).
- React, Three, react-dom, koota, honeycomb-grid, seedrandom moved from `peerDependencies` to `dependencies` — the library is unusable without them (PRD D6b).
- Asset model: tarball ships only `assets/free/manifest.json`; the GLTF tree is bootstrapped at install time by the CLI `bootstrap` subcommand (PRD §Phase RB).
- `createKayKitGuideScenarios` in `src/scenario/catalog.ts` inverted from 377-line imperative builder to a top-level data table + 5-line map (PRD D4).
- `scripts/smoke-packed-consumer.ts` split into `scripts/smoke/pack-install.ts` + `scripts/smoke/types.ts` + a thin orchestrator with labelled-phase output (PRD D10).
- CLI error messages relativize absolute paths against `cwd` so CI/CD logs don't leak developer directory layouts (PRD C5).
- release-please now prefers a GitHub App token over the legacy `CI_GITHUB_TOKEN` PAT, falling back when the App isn't yet provisioned (PRD A5).

### Removed

- `peerDependencies` block from `package.json`. React/Three/react-dom etc. are direct dependencies now.
- Legacy vitepress docs site under `apps/docs` (R1 deleted the directory; F-Site-12 will remove the remaining `docs/` content once the Astro migration completes).
- Bundled `assets/free/` GLTF tree from the published tarball.

## [0.1.0] - 2026-05-22

Initial pre-release. Library scaffold + first KayKit FREE pack manifest + react/three bindings.
