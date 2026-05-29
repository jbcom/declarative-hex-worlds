# Phase 1: Code Quality & Architecture Review

## Code Quality Findings

### High
1. **`src/cli/_shared.ts` God Module** (4,059 lines) — 20+ command implementations, 18+ formatters, all flag parsers, file readers, GLTF extraction in one file. Individual command files are 7-line delegates with zero logic. Cannot isolate tests per command; every change risks coupling across commands.

### Medium
2. **Tripled output pattern** (write/JSON/text) repeated verbatim 15+ times across `_shared.ts` — extract `emitOutput()` helper.
3. **Error-and-exit validation duplication** — `layoutAnalysisPlanFromArgs` exits internally AND callers repeat the exit check; control flow is ambiguous.
4. **`resolveSimulationSpawnActor` unsafe casts** (`engine.ts:648–666`) — two unsafe `as` casts; `.at(-1)` can return `undefined` silently typed as `SpawnGameboardActorOptions`.
5. **`commandHandlerMutations` exhaustiveness guard** (`engine.ts:462–501`) — returns `never` silently; should throw `GameboardRuntimeError` so future union variants are caught at runtime.
6. **`readJson<T>` false type-safety** (`_shared.ts:397`) — no schema validation; 25 callers trust structural cast on user-supplied files. Rename to `parseJsonUnchecked` and add guards on `--scenario`/`--script`/`--routes` entry points.
7. **`advancePatrolEntity` complexity** (`patrol.ts:230–342`) — 8 early-return branches, 4 mutable state writes interleaved; extract phase-based state machine.
8. **`_shared.ts` imports from `tests/integration/`** (lines 3–7) — layering inversion; production code depends on test infrastructure; defeats tree-shaking for all `_shared` consumers.

### Low
9. **`hashFile` missing `'close'` event** (`bootstrap/core.ts:550`) — use `stream/promises pipeline` as done elsewhere in the same file.
10. **`stageFromZip` manual `rmSync` in 3 error branches** — use `finally` instead.
11. **Long lines in hot paths** — `patrol.ts:205` (128 chars), `movement.ts:445,569`.
12. **`scenario/catalog.ts`** (2,401 lines) — likely mixes taxonomy data, filter logic, summary computation, markdown rendering; warrants targeted follow-up.
13. **`resolveCurrentWaypointIndex` silent alignment fallback** — returns index 0 without warning when `alignToCurrentTile` finds no match.

---

## Architecture Findings

### High
1. **`koota` imports from `scenario`** (`koota.ts:16` — `isKnownExtraAssetId`) — inverts the dependency hierarchy (`koota` should not depend on `scenario`). Fix: remove auto-derive, require callers to pass `requiresExtra` explicitly, or move function to `src/types/`/`src/manifest/`.
2. **`cli/_shared.ts` pierces `interop/internal` barrel** (`_shared.ts:57` — `from '../interop/internal'`) — biome `noRestrictedImports` does not list `../interop/internal`, so this violation goes undetected. Fix: add to `noRestrictedImports`; export symbol via `interop/index.ts` barrel.

### Medium
3. **`simulation/simulation.ts` dead double-shim** — the D3 split has landed; `index.ts → simulation.ts → engine/script/report/assertions` is two hops for no reason. Collapse `simulation.ts` into `index.ts`.
4. **`simulation/script.ts` at 3,163 lines** — five distinct responsibilities: step-action types, script validators, scenario index helpers, step payload interfaces, schema constants. Decompose into `script-types.ts`, `script-validators.ts`, `script-index.ts`.
5. **`systems/systems.ts` at 900 lines** — four distinct tick-loop systems (command dispatch, patrol, movement, quest) plus event types. Decompose into `systems/command.ts`, `systems/tick.ts`, `systems/events.ts`.
6. **`gameboard/gameboard.ts` at 2,228 lines** — plan schema, spawn-group expansion, procedural generation, terrain decomposition: four clusters. Decompose into `plan.ts`, `spawn-groups.ts`, `terrain.ts`.
7. **`interop/coverage.ts` cohesion mismatch** — release-readiness tooling (`GameboardCoverageReport`, `SimpleRpgEvidence`) sits inside the schema-migration domain. Either document as deliberate public API or extract to `src/release/`.
8. **Branded types migration incomplete** (`src/types/brands.ts`) — `HexKey`, `ActorId`, etc. exist but large portions of API accept raw `string`. No per-domain tracking of migration status.

### Low
9. **`runtime/asset-root.ts` `process.env` guard** — correct but undocumented for Vite consumers needing `define` config.
10. **`noRestrictedImports` enforcement gaps** — missing: `../interop/internal`, `../internal/predicates`, `../traits/board`, `../traits/actors`, `../traits/movement`, `../traits/patrol`, `../traits/quests`, all `../config/*` deep paths.
11. **`config` domain not in `noRestrictedImports`** — modules can import JSON files directly from `../config/`.

---

## Critical Issues for Phase 2 Context

- **`_shared.ts` imports from `tests/`** (Finding CQ-8): If the test helper does any I/O or network calls, this creates a potential attack surface in the CLI.
- **`readJson<T>` without validation** (Finding CQ-6): User-supplied files are cast without schema checks — malformed or adversarial JSON produces unclear runtime errors; relevant for security review of CLI entry points (`--scenario`, `--script`, `--routes`, `--plan`).
- **`koota → scenario` dependency inversion** (Finding AR-1): Performance-relevant — every `spawnGameboardPlacement` call touches `isKnownExtraAssetId` which may traverse the scenario catalog.
- **`resolveSimulationSpawnActor` `.at(-1)` silent undefined** (Finding CQ-4): Could produce a null-reference equivalent at runtime under edge conditions in simulation; worth verifying in security/robustness review.
- **`stageFromZip` cleanup** (Finding CQ-10): Temp dir leaks on error paths — relevant to the security/bootstrap review.
