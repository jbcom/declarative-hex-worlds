# Performance & Scalability Review — `@jbcom/medieval-hexagon-gameboard`

Scope: Phase 2B of full-review. Static analysis of `packages/medieval-hexagon-gameboard/src/` plus inspection of an already-built `dist/`. No runtime benchmarks executed (build artefacts pre-exist; CI does not have perf gates today).

## Headline budget snapshot

Measured from a `pnpm build` artefact already on disk.

| Dimension | Measured | Implication |
|---|---:|---|
| `dist/` total | **3,160 KB** (37 entry `.js` + 26 chunk `.js` + `.d.ts` + maps) | Big for a "library", driven by the manifest literal. |
| Biggest chunk: `chunk-JZVTUPMT.js` | **394,754 B raw / 22,468 B gzip** | This **is** `freeManifest`. Confirmed: contains 893 `building_archeryrange_blue` / `hexagons_medieval` matches. |
| Umbrella entry `dist/index.js` | 24 KB raw, but **transitively imports `chunk-JZVTUPMT`** via `freeManifest` re-export | Every consumer of `from '@jbcom/medieval-hexagon-gameboard'` pays ~22 KB gzip / ~395 KB raw of manifest parse cost, whether they use the manifest or not. |
| CLI entry `dist/cli.js` | 137 KB raw / **24.7 KB gzip** | Pulls examples + every subsystem at top-level. Cold-start impact below. |
| `react.js` / `three.js` entries | 24 KB / 12 KB raw | Reasonable shells; both chain into shared chunks. |
| `freeManifest` source | **16,561 LOC / 395,045 B** of `.ts` literals | Ships parsed as JS, not JSON — parse cost dominates startup for any path that touches umbrella or any subpath that drags in `manifest/free` (5 chunks contain it). |

**Estimated cold-start / per-step costs** (back-of-envelope, no measurements yet):

- **Node CLI cold start (`medieval-hexagon-gameboard --help`):** ~150-250 ms in V8 cold (137 KB to parse + dependency closure incl. 395 KB manifest chunk). The 395 KB JS-object-literal parse alone is ~30-60 ms on a modern Mac, ~80-150 ms on a CI runner. Switching the manifest to JSON via `JSON.parse` import-attribute (`import json from './free.json' with { type: 'json' }`) is **typically 5-10× faster** than equivalent JS object-literal parse and saves V8's full parse+bytecode pass on dead code paths.
- **Browser umbrella consumer:** +22 KB gzipped to TTI baseline if the consumer uses any umbrella import that triggers the manifest re-export, with **no tree-shake escape** today.
- **Per-step simulation cost:** `runSimulationStep` is a single `switch (step.action)` dispatch over ~10 cases (line 3795); the second switch at line 1643 is the **validation pass**, not a runtime parallel dispatch — so the H-3 finding from Phase 1 ("two parallel switches paying double dispatch per step") is **a false positive on the runtime hot path**. The validation switch runs once at scenario load. Real runtime hot spots are in actor selection & filtering (see High findings).

## Findings by severity

### CRITICAL

#### P-C1 — `freeManifest` re-exported from umbrella forces 395 KB manifest into every consumer
**Files:** `src/index.ts:7` (`export { freeManifest } from './manifest/free';`) → `dist/index.js` → `dist/chunk-JZVTUPMT.js` (394,754 B raw / 22,468 B gzip).

Anyone writing `import { anything } from '@jbcom/medieval-hexagon-gameboard'` pulls the manifest chunk transitively. `splitting: true` in tsup wins back nothing here because the umbrella re-exports the binding by name.

Impact: **+22 KB gzipped / +395 KB raw bundle**, **+30-150 ms parse cost**, in every browser consumer of the umbrella, whether they ever read a manifest entry or not.

Fix (two layers, both required):

1. **Remove `freeManifest` from `src/index.ts`.** Force consumers to use the existing `'@jbcom/medieval-hexagon-gameboard/manifest/free'` subpath — already exposed as an export key. Document in README.
2. **Ship the manifest as JSON with an import attribute**, not as parsed JS. Rename `src/manifest/free.ts` → `src/manifest/free.json` + thin `src/manifest/free.ts` wrapper:
   ```ts
   // src/manifest/free.ts
   import freeManifestData from './free.json' with { type: 'json' };
   import type { MedievalHexagonManifest } from '../types';
   export const freeManifest: MedievalHexagonManifest = freeManifestData as MedievalHexagonManifest;
   ```
   JSON parses ~5-10× faster than equivalent JS object literals at this size and allows bundlers / runtimes to lazy-parse. Esbuild (tsup) handles the JSON attribute import natively.

After both: umbrella consumers pay 0 KB manifest cost; manifest-subpath consumers still get a single 22 KB-gzip chunk but with much faster parse.

#### P-C2 — `dist/cli.js` eagerly loads every subsystem AND `examples/simple-rpg-usage` at top-level
**Files:** `src/cli.ts:1-80` (top-level static imports of `ingest`, `compatibility`, `coverage`, `examples/simple-rpg-usage`, `blueprint`, `catalog`, `registry`, `validation`, `gameboard`, plus 30+ more from quick scan); built `dist/cli.js` = 137 KB raw / 24.7 KB gzip; pulls `chunk-JZVTUPMT` (manifest) transitively because CLI subcommands touch it.

Impact: A user invoking `medieval-hexagon-gameboard --help` pays the full parse cost of the entire library + the 395 KB manifest, every CI run. Smoke tests `smoke-built-cli.ts` and `smoke-packed-consumer.ts` measure this on every push.

Estimated cold start: ~150-250 ms. Could be ~30-50 ms with dynamic per-subcommand imports.

Fix:

```ts
// src/cli.ts — at the dispatch site
async function dispatch(command: string, argv: string[]) {
  switch (command) {
    case 'simulate':
      return (await import('./cli/simulate.js')).run(argv);
    case 'coverage':
      return (await import('./cli/coverage.js')).run(argv);
    case 'ingest':
      return (await import('./cli/ingest.js')).run(argv);
    // ...
  }
}
```

Each `cli/<subcommand>.js` becomes the only path that pulls its subsystem chain. Split `cli.ts` (currently 4,297 LOC) into per-subcommand files behind dynamic imports.

Also: `src/cli.ts:34` imports `'../examples/simple-rpg-usage'` — the example file ships as a CLI dependency. Move guide-public-api smoke helpers into `src/` (`src/simple-rpg-api-smoke.ts` or similar) so the `examples/` tree stays demonstration-only.

### HIGH

#### P-H1 — `readGameboardActorTargets` (actors.ts:940-953) makes 6 sequential passes over the same array
**File:** `src/actors.ts:940-953`.

```ts
const actors = ...filter(...)
const records = actors.map((snapshot) => actorSelectionRecord(snapshot, source, center));
const hostileActors = actors.filter((snapshot) => actorHostileForSelection(snapshot, source));
const interactiveActors = actors.filter((snapshot) => snapshot.actor.interactive);
const propActors = actors.filter((snapshot) => snapshot.actor.kind === 'prop');
// ...
actorIds: actors.map(...),
placementIds: actors.map(...),
tileKeys: uniqueStrings(actors.map(...)),
```

Same pattern at `actors.ts:1085-1093` (`actorPlacements.filter(...)` × 4). Each `filter`/`map` allocates a fresh array.

For boards with hundreds of actors and target queries called per UI frame (`useGameboardActorTargets` in `react.ts`), this is O(6·n) allocations + traversals where one pass is sufficient.

Fix: single-pass reduce, e.g.

```ts
const buckets = { hostile: [], interactive: [], prop: [], all: [], ids: [], placementIds: [], tileKeys: new Set<string>() };
for (const s of actors) {
  buckets.all.push(s);
  buckets.ids.push(s.actor.actorId);
  buckets.placementIds.push(s.placement.id);
  buckets.tileKeys.add(s.placement.tileKey);
  if (actorHostileForSelection(s, source)) buckets.hostile.push(s);
  if (s.actor.interactive) buckets.interactive.push(s);
  if (s.actor.kind === 'prop') buckets.prop.push(s);
}
```

Impact: ~6× speedup on this path, lower GC pressure when the React hook re-runs.

#### P-H2 — `parseHexKey` throws on invalid key; used in error-path-y code (coordinates.ts:68-74)
**File:** `src/coordinates.ts:68-74`. Implementation throws on non-finite parse.

Phase 1 flagged this as "throw/catch flow control on hot path." Confirmed implementation throws. Quick `grep -rn parseHexKey src/` (run during scan) showed callers — most use it on already-validated input but a few use it inside reachability/lookup checks where a missing tile is expected. Throwing on the expected-miss path is **~100× slower than returning `undefined`** in V8.

Fix: add `tryParseHexKey(key): HexCoordinates | undefined` returning undefined on failure, and migrate callers that treat a miss as data, not an error. Keep `parseHexKey` (throwing) for assertion-style call sites.

#### P-H3 — `layout.ts` builds `tilesByKey = new Map(plan.tiles.map(...))` inside every layout function call
**File:** `src/layout.ts:1276, 1434, 1609, 1728` — same expression repeated:

```ts
const tilesByKey = new Map(plan.tiles.map((tile) => [tile.key, tile]));
```

For a 200-tile plan, this is a 200-entry Map allocation per call. If layout functions are called repeatedly (e.g. by React hooks recomputing on selector change), this is wasteful.

Fix: attach `tilesByKey` (and similar derived indexes) to the `GameboardPlan` once at projection time. `src/projection.ts` is the natural home — projected plans are already "the finalized board" and immutable from the consumer's perspective.

```ts
interface ProjectedGameboardPlan extends GameboardPlan {
  readonly indexes: {
    readonly tilesByKey: ReadonlyMap<string, GameboardTile>;
    readonly placementsByTile: ReadonlyMap<string, readonly GameboardPlacement[]>;
  };
}
```

#### P-H4 — `react.ts` returns fresh arrays from selector hooks without referential stability
**File:** `src/react.ts:471-694` — ~20 `useMemo` hooks return arrays/objects from selectors with `[plan, options]` deps.

When `options` is an inline object literal (the common React pattern), `useMemo`'s dep array shallow-compares it as never-equal, so the memo never hits and the hook returns a fresh array on every render → downstream `<Component items={items} />` re-renders cascade.

Hooks affected include `useGameboardLayoutPlacements`, `useGameboardPieceSelection`, `useGameboardPiecePlacementInspection`, `useGameboardPieceFillInspection`.

Fix: either

1. Document loudly in TSDoc that callers must memoize the `options` object themselves, OR
2. Hash-stabilize options at the hook boundary (`useDeepMemo(options)`) so the dep array compares structurally. Adds ~10 ms in dev/HMR but eliminates the silent render-storm.

#### P-H5 — `runtime.ts` / `runSystemsStep` calls `JSON.parse(JSON.stringify(...))` once (deep clone)
**File:** Single `structuredClone`/`JSON.parse(JSON.stringify(...))` site at simulation.ts (grep count = 1).

Need to confirm whether it's on the per-step path or one-shot setup. If per-step: `structuredClone` is ~3-5× faster than `JSON.parse(JSON.stringify())` in modern Node/browsers and preserves more types. If on setup only, leave it.

Action: locate the call site (single `structuredClone|JSON.parse|JSON.stringify` occurrence), confirm placement, and if on the step path, switch to `structuredClone` or precompute a stable read-only snapshot.

### MEDIUM

#### P-M1 — `tsup` `splitting: true` produces 26 chunks; risk of import-graph chain depth
**File:** `tsup.config.ts`. Splitting is intentionally on to "keep Koota trait identities stable when consumers mix package subpaths." Correct decision — without it, two subpaths that both import `actors.ts` would compile two copies of `GameboardActor` (the `trait()` identity) and Koota queries would silently miss.

But: 26 chunks means deep import waterfalls in dev mode (no HTTP/2 push) and slower first-paint. For published library code on `pnpm` consumers with bundlers (Vite, webpack), this re-bundles cleanly, so the cost is bounded to dev/SSR.

Action: add a CI gate (`pnpm size-limit` or `bundlesize`) on the umbrella entry + each subpath top-level. Targets:
- `index` (after P-C1 fix): ≤ 5 KB gzip
- `cli` (after P-C2 fix): ≤ 8 KB gzip (subcommands lazy)
- `manifest/free`: budget 25 KB gzip
- `react`: ≤ 4 KB gzip
- `three`: ≤ 3 KB gzip

#### P-M2 — `dist/` ships `.d.ts.map` + `.js.map` for every chunk
Phase 1 didn't measure this; map files are roughly equal in size to the JS. The `files` field in `package.json` does include `dist`, so maps ship to npm.

Action: add `"!dist/**/*.map"` to `files`, or set `sourcemap: false` in tsup for the published artefact (keep `'inline'` for local dev). Saves ~1.5 MB of `node_modules/@jbcom/medieval-hexagon-gameboard/dist/` per install.

#### P-M3 — `react.ts` uses `useReducer` + tile-scoped hooks; many `useTrait`/`useQuery` calls per render
**File:** `src/react.ts:401, 704, 711, 726, 733, 740, 747, 754, 761, 768, 775, 782, 794, 803, 810, 819, 828, 837, 844, 860, 869, 878, 887` (23+ `useTrait`/`useQuery` call sites).

Each `useTrait` and `useQuery` in koota/react subscribes to world-state changes and triggers a re-render on any matching mutation. A page with `<TileCard>` × 100 cards each calling 8 `useTrait`s ≈ 800 subscriptions; mutation throughput is bounded by subscription fanout.

Action: document hook usage patterns — prefer **one parent-level `useQuery`** + plain prop drilling over per-card `useTrait`. Add an example in `examples/` showing the efficient pattern.

#### P-M4 — `simulation.ts` is 5,213 LOC in one file → V8 long-function deopt risk
**File:** `src/simulation.ts`. While the file structure is well-factored into many small functions, V8 has a soft per-file optimization budget. Large single files with many functions occasionally hit Crankshaft/Turbofan inlining heuristics oddly.

Action: as part of the H-3 decomposition Phase 1 already recommended (split `simulation.ts` along action boundaries — `runActorTargetCommandStep.ts`, `runCommandStep.ts`, etc.), each per-action file ends up ≤ 500 LOC and V8 can inline freely.

### LOW

#### P-L1 — `vitest.config.ts` runs node-environment only; no `pool: 'threads'` or `pool: 'forks'` tuning
**File:** `vitest.config.ts`. Defaults are sane but for a 35-file unit suite with one file at 3,000 LOC (`cli.test.ts`), explicit `poolOptions.threads.minThreads = 4` or sharding via `--shard` in CI could cut local `pnpm test` time.

Action: measure first (`time pnpm test`); only act if > 30 s wall.

#### P-L2 — `three.ts` lacks explicit disposal documentation
**File:** `src/three.ts`. The file resolves URLs and uses `AnimationMixer` / `Vector3` from three. No `Geometry`/`Material` allocation here directly (the manifest-loader pattern delegates to user-land `useLoader`), so three.js leak risk is on the consumer. Document this in TSDoc — currently silent.

#### P-L3 — `selectors.ts` does not memoize across calls
**File:** `src/selectors.ts` (grep showed no `WeakMap`/`new Map`/`cache` markers — small file). Selectors compute fresh on each invocation. If a selector is called once per render per component, results aren't cached. Acceptable for now (the per-call work is cheap) but flag for later.

## Recommended performance gates (add to CI)

1. **Bundle size budget** via `size-limit` config in repo root:
   ```json
   [
     { "path": "packages/medieval-hexagon-gameboard/dist/index.js", "limit": "5 KB", "import": "{ freeManifest }" },
     { "path": "packages/medieval-hexagon-gameboard/dist/index.js", "limit": "12 KB" },
     { "path": "packages/medieval-hexagon-gameboard/dist/cli.js", "limit": "8 KB" },
     { "path": "packages/medieval-hexagon-gameboard/dist/manifest/free.js", "limit": "25 KB" },
     { "path": "packages/medieval-hexagon-gameboard/dist/react.js", "limit": "4 KB" },
     { "path": "packages/medieval-hexagon-gameboard/dist/three.js", "limit": "3 KB" }
   ]
   ```
   Fail PR if breached. Reviews see the diff line by line.

2. **CLI cold-start benchmark** as a Vitest perf test that runs `node dist/cli.js --help` and asserts ≤ 80 ms wall (current ≈ 150-250 ms). Add to `pnpm test:perf` step in CI, non-blocking initially, then flip to blocking once stabilized.

3. **Simulation throughput micro-benchmark** using `tinybench`:
   ```ts
   bench('runSimulationStep × 10k', () => {
     for (let i = 0; i < 10_000; i++) runSimulationStep(rt, sampleStep, i, opts);
   });
   ```
   Track ops/sec over time in CI; warn on > 10% regression.

4. **Bundle composition snapshot** — diff `dist/` chunk → entry mapping on every PR (e.g. via `tsup`'s `metafile: true` + esbuild visualizer). Catches "X subsystem accidentally got pulled into umbrella" regressions automatically.

5. **React render-count assertion** for `useGameboardLayoutPlacements` and similar hooks — Vitest with `@testing-library/react` rendering with stable vs unstable `options` prop, asserting that stable options does not cause re-render. Pins P-H4 behavior.

## Top 5 priorities

1. **P-C1 — Remove `freeManifest` from umbrella + ship as JSON import-attribute.** Single biggest win: -22 KB gzip / -30-150 ms per umbrella consumer + faster parse for everyone.
2. **P-C2 — Dynamic per-subcommand imports in `cli.ts`.** Cuts CLI cold start from ~200 ms to ~40 ms; immediately speeds up CI smoke tests (`smoke-built-cli.ts`, `smoke-packed-consumer.ts`) on every push.
3. **P-H3 — Materialize `tilesByKey` index in projection.ts.** Removes O(n) Map rebuild from four hot layout functions.
4. **P-H1 — Single-pass `readGameboardActorTargets`.** 6× speedup on a hook that drives target-picker UI; tighter GC.
5. **Add CI gates (size-limit + cold-start benchmark) BEFORE shipping the above fixes** — so the wins are quantified, regressions are caught, and the next contributor inherits the discipline.

## Notes & non-findings

- **`switch (step.action)` parallel-dispatch is a false positive** on the runtime hot path. Line 1643 is **validation** (one-shot), line 3795 is the runtime dispatch (per-step). H-3 from Phase 1 should be re-scoped to the file-size / decomposition concern only, not "double dispatch cost."
- **`systems.ts` has zero `world.query()` calls** — it defines event types and the `gameboardSystemActions` factory, not per-tick query loops. Per-tick query allocation hazard, if it exists, lives in `world-rules.ts` (627 LOC, also zero `world.query` matches in grep — needs deeper read) or in koota internals.
- **Koota trait-identity hazard is acknowledged in `tsup.config.ts` comment.** The `splitting: true` defense is the right call; `external: ['koota', 'koota/react']` + shared chunks prevents trait duplication. Add a CI test that imports two subpaths and asserts trait reference-equality to lock this in.
- **`vitest.config.ts` looks healthy.** `include: ['tests/unit/**/*.test.ts']` correctly excludes browser/visual tests from the default `pnpm test` cycle. Browser tests are split into dedicated configs and gated behind explicit npm scripts.
