# Performance & Scalability Analysis — declarative-hex-worlds

Generated: 2026-05-28  
Scope: Full codebase — ECS tick loop, pathfinding, caching, manifest, simulation, CLI, rendering, bundle

---

## Summary

The codebase is a TypeScript ESM library with a hex-grid ECS engine (koota), movement/patrol/quest tick systems, a simulation scripting engine, a Three.js/React adapter layer, and a CLI bootstrap. The overall architecture is sound, with several targeted fixes already in place (WeakMap plan index cache, `gameboardPlanIndex`, `useStableOptions`). The critical findings cluster in three areas: the A* open-set scan, linear ECS entity lookups, and the manifest literal's impact on the browser chunk.

---

## Finding 1 — A* Open-Set: O(|open|) Linear Scan Per Iteration

**Severity:** Critical  
**Impact:** Pathfinding on a 37-tile hexagon (radius 3) is tolerable; a 127-tile (radius 6) or 217-tile (radius 7) board pays O(N²) worst-case per `findGameboardPath` and O(N²) per `reachableGameboardTiles` call. With multiple patrolling entities per tick, this compounds.

**Location:** `src/coordinates/coordinates.ts` — `lowestScoreKey()`

```ts
// Current: O(|open|) linear scan every A* iteration
function lowestScoreKey(open: ReadonlySet<string>, ...): string {
  let bestKey = '';
  let bestScore = Number.POSITIVE_INFINITY;
  for (const key of open) {           // full iteration every time
    const score = cost + hexDistance(coordinates, goal);
    if (score < bestScore) { ... }
  }
  return bestKey;
}
```

For a 127-tile board with a path across the full board, `open` can hold 60+ keys. Each of the ~127 A* iterations scans all of them — roughly 7,600 comparisons per path. With 10 patrol agents ticking simultaneously, that is 76,000 comparisons per tick just for pathfinding.

**Recommendation:** Replace the `Set<string>` open list with a binary min-heap keyed by `f = g + h`. A standard implementation reduces per-iteration cost from O(|open|) to O(log |open|).

```ts
// Minimal binary min-heap for A*
class MinHeap {
  private data: Array<[number, string]> = [];
  push(score: number, key: string): void {
    this.data.push([score, key]);
    this.bubbleUp(this.data.length - 1);
  }
  pop(): string | undefined {
    if (this.data.length === 0) return undefined;
    const [, key] = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) { this.data[0] = last; this.sinkDown(0); }
    return key;
  }
  get size() { return this.data.length; }
  private bubbleUp(i: number) { /* standard */ }
  private sinkDown(i: number) { /* standard */ }
}

// In findHexPath: replace `open = new Set<string>` with `open = new MinHeap()`
// and replace `lowestScoreKey(open, ...)` with `open.pop()`
```

Alternatively, use the `@datastructures-js/priority-queue` package (MIT, 2 kB gzipped) which is already tree-shaken cleanly under ESM. Expected speedup: 3–8x on medium boards, 15–30x on large boards.

The same issue applies to `reachableGameboardTiles` (Dijkstra variant), which also uses `lowestCostKey(open, costByKey)` — identical linear scan.

---

## Finding 2 — ECS Entity Lookup: Linear Scan on Every Placement Access

**Severity:** High  
**Impact:** Every call to `findPlacementEntity(world, id)` and `findTileEntity(world, key)` does a full `world.query(...).find(entity => entity.get(Trait)?.field === id)` scan. In a 200-placement board, each call is O(N). These functions are called on every simulation step, every `advancePatrolEntity`, every `requirePatrolPlacementEntity`, every `spawnGameboardPlacement`, and in the `while (findPlacementEntity(world, id))` uniqueness-check loop.

**Location:** `src/koota/koota.ts` lines 582–599

```ts
// Current — O(N) scan every access
export function findTileEntity(world, coordinates) {
  return world.query(GameboardTileQuery).find(
    (entity) => entity.get(HexTileState)?.key === key
  );
}
export function findPlacementEntity(world, placement) {
  return world.query(GameboardPlacementQuery).find(
    (entity) => entity.get(PlacementState)?.id === placement
  );
}
```

**Recommendation:** Maintain module-level `Map<string, Entity>` indexes for tile-key → entity and placement-id → entity, updated on spawn/remove. The existing `tileIndex` parameter pattern inside `loadGameboardWorld` shows the intent was already understood for bulk loads — generalize it.

```ts
// Attach to the World instance via a WeakMap
const TILE_INDEX = new WeakMap<World, Map<string, Entity>>();
const PLACEMENT_INDEX = new WeakMap<World, Map<string, Entity>>();

export function findTileEntity(world: World, key: string): Entity | undefined {
  return TILE_INDEX.get(world)?.get(key);
}
export function findPlacementEntity(world: World, id: string): Entity | undefined {
  return PLACEMENT_INDEX.get(world)?.get(id);
}
// Register/deregister in spawnGameboardTile / destroyTile hooks
```

Expected speedup: O(N) → O(1) per lookup. At 200 placements, this eliminates ~200 comparisons per `advancePatrolEntity` call. On a busy board (10 agents × 60 ticks), that is 120,000 avoided comparisons per second.

---

## Finding 3 — `isKnownExtraAssetId`: Multi-Level Nested Loop on Every Placement Spawn

**Severity:** High  
**Impact:** Called twice per `spawnGameboardPlacement` (line 510 and 825). The function runs:
- `EXTRA_PROP_ASSET_IDS.includes(assetId)` — O(36) array scan
- Nested loop: `for faction of FACTIONS (4) × for kind of EXTRA_FACTION_BUILDING_KINDS (N) × factionBuildingAssetId()` — string template call per iteration
- Nested loop: `for faction (4) × for part of COLORED_UNIT_PARTS × for style of EXTRA_UNIT_STYLES (2) × coloredUnitAssetId()` — string template call per iteration
- Four more `.includes()` checks on separate arrays

With `EXTRA_FACTION_BUILDING_KINDS` appearing to have ~15+ entries and `COLORED_UNIT_PARTS` ~5+ entries, total operations per call: 4×15 + 4×5×2 + 36 + misc ≈ 136 string operations per spawn. On bulk world load of 200 placements: ~27,200 string operations.

**Location:** `src/scenario/catalog.ts` line 1221

**Recommendation:** Build the complete set of known EXTRA asset IDs once at module initialization and cache in a `Set<string>` for O(1) lookup:

```ts
// At module scope — computed once
const KNOWN_EXTRA_ASSET_ID_SET: ReadonlySet<string> = (() => {
  const ids = new Set<string>();
  for (const id of EXTRA_PROP_ASSET_IDS) ids.add(id);
  ids.add('hex_transition');
  for (const faction of FACTIONS) {
    for (const kind of EXTRA_FACTION_BUILDING_KINDS) ids.add(factionBuildingAssetId(kind, faction));
    for (const part of COLORED_UNIT_PARTS)
      for (const style of EXTRA_UNIT_STYLES) ids.add(coloredUnitAssetId(part, faction, style));
  }
  ids.add(neutralUnitAssetId('projectile_catapult'));
  // neutral unit parts that are EXTRA require the existing subtraction logic —
  // pre-compute those too
  return ids;
})();

export function isKnownExtraAssetId(assetId: string): boolean {
  return KNOWN_EXTRA_ASSET_ID_SET.has(assetId);
}
```

Expected speedup: O(136 string ops) → O(1) hash lookup per spawn. Module init cost: paid once at import time, typically <1ms.

---

## Finding 4 — `reachableGameboardTiles` / `findGameboardPath`: Redundant `new Map` Allocations in Default Arguments

**Severity:** High  
**Impact:** Both `findGameboardPath` and `reachableGameboardTiles` have default parameter values that rebuild `tilesByKey` and call `createGameboardOccupancyIndex` when callers omit them:

```ts
// src/gameboard/navigation.ts lines 513–514 and 562–563
tilesByKey: ReadonlyMap<...> = new Map(plan.tiles.map((tile) => [tile.key, tile])),
occupancy: GameboardOccupancyIndex = createGameboardOccupancyIndex(plan, profile)
```

`reachableGameboardMovementTiles` (movement tick loop) calls `createGameboardMovementNavigation` which internally calls `createGameboardNavigation`, which calls `createGameboardOccupancyIndex` fresh. On a 127-tile board with 200 placements, `createGameboardOccupancyIndex` iterates all placements to build three Set/Map structures — O(200) allocations per tick per moving entity.

The `gameboardPlanIndex` WeakMap cache covers the `gameboard.ts` callers but `navigation.ts` standalone functions bypass it via their own default argument expression.

**Location:** `src/gameboard/navigation.ts` lines 474, 513–514, 562–563

**Recommendation:** Route the default-argument Map construction through `gameboardPlanIndex`:

```ts
// navigation.ts
import { gameboardPlanIndex } from './gameboard';

export function findGameboardPath(
  plan: GameboardPlan,
  start: HexCoordinates | string,
  goal: HexCoordinates | string,
  profile: GameboardNavigationProfile = {},
  tilesByKey: ReadonlyMap<string, GameboardTileSpec> = gameboardPlanIndex(plan).tilesByKey,
  occupancy: GameboardOccupancyIndex = createGameboardOccupancyIndex(plan, profile)
```

For the occupancy index: add a second `WeakMap<GameboardPlan, Map<string, GameboardOccupancyIndex>>` keyed by profile fingerprint (JSON-serialized normalized profile). Profile objects are typically static per session, so cache hit rate approaches 100% in steady state.

---

## Finding 5 — Pathfinding `runGameboardPatrolSystem` / `runGameboardMovementSystem`: Fresh `world.query()` Per Tick, Array Spread Allocation

**Severity:** High  
**Impact:** Both system runners materialize a fresh array every tick:

```ts
// patrol.ts line 227
return [...world.query(GameboardPatrolAgentQuery)].map(...);

// movement.ts line 421
for (const entity of [...world.query(ActiveMovementQuery)]) { ... }
```

The `[...world.query(...)]` spread allocates a new array on every tick regardless of board change. For koota, `world.query()` returns a live iterable; the spread forces a full copy. With 10 patrol agents, this is 10 entity references copied per tick — relatively cheap individually but unnecessary if done 60 times/second.

**Location:** `src/patrol/patrol.ts` line 227, `src/movement/movement.ts` line 421

**Recommendation:** Iterate the koota query iterable directly without spreading to an intermediate array:

```ts
// patrol.ts
export function runGameboardPatrolSystem(world, options = {}): GameboardPatrolAdvanceResult[] {
  const results: GameboardPatrolAdvanceResult[] = [];
  for (const entity of world.query(GameboardPatrolAgentQuery)) {
    results.push(advancePatrolEntity(world, entity, options));
  }
  return results;
}
```

The `.map()` call also forces a second pass. Direct push to a pre-allocated array avoids the intermediate. Secondary: the `readGameboardPatrolAgents` function also spreads and `.sort()` — this is a read-only diagnostic path, acceptable.

---

## Finding 6 — `requirePlacementState` in Patrol: Deep Spread on Every Entity Read

**Severity:** Medium  
**Impact:** Called once per `advancePatrolEntity` tick:

```ts
// patrol.ts
function requirePlacementState(entity: Entity): PlacementStateValue {
  return {
    ...state,
    coordinates: { ...state.coordinates },
    position: { ...state.position },
    metadata: { ...state.metadata },
  };
}
```

This creates 4 new objects per patrol tick per entity. With 10 patrol agents at 60 ticks/second: 2,400 object allocations/second for state copies alone, increasing GC pressure. The copy is necessary for immutability of the snapshot but is repeated even in fast-path branches.

**Location:** `src/patrol/patrol.ts` — `requirePlacementState` function

**Recommendation:** Accept the shallow spread for the top-level object but avoid deep-copying `coordinates` and `position` (both simple `{q, r}` or `{x, y, z}` structs) unless the caller mutates them. Document the read-only contract instead of copying. Alternatively, use a `copyPlacementState` helper that is only called when building the final result snapshot, not on every early-return branch.

---

## Finding 7 — `runGameboardSystems` Event Array: flatMap + Spread Allocation Per Tick

**Severity:** Medium  
**Impact:** Every tick builds the event array with three `flatMap` calls and two spread concatenations:

```ts
// systems.ts line 555–562
const events = [
  ...patrols.flatMap(patrolEvents),
  ...movement.flatMap(movementEvents),
  ...questEvents(beforeQuests, quests),
];
```

With 10 patrols + 10 movement agents + 5 quests, this allocates 3 intermediate arrays plus the final array per tick. `snapshotGameboardSystemEvents(events)` then maps the entire array a second time.

**Location:** `src/systems/systems.ts` lines 555–563

**Recommendation:** Pre-allocate a single result array and push:

```ts
const events: GameboardSystemEvent[] = [];
for (const patrol of patrols) for (const e of patrolEvents(patrol)) events.push(e);
for (const mv of movement) for (const e of movementEvents(mv)) events.push(e);
for (const e of questEvents(beforeQuests, quests)) events.push(e);
```

Also consider lazy snapshot conversion — only materialize `eventRecords` when accessed, since many callers that only need `events` (in-memory) will pay the serialization cost unnecessarily.

---

## Finding 8 — `freeManifest` Eager Literal: 380 KB Source, Loaded Into Every Chunk That Imports `../manifest`

**Severity:** Medium  
**Impact:** `src/manifest/free.ts` is 16,580 lines / ~380 KB of autogenerated JSON-as-TS literal. It is exported eagerly as `export const freeManifest = { ... }`. V8 parses the entire object literal at module evaluation time, even if the consumer only needs one asset entry.

The dist chunk `chunk-3BIXE6RB.js` (394 KB) and `chunk-RPFQQ3X2.js` (393 KB) are the two largest output files. Both are in the same size range as the manifest source, strongly suggesting at least one chunk bakes in the full manifest literal. Any entry point that statically imports from `../manifest` — including `gameboard.ts` which `import { freeManifest }` — pulls the 380 KB into that chunk.

`gameboard.ts` unconditionally imports `freeManifest` for the `spawnFromPlan` scenario helpers. This means importing `declarative-hex-worlds/gameboard` in a browser app triggers a 380 KB parse on module load.

**Location:** `src/manifest/free.ts`, `src/gameboard/gameboard.ts` (imports `freeManifest`)

**Recommendation:**

1. The existing `loadFreeManifest()` lazy async export is the right pattern — promote it as the primary API. Document `freeManifest` as the synchronous fallback for Node.js/CLI only.

2. In `gameboard.ts`, lazily acquire the manifest only inside the functions that need it, not at module scope:

```ts
// Instead of: import { freeManifest } from '../manifest';
// Use inside the function body:
async function spawnFromPlan(...) {
  const { freeManifest } = await import('../manifest/free.js');
  // ...
}
```

3. For browser consumers, consider exporting the manifest as a JSON file (already present at `assets/free/manifest.json`) and loading it via `fetch()` to defer parse cost entirely.

Expected impact: removes 380 KB from the eager parse budget of any browser entry point that imports `gameboard`.

---

## Finding 9 — `findTileEntity` and `findPlacementEntity` Called Inside `spawnGameboardWorld` Batch Load

**Severity:** Medium  
**Impact:** `loadGameboardWorld` accepts an optional `tileIndex` parameter to skip the O(N) scan, but `spawnGameboardPlacement` (called inside the bulk load) calls `requireTileEntity(world, options.at)` which uses `findTileEntity` — falling back to the linear scan when `tileIndex` is not threaded through. On a 200-tile, 400-placement board, the bulk load performs 400 × O(200) scans = 80,000 comparisons that should be O(1).

**Location:** `src/koota/koota.ts` — `spawnGameboardPlacement`, `requireTileEntity`

**Recommendation:** Thread the `tileIndex` through `spawnGameboardPlacement` as an optional parameter. The `loadGameboardWorld` path already builds the index; passing it through eliminates the linear scan entirely during bulk load:

```ts
export function spawnGameboardPlacement(
  world: World,
  options: SpawnGameboardPlacementOptions,
  tileIndex?: ReadonlyMap<string, Entity>  // add optional param
): Entity {
  const tile = tileIndex?.get(tileKey(options.at)) ?? requireTileEntity(world, options.at);
  // ...
}
```

---

## Finding 10 — `useGameboardDerivedRevision`: 30+ Trait Subscriptions Per Component Mount

**Severity:** Medium  
**Impact:** Every React component that calls any selector hook (`useGameboardPlacementSnapshots`, `useGameboardActorSnapshots`, `useProjectedGameboardPlan`, etc.) mounts 30+ koota trait change subscriptions via `useGameboardDerivedRevision`. The subscriptions share a single `bumpRevision` callback, so any trait change — including a single tile elevation change — invalidates all memoized values in all hooks simultaneously.

On a board where movement ticks update `PlacementState` for 10 entities per tick, every tick fires `world.onChange(PlacementState)` 10 times, each triggering `bumpRevision`, causing every selector hook in the tree to re-run its `useMemo`.

**Location:** `src/react/react.ts` lines 325–400

**Recommendation:**

1. Split `useGameboardDerivedRevision` into domain-scoped revision counters: one for tile-level changes, one for placement-level changes, one for actor-level changes. Selector hooks subscribe only to the relevant domain.

2. Coalesce multiple within-frame bumps using `scheduler.postTask` or a `requestAnimationFrame` debounce so that 10 placement updates in one tick produce one revision increment, not 10 re-renders.

```ts
// Coalesced bump — batches all changes within the same microtask
let pending = false;
const update = () => {
  if (pending) return;
  pending = true;
  queueMicrotask(() => { pending = false; bumpRevision(); });
};
```

---

## Finding 11 — `useStableOptions` JSON.stringify On Every Render

**Severity:** Medium  
**Impact:** Every render of a component using any selector hook calls `JSON.stringify(options)` in `useStableOptions`. For options objects with large `profile` or `targeting` configs, serialization is non-trivial. This runs synchronously on the render thread before any memoization check.

**Location:** `src/react/react.ts` line 494

**Recommendation:** The current implementation is correct in intent; the cost only becomes meaningful for options objects with >10 keys or nested arrays. A fast-path using `Object.keys(options).length === 0` for empty options (the most common case in tests) would skip serialization entirely:

```ts
function useStableOptions<T>(options: T): T {
  const ref = useRef<...>(undefined);
  if (options === null || (typeof options === 'object' && Object.keys(options as object).length === 0)) {
    return options; // empty object — stable by convention, no serialization needed
  }
  const serialized = JSON.stringify(options);
  // ...
}
```

---

## Finding 12 — Catalog `guidePublicApiCoverage`: O(scenarios × treatments) Per Coverage Call

**Severity:** Low  
**Impact:** `guidePublicApiCoverage` calls `.filter()` on the full `KAYKIT_ASSET_PUBLIC_TREATMENTS` array (and scenarios array) for every public API string queried. `listKayKitGuidePublicApiCoverages` iterates all APIs, making total cost O(APIs × scenarios × treatments). This is a CLI/report-time path, not a tick-loop path — no runtime impact.

**Location:** `src/scenario/catalog.ts` — `guidePublicApiCoverage`, `guideRoleCoverage`

**Recommendation:** Pre-index treatments by `publicApi` string at module load using `Map<string, KayKitAssetPublicTreatment[]>`. This converts the filter from O(N) to O(1) per API lookup. Apply the same pattern to scenarios. Cost: one-time O(N) indexing at import vs repeated O(N) per query.

---

## Finding 13 — Bootstrap I/O: Pipeline Usage is Correct, No Event-Listener Anti-Pattern

**Severity:** Low (informational — Phase 1 context was incorrect)

The `src/cli/commands/bootstrap/core.ts` code already uses `node:stream/promises` `pipeline()` for download streaming:

```ts
await pipeline(incoming, createWriteStream(zipPath));
```

The event-listener anti-pattern mentioned in the Phase 1 context does not appear in the current codebase. The `yauzl` zip extraction uses callback-style (the library's own API, not avoidable without switching libraries), but this is a one-time CLI operation with no tick-loop impact. No action required.

---

## Finding 14 — `selectSpawnCoordinates`: O(N²) Spacing Check

**Severity:** Low  
**Impact:** The spawn coordinate selector uses:

```ts
if (selected.every((existing) => hexDistance(existing, candidate) >= minDistance))
```

This is O(selected.length) per candidate, making total complexity O(candidates × selected). For small spawns (≤20 points on ≤200-tile boards) this is negligible. For large boards with dense spawn requirements, it degrades to O(N²).

**Recommendation:** Use a spatial hash grid partitioned by `minDistance` to reduce the check to O(1) average per candidate. Defer until spawn counts exceed 50.

---

## Finding 15 — Bundle: `manifest/free` Chunk Not Isolated From Shared Chunks

**Severity:** Low  
**Impact:** `dist/manifest/free.js` is a tiny 197-byte re-export wrapper that points to `chunk-3BIXE6RB.js` (394 KB). The actual manifest data lives in the shared chunk. Any entry point that shares that chunk (e.g., `gameboard`, `scenario`, `catalog`) pulls the 380 KB manifest into its transitive closure, even if the consumer never calls `freeManifest`.

The `splitting: true` in `tsup.config.ts` is correct and does produce shared chunks, but the manifest literal is so large it dominates the chunk it lands in. The root cause is the static import in `gameboard.ts`.

**Recommendation:** Same as Finding 8 — break the static import. Once `gameboard.ts` lazily loads the manifest, tsup chunk splitting will isolate the manifest data into a separately loaded chunk that browsers can defer or skip entirely if the consumer uses only the navigation and ECS APIs.

---

## Priority Matrix

| # | Finding | Severity | Effort | Impact |
|---|---------|----------|--------|--------|
| 1 | A* open-set linear scan | Critical | Medium | 3–30x pathfinding speedup on medium/large boards |
| 2 | ECS entity lookup linear scan | High | Medium | O(N)→O(1) per access, eliminates dominant hotspot in patrol/movement |
| 3 | `isKnownExtraAssetId` nested loop | High | Low | O(136)→O(1) per spawn, eliminates bulk-load cost |
| 4 | Navigation default-arg Map allocation | High | Low | Eliminates O(N) per-tick allocation in movement system |
| 5 | Spread in system runners | High | Low | Removes one array alloc per tick per system |
| 6 | `requirePlacementState` deep spread | Medium | Low | Reduces GC pressure 2400 allocs/sec at 10 agents |
| 7 | Event array flatMap+spread per tick | Medium | Low | Reduces tick allocation, enables lazy eventRecords |
| 8 | `freeManifest` eager 380 KB import | Medium | Medium | Removes 380 KB from browser startup parse |
| 9 | Batch load tileIndex not threaded | Medium | Low | Eliminates 80K comparisons on world init |
| 10 | 30+ trait subscriptions per component | Medium | Medium | Reduces re-render fan-out in movement-heavy scenes |
| 11 | `useStableOptions` JSON.stringify | Medium | Low | Negligible for empty options (most common case) |
| 12 | Catalog coverage O(N²) | Low | Low | CLI-only path, no runtime impact |
| 13 | Bootstrap pipeline | Low | None | Already correct |
| 14 | Spawn spacing O(N²) | Low | Low | Negligible at current board sizes |
| 15 | Manifest chunk isolation | Low | Low | Follows from Fix 8 automatically |

---

## Existing Mitigations (Confirmed Working)

- `gameboardPlanIndex` WeakMap cache (gameboard.ts) — correctly caches tile/placement maps per plan object; covers `coordinates/layout.ts` and `interop/interop.ts` callers.
- `createQuery` at module scope for `GameboardPatrolAgentQuery`, `ActiveMovementQuery`, `MovementAgentQuery` — queries are defined once and reused; koota handles the live entity tracking internally.
- `useStableOptions` with JSON.stringify identity — prevents fresh-literal option objects from invalidating memoized selectors on every parent render.
- `splitting: true` in tsup — ensures shared code lands in shared chunks rather than being duplicated across entry points.
- `maxVisited: plan.tiles.length * 4` guard in `findGameboardPath` — prevents unbounded A* on disconnected graphs.
- `loadFreeManifest()` async lazy export — already available; needs promotion over the eager `freeManifest` for browser consumers.
