# Comprehensive Code Review Report — declarative-hex-worlds

**Reviewed:** 2026-05-28  
**Scope:** Full codebase — `src/` (18 domains, ~58 modules), `tests/`, `scripts/`, `.github/workflows/`, `docs-site/`  
**Stack:** TypeScript ESM, vitest, tsup, biome, koota (ECS), three.js, react-three-fiber, citty, yauzl, Node ≥22, pnpm ≥9, Astro Starlight  
**Phases:** Code Quality & Architecture · Security & Performance · Testing & Documentation · Best Practices & CI/CD

---

## Executive Summary

The codebase is architecturally sound and shows deliberate security engineering (SHA-pinned actions, SLSA L3 provenance, OIDC publishing, path-traversal guards, zip-bomb ceilings, redirect allowlists). The ECS core, simulation scripting, and navigation are well-tested and behavior-oriented. Documentation maturity is unusually high for a 1.0.

The critical gaps cluster in three areas: **CI enforcement** (no branch protection means no gate exists on any merge; a `release-as` pin will break the next release), **security test coverage** (network/zip guards are untested in per-PR CI; `readJson<T>` accepts arbitrary user JSON without validation), and **package hygiene** (React/Three/koota are hard dependencies instead of peers, causing duplicate-instance bugs in consumers). The `_shared.ts` god module is the dominant code quality risk, but its decomposition is already tracked as an architectural directive.

---

## P0 — Critical Issues (must fix before next release)

### P0-1 — `main` has no branch protection: CI gates are advisory [CI-1]
**Finding:** `gh api repos/jbcom/declarative-hex-worlds/branches/main/protection` → `404 "Branch not protected"`. Every check (lint, typecheck, build, test, semgrep, dependency-review) is advisory. A PR can be merged red. `automerge.yml --auto` merges dependabot/release-please PRs with zero required checks — before CI even reports.

**Fix:** Enable branch protection via `gh api` with required status checks: `lint`, `typecheck`, `build`, `test`, `Semgrep SAST`, `Dependency Review`, `Docs Site Build`. Require linear history, dismiss stale approvals. Manage as code.

---

### P0-2 — `release-as: "1.0.0"` pin kills all future releases [CI-2]
**Finding:** `release-please-config.json` `release-as` is a forced override — it re-cuts `1.0.0` on every release PR regardless of commits. The next release PR collides with the existing tag; bug fixes never reach npm. Directly contradicts "versioning is release-please's job."

**Fix:** Remove `release-as` from `release-please-config.json`. Leave `.release-please-manifest.json` at `"1.0.0"` as baseline. One-line change.

---

### P0-3 — `react`/`three`/`koota` are hard `dependencies`, not `peerDependencies` [BP-1]
**Finding:** `package.json` hard-declares `react`, `react-dom`, `three`, `koota` as runtime deps. For a library providing React/Three/koota bindings, these install as a second copy under `node_modules/declarative-hex-worlds/node_modules/`, causing: koota trait identity mismatches (silent query failures), React "Invalid hook call" crash, Three `instanceof` failures. `tsup.config.ts` already marks them `external` (correct for bundling) — but `dependencies` controls installation, not bundling.

**Fix:** Move `react`, `react-dom`, `three`, `koota` to `peerDependencies`. Mark React/Three optional via `peerDependenciesMeta`. Keep in `devDependencies` for the build.

---

### P0-4 — Bootstrap network/zip security guards have zero unit tests [S-2]
**Finding:** The redirect allowlist (CWE-601/918), the live `extractZipTo` zip-slip guard (CWE-22), and the 64 MB zip-bomb ceilings (CWE-409, both declared-size and streaming) have **no unit tests**. `https.request` is never mocked anywhere in the suite. These guards are only exercised by env-gated e2e that never runs on PRs. A regression that drops any guard would ship green.

**Fix:** Add `vi.mock('node:https')` injectable seam; add hostile-entry zip tests using the existing `yazl` harness in `core.test.ts`. See test phase recommendations S-1, S-2, S-3.

---

### P0-5 — `readJson<T>` bare cast at ~20 CLI call sites (CWE-20) [H-3, BP-3]
**Finding:** `readJson<T>(path) { return JSON.parse(readFileSync(...)) as T }` has no runtime validation. All `--scenario`, `--plan`, `--script`, `--recipe`, `--groups` paths trust caller shape entirely. 25 callers including `validate-*.ts` commands (which validate *after* asserting the type). A crafted JSON file can propagate structurally wrong data deep into ECS spawning before an error surfaces. Only `readPieceSourceRoots` has a prototype-pollution guard.

**Fix:** Make `readJson` return `unknown`. Route callers through existing `inspect*` / `validate*` validators. Add Zod/Valibot schemas for the five user-facing document types. File-size ceiling before `readFileSync` (10 MB) as immediate interim control.

---

## P1 — High Priority (fix before next release)

### P1-1 — A* open-set `lowestScoreKey` is O(|open|) linear scan per iteration [P-1]
**Finding:** `src/coordinates/coordinates.ts` — `findHexPath` uses `Set<string>` + full linear scan every iteration. O(N²) worst-case per path on medium/large boards. 10 patrol agents at 60 Hz = 76,000 comparisons/tick for pathfinding alone. Same issue in `reachableGameboardTiles`.

**Fix:** Replace `Set<string>` open list with a binary min-heap. Expected speedup: 3–8x medium boards, 15–30x large boards. **Before refactoring:** add pathfinding golden-path oracle and `visited`-ceiling guard (S-5).

---

### P1-2 — Production CLI imports from `tests/integration/` (CWE-829) [H-2, CQ-8]
**Finding:** `src/cli/_shared.ts:3-7` imports three symbols from `../../tests/integration/simple-rpg/simple-rpg`. Test code is bundled into the published tarball. A test-only devDependency compromise becomes a production compromise. Also the structural root cause of the S-1 mock-injection gap.

**Fix:** Move `listSimpleRpgGuidePublicApiExercises`, `runSimpleRpgExecutableGuideApiSmoke`, `summarizeSimpleRpgGuidePublicApiExercises` to `src/` (e.g. `src/guides/simple-rpg/`). Integration test imports from source, not the reverse. Introducing an injectable HTTP seam here also resolves the redirect-allowlist testability gap.

---

### P1-3 — `--commit` ref not sanitized before GitHub URL interpolation (CWE-601/CWE-918) [H-1]
**Finding:** `src/config/index.ts:64-70` does `template.replace('{ref}', ref)` with no allowlist or percent-encoding. Enables log injection (CWE-117), structural URL ambiguity. Existing `smoke.test.ts:36` asserts the vulnerable raw-interpolation contract and will resist the fix.

**Fix:** Add `SAFE_REF = /^[a-zA-Z0-9._\-\/]{1,200}$/` guard + `encodeURIComponent` on the ref slot. Update `smoke.test.ts:36` to assert the sanitized form.

---

### P1-4 — ECS entity lookup is O(N) scan on every access [P-2]
**Finding:** `findPlacementEntity(world, id)` and `findTileEntity(world, key)` do `world.query(...).find(entity => entity.get(Trait)?.field === id)` on every call. Called on every simulation step, patrol advance, spawn. 200-placement board: O(200) per call. 10 agents × 60 Hz = 120,000 avoided comparisons/second with O(1) lookup.

**Fix:** `WeakMap<World, Map<string, Entity>>` indexes for tile-key → entity and placement-id → entity, updated on spawn/destroy.

---

### P1-5 — `isKnownExtraAssetId` runs ~136 string ops per spawn [P-3]
**Finding:** `src/scenario/catalog.ts:1221` — nested loops: 4 factions × 15 building kinds + 4 × 5 unit parts × 2 styles + array `.includes()` calls. Called twice per `spawnGameboardPlacement`. 200-placement bulk load = ~27,200 string operations.

**Fix:** Pre-compute `Set<string>` at module init. O(136) → O(1) per spawn.

---

### P1-6 — Coverage ratchet not in CI [S-1, H-3/CI]
**Finding:** `test:coverage:enforce` is local-only. `release.yml` runs it as a gate before publish — but that surfaces regressions weeks after the causative PR. With P0-1 (no branch protection) also unresolved, nothing prevents coverage drops from reaching `main`.

**Fix:** Add a `coverage` CI job running `pnpm test:coverage:enforce` and make it a required status check. Unit harness only; run in parallel with the matrix.

---

### P1-7 — `bootstrap-nightly.yml` mutable tags + disabled output jail [CI-4, M-2/M-4]
**Finding:** The daily job fetching live upstream tarball uses mutable `@v4` action tags and `HEX_WORLDS_OUT_ROOT='/'` (disables path jail). Highest-risk combination: untrusted bytes + weakened security controls.

**Fix:** SHA-pin all four actions. Set `HEX_WORLDS_OUT_ROOT: /tmp`. Add `on: pull_request: paths: ['src/cli/commands/bootstrap/**']` to trigger on bootstrap code changes.

---

### P1-8 — `resolveSimulationSpawnActor` `.at(-1) as SpawnGameboardActorOptions` unsafe cast [CQ-4, M-1/Sec]
**Finding:** `src/simulation/engine.ts:663-665` — empty array produces `undefined`; cast silently propagates to `spawnGameboardActor`, corrupting ECS world state with no diagnostic. Triggered by crafted `--scenario` JSON with a nonexistent `spawnGroupId`.

**Fix:** Null-check + `throw new GameboardRuntimeError(...)` with actor ID and spawnGroupId.

---

### P1-9 — `react-dom` ghost dep + `@types/react` mis-scoped [BP-2]
**Finding:** `react-dom` declared but never imported in `src/`. `@types/react` in `dependencies` (not `devDependencies`) forces it into consumer install graph.

**Fix:** Remove `react-dom` from dependencies. Move `@types/react` to `devDependencies`.

---

### P1-10 — `release.yml` `workflow_dispatch` can accidentally publish to npm [CI-8]
**Finding:** The publish step lacks `if: github.event_name == 'release'` guard. A manual dispatch runs `npm publish --provenance`.

**Fix:** Add the `if` guard on the publish step, or a `confirm_publish` dispatch input defaulting false.

---

## P2 — Medium Priority (plan for next sprint)

### Code Quality & Architecture
- **CQ-1** — `_shared.ts` god module (4,059 lines, 20+ commands) — decompose to per-command files; extract `emitOutput()` helper (tripled output pattern × 15+)
- **CQ-2** — `commandHandlerMutations` exhaustiveness guard returns `never` silently — throw `GameboardRuntimeError` for future union variants
- **CQ-3** — `advancePatrolEntity` 8-branch, 4 mutable-write complexity — extract phase-based state machine
- **CQ-4** — `koota.ts:16` imports `isKnownExtraAssetId` from `scenario` — dependency inversion; move to `src/types/` or require callers to pass `requiresExtra` explicitly
- **CQ-5** — `_shared.ts:57` pierces `interop/internal` barrel — re-export via `interop/index.ts`; add to `noRestrictedImports`

### Performance
- **P-4** — `findGameboardPath`/`reachableGameboardTiles` rebuild `new Map` in default arguments (bypasses `gameboardPlanIndex` cache) — route defaults through the WeakMap
- **P-5** — `[...world.query(...)]` spread allocates per tick in patrol/movement systems — iterate directly
- **P-6** — `requirePlacementState` deep spread per entity per tick (2,400 allocs/sec at 10 agents) — deep-copy only on final result snapshot
- **P-7** — `runGameboardSystems` three `flatMap` + two spreads per tick — pre-allocate, push directly
- **P-8** — `freeManifest` 380 KB eager literal — convert static import in `gameboard.ts` to dynamic `import()` inside functions that need it
- **P-9** — `spawnGameboardPlacement` doesn't receive `tileIndex` during bulk `loadGameboardWorld` — thread index through as optional param (80,000 O(1) substitutions)
- **P-10** — `useGameboardDerivedRevision` mounts 30+ trait subscriptions per component — domain-split revision counters + microtask coalescing

### Security
- **Sec-M3** — `stageFromZip` cleanup not in `finally` — restructure to `let ok = false; try { ...; ok = true; } finally { if (!ok) rmSync(...) }`
- **Sec-M4** — `readSidecar` no file-size ceiling — add `statSync` size check + `files.length` bound
- **Sec-L1** — `interop/internal` barrel pierced — re-export via public barrel
- **Sec-L3** — `walkFilesInternal` silently skips symlinks — add warning + count assertion vs `expectedGltfCount`

### CI/CD
- **CI-3** — pnpm/setup-node SHA split inside `ci.yml` (check matrix uses older SHAs than install job) — hoist to single SHA; or drop artifact-share for per-job pnpm cache
- **CI-6** — `automerge.yml` auto-merges before CI-1 fix — reassess after branch protection enabled
- **CI-7** — no post-publish `npm audit signatures` verify + no rollback runbook

### Testing
- **T-S3** — Zip-bomb ceiling tests (declared-size + streamed-bytes + exact-boundary) — use `yazl` harness
- **T-S4** — `--commit` hostile-ref tests + update `smoke.test.ts:36` (currently pins the vulnerable contract)
- **T-S5** — `readJson` malformed/wrong-shape/missing-file contract tests at 5 CLI entry points
- **T-S6** — Three `it.skip` stubs in `cli.test.ts:219,1426,1922` — fix or delete (per repo policy: stubs are bugs)
- **T-S7** — `__proto__` prototype-pollution test — tighten assertion to guard message, not just non-zero exit
- **T-P1** — Add pathfinding golden-path + `visited`-ceiling guard before heap refactor

### Documentation
- **H-DOC-1** — CLI reference self-referential rename artifact (`cli-reference.md:15`) — fix in `generate-cli-reference.ts` template
- **H-DOC-2** — No rename narrative for `medieval-hexagon-gameboard` → `declarative-hex-worlds` in CHANGELOG + no migration page — add both
- **H-DOC-3** — Five file-accepting CLI flags have no documented JSON schema or error contract — add "JSON input contract" subsection per flag in CLI reference
- **M-DOC-1** — `HEX_WORLDS_OUT_ROOT='/'` footgun documented only in source — add `<Aside type="danger">` to CLI reference docs

---

## P3 — Track in Backlog

### Code Quality
- `scenario/catalog.ts` at 2,401 lines — decompose taxonomy/filter/summary/rendering
- `simulation/script.ts` at 3,163 lines — decompose into `script-types.ts`, `script-validators.ts`, `script-index.ts`
- `gameboard/gameboard.ts` at 2,228 lines — decompose into `plan.ts`, `spawn-groups.ts`, `terrain.ts`
- `systems/systems.ts` at 900 lines — decompose into `systems/command.ts`, `systems/tick.ts`, `systems/events.ts`
- `hashFile` missing `'close'` event — use `stream/promises pipeline`
- Branded types migration: `HexKey`, `ActorId` etc. exist but widespread raw `string`; track migration per domain

### Architecture
- `noRestrictedImports` enforcement gaps (8+ missing paths including `../interop/internal`, `../internal/predicates`, `../traits/*`, `../config/*` deep paths) 
- `interop/coverage.ts` cohesion — release-readiness tooling in schema-migration domain; document or extract to `src/release/`
- `simulation/simulation.ts` double-shim — collapse into `index.ts`

### Performance
- `useStableOptions` JSON.stringify — add empty-options fast-path
- `guidePublicApiCoverage` O(N²) — pre-index by `publicApi` (CLI-only path)
- Nightly bench workflow with artifact upload — no perf signal on any merge currently

### Best Practices
- `tsconfig.json` `ignoreDeprecations: "6.0"` — remove; fix surfaced TS-6 deprecation warnings
- tsup `treeshake: true` explicit + size-budget vitest test
- `bootstrap/core.ts:588` `new URL(import.meta.url).pathname` → `import.meta.dirname` (Windows fix)
- Biome `noRestrictedImports` add `.js` variants for 35 of 36 paths
- `npm install -g npm@latest` — pin to specific major in `release.yml`
- `@cyclonedx/cyclonedx-npm@latest` — pin as devDependency, call via `pnpm exec`
- `as unknown as` double-casts in `manifest/schema.ts:231`, `_shared.ts:2716,2843`

### CI/CD
- `CI_GITHUB_TOKEN` PAT → repo-scoped GitHub App token
- Semgrep pip install caching
- Benchmark install-once artifact-share vs per-job pnpm cache

### Documentation
- `docs/` vs `docs-site/` — add contributor pointer to `CONTRIBUTING.md`
- Patrol state machine transitions — add state-diagram comment above `advancePatrolEntity`
- A* pathfinding inline commentary — name algorithm, annotate relaxation + abort
- Branded-types "NOT yet enforced" caveat — add to `public-api.md`
- `interop/coverage.ts` — add architecture note distinguishing release-tooling from runtime interop

---

## Positive Controls (do not regress)

The following are well-implemented and must be preserved through any refactoring:

- **SLSA L3 + OIDC trusted publishing** (`release.yml`) — SHA-pinned, real `id-token: write`, CycloneDX SBOM, `--provenance`, `persist-credentials: false` on every checkout
- **Redirect allowlist** (`core.ts:626-668`) — `new URL(location, url)` for relative resolution, depth-limited to 5, correct host allowlist
- **Zip-slip guard** (`core.ts:691-697`) — `relative(targetRoot, targetPath)` + `..` prefix check, real-time byte counter
- **Output path jail** (`_shared.ts:274-282`) — `safeResolveOutput` applied to all `--out*` flags; `relative(root, resolved)` + `sep` check is correct
- **Prototype pollution guard** (`_shared.ts:3726-3758`) — `readPieceSourceRoots` with `Object.create(null)`, `RESERVED_OBJECT_KEYS`, strict allowlist regex
- **koota queries module-scoped** — every `createQuery(...)` at module scope, no recreation in loops
- **`pnpm install --frozen-lockfile`** in all CI install steps
- **`pnpm audit --prod --audit-level=high`** as blocking release gate + `dependency-review-action` in PRs
- **`splitting: true` in tsup** — necessary for koota trait identity stability across 44 subpath entries
- **CI-enforced docs contract** — `audit-docs-contract.ts`, `audit-api-docs.ts` 0-warning gate — doc rot fails the build
- **koota queries module-scoped** — no recreated queries in loops
- **Test behavior orientation** — 897 `it` blocks assert observable outcomes, not internals

---

## Finding Counts by Phase

| Phase | Critical | High | Medium | Low |
|-------|----------|------|--------|-----|
| Code Quality | 1 | 3 | 5 | 5 |
| Architecture | 2 | 3 | 4 | 3 |
| Security | 0 | 3 | 4 | 3 |
| Performance | 1 | 4 | 5 | 5 |
| Testing | 2 | 4 | 3 | 4 |
| Documentation | 0 | 3 | 5 | 4 |
| Best Practices | 1 | 3 | 3 | 2 |
| CI/CD | 2 | 3 | 4 | 4 |
| **Total** | **9** | **26** | **33** | **30** |

P0 items (Critical, must fix before next release): **9**  
P1 items (High, fix before next release): **10 actionable clusters**  
P2 items (Medium, plan for next sprint): **~24**  
P3 items (Low, backlog): **~25**
