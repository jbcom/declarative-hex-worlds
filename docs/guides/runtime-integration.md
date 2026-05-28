# Runtime Integration Guide

Use the runtime facade as the application boundary for a playable board. The
lower-level modules remain public, but a game usually wants one object that owns
the Koota world, exposes safe mutations, projects render plans, runs systems,
and emits snapshots for UI or another ECS.

## Runtime Ownership

A scene should create exactly one runtime for one board instance:

- Use `createGameboardRuntime(plan)` when the app already has a validated
  `GameboardPlan`.
- Use `createGameboardRuntimeFromRecipe(recipe)` when the app loads saved
  board intent and still needs recipe-local piece registries.
- Use `createGameboardRuntimeFromScenario(scenario)` when the app loads actors,
  movement agents, patrols, quests, spawn groups, or SimpleRPG-style fixtures.

The runtime keeps `runtime.world` public so advanced users can run raw Koota
queries or mount the world in React. Prefer the facade methods first when code
is about gameplay, editor previews, save data, or integration tests; those
methods project live board state before navigation, layout, and interop reads.

## Play Loop

The common loop is deterministic:

1. Validate the recipe, scenario, or plan before startup.
2. Create the runtime.
3. Spawn or register any transient scene actors and props.
4. Convert pointer/raycast targets into commands.
5. Dispatch commands and run system ticks.
6. Render `runtime.plan()` or `runtime.snapshot().plan`.
7. Mirror `runtime.createInteropSnapshot()` into another ECS if needed.

```ts
import {
  createGameboardRuntimeFromScenario,
} from 'declarative-hex-worlds/runtime';
import {
  createGameboardInteractionHandlerPreset,
} from 'declarative-hex-worlds/commands';

const runtime = createGameboardRuntimeFromScenario(scenario);
const handlers = createGameboardInteractionHandlerPreset('default-rpg');

function frame(step: number, clickedTarget?: string) {
  if (clickedTarget) {
    runtime.dispatchCommand(clickedTarget, {
      sourceActor: 'player',
      handlers,
      systems: false,
    });
  }

  const tick = runtime.tick({
    patrols: true,
    movement: { steps: 4 },
    quests: { step },
  });

  renderBoard(runtime.plan());
  updateHud(runtime.readActors(), runtime.readQuests(), tick.eventRecords);
}
```

## Runtime Mutations

Runtime placements are for gameplay state that changes after startup: units,
construction previews, dropped props, markers, blockers, and temporary effects.
Use occupancy preflight when a placement can block movement or reserve a
footprint.

```ts
const preview = runtime.inspectPlacementOccupancy({
  at: '2,1',
  kind: 'structure',
  footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
});

if (preview.canOccupy) {
  const tower = runtime.spawnPlacement({
    id: 'watchtower-01',
    at: '2,1',
    assetId: 'kenney:round-tower',
    kind: 'structure',
    occupancyGuard: true,
  });

  runtime.registerActor(tower, {
    actorId: 'watchtower-01',
    actorKind: 'prop',
    blocking: true,
    tags: ['player-built'],
  });
}
```

Use `runtime.readPlacements()` and `runtime.readPlacementOccupancy()` for whole
board save files, editor panels, and bridge code. Use
`runtime.readPlacementsForTile(tileKey)` and
`runtime.readPlacementOccupancyForTile(tileKey)` when a hover panel, collision
probe, or host ECS sync only needs one hex. Use
`runtime.readActorsForTile(tileKey)` when that same one-hex read needs actor
kinds, teams, hostility, tags, or interaction flags rather than raw placement
records. Use `runtime.removePlacement(id)` for cleanup; it removes the placement
entity and its placement relations so future navigation and occupancy reads use
the current world.

Use `runtime.summarizePlan()` when a tool needs aggregate coverage from the
current live board instead of raw placement arrays. It returns counts by terrain,
texture set, elevation, tile tag, placement kind/layer, semantic feature, asset
id, and local-only asset usage. The same pure helper is available as
`summarizeGameboardPlan(plan)` for build-time recipes, browser screenshot
manifests, editor sidebars, and ECS bridge preflight checks.

## Actor And Quest Reads

Actors are placement-backed. That keeps render transforms, collision, target
selection, and quest objectives tied to the same tile occupancy model.

```ts
const nearbyEnemies = runtime.selectActors({
  sourceActor: 'player',
  hostileToSource: true,
  radius: 4,
  sort: 'distance',
});

const targetPlan = runtime.inspectActorTargets({
  sourceActor: 'player',
  hostileToSource: true,
  maxPathCost: 6,
});

if (targetPlan.nearestTarget) {
  runtime.interactActorTarget(
    { sourceActor: 'player', targetActorId: targetPlan.nearestTarget.actor.actorId },
    { handlers, systems: { movement: false, quests: true } }
  );
}

for (const quest of runtime.advanceAllQuests({ step: frameNumber })) {
  if (quest.quest.status === 'completed') {
    unlockReward(quest.quest.questId);
  }
}
```

## Seeded Scene Assembly

Random board generation should still be inspectable before it mutates the live
world. Analyze fills first, then spawn the same rules after the app accepts the
diagnostics.

```ts
const fill = {
  seed: 'campaign-01:forest',
  rules: [{ id: 'trees', archetype: 'tree', assetId: 'tree_single_A', fill: 0.18 }],
} as const;

const analysis = runtime.analyzeLayoutFill(fill);
if (analysis.errors.length === 0) {
  runtime.spawnLayoutFill(fill);
}

const spawnPlan = runtime.planSpawnGroups({
  seed: 'campaign-01:encounters',
  groups: [
    { id: 'player', count: 1, tileTags: ['player-spawn'] },
    { id: 'enemy', count: 3, minDistanceFromGroups: 4, pathToGroups: ['player'] },
  ],
});
```

Keep seed namespaces stable. Board terrain, layout fills, piece fills, spawn
groups, patrol plans, and combat randomness should not all consume one stream if
the game needs reproducible maps across content edits.

## React Runtime Boundary

React components can mount a runtime created outside React with
`GameboardRuntimeProvider`, or load content directly with
`GameboardPlanProvider`, `GameboardRecipeProvider`, and
`GameboardScenarioProvider`.

Use hook families by intent:

| Intent | Hooks |
| --- | --- |
| Runtime and snapshots | `useGameboardRuntime`, `useGameboardRuntimeSnapshot`, `useProjectedGameboardPlan` |
| Mutable gameplay actions | `useGameboardActions`, `useGameboardActorActions`, `useGameboardCommandActions`, `useGameboardMovementActions`, `useGameboardPatrolActions`, `useGameboardQuestActions`, `useGameboardSystemActions` |
| Serializable reads | `useGameboardPlacementSnapshots`, `useGameboardActorSnapshots`, `useGameboardQuestSnapshots`, `useGameboardPlacementOccupancy` |
| Tile-local UI and collision probes | `useGameboardTileInspection`, `useGameboardNeighborhoodInspection`, `usePlacementOccupancyForTile`, `useGameboardActorsForTile`, `usePlacementEntitiesForTile`, `useOriginPlacementEntitiesForTile` |
| Actor commands and target overlays | `useGameboardActorSelection`, `useGameboardActorTargets`, `useGameboardActorTargetCommand`, `useGameboardInteractionTarget`, `useGameboardInteractionCommand`, `useGameboardInteractionCommandPreview` |
| Navigation and spawned NPC setup | `useGameboardOccupancyIndex`, `useGameboardNavigation`, `useGameboardSpawnLocations`, `useGameboardPatrolRoute`, `useGameboardPatrolRoutes` |
| Build cursors and generated content | `useGameboardLayoutSiteInspection`, `useGameboardLayoutFillAnalysis`, `useGameboardLayoutPlacements`, `useGameboardPieceRegistryAnalysis`, `useGameboardPieceSelection`, `useGameboardPiecePlacementInspection`, `useGameboardPieceFillInspection`, `useGameboardPieceSourceUrlMap` |
| Raw Koota trait reads | entity queries such as `useGameboardTileEntities`, plus trait hooks such as `useTileCoordinates`, `usePlacementState`, `useGameboardActor`, and `useGameboardQuest` |
| Live rule checks | `useGameboardPlacementOccupancyInspection`, `useCanOccupyGameboardPlacement`, `useGameboardRuleViolations` |

Those hooks subscribe to trait and relation value changes, so moving an existing
entity in place rerenders the UI even when query membership does not change.

## External ECS Bridge

Use interop snapshots when a host game already owns the simulation ECS but wants
KayKit-aware board rules.

```ts
const snapshot = runtime.createInteropSnapshot({
  includeActors: true,
  includeQuests: true,
});

externalEcs.apply(snapshot.entities, snapshot.relations);
```

For callback-style stores, `runtime.mountInterop(adapter)` sends the same
snapshot through an adapter and returns the host-entity mapping.

## Integration Tests

Integration tests should use the public runtime the same way a game does:

- Load a fixed scenario and assert the golden path.
- Load a seeded scenario with stable seed namespaces and assert the chosen
  board, actors, quests, collisions, and routes.
- Dispatch commands through `runtime.dispatchCommand` or
  `runtime.interactActorTarget` instead of calling lower-level movement helpers
  directly.
- Run `runtime.tick` for patrols, movement, commands, and quests.
- Capture browser screenshots from `runtime.plan()` and assert the generated
  files are nonblank.

The package SimpleRPG browser tests follow this pattern for fixed and seeded
boards, local-only external pieces, actor targeting, collision, and quest
completion.
