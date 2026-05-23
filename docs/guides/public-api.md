# Public API Guide

The package is a board runtime, not a file listing for GLTF assets. Most games
should flow through the same layers:

1. Load a manifest or app-local manifest bundle.
2. Build a `GameboardPlan` from a recipe, scenario, or seeded board request.
3. Validate assets, footprints, adjacency, spawn groups, patrol routes, and
   scenario references before rendering.
4. Instantiate a Koota runtime when live actors, quests, movement, systems, or
   mutations are needed.
5. Project the runtime into Three.js, React, a custom renderer, or another ECS.

## Subpaths

| Subpath | Use it for |
| --- | --- |
| `@jbcom/medieval-hexagon-gameboard` | Core manifests, seeded board creation, plan validation, selectors, and the runtime facade. |
| `@jbcom/medieval-hexagon-gameboard/manifest/free` | The packaged FREE KayKit asset manifest. |
| `@jbcom/medieval-hexagon-gameboard/manifest/schema` | Manifest bundle validation, lookup, URL resolution, and app-local FREE/EXTRA manifests. |
| `@jbcom/medieval-hexagon-gameboard/grid` | Honeycomb-compatible board grids and shape helpers. |
| `@jbcom/medieval-hexagon-gameboard/coordinates` | Axial/world conversion, path coordinates, and spawn-location helpers. |
| `@jbcom/medieval-hexagon-gameboard/gameboard` | Neutral board plan construction and serialization. |
| `@jbcom/medieval-hexagon-gameboard/layout` | Archetypes, site inspection, percentage fills, scatter slots, and seeded placement generation. |
| `@jbcom/medieval-hexagon-gameboard/pieces` | Reusable declarations for external buildings, props, units, landmarks, and scatter assets. |
| `@jbcom/medieval-hexagon-gameboard/recipe` | Serializable board intent for saved maps, editors, and generated plans. |
| `@jbcom/medieval-hexagon-gameboard/scenario` | Recipes plus actors, spawn groups, patrols, movement, and quests. |
| `@jbcom/medieval-hexagon-gameboard/simulation` | Headless scenario scripts and deterministic integration-test logs. |
| `@jbcom/medieval-hexagon-gameboard/koota` | Koota traits, relations, projections, actions, and selectors. |
| `@jbcom/medieval-hexagon-gameboard/actors` | Player, NPC, enemy, prop, collision, interaction-target, and actor-selection helpers. |
| `@jbcom/medieval-hexagon-gameboard/movement` | Movement profiles, path requests, movement budgets, and frame-loop stepping. |
| `@jbcom/medieval-hexagon-gameboard/patrol` | Patrol agents and route execution inside the same movement system. |
| `@jbcom/medieval-hexagon-gameboard/quests` | Reach, interaction, collision, and defeat quest objectives. |
| `@jbcom/medieval-hexagon-gameboard/commands` | Renderer-click command planning, previews, and opt-in handler execution. |
| `@jbcom/medieval-hexagon-gameboard/systems` | Game-loop helpers for commands, patrols, movement, quests, and target dispatch. |
| `@jbcom/medieval-hexagon-gameboard/interop` | Neutral ECS snapshots and adapter mounting for non-Koota engines. |
| `@jbcom/medieval-hexagon-gameboard/react` | React provider, query hooks, actions, layout/piece previews, and runtime-aware UI helpers. |
| `@jbcom/medieval-hexagon-gameboard/three` | Asset URL resolution, GLTF loading, transform sync, raycast lookup, and animation clip metadata. |

## Plan Versus Runtime

`GameboardPlan` is the portable format. It is the right object for:

- Saved maps.
- AI-authored board JSON.
- build-time validation.
- renderer input.
- interop with engines that do not use Koota.

The Koota runtime is the live simulation surface. Use it when a game needs:

- actors and actor-aware movement.
- runtime placement spawn, move, update, or removal.
- footprint occupancy that changes during play.
- patrols, quests, commands, or frame-loop systems.
- live snapshots for another ECS.

```ts
import {
  createGameboardRuntimeFromScenario,
} from '@jbcom/medieval-hexagon-gameboard';
import simpleRpgScenario from '@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json';

const runtime = createGameboardRuntimeFromScenario(simpleRpgScenario);

const startTile = runtime.inspectTile('0,0');
const nearbyThreats = runtime.selectActors({
  sourceActor: 'player',
  hostileToSource: true,
  radius: 4,
});
```

## Runtime Facade

Use `./runtime` when application code wants one game-loop object instead of
coordinating individual subpaths. The facade keeps the Koota world available
while exposing safe helpers for the common loops:

- inspect a tile or neighborhood.
- select or target actors.
- preview and execute commands.
- spawn declared pieces or generated layout fills.
- advance patrol, movement, command, actor-target, and quest systems.
- project the board to a `GameboardPlan`.
- emit or mount interop snapshots.

This is the recommended boundary for a game UI, editor preview, or integration
test. Lower-level subpaths stay public for engines that want tighter control.

## Custom Packs

External assets should be modeled as declarations before they are placed. This
keeps compatibility warnings, scale, footprint, source attribution, and default
placement criteria reusable.

```ts
import { analyzeExternalAssetCompatibility } from '@jbcom/medieval-hexagon-gameboard/compatibility';
import { createGameboardLayoutArchetypeRegistry } from '@jbcom/medieval-hexagon-gameboard/layout';
import { declareGameboardPieceFromCompatibility } from '@jbcom/medieval-hexagon-gameboard/pieces';

const report = analyzeExternalAssetCompatibility({
  id: 'kenney-round-tower',
  sourcePack: 'Kenney Castle Kit',
  intendedRole: 'tile',
  bounds: {
    min: [-1.15, 0, -1.15],
    max: [1.15, 4.8, 1.15],
    size: [2.3, 4.8, 2.3],
  },
});

const archetypes = createGameboardLayoutArchetypeRegistry({
  'round-tower': {
    id: 'round-tower',
    label: 'Round Tower',
    kind: 'structure',
    criteria: {
      terrain: ['grass', 'road'],
      footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
      allowOccupied: false,
    },
  },
});

const tower = declareGameboardPieceFromCompatibility(report, {
  role: 'landmark',
  archetype: 'round-tower',
  metadata: { sourceUrl: '/assets/kenney/round-tower.glb' },
});
```

If an external mesh looks unlike a KayKit hex tile, the compatibility report
should not force it into tile rules. Prefer declaring it as a prop, landmark,
building, tree, scatter asset, or unit with explicit placement criteria.

## Validation Boundaries

| Boundary | Public helper |
| --- | --- |
| Manifest shape and stale indexes | `inspectMedievalHexagonManifest` |
| Packaged or app-local manifest lookup | `createManifestBundle`, `getManifestAsset` |
| Missing assets in plans, recipes, and scenarios | `validateGameboardPlan`, recipe/scenario validation helpers |
| Tile declarations and neutral plan rules | `validateGameboardPlan` |
| Koota world rules | `validateGameboardRules` |
| Layout candidate analysis | `inspectGameboardLayoutSites`, `analyzeGameboardLayoutFill` |
| Piece placement previews | `inspectGameboardPiecePlacement` |
| Runtime footprint blockers | `inspectGameboardPlacementOccupancy` |
| Actor collision and interactions | `inspectGameboardActorCollision`, `inspectGameboardInteractionTarget` |
| Scenario scripts | `validateGameboardScenarioSimulationScript` |

Use the earliest boundary that has enough information. For example, validate a
scenario before rendering, then use runtime occupancy guards for mutations that
depend on the current live board.
