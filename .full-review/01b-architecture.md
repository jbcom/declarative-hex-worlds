# Architecture Review — declarative-hex-worlds

**Reviewed:** 2026-05-28  
**Scope:** Full `src/` codebase — 18+ domain modules, ECS via koota, CLI via citty, simulation engine, config subsystem, public API surface

---

## Executive Summary

The codebase demonstrates a thoughtfully evolved domain-barrel architecture that largely succeeds at its stated goals: browser-safe core, node-only CLI/ingest isolation, ECS trait centralization, and cross-domain import discipline enforced by biome `noRestrictedImports`. Most architectural decisions are correct and well-motivated. The findings below are ordered by severity and describe concrete coupling violations, incomplete enforcement, and cohesion gaps that warrant attention.

---

## Finding 1 — `koota` domain imports from `scenario` (layering inversion)

**Severity: High**  
**Impact: High**

`src/koota/koota.ts` (line 16) imports `isKnownExtraAssetId` from `'../scenario'`. The dependency arrow runs `koota → scenario`, meaning the low-level ECS world-management layer depends on the high-level authored-content layer. This is an inversion of the natural dependency hierarchy:

```
types → traits → gameboard → koota → scenario → simulation
```

The function `isKnownExtraAssetId` is used during `spawnGameboardPlacement` / `updateGameboardPlacement` to auto-derive the `requiresExtra` flag when an `assetId` is supplied but `requiresExtra` is not explicitly set. The check itself is catalog-membership logic that belongs in the authored-content layer.

**Recommendation:** Move `requiresExtra` inference out of `koota`. Options in order of preference:

1. Require callers to pass `requiresExtra` explicitly — the field is already on the options interface; remove the auto-derive entirely. This is the cleanest; the two call sites in `simulation/engine.ts` and user code can compute it before calling spawn/update.
2. Move `isKnownExtraAssetId` to `src/types/` or `src/manifest/` so it depends only on the manifest catalog constant array, removing the scenario import from koota entirely.
3. Accept `requiresExtra` as an optional callback parameter typed `(assetId: string) => boolean` in `SpawnGameboardPlacementOptions`, keeping the default null and letting the caller inject the check. This inverts the dependency correctly without removing the convenience.

---

## Finding 2 — `src/cli/_shared.ts` pierces `interop/internal` barrel (enforcement gap)

**Severity: High**  
**Impact: Medium**

`src/cli/_shared.ts` line 57:

```ts
import { GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS } from '../interop/internal';
```

This is a direct deep-path import from `interop/internal` — the module explicitly marked `@internal` and excluded from the barrel. The `biome.json` `noRestrictedImports` rule does **not** list `../interop/internal` or `../interop/internal.js` as restricted paths, so this violation goes silently undetected by the linter.

This matters because `interop/internal` holds symbols intended as implementation detail between `interop/*.ts` siblings. Leaking them into CLI code couples the CLI formatter layer to interop internals. It also means the symbol cannot be refactored without checking CLI consumers.

**Recommendation:**

1. Add `"../interop/internal"` and `"../interop/internal.js"` to `noRestrictedImports` paths in `biome.json` immediately — catches future violations.
2. Export `GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS` through the `src/interop/index.ts` barrel (or create a dedicated `src/interop/artifacts.ts` sub-module re-exported via the barrel) so the CLI import becomes `from '../interop'`.

---

## Finding 3 — `simulation/index.ts` → `simulation/simulation.ts` double-shim adds unnecessary indirection level

**Severity: Medium**  
**Impact: Low**

The simulation domain has two shim files:

- `simulation/index.ts` (19 lines): `export * from './simulation'`
- `simulation/simulation.ts` (43 lines): selective re-exports from `./script`, `./engine`, `./assertions`, `./report`

The `index.ts` comment says the split "lands in a dedicated commit (D3)" but that commit has already landed — `engine.ts`, `script.ts`, `report.ts`, and `assertions.ts` all exist. The `simulation.ts` shim file now serves no architectural purpose: it is a pass-through between `index.ts` and the actual implementation files. The existing arrangement produces two module hops (`index → simulation → script/engine/report/assertions`) instead of one (`index → script/engine/report/assertions`).

**Recommendation:** Collapse `simulation/simulation.ts` into `simulation/index.ts`. Move the selective export logic (including the deliberate omission of `@internal` record builders) directly into `index.ts`. Delete `simulation/simulation.ts`. The barrel contract with consumers is unchanged.

---

## Finding 4 — `simulation/script.ts` at 3,163 lines violates Single Responsibility

**Severity: Medium**  
**Impact: Medium**

`simulation/script.ts` is the largest non-generated source file (excluding `manifest/free.ts` which is autogenerated data). It contains at least five distinct responsibilities based on its export count (160 `export`/`const`/`function`/`interface`/`type` declarations):

- Simulation step-action type definitions and discriminators
- Script validation (authored-script schema validators, `validateGameboardScenarioSimulationScript`)
- Scenario index helpers (`buildSimulationScenarioIndex`, `SimulationScenarioIndex`)
- Step payload type interfaces for every step action
- Schema version constants and published `GAMEBOARD_SCENARIO_SIMULATION_*` constants

At 3,163 lines a single reader cannot hold the whole file in their head, and changes to validation logic create unnecessary churn across step type definitions and vice versa.

**Recommendation:** Decompose into three files within `simulation/`:

- `script-types.ts` — step-action type interfaces, discriminators, and schema constants (stable, rarely changes)
- `script-validators.ts` — `validateGameboardScenarioSimulationScript` and its recursive validators
- `script-index.ts` — `buildSimulationScenarioIndex`, `SimulationScenarioIndex`, and tile-key helpers

Re-export all through `simulation/simulation.ts` (or directly from `simulation/index.ts` after collapsing Finding 3). Public surface is unchanged.

---

## Finding 5 — `src/systems/systems.ts` owns four distinct systems in one 900-line file

**Severity: Medium**  
**Impact: Medium**

`systems/systems.ts` aggregates command dispatch, patrol advancement, movement advancement, and quest advancement — four separate tick-loop concerns — plus their event-type discriminators and result interfaces. The module comment acknowledges a planned split ("will split per-system as the simulation grows") but the 900-line file currently crosses the reader-can-hold-it-in-head threshold. Cross-system event handling is the main coupling: the `runGameboardSystems` function calls `patrolEvents`, `movementEvents`, and `questEvents` on results from three separate subsystems and merges them.

The `systems.ts` file is also the single most-cross-depended-upon domain in the codebase (134 cross-domain import occurrences from the grep analysis).

**Recommendation:** Decompose along system lines now rather than after further growth:

- `systems/command.ts` — `dispatchGameboardInteractionCommand`, `runGameboardInteraction`, action bundle entry points
- `systems/tick.ts` — `runGameboardSystems`, options/result interfaces, the merge logic
- `systems/events.ts` — event type union, `GameboardSystemEvent`, `GameboardSystemEventRecord`, snapshot helpers
- `systems/index.ts` — barrel re-export, unchanged public surface

The split is mechanical: each function already delegates to `../movement`, `../patrol`, `../quests`. The merge logic in `tick.ts` is ~30 lines.

---

## Finding 6 — `src/gameboard/gameboard.ts` at 2,228 lines is a single-file monolith

**Severity: Medium**  
**Impact: Medium**

The gameboard domain has only two implementation files: `gameboard.ts` (2,228 lines) and `navigation.ts` (1,202 lines), with `occupancy.ts` at a thin 93 lines. `gameboard.ts` owns plan schema types, tile spec building, spawn-group expansion, procedural generation helpers, plan merging, and the terrain/elevation decomposition utilities used by `src/coordinates/`. This is five distinct responsibility clusters in one file.

**Recommendation:** Decompose `gameboard.ts`:

- `gameboard/plan.ts` — `GameboardPlan`, tile specs, placement specs, schema constants
- `gameboard/spawn-groups.ts` — `GameboardSpawnGroup` expansion, route-set normalization
- `gameboard/terrain.ts` — terrain/elevation decomposition, `readDecomposedTileSpecs`, `readValidationGameboardPlanFromWorld`
- `gameboard/index.ts` — barrel, unchanged public surface

---

## Finding 7 — `interop/coverage.ts` cohesion mismatch: release-readiness tooling in schema-migration domain

**Severity: Medium**  
**Impact: Low**

The `interop` domain's stated purpose is "schema migration, version compatibility, and coverage." The first two are clearly interop concerns. However, `interop/coverage.ts` (1,002 lines) contains release-readiness tooling: `GameboardCoverageReport`, `summarizeGameboardCoverage`, `VisualArtifactCoverage`, `GuidePageCoverage`, and the `SimpleRpgEvidence` matrix. This is CI/developer-tooling territory, not interoperability.

`interop/coverage.ts` imports from `./internal` which holds `GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS` — a compile-time constant list of required screenshot filenames. The CLI's `coverage` subcommand is the primary consumer. This means the library ships release-readiness metadata as part of its public API surface (it is accessible via `'declarative-hex-worlds/coverage'` export).

**Recommendation:** Either:

1. Accept the current placement as deliberate (coverage/release-readiness IS a documented consumer-facing capability of the library) and document it more clearly in the `interop/` barrel comment — distinguish "schema interop" from "release-readiness coverage" as two distinct sub-concerns.
2. Extract to a new `src/release/` domain that is CLI-only (not re-exported from `src/index.ts`) and accessed via a dedicated `./release` subpath. This keeps `interop` focused on schema migration/compatibility.

---

## Finding 8 — Branded types migration is incomplete and inconsistently enforced

**Severity: Medium**  
**Impact: Low**

`src/types/brands.ts` defines `HexKey`, `ActorId`, `TileId`, `PlacementId`, `ScenarioId`, `QuestId`, `ObjectiveId`, `PatrolRouteId`, `AssetId`, and `PieceId` as phantom-typed branded strings. The module comment states "Branded types are NOT yet enforced across the codebase — Epic R2 introduces them progressively." 

The practical consequence: large portions of the API accept raw `string` for IDs, silently. `hexKey()` returns `HexKey` (branded) but many functions in `koota.ts`, `gameboard.ts`, and `scenario.ts` accept `string | HexCoordinates` at the entry points and pass `string` through internally. The brand types exist in the published surface (`./types` subpath) but deliver no compile-time safety until adoption is complete.

**Recommendation:** Establish an explicit milestone tracking the brand migration status per domain. Each domain barrel should have a one-line comment marking whether it is "brand-complete." Prioritize `koota.ts` first (it is the ECS entity-management layer — ID confusion there has runtime consequences). Use `zod` or a dedicated validator at parse boundaries to ensure `brandHexKey()` is called exactly at input validation time, not scattered through internal logic.

---

## Finding 9 — `src/runtime/asset-root.ts` uses `process.env` without bundler-safe guard — minor browser risk

**Severity: Low**  
**Impact: Low**

`src/runtime/asset-root.ts` line 84 reads:

```ts
const fromEnv = typeof process !== 'undefined' ? process.env?.[GAMEBOARD_ASSET_ROOT_ENV_VAR] : undefined;
```

The `typeof process !== 'undefined'` guard is correct for browser safety with most bundlers. However, Vite (the most common browser build tool for Three.js consumers) statically replaces `process.env.*` references at build time using `define`. If a consumer's Vite config does not define `process.env.HEX_WORLDS_ASSET_ROOT`, Vite's default behavior produces `undefined` inline — which is fine. But if they set `envPrefix` to exclude `HEX_WORLDS_*`, the reference becomes an undefined variable at runtime.

The more idiomatic browser-safe pattern is `import.meta.env.HEX_WORLDS_ASSET_ROOT` (Vite) vs. a runtime fallback — but `import.meta.env` is a Vite-specific extension not available in all bundlers.

**Recommendation:** Document in the API docs that `process.env.HEX_WORLDS_ASSET_ROOT` is resolved by the bundler at build time for browser consumers and may require an `define` entry. The existing guard prevents runtime crashes; the issue is documentation completeness, not a code bug.

---

## Finding 10 — Barrel enforcement gap: `src/internal` and `../traits/*` sub-files not in `noRestrictedImports`

**Severity: Low**  
**Impact: Low**

The biome `noRestrictedImports` list (37 paths) covers the major domain internals but omits:

- `../interop/internal` / `../interop/internal.js` (confirmed gap — Finding 2 above exploits this)
- `../internal/*` deep paths (cross-domain shared utilities module)
- `../traits/board`, `../traits/actors`, `../traits/movement`, `../traits/patrol`, `../traits/quests` — the individual trait files

The traits sub-files are not listed as restricted, meaning a module could import `from '../traits/board'` instead of `from '../traits'` and pass the linter unchallenged.

**Recommendation:** Add the missing paths to `noRestrictedImports`. The traits sub-files are: `../traits/board`, `../traits/actors`, `../traits/movement`, `../traits/patrol`, `../traits/quests`, `../traits/board.js`, etc. Add the full set. The pattern `"../interop/internal"` and `"../internal/predicates"` should also be added.

---

## Finding 11 — `config` domain is browser-safe but not in `noRestrictedImports`; no barrel enforcement

**Severity: Low**  
**Impact: Low**

`src/config/index.ts` is marked `@internal` and not in `package.json#exports` — correct. However the `noRestrictedImports` list does not include any `../config/*` paths. A module could import `from '../config/kaykit-source.json'` directly with no linter warning. The config module is a pure JSON loader with no node builtins, so the safety risk is low, but the consistency of the enforcement pattern is violated.

**Recommendation:** Add `"../config/index"`, `"../config/bootstrap-paths.json"`, `"../config/kaykit-source.json"`, and `"../config/upstream-layouts.json"` to `noRestrictedImports` so any external consumer of config goes through the barrel.

---

## Architecture Pattern Assessment

### Strengths

**ECS trait centralization is correct.** Trait definitions in `src/traits/` import only `koota` (the npm dep) and pure-type imports. This solves the evaluation-cycle problem documented in the traits barrel comment. The pattern correctly separates schema (traits) from world-management (koota) from domain logic (systems, simulation).

**Browser-safety boundary is largely respected.** `src/index.ts` does not transitively pull in `node:` builtins through any of its 21 `export *` lines. The `ingest` and `cli` domains are correctly excluded from the root barrel. The only node-touching modules accessible from the public surface are `manifest/index.ts` (browser-safe — pure JSON) and `runtime/asset-root.ts` (guarded `process.env` read, discussed in Finding 9). This is a well-executed boundary.

**Dependency direction is mostly correct.** The dependency graph flows: `types → internal → errors → traits → coordinates → gameboard → koota → commands/actors/scenario → simulation/systems`. The exception is Finding 1 (`koota → scenario`).

**Barrel-only cross-domain import rule is well-enforced.** The 37-path `noRestrictedImports` list catches the most common violations. The gaps identified (Findings 2, 10, 11) are narrow.

**Lazy CLI subcommand loading is correctly implemented.** The citty command map uses `() => import('./commands/<name>')` for all 30+ subcommands, so the cold-start path loads only the citty dispatcher and the single matching subcommand module. This is the correct approach for CLI startup performance.

**Simulation domain decomposition is complete.** Despite the stale `index.ts` comment (Finding 3), the actual split into `engine.ts`, `script.ts`, `report.ts`, and `assertions.ts` has landed and is architecturally sound. The `simulation/internal.ts` anti-cycle device (holding `SIMULATION_STEP_ACTIONS` to prevent a `script.ts → internal → script.ts` TDZ crash) is a pragmatic and documented workaround.

**`splitting: true` in tsup preserves koota trait identity.** The comment in `tsup.config.ts` correctly identifies the problem: koota uses object reference equality for trait identity, so shared chunks prevent duplicate trait objects when consumers mix `declarative-hex-worlds` subpaths. The configuration correctly addresses this.

### Cohesion Summary by Domain

| Domain | Cohesion | Notes |
|---|---|---|
| `types` | High | Pure vocabulary types, no runtime deps |
| `errors` | High | Single error hierarchy, zero external deps |
| `traits` | High | Pure koota trait declarations, no sibling imports |
| `internal` | High | Shared predicates only |
| `config` | High | Pure JSON loader, correctly internal-only |
| `coordinates` | High | Math/geometry, no domain deps |
| `selectors` | High | Tile-variant selection, narrow purpose |
| `rules` | High | Validation logic, clean boundary |
| `commands` | Medium-High | Interaction command dispatch — single concern |
| `actors` | Medium | 2,259 lines; actor state + targeting + snapshot in one file |
| `movement` | Medium | Acceptable size, focused |
| `patrol` | Medium | Acceptable size, focused |
| `quests` | Medium | Acceptable size, focused |
| `pieces` | Medium | 940 lines, single concern |
| `manifest` | Medium | `free.ts` is 16,580 lines of autogenerated data — not a code quality issue but worth noting |
| `gameboard` | Medium-Low | `gameboard.ts` at 2,228 lines owns too many responsibilities (Finding 6) |
| `koota` | Medium-Low | Layering violation (Finding 1); otherwise well-bounded |
| `scenario` | Medium-Low | `catalog.ts` at 2,401 lines; blueprint + catalog + recipe are distinct concerns co-located |
| `systems` | Medium-Low | 900-line monolith with 4 distinct tick-loop systems (Finding 5) |
| `simulation` | Medium-Low | `script.ts` at 3,163 lines needs decomposition (Finding 4); double-shim (Finding 3) |
| `interop` | Low-Medium | Coverage responsibility mismatch (Finding 7) |
| `react` | Medium | 1,255 lines; likely multiple React hook concerns; not deep-reviewed |
| `three` | Not reviewed | |
| `runtime` | Medium | Two files, focused purpose, `process.env` guard adequate |
| `cli` | Medium-Low | `_shared.ts` at 4,059 lines is a CLI utility blob; barrel violation (Finding 2) |
| `ingest` | Medium | Single file, node-only, correctly isolated |

---

## Priority Remediation Sequence

1. **Fix Finding 1** (koota → scenario inversion) — architectural debt that grows with every new koota consumer
2. **Fix Finding 2** (CLI barrel pierce + missing biome rule) — adds biome coverage first, then move the import
3. **Fix Finding 10** (biome enforcement gaps for traits and interop/internal) — mechanical biome.json edit
4. **Fix Finding 5** (systems.ts decomposition) — enables independent modification of command vs tick vs event code
5. **Fix Finding 3** (simulation double-shim collapse) — removes dead indirection
6. **Fix Finding 4** (script.ts decomposition) — enables focused changes to type defs vs validators vs indexers
7. **Fix Finding 6** (gameboard.ts decomposition) — medium effort, deferred until gameboard surface stabilizes
8. **Address Finding 7** (interop/coverage home) — depends on team decision about coverage as public API
9. **Drive Finding 8** (branded types) — Epic R2 work, track per-domain status explicitly
