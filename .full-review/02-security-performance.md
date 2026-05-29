# Phase 2: Security & Performance Review

## Security Findings

### High

**H-1 — Unvalidated `--commit` / `{ref}` interpolated into GitHub URL** (`src/config/index.ts:64-70`, `src/cli/_shared.ts:313`)
CWE-601/918. Raw `.replace('{ref}', ref)` with user-supplied `--commit` string; no allowlist or percent-encoding. Risk: log injection, structural URL ambiguity. Fix: `SAFE_REF = /^[a-zA-Z0-9._\-\/]{1,200}$/` guard + `encodeURIComponent` on the `{ref}` slot.

**H-2 — Production CLI imports from `tests/integration/`** (`src/cli/_shared.ts:3-7`)
CWE-829. Three symbols imported from `../../tests/integration/simple-rpg/simple-rpg` into production CLI. Test code bundled into published tarball; test-only devDependency compromise becomes production compromise. Fix: move `listSimpleRpgGuidePublicApiExercises`, `runSimpleRpgExecutableGuideApiSmoke`, `summarizeSimpleRpgGuidePublicApiExercises` to `src/` and invert the dependency direction.

**H-3 — `readJson<T>` is a bare TypeScript cast with no runtime schema validation** (`src/cli/_shared.ts:397-398`, ~25 callers)
CWE-20. All `--scenario`, `--plan`, `--script`, `--routes`, `--recipe`, `--assignments` paths trust the caller's JSON shape at runtime. Only `readPieceSourceRoots` has a prototype-pollution guard. Fix: introduce `readValidatedJson` with Zod/Valibot schemas for the five user-facing document types; add file-size ceiling before `readFileSync` as immediate interim control.

### Medium

**M-1 — `resolveSimulationSpawnActor` `.at(-1) as SpawnGameboardActorOptions` unsafe cast** (`src/simulation/engine.ts:663-665`)
CWE-476. Empty array produces `undefined`; cast silently propagates to `spawnGameboardActor`, corrupting ECS world state. Fix: null-check + `throw new GameboardRuntimeError(...)`.

**M-2 — Nightly bootstrap workflow uses mutable version tags (`@v4`) for all 4 actions** (`.github/workflows/bootstrap-nightly.yml:28,30,34,74`)
CWE-829. Inconsistent with SHA-pinned `ci.yml`/`release.yml`/`cd.yml`; compounded by `HEX_WORLDS_OUT_ROOT='/'` in same workflow. Fix: mechanical SHA substitution matching existing workflows.

**M-3 — `stageFromZip` temp-dir cleanup not in `finally`** (`src/cli/commands/bootstrap/core.ts:371-405`)
CWE-459. Three separate `rmSync` error branches instead of `try/finally`; future code path between detection and `return` will leak staging directories. Fix: `let ok = false; try { ...; ok = true; } finally { if (!ok) rmSync(...) }`.

**M-4 — `HEX_WORLDS_OUT_ROOT='/'` widens output jail to filesystem root** (`.github/workflows/bootstrap-nightly.yml:53-60`)
CWE-22. With root `/`, any `--out /etc/...` value passes `safeResolveOutput`. Fix: narrow to `OUT_ROOT='/tmp'` in the nightly workflow.

### Low

**L-1** — `src/interop/internal` barrel pierced directly from `_shared.ts:57`. Re-export via public barrel.

**L-2** — `readSidecar` has no file-size ceiling before `readFileSync` + `JSON.parse` (`core.ts:560-572`). Add `statSync` size check + `files.length` sanity bound.

**L-3** — `walkFilesInternal` silently skips symlinks; a symlink-replaced GLTF produces a valid sidecar recording a 0-byte file. Add warning + count assertion against `expectedGltfCount`.

---

## Performance Findings

### Critical

**P-1 — A* open-set `lowestScoreKey` is O(|open|) linear scan per iteration** (`src/coordinates/coordinates.ts`)
On a 127-tile board, ~7,600 comparisons per path. Ten patrolling agents = 76,000 comparisons/tick. Same issue in `reachableGameboardTiles` (Dijkstra variant). Fix: replace `Set<string>` open list with a binary min-heap. Expected speedup: 3–8x medium boards, 15–30x large boards.

### High

**P-2 — `findPlacementEntity` / `findTileEntity` O(N) scan on every access** (`src/koota/koota.ts:582-599`)
O(N) `world.query(...).find(...)` called on every simulation step, patrol advance, spawn. Fix: `WeakMap<World, Map<string, Entity>>` indexes updated on spawn/destroy. O(N) → O(1). Eliminates 120,000 comparisons/second at 10 agents, 60 Hz.

**P-3 — `isKnownExtraAssetId` nested loops on every placement spawn** (`src/scenario/catalog.ts:1221`)
~136 string operations per call; called twice per `spawnGameboardPlacement`. 200-placement load = ~27,200 string ops. Fix: pre-compute `Set<string>` at module init. O(136) → O(1) per spawn.

**P-4 — `findGameboardPath` / `reachableGameboardTiles` rebuild `new Map` in default arguments** (`src/gameboard/navigation.ts:513-514, 562-563`)
O(N) allocation per call bypassing the `gameboardPlanIndex` WeakMap cache. Fix: route defaults through `gameboardPlanIndex`.

**P-5 — `[...world.query(...)]` spread allocates fresh array every tick** (`src/patrol/patrol.ts:227`, `src/movement/movement.ts:421`)
Direct iteration of koota query iterable avoids allocation. Simple: `for (const entity of world.query(...))`.

### Medium

**P-6 — `requirePlacementState` deep spread per entity per tick** (`src/patrol/patrol.ts`)
4 object allocations per patrol tick per entity = 2,400 allocs/sec at 10 agents, 60 Hz. Fix: only deep-copy on final result snapshot, not every early-return branch.

**P-7 — `runGameboardSystems` event array: three `flatMap` + two spreads per tick** (`src/systems/systems.ts:555-563`)
Fix: pre-allocate single array, push directly. Lazy `snapshotGameboardSystemEvents` conversion.

**P-8 — `freeManifest` 380 KB eager literal loaded at module init** (`src/manifest/free.ts`, `src/gameboard/gameboard.ts`)
`gameboard.ts` statically imports `freeManifest`; any consumer parsing the `gameboard` entry point pays 380 KB parse on module load. `loadFreeManifest()` async lazy export already exists — promote it; make the static import dynamic inside the functions that need it.

**P-9 — `spawnGameboardPlacement` doesn't receive `tileIndex` during bulk `loadGameboardWorld`** (`src/koota/koota.ts`)
400 placements × O(200) scan = 80,000 comparisons that should be O(1). Fix: thread `tileIndex` through `spawnGameboardPlacement` as optional parameter.

**P-10 — `useGameboardDerivedRevision` mounts 30+ trait subscriptions per component** (`src/react/react.ts:325-400`)
Any trait write triggers every selector hook to re-run. Fix: domain-split revision counters + microtask coalescing.

### Low

**P-11** — `useStableOptions` JSON.stringify on every render; add empty-options fast-path.

**P-12** — `guidePublicApiCoverage` O(N²) in CLI/report path; pre-index by `publicApi`.

**P-13** — `selectSpawnCoordinates` O(N²) spacing check; negligible at current board sizes.

**P-14** — `manifest/free` chunk not isolated (follows from fixing P-8 static import).

---

## Critical Issues for Phase 3 Context

- **H-2 test import layering** + **H-3 unvalidated readJson**: Both affect testing strategy — H-2 means integration tests currently exercise code that's importing back from them; H-3 means there are no schema-validation tests covering the five user-facing document types.
- **P-1 A* heap**: No performance regression test exists. Any change to `findGameboardPath` risks silently regressing pathfinding correctness or O-complexity.
- **P-8 manifest eager import**: Browser visual tests can't currently distinguish "gameboard entry point loaded eagerly" vs "lazily"; test coverage for the `loadFreeManifest` async path is unclear.
- **H-3 readJson callers**: `--scenario`, `--plan`, `--script`, `--routes`, `--recipe` all lack documented or tested error contracts for malformed input — relevant for both test and doc gaps.
