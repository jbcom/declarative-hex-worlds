# @jbcom/medieval-hexagon-gameboard

Koota-first 2.5D gameboard runtime for KayKit's Medieval Hexagon Pack.

The package includes the FREE CC0 GLTF assets, typed manifests, deterministic
seeded board generation, Koota traits/actions/queries, React hooks, Three.js
placement helpers, and a local-only ingest path for owned EXTRA assets.
It also exposes neutral tile declarations and plain ECS snapshots so engines can
use their own state model while still sharing KayKit-aware grid, adjacency, and
scale rules. Those snapshots include tile adjacency, canonical placement
origin, placement footprint occupancy, and spawn-to-tile relations for
callback-based ECS mounting. Scenario snapshots can also carry actors, movement
seeds, patrol routes, quests, actor-on-tile links, and quest target links for
games that use another ECS but want the same authored content. Patrol route
plans can also be converted into executable movement scripts for integration
tests or host-game schedulers.
Runtime snapshots and mount helpers also carry live actor state, quest state,
actor-placement relations, and quest references so a running Koota board can be
mirrored into another ECS without reconstructing that graph manually.

The published package targets Node 22+ for CLI, ingest, examples, and release
verification. Browser/runtime consumers can still tree-shake renderer-specific
subpaths and only install the optional peers they use.

## Documentation

Use the package README for code examples and the docs site for the architectural
contract:

- `docs/guides/public-api.md` maps the public subpaths to runtime, rendering,
  manifest, recipe, scenario, simulation, and interop responsibilities.
- `docs/guides/recipes-scenarios-and-simulation.md` explains how saved recipes,
  generated fills, scenarios, SimpleRPG fixtures, and simulation scripts fit
  together.
- `docs/guides/rendering-assets-and-external-packs.md` covers FREE asset URLs,
  local EXTRA manifests, Three.js sync helpers, and third-party compatibility
  scans.
- `docs/pillars/` remains the source of truth for asset taxonomy, tile
  connectivity, editions, visual verification, and Koota runtime rules.

The generated TypeDoc API reference is rebuilt by `pnpm docs` and
`pnpm docs:build`.

## Install

```bash
pnpm add @jbcom/medieval-hexagon-gameboard
```

Install `react` for `@jbcom/medieval-hexagon-gameboard/react` and `three` for
`@jbcom/medieval-hexagon-gameboard/three`. Those peers are intentionally
optional so core Koota, manifest, recipe, CLI, and interop users do not need a
renderer stack.

## Quick Start

```ts
import {
  createSeededGameboardWorld,
  readGameboardPlacements,
  validateGameboardRules,
} from '@jbcom/medieval-hexagon-gameboard';

const world = createSeededGameboardWorld({
  seed: 'campaign-01',
  shape: { kind: 'rectangle', width: 10, height: 8 },
  faction: 'blue',
});

const errors = validateGameboardRules(world).filter((item) => item.severity === 'error');
const placements = readGameboardPlacements(world);
```

## Core Model

Tiles are Koota entities. The serializable `GameboardPlan` is an export/projection
format for rendering, saving, or tests.

- `TileCoordinates`: stable key plus axial `q/r`.
- `TileTerrain`: grass, water, coast, road, river, mountain, hill, forest.
- `TileElevation`: stack height and base/support tile assets.
- `TileConnectivity`: road, river, and coast edge masks.
- `AdjacentTo`: Koota relation between neighboring hex tiles with `edge` metadata.
- `PlacementState`: renderable terrain, surface, decoration, structure, unit, or prop.
- `PlacementOnTile`: exclusive relation to a placement's canonical origin tile.
- `PlacementOccupiesTile`: non-exclusive relation to every tile covered by a
  placement footprint, with blocking and occupancy-group metadata.

Use `validateGameboardRules` for stacking, reciprocal path edges, coast-water
adjacency, harbor adjacency, and invalid water placement checks.

`createGameboardGrid`, `createRectangleGameboardGrid`, and
`createHexagonGameboardGrid` expose Honeycomb grids for the same board shapes
used by seeded generation; `createGameboardCoordinateSystem` handles axial/world
conversion, pathfinding, and spawn locations.

## Runtime Placement Actions

Games can mutate renderable board pieces after the initial plan has loaded. This
is the path for units, build previews, markers, player-built props, and any
gameplay piece that should live inside the same Koota world as the board.

```ts
import {
  gameboardActions,
  inspectGameboardPlacementOccupancy,
  readGameboardPlacements,
} from '@jbcom/medieval-hexagon-gameboard';

const actions = gameboardActions(world);
const preflight = inspectGameboardPlacementOccupancy(world, {
  at: { q: 2, r: 1 },
  kind: 'unit',
});

if (!preflight.canOccupy) throw new Error(preflight.reason);

const marker = actions.spawnPlacement({
  at: { q: 2, r: 1 },
  assetId: 'flag_blue',
  kind: 'prop',
  metadata: { feature: 'player-marker' },
  occupancyGuard: true,
});

actions.movePlacement(marker, { q: 3, r: 2 }, { rotationSteps: 1, occupancyGuard: true });
actions.updatePlacement(marker, { scale: 1.25 });

const placements = readGameboardPlacements(world);
```

Runtime placements keep `PlacementOnTile` and `PlacementOccupiesTile` relations
current, recompute world position from tile elevation, update tag queries such as
`HarborPlacementQuery` and `ExtraPlacementQuery`, and stay visible when
projecting the world back to a `GameboardPlan`. Use
`readPlacementOccupancyForTile` or `readGameboardPlacementOccupancy` when UI,
save, or ECS bridge code needs serializable footprint occupancy records rather
than raw Koota relation stores. Use `inspectGameboardPlacementOccupancy` or
`canOccupyGameboardPlacement` before runtime spawn/move commits when units,
structures, or custom footprints must not overlap existing blockers. Pass
`occupancyGuard: true` to runtime spawn/move/update helpers when the mutation
itself should fail on blockers or missing footprint tiles; guard options can
also ignore known placement IDs for drag previews and self-overlap workflows.

Use `inspectGameboardTile` when UI, AI, or ECS bridge code needs a complete
tile summary from live Koota state. It returns the tile state, render
placements, footprint occupancy records, actors, hostile/interactive/prop actor
buckets, blocking placements, and source-aware enterability in one call.
Use `inspectGameboardNeighborhood` for hover panels, aggro checks, local AI
sensing, and external ECS adapters that need the same summary across a hex
radius with filters for terrain, tags, enterability, actors, hostiles,
interactive actors, and props.
Use `selectGameboardActors` when code needs the actors themselves rather than
tile summaries: it filters by actor id, placement id, kind, team, faction, tags,
tile keys, source-relative radius, hostility, interactivity, and blocking state,
then returns both live Koota actor snapshots and serializable actor records with
stable actor id, placement id, tile-key, distance, and per-tile buckets.
Use `inspectGameboardActorTargets` when AI, command menus, or external ECS
mirrors need those selected actors ranked with actor-aware paths, approach tile
choice, command planning metadata, and reachable/unreachable buckets.

```ts
import {
  inspectGameboardActorTargets,
  inspectGameboardNeighborhood,
  selectGameboardActors,
  inspectGameboardTile,
} from '@jbcom/medieval-hexagon-gameboard';

const tile = inspectGameboardTile(world, '2,0', { sourceActor: 'player' });
if (tile.hasHostiles) highlightAttack(tile.hostileActors);
if (!tile.canEnter) showBlocker(tile.reason);

const nearbyHostiles = inspectGameboardNeighborhood(world, 'player', {
  radius: 3,
  sourceActor: 'player',
  hasHostiles: true,
});
const enemyActors = selectGameboardActors(world, {
  sourceActor: 'player',
  radius: 3,
  hostileToSource: true,
  sort: 'distance',
});
const targetReport = inspectGameboardActorTargets(world, {
  sourceActor: 'player',
  hostileToSource: true,
  radius: 3,
  maxPathCost: 4,
});
```

## Layout Archetypes And Fill Rules

Use `./layout` when a game needs repeatable placement rules instead of
hand-picked coordinates. Built-in archetypes cover surfaces, buildings, units,
props, trees, scatter, harbors, and landmarks. Harbor rules target coast tiles
with adjacent water. Criteria can filter terrain, adjacency, stack
height/elevation, adjacent placement kind or layer, occupancy, distance, edge
padding, footprint reservations, and scoring preferences; scatter-style archetypes
can place multiple slots on a single hex. Use
`createGameboardLayoutArchetypeRegistry` when a pack needs reusable custom
placement behavior, such as camp supplies, large towers, ship props, or custom
unit spawn rules, while still retaining the built-in archetypes.

```ts
import {
  analyzeGameboardLayoutFill,
  createGameboardLayoutArchetypeRegistry,
  createGameboardLayoutFillPlacements,
  inspectGameboardLayoutSites,
  spawnGameboardLayoutFill,
} from '@jbcom/medieval-hexagon-gameboard/layout';

const archetypes = createGameboardLayoutArchetypeRegistry({
  'camp-supply': {
    id: 'camp-supply',
    label: 'Camp Supply',
    kind: 'prop',
    layer: 'feature',
    criteria: {
      terrain: ['grass', 'road'],
      allowOccupied: true,
      maxPerTile: 2,
      slotGroup: 'camp-supply',
    },
  },
});

const fill = {
  seed: 'campaign-01:decor',
  rules: [
    { id: 'watchtowers', archetype: 'landmark', assetId: 'building_tower_A_blue', count: 3 },
    {
      id: 'gatehouses',
      archetype: 'landmark',
      assetId: 'building_tower_B_blue',
      count: 1,
      criteria: {
        minElevation: 1,
        requiredAdjacentPlacementKind: 'road',
        footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
      },
    },
    {
      id: 'shipyards',
      archetype: 'harbor',
      assetId: 'building_shipyard_blue',
      count: 1,
      requiresExtra: true,
    },
    {
      id: 'forest-scatter',
      archetype: 'tree',
      assets: ['tree_single_A', 'tree_single_B'],
      fill: 0.18,
      maxCount: 24,
    },
    { id: 'camp-supplies', archetypes, archetype: 'camp-supply', assetId: 'crate_A_small', count: 2 },
    { id: 'patrols', archetype: 'unit', assetId: 'unit_blue_full', fill: 0.04, minCount: 2, requiresExtra: true },
  ],
} as const;

const analysis = analyzeGameboardLayoutFill(plan, fill);
if (analysis.warningCount > 0 || analysis.errorCount > 0) {
  console.warn([...analysis.warnings, ...analysis.errors].join('\n'));
}

const harborSites = inspectGameboardLayoutSites(plan, {
  seed: 'campaign-01:harbors',
  criteria: { terrain: 'coast', requiredAdjacentTerrain: 'water', allowOccupied: false },
});
console.table(harborSites.rejectionCounts);

const placements = createGameboardLayoutFillPlacements(plan, fill);

spawnGameboardLayoutFill(world, {
  seed: 'campaign-01:decor',
  rules: [{ id: 'props', archetype: 'scatter', assets: ['crate_A_small', 'barrel_A'], fill: 0.08 }],
});
```

Use `./pieces` when a custom pack asset needs reusable placement behavior. A
piece declaration records role, footprint, scale, source attribution, and default
criteria once, then converts into layout fill rules or one-off placement options.
Pieces may reference custom archetype ids declared by a recipe, seeded board, or
caller-provided registry, which keeps external pack behavior reusable without
forcing every placement rule to restate terrain, footprint, and slot criteria.
Use `declareGameboardPieceFromCompatibility` for one asset, or
`declareGameboardPiecesFromCompatibilityReports` /
`createGameboardPieceRegistryFromCompatibilityReports` when a local pack scan
has already produced multiple `./compatibility` reports. Batch declarations
accept per-asset overrides keyed by the compatibility report id, so one scanned
pack can still give towers footprint reservations, trees scatter slots, and
rigged characters unit-specific criteria.

```ts
import {
  createGameboardLayoutFillRuleFromPiece,
  createGameboardLayoutFillRulesFromRegistry,
  createGameboardLayoutPlacementsFromPiece,
  createGameboardPieceRegistry,
  declareGameboardPiece,
  inspectGameboardPiecePlacement,
} from '@jbcom/medieval-hexagon-gameboard/pieces';
import { appendGameboardLayoutPlacementsToPlan } from '@jbcom/medieval-hexagon-gameboard/layout';
import { inspectSeededGameboardPieceFills } from '@jbcom/medieval-hexagon-gameboard/rules';

const roundTower = declareGameboardPiece({
  id: 'kenney-round-tower',
  assetId: 'kenney:castle-kit/round-tower',
  source: 'Kenney Castle Kit',
  role: 'landmark',
  scale: 0.8,
  footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
  criteria: { terrain: ['grass', 'road'], edgePadding: 0 },
});

const rule = createGameboardLayoutFillRuleFromPiece(roundTower, { count: 1 });
const inspection = inspectGameboardPiecePlacement(plan, roundTower, {
  count: 1,
  seed: 'kenney-round-tower',
});
console.table(inspection.siteInspection.rejectionCounts);

const placements = createGameboardLayoutPlacementsFromPiece(plan, roundTower, {
  count: 1,
  seed: 'kenney-round-tower',
});
const placedPlan = appendGameboardLayoutPlacementsToPlan(plan, placements);

const registry = createGameboardPieceRegistry([roundTower]);
const packRules = createGameboardLayoutFillRulesFromRegistry(registry, {
  selection: { roles: ['landmark'], sources: ['Kenney Castle Kit'] },
  ruleIdPrefix: 'kenney-castle',
  count: 1,
});

const fillInspection = inspectSeededGameboardPieceFills(
  plan,
  registry,
  [{ mode: 'pool', selection: { roles: ['landmark'] }, count: 1 }],
  { seed: 'kenney-pack-preview' }
);
```

For build-time local packs, the CLI can scan a directory and emit a registry
JSON that stays in your app while the source GLBs remain local-only:

```bash
medieval-hexagon-gameboard pieces-from-assets \
  --assets "references/kenney_castle-kit/Models/GLB format" \
  --sourcePack "Kenney Castle Kit" \
  --intendedRole tile \
  --assetIdPrefix kenney \
  --pieceIdPrefix kenney-castle \
  --tags castle \
  --pieceOverrides docs/examples/local-piece-overrides.kenney-castle.json \
  --includeReports \
  --out /tmp/kenney-pieces.json

medieval-hexagon-gameboard pieces --pieces /tmp/kenney-pieces.json --emitRules --role landmark --count 1 --json
medieval-hexagon-gameboard pieces --pieces /tmp/kenney-pieces.json --emitSourceUrls --pieceSourceRoots docs/examples/local-piece-source-roots.example.json --json
medieval-hexagon-gameboard pieces --pieces /tmp/kenney-pieces.json --recipe scenario.recipe.json --mode pool --role tree --count 3 --seed preview --out piece-fill-inspection.json --outPlan piece-fill-plan.json
medieval-hexagon-gameboard place-piece --recipe scenario.recipe.json --pieces /tmp/kenney-pieces.json --pieceId kenney-castle:tower-hexagon-base --count 1 --seed preview --idPrefix preview:tower --out piece-placement.json --outPlan piece-placement-plan.json
```

The output stores source asset records with paths relative to the scanned folder
and copies `sourceRelativePath`, `sourceFileName`, `sourceExtension`, and
`localAsset: true` into each generated piece's metadata. Absolute paths are
omitted by default so the registry can be checked into an app repo; pass
`--includeAbsolutePaths` only for throwaway diagnostics.
`pieces --emitSourceUrls` converts those relative paths into an asset-id URL map
for renderers; pass `--pieceSourceRoot` for one local pack root or
`--pieceSourceRoots` as a JSON object keyed by piece `source` when a registry
combines multiple packs.

Override files can be either a plain id-to-options object or wrapped in
`{ "overrides": { ... } }`:

```json
{
  "overrides": {
    "tower-hexagon-base": {
      "footprint": { "kind": "adjacent", "edges": [0, 1], "includeCenter": true },
      "criteria": { "terrain": ["grass", "road"], "edgePadding": 1 },
      "metadata": { "placementPreset": "castle-tower" }
    },
    "tree-large": {
      "criteria": { "maxPerTile": 3, "slotGroup": "soft-feature" },
      "tags": ["forest"]
    }
  }
}
```

Seeded boards can consume the same registry directly:

```ts
import { createSeededGameboardPlan } from '@jbcom/medieval-hexagon-gameboard';

const plan = createSeededGameboardPlan({
  seed: 'campaign-01',
  shape: { kind: 'hexagon', radius: 4 },
  pieceRegistry: registry,
  pieceFills: [
    { selection: { roles: ['landmark'], sources: ['Kenney Castle Kit'] }, count: 1 },
    { mode: 'pool', selection: { roles: ['tree'], tags: ['forest'] }, fill: 0.15, maxCount: 12 },
  ],
});
```

Games can register their own archetypes by passing an `archetypes` registry or
by providing an inline archetype object. Seeded boards also expose
`layoutDensity` presets for common trees, rocks, loose props, harbors, landmarks,
and unit placements; raw `layoutFills` remain available when a game needs exact rule
ordering or custom assets. This is the intended path for custom asset packs: use
`./compatibility` to calculate scale and placement warnings, declare reusable
assets through `./pieces`, then use `./layout` or seeded density presets to place
those pieces as props, units, landmarks, buildings, or scatter according to the
same board rules. Docks, harbors, shipyards, and ports infer to the `harbor`
piece role and use coast-plus-water placement rules by default. Piece registries
can be selected by id, asset id, role, source,
tags, and local-only state, then expanded into per-piece rules or same-role
variant pools either manually or through `pieceFills` during seeded generation.
Footprints write `layoutFootprintTiles` metadata and reserve those tiles for
later fill rules, so large local props do not collide with subsequent landmarks,
units, or scatter. Multi-slot tree/scatter archetypes also emit deterministic
`positionOffset` values plus scalar `layoutPositionOffsetX/Y/Z` metadata so
multiple props on the same hex render as a spread instead of collapsing to the
tile center. Their shared `soft-feature` slot group is reserved across fill
rules, so later generated trees, crates, rocks, and similar scatter continue at
the next available visual slot on a tile. When layout or piece rules are spawned
directly into a live Koota world, pass `occupancyGuard: true` or guard options
through the same rule/placement options to fail fast if runtime state has changed
since the source plan was inspected.

## Actors And Collision

Use `./actors` when renderable placements need gameplay meaning. Actor traits
sit on the same placement entities as `PlacementState`, so a game can distinguish
players, NPCs, enemies, props, hostile actors, interactive actors, and blockers
without mirroring board state elsewhere.

```ts
import {
  createGameboardActorNavigationProfile,
  gameboardActorActions,
  inspectGameboardActorCollision,
  inspectGameboardActorTargets,
  inspectGameboardInteractionTarget,
  planGameboardInteractionCommand,
  selectGameboardActors,
} from '@jbcom/medieval-hexagon-gameboard/actors';
import { gameboardCommandActions } from '@jbcom/medieval-hexagon-gameboard/commands';
import { gameboardMovementActions } from '@jbcom/medieval-hexagon-gameboard/movement';

const actors = gameboardActorActions(world);
const commands = gameboardCommandActions(world);
const movement = gameboardMovementActions(world);

const player = actors.spawn({
  actorId: 'player',
  actorKind: 'player',
  team: 'blue',
  at: '0,0',
  assetId: 'flag_blue',
  kind: 'unit',
  occupancyGuard: true,
});
actors.move('player', '1,0', { occupancyGuard: true });

actors.spawn({
  actorId: 'bandit',
  actorKind: 'enemy',
  team: 'red',
  at: '3,1',
  assetId: 'flag_red',
  kind: 'prop',
});

const collision = inspectGameboardActorCollision(world, player, '3,1');
const target = inspectGameboardInteractionTarget(
  world,
  { placementId: clickedObject.userData.gameboardPlacementId },
  { sourceActor: player }
);
const command = planGameboardInteractionCommand(world, target.tileKey ?? target.placement?.id ?? '', {
  sourceActor: player,
});
const preview = commands.preview('3,1', {
  sourceActor: player,
});
const threats = selectGameboardActors(world, {
  sourceActor: player,
  radius: 4,
  hostileToSource: true,
  sort: 'distance',
});
const targetReport = inspectGameboardActorTargets(world, {
  sourceActor: player,
  hostileToSource: true,
  approach: 'nearest',
  maxPathCost: 4,
});
const execution = commands.execute('3,1', { sourceActor: player });
const request =
  execution.status === 'requested-move'
    ? execution.movement
    : movement.requestMove(player, '3,1', {
        navigation: createGameboardActorNavigationProfile(world, player),
      });
```

Actor-aware navigation can block a hostile actor even when its renderable
placement is a prop, while still letting registered props and NPCs remain
passable unless a game marks them as blocking. Interaction targets accept
`placementId`, `actorId`, `tileKey`, or axial coordinates, and classify the
resulting hit as `move`, `interact`, `attack`, or `inspect`, which is the
intended bridge from renderer selection into movement and quest code. Command
planning converts that report into a stable payload such as `move`,
`interact-actor`, `attack-actor`, or `inspect-tile` before app-specific systems
execute anything.
Actor spawns go through the same placement mutation path as raw placements, so
`positionOffset`, `rotationSteps`, `scale`, `requiresExtra`, and
`occupancyGuard` behave the same for players, NPCs, enemies, and registered
props. `moveGameboardActor` and `gameboardActorActions(world).move` resolve
actor ids as well as placement entities while preserving those runtime placement
offsets and guards. `selectGameboardActors` and `gameboardActorActions(world).select`
are the public actor-query boundary for AI, UI lists, aggro, quest checks, and
external ECS bridges; use them for source-relative hostility/radius/tag filters
instead of rebuilding Koota queries around `PlacementState` and `GameboardActor`.
Use `selection.records` and `selection.recordsByTileKey` when the result needs
to cross into a worker, save log, UI store, or non-Koota ECS.
`inspectGameboardActorTargets` builds on the same selector and adds a
non-mutating command plus the cheapest target-tile or adjacent approach path
from the source actor. Use the reachable buckets to drive AI aggro, command
availability, or host ECS mirrors; do not use it as combat/dialog policy.

Use `./commands` when the renderer or input layer needs a complete command
boundary. `previewGameboardInteractionCommand` resolves the same target forms as
`./actors`, calculates the actor-aware movement path and current movement budget
for `move` commands, and reports why a click is blocked. `executeGameboardInteractionCommand`
requests movement for executable `move` commands. Interact, attack, and inspect
commands deliberately return `requires-game-handler` so the game can route them
to dialog, combat, inventory, or quest systems without this package owning that
gameplay.

When a game wants the package to perform common RPG effects, pass opt-in
handlers. The built-ins are intentionally small and serializable: remove a
target actor, remove a target placement, or mark a target actor as interacted.
`GAMEBOARD_INTERACTION_HANDLER_PRESETS` and
`createGameboardInteractionHandlerPreset` expose the same preset registry used
by simulation JSON, so direct game code, external ECS adapters, and packaged
scripts share one command effect contract. Simulation scripts can also pass
`defaultCommandHandlerOptions` or step-level `handlerOptions` for the same
serialized knobs, including custom handler ids, hostile checks, and interaction
metadata fields.

```ts
import {
  createGameboardInteractionHandlerPreset,
  createMarkTargetActorInteractedHandler,
  createRemoveTargetActorHandler,
  gameboardCommandActions,
} from '@jbcom/medieval-hexagon-gameboard/commands';

const commands = gameboardCommandActions(world);
const defaultRpgHandlers = createGameboardInteractionHandlerPreset('default-rpg');

commands.execute({ actorId: 'bandit' }, {
  sourceActor: 'player',
  handlers: defaultRpgHandlers,
});

commands.execute({ actorId: 'elder' }, {
  sourceActor: 'player',
  handlers: defaultRpgHandlers,
});

commands.execute({ actorId: 'guarded-bandit' }, {
  sourceActor: 'player',
  handlers: createRemoveTargetActorHandler({ requireHostile: true }),
});

commands.execute({ actorId: 'quest-elder' }, {
  sourceActor: 'player',
  handlers: createMarkTargetActorInteractedHandler({ metadata: { quest: 'intro' } }),
});
```

## Runtime Systems

Use `./systems` when a game loop needs event records from the public runtime
APIs. It does not implement combat, dialog, or inventory; it reports those
handler-required commands and advances the shared Koota systems that this
package owns. Every dispatch/run result includes in-process `events` for Koota
consumers and serializable `eventRecords` for non-Koota ECS, workers, save logs,
or telemetry streams.

```ts
import {
  gameboardSystemActions,
  snapshotGameboardSystemEvents,
} from '@jbcom/medieval-hexagon-gameboard/systems';
import { createGameboardInteractionHandlerPreset } from '@jbcom/medieval-hexagon-gameboard/commands';

const systems = gameboardSystemActions(world);
const click = systems.dispatchCommand(targetFromRaycast, { sourceActor: 'player' });
const enemyClick = systems.dispatchActorTargetCommand(
  {
    sourceActor: 'player',
    hostileToSource: true,
    targetActorId: 'raider',
    maxPathCost: 4,
  },
  { handlers: createGameboardInteractionHandlerPreset('default-rpg') }
);

for (const event of click.events) {
  if (event.type === 'command-handler-required') {
    openGameHandler(event.execution.command);
  }
}

const tick = systems.run({ movement: { steps: 4 }, quests: { step: frameNumber } });
for (const event of tick.events) {
  if (event.type === 'movement-completed') {
    syncHud(event.movement.placement.id);
  }
  if (event.type === 'quest-completed') {
    unlockNextQuest(event.quest.quest.questId);
  }
}

externalEcs.enqueue([...click.eventRecords, ...enemyClick.eventRecords, ...tick.eventRecords]);

// Snapshot helpers are also exported when you already have in-process events.
externalEcs.enqueue(snapshotGameboardSystemEvents([...click.events, ...tick.events]));
```

## Runtime Facade

Use `./runtime` when a game wants one bound surface instead of manually wiring
Koota actions, actors, commands, systems, projection, snapshots, and scenario
startup in every scene. It does not hide the lower-level modules; it keeps them
available as `runtime.actors`, `runtime.movement`, `runtime.commands`,
`runtime.systems`, and the other action bundles.

```ts
import { createGameboardRuntime } from '@jbcom/medieval-hexagon-gameboard/runtime';
import { createGameboardInteractionHandlerPreset } from '@jbcom/medieval-hexagon-gameboard/commands';
import { createInMemoryGameboardEcs } from '@jbcom/medieval-hexagon-gameboard/interop';
import { createGameboardPieceRegistry, declareGameboardPiece } from '@jbcom/medieval-hexagon-gameboard/pieces';
import type { SeededGameboardPieceFillOptions } from '@jbcom/medieval-hexagon-gameboard/rules';

const runtime = createGameboardRuntime(plan);
const player = runtime.spawnActor({
  id: 'player-placement',
  actorId: 'player',
  actorKind: 'player',
  at: '0,0',
  assetId: 'flag_blue',
  kind: 'unit',
  occupancyGuard: true,
});

runtime.movement.setAgent(player, { profile: 'ground', movementBudget: 4 });
runtime.dispatchCommand('2,0', { sourceActor: 'player' });
runtime.tick({ movement: { steps: 4 }, quests: { step: frameNumber } });

const hoveredTile = runtime.inspectTile('2,0', { sourceActor: 'player' });
if (hoveredTile.hasInteractive) showInteractCursor();
const nearbyActors = runtime.selectActors({
  sourceActor: 'player',
  radius: 3,
  includeSource: false,
});
const nearbyTargets = runtime.inspectActorTargets({
  sourceActor: 'player',
  hostileToSource: true,
  maxPathCost: 4,
});
const nearestTargetId = nearbyTargets.nearestTarget?.actor.actor.actorId;
const attack = nearestTargetId
  ? runtime.interactActorTarget(
      {
        sourceActor: 'player',
        hostileToSource: true,
        targetActorId: nearestTargetId,
        maxPathCost: 4,
      },
      {
        handlers: createGameboardInteractionHandlerPreset('default-rpg'),
        systems: { movement: false, quests: { step: frameNumber } },
      }
    )
  : undefined;
if (attack?.targetCommand.reason) showTargetHint(attack.targetCommand.reason);

const campProps = declareGameboardPiece({
  id: 'camp-crates',
  assetId: 'crate_A_small',
  role: 'scatter',
});
runtime.spawnPiece(campProps, { count: 3, seed: 'camp', occupancyGuard: true });
runtime.spawnLayoutFill({
  seed: 'ambient-trees',
  rules: [{ id: 'trees', archetype: 'tree', assetId: 'tree_single_A', fill: 0.15 }],
});

const localPieces = createGameboardPieceRegistry([
  { id: 'castle-tower', assetId: 'kenney:round-tower', source: 'Kenney Castle Kit', role: 'landmark' },
  { id: 'camp-crate', assetId: 'crate_A_small', role: 'scatter', tags: ['camp'] },
  { id: 'forest-tree', assetId: 'tree_single_A', role: 'tree', tags: ['nature'] },
]);
const pieceFills = [
  { selection: { roles: ['landmark'] }, count: 1, occupancyGuard: true },
  { mode: 'pool', selection: { tags: ['nature'] }, fill: 0.12, occupancyGuard: true },
] satisfies readonly SeededGameboardPieceFillOptions[];
const fillInspection = runtime.inspectPieceFills(localPieces, pieceFills, { seed: 'scene-01:pieces' });
if (fillInspection.errors.length === 0) {
  runtime.spawnPieceFills(localPieces, pieceFills, { seed: 'scene-01:pieces' });
}
const sourceUrls = runtime.createPieceSourceUrlMap(localPieces, {
  sourceRoots: { 'Kenney Castle Kit': '/assets/kenney-castle-kit' },
});

const snapshot = runtime.snapshot({ includeValidationPlan: true });
renderGameboard(snapshot.plan, { sourceUrls });
externalEcs.enqueue(snapshot.interop?.relations ?? []);
externalEcs.enqueueActorIds(nearbyActors.actorIds);
externalEcs.enqueueTargetIds(nearbyTargets.reachableActorIds);

const mirror = createInMemoryGameboardEcs();
runtime.mountInterop(mirror.adapter);
```

`createGameboardRuntimeFromRecipe` compiles saved recipe JSON into the same
facade while preserving `recipePieceRegistry` and
`createRecipePieceSourceUrlMap` for generated local pieces. 
`createGameboardRuntimeFromScenario` wraps `createGameboardWorldFromScenario`
and keeps the resolved actor/quest entity indexes, `scenarioPieceRegistry`, and
`createScenarioPieceSourceUrlMap` beside the same runtime facade, which is the
shortest path for SimpleRPG-style fixtures and host games that load JSON
scenario content. `spawnPiece`, `inspectPiecePlacement`, and
`spawnLayoutFill` run against the current projected world, so generated props,
trees, landmarks, units, harbors, and local third-party pieces respect live
occupancy before they mutate the board. Registry helpers on the same facade
(`analyzePieceRegistry`, `selectPieces`, `createPieceFillRules`,
`createPiecePoolFillRule`, `analyzePieceFills`, `inspectPieceFills`, and
`spawnPieceFills`) keep local pack integration declarative for games that want
tag/role/source queries, seeded variant pools, and dry-run diagnostics before
spawning into a live board. `createPieceSourceUrlMap` is also available on the
facade for renderers that need asset URLs for local-only registry entries.
Use `runtime.createInteropSnapshot()` when an active board needs a neutral ECS
payload with live actors and quests, or `runtime.mountInterop(adapter)` when a
host game wants callback-based mirroring into BiteCS, Miniplex, a server store,
or a test adapter. Scenario runtimes also expose
`createScenarioInteropSnapshot()` and `mountScenarioInterop()` for authored
pre-runtime content with spawn groups and patrol route plans.

For spawn placement, use the board-aware helpers so terrain, occupancy, tags,
inter-group spacing, and movement profiles are respected:

```ts
import {
  planGameboardPatrolRoute,
  planGameboardSpawnGroups,
  selectGameboardSpawnLocations,
} from '@jbcom/medieval-hexagon-gameboard/navigation';

const spawns = selectGameboardSpawnLocations(plan, {
  count: 4,
  seed: 'campaign-01:spawns',
  tileTags: ['spawn-zone'],
  maxElevation: 1,
  minDistance: 3,
  profile: { blockedTerrain: ['water'], blockingPlacementKinds: ['structure', 'unit'] },
});

const spawnPlan = planGameboardSpawnGroups(plan, {
  seed: 'campaign-01:quest-spawns',
  groups: [
    { id: 'player', count: 1, tileTags: ['player-spawn'] },
    { id: 'npc', count: 2, tileTags: ['npc-spawn'], minDistanceFromGroups: 3, pathToGroups: ['player'] },
    { id: 'enemy', count: 3, tileTags: ['enemy-spawn'], minDistanceFromGroups: 4, pathToGroups: ['player'] },
  ],
});

if (spawnPlan.errors.length > 0) {
  throw new Error(spawnPlan.errors.join('\n'));
}

const patrol = planGameboardPatrolRoute(plan, {
  id: 'north-watch',
  seed: 'campaign-01:north-watch',
  count: 4,
  startGroupId: 'enemy',
  spawnGroups: spawnPlan,
  tileTags: ['watch-point'],
  minDistance: 2,
  loop: true,
});

if (!patrol.found) {
  throw new Error(patrol.errors.join('\n'));
}
```

The same preflight is available from the CLI with `spawn-groups --plan`,
`--recipe`, or `--scenario` plus a JSON group file shaped like
`{ "seed": "...", "groups": [...] }`. Scenarios can also embed the same
`spawnGroups` block and let actors reference `spawnGroupId` instead of hard-coded
coordinates; validation checks the group routes and runtime actors are spawned
at unique resolved group locations. Duplicate group ids and duplicate actor
claims on the same `spawnLocationIndex` are treated as preflight errors.
Use `planGameboardPatrolRoute` or `planGameboardPatrolRoutes` for guard loops,
NPC schedules, enemy wander routes, and encounter waypoints; the returned
waypoints, segment path keys, warnings, and errors are serializable and can be
fed into Koota movement or another ECS. The CLI `patrol-routes` command accepts
the same `--plan`, `--recipe`, or `--scenario` inputs, can reuse `--groups`, and
can also read embedded scenario `patrolRoutes`. Use
`createGameboardPatrolSimulationScript` or the `patrol-script` CLI to convert a
planned route plus actor assignment into executable simulation command steps.
Use `./patrol` when the route should live as Koota state: `setGameboardPatrolAgent`
attaches a planned route to an actor/placement, and `runGameboardSystems` runs
patrols before movement so the same tick can request and complete the next path
segment.

```ts
import { createGameboardPatrolSimulationScript } from '@jbcom/medieval-hexagon-gameboard/simulation';

const patrolScript = createGameboardPatrolSimulationScript({
  routes: [patrol],
  assignments: [{ routeId: 'north-watch', actorId: 'bandit', stepIdPrefix: 'watch' }],
});

if (patrolScript.errors.length > 0) {
  throw new Error(patrolScript.errors.join('\n'));
}

gameLoop.enqueueScript(patrolScript.script.steps);
```

## Quests

Use `./quests` when progression should be driven by board state. Quest
definitions are serializable and Koota quest entities track objective progress,
so a game can verify reach, interaction, collision, and defeat objectives without
duplicating actor or placement state.

```ts
import {
  advanceGameboardQuest,
  spawnGameboardQuest,
} from '@jbcom/medieval-hexagon-gameboard/quests';

const quest = spawnGameboardQuest(world, {
  id: 'harbor-intro',
  objectives: [
    { id: 'crate-is-passable', kind: 'collision', actor: 'player', targetActor: 'crate', expect: 'can-enter' },
    { id: 'bandit-blocks', kind: 'collision', actor: 'player', targetActor: 'bandit', expect: 'blocked' },
    { id: 'defeat-bandit', kind: 'defeat-actor', targetActor: 'bandit' },
    { id: 'speak-elder', kind: 'interact-actor', actor: 'player', targetActor: 'elder' },
  ],
});

const progress = advanceGameboardQuest(world, quest);
```

The SimpleRPG integration fixture uses this quest runtime for its golden path:
registered props must remain passable, registered enemies must block, the enemy
must be removed, and the player must reach both NPC objectives.

## Scenarios

Use `./scenario` when saved content should include a board, actors, movement
agents, patrol agents, and quests together. This is the portable form of the
SimpleRPG pattern: JSON content compiles into a ready Koota world without a
fixture-only setup script.

```ts
import {
  createGameboardScenario,
  validateGameboardScenario,
} from '@jbcom/medieval-hexagon-gameboard/scenario';
import { createGameboardRecipe } from '@jbcom/medieval-hexagon-gameboard/recipe';
import { createGameboardRuntimeFromScenario } from '@jbcom/medieval-hexagon-gameboard/runtime';

const board = createGameboardRecipe(
  { seed: 'intro', shape: { kind: 'rectangle', width: 5, height: 4 } },
  [
    { action: 'addRoadPath', path: [{ q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }] },
    { action: 'setTileAsset', at: { q: 0, r: 1 }, assetId: 'hex_grass', tags: ['player-spawn'] },
    { action: 'setTileAsset', at: { q: 2, r: 1 }, assetId: 'hex_grass', tags: ['watch-point'] },
  ]
);

const scenario = createGameboardScenario('intro', board, {
  spawnGroups: {
    groups: [{ id: 'player-start', count: 1, tileTags: ['player-spawn'] }],
  },
  patrolRoutes: [
    { id: 'village-watch', count: 2, startGroupId: 'player-start', tileTags: ['watch-point'], loop: false },
  ],
  actors: [
    {
      actorId: 'player',
      actorKind: 'player',
      spawnGroupId: 'player-start',
      assetId: 'flag_blue',
      kind: 'unit',
      movementAgent: { profile: 'worker' },
      patrolAgent: { routeId: 'village-watch', movement: { profile: 'worker' } },
    },
  ],
  quests: [
    {
      id: 'intro:quest',
      objectives: [{ id: 'reach-road', kind: 'reach-tile', actor: 'player', tile: '2,1' }],
    },
  ],
});

const runtime = createGameboardRuntimeFromScenario(scenario);
```

Call `validateGameboardScenario` or the `validate-scenario` CLI before loading
authored JSON. It catches duplicate actor/quest/objective ids, bad tile targets,
missing quest actors, missing collision targets, unresolved actor spawn groups,
duplicate spawn-location claims, spawn-group and patrol-route failures,
missing actor patrol routes, manifest-missing actor assets, incorrect EXTRA
flags, and optional plan rule violations before a runtime actor index can be
overwritten.

See `examples/simple-rpg-scenario.json` for a packaged JSON scenario with actors,
patrol agents, movement, and quest objectives.

## Scenario Simulation

Use `./simulation` when CI, tools, or external ECS integrations need to prove a
scenario by actually playing scripted steps. Simulation scripts dispatch public
commands, run systems, apply explicit game-handler mutations such as removing a
defeated actor or spawning/updating a marker/actor, or use named handler presets
such as `remove-target-actor`, `remove-target-placement`,
`mark-target-interacted`, and `default-rpg` from the `./commands` preset
registry. They can also run read-only `inspect-actor-targets` steps, which
record the same path-aware targeting report a live game would use for command
menus or AI, and `actor-target-command` steps, which choose a target through
the same planner before dispatching the planned attack/interact/inspect
command. Reports include event records, top-level command, actor-target,
patrol, and movement timelines, mutations, final placements, actors, quests,
projected plan, and expectation failures. Call
`validateGameboardScenarioSimulationScript` before running authored JSON; it
checks script schema, step IDs/actions, command targets, actor/placement/tile
references, handler preset names/options, spawn groups for scripted actors,
quest/objective expectations, command expectations, actor-target expectations,
mutation expectations, movement expectations, actor metadata/tag expectations,
and event type names against the scenario and compiled plan. Use
`GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS` when editor/tooling code needs the
supported authored action list. Add `expectations`
to make a script define success in JSON. The `spawn-guide` step below assumes
the scenario defines a `guide-start` spawn group.

```ts
import {
  createGameboardScenarioSimulationReport,
  runGameboardScenarioSimulationScript,
  validateGameboardScenarioSimulationScript,
} from '@jbcom/medieval-hexagon-gameboard/simulation';

const script = {
  schemaVersion: '1.0.0',
  defaultSourceActor: 'player',
  defaultCommandHandlerOptions: {
    removeTargetActor: { handlerId: 'quest-defeat-handler', requireHostile: true },
    markTargetActorInteracted: {
      handlerId: 'quest-dialog-handler',
      interactedField: 'spoken',
      sourceActorField: 'speakerActor',
      metadata: { questStage: 'intro-complete' },
    },
  },
  steps: [
    {
      action: 'spawn-placement',
      id: 'drop-quest-marker',
      placement: {
        id: 'quest-marker',
        at: '2,0',
        assetId: 'flag_yellow',
        kind: 'prop',
        metadata: { role: 'quest-marker', state: 'pending' },
      },
      systems: false,
    },
    {
      action: 'update-placement',
      id: 'arm-quest-marker',
      placementId: 'quest-marker',
      placement: {
        assetId: 'flag_green',
        metadata: { role: 'quest-marker', state: 'armed' },
      },
      systems: false,
    },
    {
      action: 'update-actor',
      id: 'mark-bandit-alert',
      actorId: 'bandit',
      actor: {
        actorMetadata: { state: 'alert' },
        tags: ['quest-target'],
      },
      placement: {
        metadata: { encounter: 'intro-bandit' },
      },
      systems: false,
    },
    {
      action: 'spawn-actor',
      id: 'spawn-guide',
      actor: {
        actorId: 'guide',
        actorKind: 'npc',
        spawnGroupId: 'guide-start',
        assetId: 'flag_green',
        kind: 'prop',
      },
      systems: false,
    },
    {
      action: 'inspect-actor-targets',
      id: 'scan-hostiles',
      sourceActor: 'player',
      targeting: {
        hostileToSource: true,
        approach: 'nearest',
        maxPathCost: 2,
      },
    },
    {
      action: 'actor-target-command',
      id: 'target-bandit',
      targetActorId: 'bandit',
      requireReachable: true,
      targeting: {
        hostileToSource: true,
        approach: 'nearest',
        maxPathCost: 2,
      },
      handler: 'remove-target-actor',
      systems: { movement: false, quests: { step: 1 } },
    },
    {
      action: 'command',
      id: 'walk-to-elder',
      target: '2,0',
      systems: { movement: { steps: 10 }, quests: { step: 2 } },
    },
  ],
  expectations: {
    requiredEventTypes: ['command-handled', 'quest-completed'],
    commands: [
      {
        stepId: 'target-bandit',
        kind: 'attack-actor',
        intent: 'attack',
        status: 'handled',
        handlerId: 'quest-defeat-handler',
        effectTypes: ['actor-removed'],
        canExecute: true,
        actorId: 'bandit',
        sourceActorId: 'player',
        targetKind: 'actor',
        targetActorId: 'bandit',
      },
    ],
    actorTargets: [
      {
        stepId: 'scan-hostiles',
        sourceActorId: 'player',
        targetActorIds: ['bandit'],
        reachableActorIds: ['bandit'],
        nearestActorId: 'bandit',
        targetActorId: 'bandit',
        targetReachable: true,
        targetCommandKind: 'attack-actor',
        targetCommandIntent: 'attack',
        targetCommandCanExecute: true,
      },
    ],
    movements: [
      {
        stepId: 'walk-to-elder',
        eventType: 'movement-completed',
        actorId: 'player',
        tileKey: '2,0',
        status: 'completed',
        destinationKey: '2,0',
      },
    ],
    mutations: [
      { type: 'placement-spawned', placementId: 'quest-marker', spawned: true },
      { type: 'placement-updated', placementId: 'quest-marker', updated: true },
      { type: 'actor-spawned', actorId: 'guide', spawned: true },
      { type: 'actor-updated', actorId: 'bandit', updated: true },
      { type: 'actor-removed', actorId: 'bandit', removed: true },
    ],
    actors: [
      { actorId: 'player', tileKey: '2,0' },
      { actorId: 'bandit', exists: false },
    ],
    placements: [
      {
        placementId: 'quest-marker',
        tileKey: '2,0',
        assetId: 'flag_green',
        kind: 'prop',
        metadata: { role: 'quest-marker', state: 'armed' },
      },
    ],
    quests: [{ questId: 'intro:quest', status: 'completed' }],
  },
} as const;

const scriptViolations = validateGameboardScenarioSimulationScript(script, { scenario });
if (scriptViolations.some((violation) => violation.severity === 'error')) {
  throw new Error(scriptViolations.map((violation) => violation.message).join('\n'));
}

const result = runGameboardScenarioSimulationScript(scenario, script);
const report = createGameboardScenarioSimulationReport(result, script.expectations);

if (!report.success) {
  throw new Error(report.expectationFailures.map((failure) => failure.message).join('\n'));
}

externalEcs.enqueue(report.eventRecords);
externalEcs.enqueueCommands(report.commands);
externalEcs.enqueueActorTargets(report.actorTargets);
externalEcs.enqueuePatrols(report.patrols);
externalEcs.enqueueMovements(report.movements);
renderer.sync(report.placements);
```

The same preflight and runner are available from the CLI. `patrol-script`
generates movement command steps from route plans, `validate-simulation` checks
the scenario plus script without executing it, and `simulate-scenario` exits
non-zero when script validation or expectations fail unless the corresponding
allow flags are provided. When `simulate-scenario` writes `--out`,
`--outPlan`, or `--outInterop`, it still prints the human-readable simulation
summary, including actor-target record counts and nearest target details; use
`--json` when the command output itself must stay machine-only.

```bash
medieval-hexagon-gameboard validate-simulation \
  --scenario examples/simple-rpg-scenario.json \
  --script examples/simple-rpg-simulation.script.json \
  --manifest assets/free/manifest.json

medieval-hexagon-gameboard simulate-scenario \
  --scenario examples/simple-rpg-scenario.json \
  --script examples/simple-rpg-simulation.script.json \
  --manifest assets/free/manifest.json \
  --out simple-rpg-simulation.json \
  --outPlan simple-rpg-final-plan.json \
  --outInterop simple-rpg-simulation-interop.json
```

## Movement Agents

Use `./movement` when a game needs units or other board pieces to move through
actual board rules. It layers Koota movement traits on top of `./navigation`,
so movement sees terrain costs, blockers, elevation limits, and the moving
piece's own occupancy. `./patrol` builds on this layer: patrol agents request
movement paths from planned route waypoints, while movement agents still own
profile, budget, and path stepping rules.

```ts
import {
  gameboardMovementActions,
} from '@jbcom/medieval-hexagon-gameboard/movement';

const movement = gameboardMovementActions(world);

movement.setAgent(playerPlacementId, { profile: 'worker' });
const request = movement.requestMove(playerPlacementId, '5,3');

if (request.state.status === 'ready') {
  movement.runSystem({ steps: 10 });
}

movement.resetBudget(playerPlacementId);
```

Built-in profiles are `ground`, `worker`, `cavalry`, `ship`, and `flying`.
Games can pass custom profiles with the same navigation rules used by
`createGameboardNavigation`.

## Coordinates, Paths, And Spawns

The public coordinate surface uses axial `q/r` coordinates with the same edge
ordering as the guide variants. It is suitable for Honeycomb grids, pathfinding,
spawn selection, and ECS adapters.

```ts
import {
  createGameboardCoordinateSystem,
  findHexPath,
} from '@jbcom/medieval-hexagon-gameboard';

const coordinates = createGameboardCoordinateSystem();
const path = findHexPath(
  { q: 0, r: 0 },
  { q: 6, r: 3 },
  {
    shape: { kind: 'rectangle', width: 10, height: 8 },
    passable: (hex) => !blocked.has(`${hex.q},${hex.r}`),
  },
);

const spawns = coordinates.spawnLocations({
  shape: { kind: 'rectangle', width: 10, height: 8 },
  count: 4,
  seed: 'campaign-01',
  minDistance: 3,
});
```

When exact guide variant control matters, import the selector subpath directly:

```ts
import {
  listGuideTilePermutations,
  selectCoastVariantByLabel,
  selectRiverVariant,
  selectRoadVariantByLabel,
} from '@jbcom/medieval-hexagon-gameboard/selectors';

const roadA = selectRoadVariantByLabel('A');
const riverThrough = selectRiverVariant([0, 3], { curvy: true });
const coastE = selectCoastVariantByLabel('E', { waterless: true });
const visualMatrix = listGuideTilePermutations();
```

Mask selectors canonicalize rotationally equivalent shapes. Use the
`list*GuidePermutations` helpers when an editor, renderer, or test needs the
full guide-authored matrix with labels, waterless/curvy flags, and render
rotations preserved.

## Navigation And Occupancy

Use `./navigation` when pathing needs to understand the actual board, not only
abstract hex coordinates. It reads `GameboardPlan` tiles and placements, expands
layout footprint reservations into occupancy, then applies terrain costs,
blocking placement kinds, elevation limits, and movement profiles.

```ts
import { createGameboardNavigation } from '@jbcom/medieval-hexagon-gameboard/navigation';

const navigation = createGameboardNavigation(plan, {
  blockedTerrain: ['water'],
  blockingPlacementKinds: ['structure', 'unit'],
  terrainCosts: { forest: 2, hill: 2 },
  maxElevationStep: 1,
});

const path = navigation.findPath('0,0', '6,3');
const moveRange = navigation.reachable('0,0', 4);

const shipNavigation = createGameboardNavigation(plan, {
  allowedTerrain: ['water'],
  blockedTerrain: [],
  blockingPlacementKinds: ['prop'],
});
```

`createGameboardOccupancyIndex` exposes tile-to-placement occupancy data for
selection, UI overlays, build previews, and custom rule systems. The lower-level
`./occupancy` helpers expose the same footprint parsing and blocking metadata
checks for custom ECS adapters.

## SimpleRPG Integration Fixture

The test suite includes a small public-API game fixture in `tests/simple-rpg/`.
It builds a fixed golden quest map and a locked seedrandom map, spawns a player,
NPCs, a registered prop, and a registered enemy, then completes a quest line
through movement actions and systems. The tests verify that props are passable,
enemies block movement, enemy removal changes pathability, and the final Koota
world projects back into a renderable `GameboardPlan`.

The repository includes `examples/simple-rpg-usage.ts`, and the package ships
the compiled `@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-usage`
export. It is a typed public-import walkthrough over
`examples/simple-rpg-scenario.json` and
`examples/simple-rpg-simulation.script.json`: validate and instantiate the
scenario, resolve scenario-owned player/NPC/enemy spawn groups, select
additional board-aware spawn locations, create an interop snapshot for external
ECS consumers, run the scripted quest flow, and return a serializable summary
suitable for app smoke tests.
The JSON examples are exported as
`@jbcom/medieval-hexagon-gameboard/examples/*.json`; raw TypeScript example
source stays in the repo and is not included in the npm tarball.

```ts
import { runSimpleRpgUsageExample } from '@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-usage';

const smoke = runSimpleRpgUsageExample();
if (!smoke.simulationSucceeded || smoke.validationErrorCount > 0) {
  throw new Error(`SimpleRPG smoke failed for ${smoke.scenarioId}`);
}
console.log(smoke.nearestActorTargetId, smoke.actorTargetCommandKinds);
```

The seeded fixture also declares FREE trees, supply scatter, and a quest marker
as reusable pieces, feeds them into `createSeededGameboardPlan` through
`pieceRegistry` and `pieceFills`, and asserts that those generated placements
survive gameplay and projection. That keeps the custom-piece API tested as a
real board-generation path, not just isolated helper output.

Browser coverage captures `simple-rpg-fixed-completed.png`,
`simple-rpg-seeded-completed.png`, the packaged scenario, and the packaged
simulation report alongside the existing catalog and guide screenshots.
The browser scripts assert renderer draw calls and triangle counts before
capture, then run `tests/scripts/assert-screenshots.ts` against the saved PNGs so
blank, undersized, or visually flat artifacts fail in CI.

## Third-Party Local Asset E2E

External packs are tested without being bundled. The local-only E2E runner reads
ignored assets from `references/` through Vite `@fs`:

```bash
pnpm test:e2e:local-assets
```

From the workspace root, `pnpm test:visual` serializes the FREE browser suite,
local EXTRA suite, and this third-party local asset E2E suite for a complete
manual screenshot review pass.
`pnpm test:assets` verifies that every packaged FREE GLTF/BIN/PNG is accounted
for in `assets/free/manifest.json`, that counts and bounds are still correct,
and that NOTICE attribution remains intact.
`pnpm test:workspace` checks that Nx, pnpm workspace settings, VitePress docs
dependencies, package exports, and tsup build entries stay in sync. The tsup
build uses ESM shared chunks so mixed root/subpath imports share the same Koota
trait identities for live worlds.
`pnpm test:cli` runs the built CLI against the packaged FREE manifest, packaged
examples, SimpleRPG simulation, and synthetic external GLTF fixtures so README
commands keep working after `tsup` output and package-path changes.

The fixture uses Kenney Castle Kit to prove non-KayKit shapes are flagged as
incompatible hex tiles and suggested as prop placements, then places a round
tower, square piece, and tree on the board with generated scale/footprint
metadata. It also uses KayKit Adventurers to place a rigged unit with facing and
animation metadata from the movement animation GLB. `recommendExternalAssetFacing`
maps the model's authored forward axis to a target hex edge, and the CLI exposes
the same behavior through `--modelForward` and `--boardForwardEdge`.

Use the CLI for build-time checks:

```bash
medieval-hexagon-gameboard compatibility \
  --asset "references/kenney_castle-kit/Models/GLB format/tower-hexagon-base.glb" \
  --intendedRole tile \
  --sourcePack "Kenney Castle Kit" \
  --modelForward +z \
  --boardForwardEdge 1 \
  --failOnWarning

medieval-hexagon-gameboard piece \
  --asset "references/kenney_castle-kit/Models/GLB format/tower-hexagon-base.glb" \
  --id kenney:tower-hexagon-base \
  --intendedRole tile \
  --sourcePack "Kenney Castle Kit" \
  --tags castle,landmark \
  --out /tmp/kenney-piece.json

medieval-hexagon-gameboard pieces \
  --pieces /tmp/kenney-piece.json \
  --emitRules \
  --mode pool \
  --role landmark \
  --count 1 \
  --json
```

`compatibility` reports fit warnings; `piece` emits a starter custom piece
declaration with suggested role, scale, footprint, facing, and animation
metadata. `pieces` validates declaration files, reports duplicate/empty-selection
warnings, rejects incompatible variant pools, and can emit seeded `pieceFills`
layout rules. `./compatibility` and `./pieces` expose the same building blocks
as library APIs for custom pipelines and editors.

For guide-audit tooling, the CLI can also emit the full selector permutation
matrix and validate it against a manifest:

```bash
medieval-hexagon-gameboard guide-permutations \
  --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json \
  --out /tmp/kaykit-guide-permutations.json
```

## Authoring Boards

For deterministic authored boards:

```ts
import { createGameboardBuilder, createGameboardWorld } from '@jbcom/medieval-hexagon-gameboard';

const plan = createGameboardBuilder({
  seed: 'harbor-town',
  shape: { kind: 'rectangle', width: 8, height: 6 },
})
  .addMountainStack({ at: { q: 0, r: 0 }, height: 3, variant: 'A', withTrees: true })
  .addRoadPath([{ q: 3, r: 2 }, { q: 3, r: 3 }, { q: 4, r: 4 }])
  .addHarbor({ at: { q: 4, r: 4 }, facing: 1, faction: 'blue', kind: 'shipyard' })
  .addFactionBuilding({ at: { q: 3, r: 2 }, faction: 'blue', building: 'townhall' })
  .addUnitPreset({ at: { q: 2, r: 2 }, faction: 'blue', role: 'soldier' })
  .build();

const world = createGameboardWorld(plan);
```

The packaged harbor-town helper supports both primary board shapes:

```ts
import { createMedievalHarborBoard } from '@jbcom/medieval-hexagon-gameboard';

createMedievalHarborBoard({ seed: 'harbor-01', faction: 'blue' });
createMedievalHarborBoard({ seed: 'harbor-hex', faction: 'yellow', shape: { kind: 'hexagon', radius: 3 } });
```

For seeded random boards:

```ts
import { createSeededGameboardPlan } from '@jbcom/medieval-hexagon-gameboard';

const plan = createSeededGameboardPlan({
  seed: 'weekly-map',
  shape: { kind: 'rectangle', width: 12, height: 9 },
  mountainStacks: 4,
  forestTiles: 10,
  settlements: 5,
  layoutDensity: {
    trees: 0.12,
    rocks: 0.05,
    props: { fill: 0.04, maxCount: 12 },
    harbors: { count: 1 },
    landmarks: { count: 2 },
  },
});
```

For saved configs or agent-authored boards, use serializable recipes:

```ts
import {
  createGameboardPlanFromRecipe,
  createGameboardRecipe,
} from '@jbcom/medieval-hexagon-gameboard';

const recipe = createGameboardRecipe(
  { seed: 'port-contract', shape: { kind: 'rectangle', width: 6, height: 5 } },
  [
    { action: 'addMountainStack', at: { q: 0, r: 0 }, height: 2, variant: 'B', withTrees: true },
    { action: 'addHarbor', at: { q: 3, r: 3 }, facing: 1, faction: 'blue', kind: 'shipyard' },
    { action: 'addFactionBuilding', at: { q: 3, r: 1 }, faction: 'blue', building: 'townhall' },
    { action: 'addRoadPath', path: [{ q: 3, r: 1 }, { q: 3, r: 2 }, { q: 3, r: 3 }] },
  ],
);

const plan = createGameboardPlanFromRecipe(recipe);
```

Recipes can also carry generated placement intent. The third argument accepts
`layoutArchetypes`, `layoutFills`, `pieceDeclarations`, and `pieceFills`, then
compiles those seeded placements after authored steps. Put custom archetypes
there when saved content should define reusable external-pack behavior once and
reference it from many layout or piece fill rules.

```ts
const scenario = createGameboardRecipe(
  { seed: 'scenario-01', shape: { kind: 'rectangle', width: 8, height: 6 } },
  [{ action: 'addFactionBuilding', at: { q: 3, r: 2 }, faction: 'green', building: 'market' }],
  {
    layoutFillSeed: 'scenario-01:decor',
    layoutArchetypes: {
      'camp-supply': {
        id: 'camp-supply',
        label: 'Camp Supply',
        kind: 'prop',
        layer: 'feature',
        criteria: { terrain: ['grass', 'road'], allowOccupied: true, maxPerTile: 2 },
      },
    },
    pieceDeclarations: [
      {
        id: 'scenario-tree',
        assetId: 'tree_single_A',
        role: 'tree',
        requiresExtra: false,
        tags: ['scenario-piece'],
      },
      {
        id: 'scenario-crate',
        assetId: 'crate_A_small',
        role: 'custom',
        archetype: 'camp-supply',
        requiresExtra: false,
        tags: ['scenario-piece'],
      },
    ],
    pieceFills: [{ selection: { tags: ['scenario-piece'] }, count: 6 }],
  }
);
```

Recipes are JSON-friendly and compile down to the same `GameboardPlan` structure
as imperative builder code, so games can validate them, project them into Koota,
or mount them into another ECS. The generation block sees the completed authored
board and can use proximity, occupancy, footprint, and density rules against the
same plan a renderer or ECS adapter will receive. When a game already has an
authored `GameboardPlan`, use `applyGameboardRecipeGeneration` to apply just
that generated placement block.

Use `inspectGameboardRecipe` or `validateGameboardRecipe` before loading
authored recipe JSON. They compile the recipe, return the generated plan when
available, and can run the same manifest-backed asset checks as direct
`GameboardPlan` validation. Generation is preflighted before compilation, so
missing custom layout archetypes, mismatched archetype ids, and custom
archetypes without a placement `kind` return specific recipe violations instead
of surfacing only as generic compile failures.

See `examples/generated-piece-scenario.recipe.json` for a complete
serializable scenario included in the npm package and validated through the CLI.

## Custom Tiles And Other ECS Runtimes

Use tile declarations when a game needs to mix KayKit with another hex tile set.
Declarations describe footprint, terrain, stack behavior, and adjacency channels
without requiring Koota.

```ts
import {
  applyTileDeclaration,
  createGameboardBuilder,
  createGameboardInteropSnapshotIndex,
  createGameboardInteropSnapshot,
  createGameboardScenarioInteropSnapshot,
  createGameboardSimulationInteropSnapshot,
  mountGameboardInteropSnapshot,
  createHexTileRegistry,
  selectGameboardInteropRelations,
  validateGameboardPlan,
} from '@jbcom/medieval-hexagon-gameboard';
import { createGameboardScenario } from '@jbcom/medieval-hexagon-gameboard/scenario';
import { createGameboardRecipe } from '@jbcom/medieval-hexagon-gameboard/recipe';

const registry = createHexTileRegistry([
  {
    id: 'custom_hex_lava',
    assetId: 'custom_hex_lava',
    role: 'base',
    terrain: 'lava',
    bounds: { min: [-1, 0, -1.1547], max: [1, 0.4, 1.1547], size: [2, 0.4, 2.3094] },
  },
  {
    id: 'custom_lava_bridge',
    assetId: 'custom_lava_bridge',
    role: 'road',
    edges: { road: [0, 3] },
  },
]);

const builder = createGameboardBuilder({
  seed: 'custom',
  shape: { kind: 'rectangle', width: 6, height: 4 },
});

applyTileDeclaration(builder, registry, { at: { q: 2, r: 1 }, declaration: 'custom_hex_lava' });
applyTileDeclaration(builder, registry, { at: { q: 2, r: 1 }, declaration: 'custom_lava_bridge' });

const plan = builder.build();
const violations = validateGameboardPlan(plan, { registry });
const ecsSnapshot = createGameboardInteropSnapshot(plan, {
  spawnLocations: { count: 2, seed: 'custom' },
});
const snapshotIndex = createGameboardInteropSnapshotIndex(ecsSnapshot);
const tileAdjacency = selectGameboardInteropRelations(snapshotIndex, {
  name: 'AdjacentTo',
  fromId: 'tile:2,1',
});

mountGameboardInteropSnapshot(ecsSnapshot, {
  createEntity: (entity) => myEcs.createEntity(entity.id),
  addComponent: (entity, name, value) => myEcs.addComponent(entity, name, value),
  addRelation: (from, to, relation) => myEcs.addRelation(from, relation.name, to, relation.data),
});
```

`ecsSnapshot.entities` contains plain component records for tiles, placements,
and spawns. Games using BiteCS, Miniplex, custom ECS stores, or server-side state
can map those records into their own component registration. Use
`createGameboardInteropSnapshotIndex` and `selectGameboardInteropRelations` when
a build step or external runtime needs to query relations by name, source, or
target before mounting. Use `mountGameboardInteropSnapshot` for callback-based
stores, or `createInMemoryGameboardEcs` as a tiny reference adapter in tests.
When the game has already loaded a Koota world, prefer the bound runtime helper:
`runtime.createInteropSnapshot()` includes the current projected plan, actor
state, quest state, `ActorPlacement`, `ActorOnTile`, `QuestReferencesActor`, and
`QuestTargetsTile` relations. The lower-level
`createGameboardRuntimeInteropSnapshot` accepts `{ plan, actors, quests }` for
tools that already have serialized runtime records.

For authored gameplay content, use `createGameboardScenarioInteropSnapshot`.
It compiles the scenario recipe, keeps the same tile/placement records, and adds
spawn-group, patrol-route, actor, and quest entities with
`SpawnGroupHasLocation`, `SpawnGroupRouteCheck`, `PatrolRouteHasWaypoint`,
`PatrolWaypointOnTile`, `PatrolRouteSegment`, `ActorOnTile`,
`QuestReferencesActor`, and `QuestTargetsTile` relations. Actor entities include
`TileCoordinates`, KayKit-derived `WorldPosition`, the original actor
definition, movement seed data, and a renderable `ActorPlacementSeed` component;
spawn-group entities include selected locations and route checks, while patrol
route entities include waypoint and segment lists so another ECS can inspect
scenario starts and schedules without adopting Koota. Actors that reference a
scenario patrol route also emit an `ActorPatrolRoute` relation. The CLI
`snapshot --scenario` path includes scenario spawn groups by default; pass
`--excludeSpawnGroups` when a tool only wants explicit `--spawnCount` locations.

```ts
const board = createGameboardRecipe(
  { seed: 'interop-scenario', shape: { kind: 'rectangle', width: 4, height: 3 } },
  [
    { action: 'addRoadPath', path: [{ q: 0, r: 1 }, { q: 1, r: 1 }, { q: 2, r: 1 }] },
    { action: 'setTileAsset', at: { q: 0, r: 1 }, assetId: 'hex_grass', tags: ['player-spawn'] },
  ]
);

const scenario = createGameboardScenario('interop-scenario', board, {
  spawnGroups: {
    groups: [{ id: 'player-start', count: 1, tileTags: ['player-spawn'] }],
  },
  actors: [
    {
      actorId: 'player',
      actorKind: 'player',
      spawnGroupId: 'player-start',
      assetId: 'flag_blue',
      kind: 'unit',
      movementAgent: { profile: 'worker' },
    },
  ],
  quests: [
    {
      id: 'intro',
      objectives: [{ id: 'reach-road', kind: 'reach-tile', actor: 'player', tile: '2,1' }],
    },
  ],
});

const scenarioSnapshot = createGameboardScenarioInteropSnapshot(scenario);
```

When a scenario has been exercised through `./simulation`, project the report
instead of hand-mapping the JSON. `createGameboardSimulationInteropSnapshot`
keeps the final board/placement records, final actor and quest entities,
removed-actor timeline references, and simulation step plus actor-target,
command, patrol, movement, and mutation entities. Those mount through the same
adapter and relations, including `SimulationStepActorTargets`,
`ActorTargetsSourceActor`, `ActorTargetsTargetActor`, `CommandEffectActor`,
`CommandEffectPlacement`, `PatrolActor`, `PatrolPlacement`, `MovementActor`,
`MovementPlacement`, `MutationActor`, and `SimulationHasStep`. Actor-target
relations carry reachable status, approach tile, path cost, and command
kind/can-execute fields. Command relations carry command kind/status, handler
id/status, effect types, and per-effect actor/placement links so external ECS
stores can mirror handled outcomes without parsing command components:

```ts
import {
  createGameboardScenarioSimulationReport,
  runGameboardScenarioSimulationScript,
} from '@jbcom/medieval-hexagon-gameboard/simulation';

const report = createGameboardScenarioSimulationReport(
  runGameboardScenarioSimulationScript(scenario, script),
  script.expectations
);

const replaySnapshot = createGameboardSimulationInteropSnapshot(report);
mountGameboardInteropSnapshot(replaySnapshot, myEcsAdapter);
```

The CLI exposes the same projection for build pipelines. Use `snapshot` for an
initial scenario projection, or `simulate-scenario --outInterop` when the
external runtime needs a replayable command, patrol, movement, and mutation
timeline:

```bash
medieval-hexagon-gameboard snapshot \
  --scenario examples/simple-rpg-scenario.json \
  --manifest assets/free/manifest.json \
  --spawnCount 2 \
  --spawnSeed simple-rpg \
  --out /tmp/simple-rpg-interop.json

medieval-hexagon-gameboard simulate-scenario \
  --scenario examples/simple-rpg-scenario.json \
  --script examples/simple-rpg-simulation.script.json \
  --manifest assets/free/manifest.json \
  --out /tmp/simple-rpg-simulation.json \
  --outInterop /tmp/simple-rpg-simulation-interop.json
```

`validateGameboardPlan` runs without Koota. It validates built-in road, river,
coast, stack, harbor, structure, layout footprint, and blocking-overlap rules,
then applies custom declaration rules for stackability, required reciprocal
channels, and neighbor terrain constraints.
`validateGameboardRules(world)` delegates through the same neutral plan validator
so Koota and non-Koota consumers get the same rule results.

## React

The React subpath wraps Koota's provider and query hooks with gameboard-specific
actions and selectors. Browser coverage mounts the real provider, reads
tile/placement/actor/quest/patrol hooks, and mutates the world through hook actions.
Projection, occupancy, navigation, spawn, and world-rule hooks use the
lightweight `./projection`, `./navigation`, and `./world-rules` modules so
importing `./react` does not drag in seeded board generation.
`usePlacementEntitiesForTile` reads footprint occupancy through
`PlacementOccupiesTile`; use `useOriginPlacementEntitiesForTile` when a UI
needs only placements whose canonical origin is that tile.
`usePlacementOccupancyForTile` and `useGameboardPlacementOccupancy` return the
same serializable occupancy snapshot records as the Koota helpers.
`useGameboardPlacementOccupancyInspection` and
`useCanOccupyGameboardPlacement` run the same spawn/move preflight checks for
React build cursors, drag previews, and movement UI.
`useGameboardTileInspection` gives React UI, AI overlays, and ECS bridge
components the same actor-aware tile summary as `inspectGameboardTile`, including
tile state, placements, occupancy, actor buckets, and source-aware enterability.
`useGameboardNeighborhoodInspection` mirrors `inspectGameboardNeighborhood` for
React hover panels, local sensing UI, and tactical overlays that need filtered
nearby tile and actor buckets.
`useGameboardActorSelection` mirrors `selectGameboardActors` for React panels,
AI debug views, and command menus that need stable actor id, tile, hostility,
and tag filters without touching raw Koota traits.
`useGameboardActorTargets` mirrors `inspectGameboardActorTargets` for React
command menus and tactical overlays that need path-aware target availability
without executing host-game combat or dialog policy.
`useGameboardActorTargetCommand` mirrors `planGameboardActorTargetCommand` for
React HUDs, AI panels, and command palettes that need the chosen target plus the
stable command payload they would enqueue.
`useGameboardRuntime` returns the same bound `./runtime` facade for components
that want actor spawn helpers, command dispatch, system ticks, and runtime
snapshots from the current provider world. Use `GameboardRuntimeProvider` when a
runtime was created outside React, or mount saved content directly with
`MedievalGameboardPlanProvider`, `MedievalGameboardRecipeProvider`, and
`MedievalGameboardScenarioProvider`; those providers keep generated piece
registries and source URL map helpers available through `useGameboardRuntime`.

```tsx
import {
  MedievalGameboardPlanProvider,
  MedievalGameboardProvider,
  useGameboardActions,
  useGameboardCommandActions,
  useGameboardInteractionCommand,
  useGameboardInteractionCommandPreview,
  useGameboardActorSelection,
  useGameboardActorTargetCommand,
  useGameboardActorTargets,
  useGameboardNavigation,
  useGameboardNeighborhoodInspection,
  useGameboardPatrolActions,
  useGameboardPatrolAgent,
  useGameboardPatrolAgentEntities,
  useGameboardPatrolRoute,
  useGameboardSpawnLocations,
  useGameboardPlacementEntities,
  useGameboardPlacementOccupancyInspection,
  useGameboardRuntime,
  useGameboardTileInspection,
  usePlacementState,
  useProjectedGameboardPlan,
  useGameboardSystemActions,
} from '@jbcom/medieval-hexagon-gameboard/react';
import type { GameboardPlan } from '@jbcom/medieval-hexagon-gameboard';
import type { Entity, World } from 'koota';

function BoardFromPlan({ plan }: { plan: GameboardPlan }) {
  return (
    <MedievalGameboardPlanProvider plan={plan}>
      <Placements />
      <PlaceMarkerButton />
    </MedievalGameboardPlanProvider>
  );
}

function Board({ world }: { world: World }) {
  return (
    <MedievalGameboardProvider world={world}>
      <Placements />
      <PlaceMarkerButton />
    </MedievalGameboardProvider>
  );
}

function Placements() {
  const plan = useProjectedGameboardPlan();
  const entities = useGameboardPlacementEntities();
  return entities.map((entity) => <PlacementMesh key={String(entity)} entity={entity} canRender={Boolean(plan)} />);
}

function PlacementMesh({ entity, canRender }: { entity: Entity; canRender: boolean }) {
  const placement = usePlacementState(entity);
  return placement && canRender ? <mesh /> : null;
}

function PlaceMarkerButton() {
  const actions = useGameboardActions();
  const commands = useGameboardCommandActions();
  const patrolActions = useGameboardPatrolActions();
  const patrolAgents = useGameboardPatrolAgentEntities();
  const firstPatrol = useGameboardPatrolAgent(patrolAgents[0]);
  const systems = useGameboardSystemActions();
  const targetTile = useGameboardTileInspection('0,0', { sourceActor: 'player' });
  const nearbyHostiles = useGameboardNeighborhoodInspection('0,0', {
    radius: 2,
    sourceActor: 'player',
    hasHostiles: true,
  });
  const nearbyActors = useGameboardActorSelection({
    sourceActor: 'player',
    radius: 2,
    includeSource: false,
  });
  const nearbyTargets = useGameboardActorTargets({
    sourceActor: 'player',
    hostileToSource: true,
    maxPathCost: 4,
  });
  const targetCommand = useGameboardActorTargetCommand({
    sourceActor: 'player',
    hostileToSource: true,
    maxPathCost: 4,
  });
  const navigation = useGameboardNavigation({ blockedTerrain: ['water'] });
  const spawns = useGameboardSpawnLocations({
    count: 2,
    seed: 'ui-preview',
    terrain: 'grass',
  });
  const patrol = useGameboardPatrolRoute({
    id: 'preview-watch',
    count: 3,
    start: '0,0',
    terrain: 'grass',
  });
  const command = useGameboardInteractionCommand('0,0', { sourceActor: 'player' });
  const preview = useGameboardInteractionCommandPreview(command, { sourceActor: 'player' });
  return (
    <button
      disabled={
        command?.kind !== 'move' ||
        !preview?.canExecute ||
        !targetTile.canEnter ||
        nearbyActors.hostileActors.length > 0 ||
        ((nearbyTargets?.reachableTargets.length ?? 0) > 0 && !targetCommand?.canExecute) ||
        nearbyHostiles.hostileActors.length > 0 ||
        !navigation?.canEnter('0,0') ||
        patrol?.found === false
      }
      onClick={() => {
        commands.execute(command, { sourceActor: 'player' });
        if (!firstPatrol) {
          patrolActions.set('player', { route: { id: 'preview-watch', waypointKeys: ['0,0', '1,0'] } });
        }
        systems.run({ patrols: {}, movement: { steps: 1 }, quests: { step: performance.now() } });
        actions.spawnPlacement({ at: spawns[0]?.key ?? '0,0', assetId: 'flag_blue', kind: 'prop' });
      }}
    >
      Mark
    </button>
  );
}
```

## Asset Editions

FREE assets are published under `./assets/free/*`.

EXTRA assets are never redistributed. Owners can ingest them locally:

```bash
medieval-hexagon-gameboard extract \
  --edition extra \
  --source references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA \
  --out public/kaykit-extra
```

Analyze a source folder or existing manifest for grid geometry:

```bash
medieval-hexagon-gameboard doctor --edition free
medieval-hexagon-gameboard validate --edition free
medieval-hexagon-gameboard manifest --edition free --out kaykit-manifest.json
medieval-hexagon-gameboard validate-manifest --manifest kaykit-manifest.json --outManifest kaykit-manifest.normalized.json
medieval-hexagon-gameboard analyze --edition free
medieval-hexagon-gameboard analyze --manifest assets/free/manifest.json --json
medieval-hexagon-gameboard declarations --manifest assets/free/manifest.json --out kaykit-declarations.json
medieval-hexagon-gameboard analyze --registry kaykit-declarations.json
medieval-hexagon-gameboard validate-plan --plan board.json --manifest assets/free/manifest.json
medieval-hexagon-gameboard validate-recipe --recipe scenario.json --manifest assets/free/manifest.json --outPlan board.json
medieval-hexagon-gameboard analyze-layout --recipe scenario.recipe.json --rules layout-rules.json --out layout-analysis.json --outPlan board.json
medieval-hexagon-gameboard spawn-groups --recipe scenario.recipe.json --groups spawn-groups.json --out spawn-groups.plan.json
medieval-hexagon-gameboard patrol-routes --scenario simple-rpg-scenario.json --out patrol-routes.plan.json
medieval-hexagon-gameboard patrol-script --routes patrol-routes.plan.json --routeId bandit-watch --actorId bandit --out patrol.script.json
medieval-hexagon-gameboard validate-scenario --scenario simple-rpg-scenario.json --manifest assets/free/manifest.json --outPlan board.json
medieval-hexagon-gameboard validate-simulation --scenario examples/simple-rpg-scenario.json --script examples/simple-rpg-simulation.script.json --manifest assets/free/manifest.json
medieval-hexagon-gameboard simulate-scenario --scenario examples/simple-rpg-scenario.json --script examples/simple-rpg-simulation.script.json --manifest assets/free/manifest.json --out simple-rpg-simulation.json --outPlan simple-rpg-final-plan.json --outInterop simple-rpg-simulation-interop.json
medieval-hexagon-gameboard compatibility --asset third-party.glb --intendedRole tile --failOnWarning
```

The analysis reports tile footprint, row spacing, recommended scale, and warnings
for off-center origins, mismatched width/depth scale, and irregular mixed tile
sets. The validation commands use `--manifest` or an available `--source` folder
to check referenced tile, placement, and scenario actor assets against the
catalog, including `requiresExtra` consistency. Use `--allowUnknownAssetIds` for
specific third-party assets that are registered through your own pipeline, or
`--allowUnknownAssets` for intentionally open local prototyping.
`analyze-layout` checks saved fill rules against a saved plan, recipe, or
scenario and reports candidate counts, selected tile keys, and warnings when
requested counts or `minCount` values cannot be satisfied by the board. The same
diagnostics include rejection counts for terrain, adjacency, occupancy,
footprint, distance, edge-padding, and full scatter-slot failures; use
`inspectGameboardLayoutSites` directly when a game editor needs per-tile
accept/reject details before committing generated placements. Use
`--outPlan` with recipe or scenario inputs when the build pipeline also needs
the compiled board JSON. Layout criteria support terrain, elevation bands, hard
adjacent placement kind/layer requirements, distance, edge padding, occupancy,
and footprint reservation checks.
The `pieces` command can also accept `--plan`, `--recipe`, or `--scenario` with
piece fill flags; it emits registry selection diagnostics, concrete fill rules,
layout analysis, generated placement options, and can write a piece-filled
`GameboardPlan`. This is the build-time path for proving a local pack selection
can actually place before a renderer loads external assets.
All commands that read `--manifest` validate and normalize it first, so stale
`counts` or `assetsById` indexes are repaired in memory and malformed manifests
fail before downstream board or simulation work starts.
`place-piece` is the one-piece build-time bridge: it uses the same declarative
piece criteria and archetype defaults as runtime code, emits site rejection
diagnostics, and can write a `GameboardPlan` with the selected placement
appended for editor previews or checked scenario assets.

The same build-time ingest behavior is available as a Node-only subpath for apps
that prefer scripting over CLI calls:

```ts
import {
  copyGltfTree,
  generateManifestFromSource,
  validateSourceRoot,
  writeManifestJson,
} from '@jbcom/medieval-hexagon-gameboard/ingest';

const sourceRoot = 'references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA';
const validation = validateSourceRoot(sourceRoot, 'extra');

if (!validation.ok) {
  throw new Error(`Expected ${validation.expectedCount} GLTF files, found ${validation.gltfCount}`);
}

copyGltfTree(sourceRoot, 'public/kaykit-extra');
writeManifestJson(
  generateManifestFromSource({
    sourceRoot,
    edition: 'extra',
    assetBasePath: 'kaykit-extra',
  }),
  'public/kaykit-extra/manifest.json'
);
```

Use `writeManifestModule` only when your build wants a TypeScript module instead
of JSON. It emits `freeManifest` or `extraManifest` by default, and accepts
`exportName` plus `typeImportPath` overrides for app-specific module layouts.

Keep `./ingest` in build scripts or Node tools. Browser/runtime code should use
`./manifest/schema` with the generated manifest JSON instead.

The API still models EXTRA-only concepts such as `shipyard`, `docks`,
`stables`, `workshop`, seasonal textures, and unit combinations. Placements that
require local EXTRA files are marked with `requiresExtra: true`.

To consume an app-local EXTRA manifest at runtime, combine it with the packaged
FREE manifest:

```ts
import { freeManifest } from '@jbcom/medieval-hexagon-gameboard/manifest/free';
import {
  createManifestBundle,
  inspectMedievalHexagonManifest,
  resolveManifestAssetUrl,
  selectManifestAssets,
} from '@jbcom/medieval-hexagon-gameboard/manifest/schema';
import extraManifest from './public/kaykit-extra/manifest.json' assert { type: 'json' };

const extraInspection = inspectMedievalHexagonManifest(extraManifest);
if (extraInspection.errorCount > 0) {
  throw new Error(`Invalid EXTRA manifest: ${JSON.stringify(extraInspection.issues)}`);
}

const catalog = createManifestBundle([freeManifest, extraManifest], {
  duplicatePreference: 'extra',
});

const localUnits = selectManifestAssets(catalog, {
  editions: ['extra'],
  categories: ['units'],
});

const modelUrl = resolveManifestAssetUrl(localUnits[0], {
  editionBaseUrls: { extra: '/kaykit-extra' },
});
```

## Three.js Rendering Helpers

Use the `./three` subpath to keep render-loop URL resolution and placement
loading aligned with manifests and local piece registries. The resolver checks
an explicit asset URL map first, then placement `metadata.sourceUrl`, then a
FREE/EXTRA manifest catalog, then an optional fallback. The loader helper
applies the placement transform and can attach external animation clips through
an `AnimationMixer`, which is the intended path for KayKit Adventurers-style
rigged units. For a full scene, use the sync helper so Koota projection output
loads missing objects, updates transforms, removes stale placements, and advances
animation mixers through one public API. Loaded roots are tagged with
gameboard user data, so raycast hits on child meshes can be resolved back to the
placement record without a renderer-specific side map.

```ts
import {
  createGameboardPlacementAssetUrlResolver,
  findLoadedGameboardPlacementObjectForObject,
  gameboardInteractionTargetForObject,
  loadGameboardPlacementObject,
  syncGameboardPlacementObjects,
  updateGameboardPlacementAnimation,
} from '@jbcom/medieval-hexagon-gameboard/three';
import { gameboardCommandActions } from '@jbcom/medieval-hexagon-gameboard/commands';
import { createGameboardPieceSourceUrlMap } from '@jbcom/medieval-hexagon-gameboard/pieces';
import { freeManifest } from '@jbcom/medieval-hexagon-gameboard/manifest/free';

const localPieceUrls = createGameboardPieceSourceUrlMap(pieceRegistry, {
  sourceRoots: {
    'Kenney Castle Kit': '/local-packs/kenney-castle',
    'KayKit Adventurers 2.0 FREE': '/local-packs/kaykit-adventurers',
  },
});

const resolveModelUrl = createGameboardPlacementAssetUrlResolver({
  catalog: freeManifest,
  assetUrls: localPieceUrls,
  fallback: (placement) =>
    placement.requiresExtra ? `/kaykit-extra/${placement.assetId}.gltf` : undefined,
});
const commands = gameboardCommandActions(world);

const placementObjects = new Map();
await syncGameboardPlacementObjects(plan.placements, {
  loader: gltfLoader,
  parent: scene,
  records: placementObjects,
  catalog: freeManifest,
  assetUrls: localPieceUrls,
  fallback: resolveModelUrl,
  animationUrls: {
    'adventurer:knight': '/local-packs/kaykit-adventurers/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb',
  },
  deltaSeconds,
});

const hitPlacement = findLoadedGameboardPlacementObjectForObject(raycastHit.object, placementObjects);
if (hitPlacement) {
  console.log(hitPlacement.placementId, hitPlacement.object.userData.gameboardPlacement);
}

const target = gameboardInteractionTargetForObject(raycastHit.object);
if (target) {
  commands.execute(target, { sourceActor: 'player' });
}

const loadedKnight = await loadGameboardPlacementObject(knightPlacement, {
  loader: gltfLoader,
  assetUrls: localPieceUrls,
  animationUrls: {
    'adventurer:knight': '/local-packs/kaykit-adventurers/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb',
  },
});

updateGameboardPlacementAnimation(loadedKnight, deltaSeconds);
```
