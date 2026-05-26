---
status: implemented
last_verified: 2026-05-25
source_images:
  - docs/assets/kaykit-guide/pages/page-05.png
  - docs/assets/kaykit-guide/pages/page-06.png
  - docs/assets/kaykit-guide/pages/page-07.png
  - docs/assets/kaykit-guide/pages/page-08.png
  - docs/assets/kaykit-guide/pages/page-09.png
  - docs/assets/kaykit-guide/pages/page-11.png
  - docs/assets/kaykit-guide/pages/page-15.png
  - docs/assets/kaykit-guide/pages/page-16.png
  - docs/assets/kaykit-guide/pages/page-18.png
source_pack: references/KayKit_Medieval_Hexagon_Pack_1.0_FREE
implementation_links:
  - docs/release-readiness.json
  - docs/guides/release-readiness.md
  - docs/examples/blueprint-board.json
  - src/actors/actors.ts
  - src/scenario/blueprint.ts
  - src/commands/commands.ts
  - src/interop/coverage.ts
  - src/scenario/catalog.ts
  - src/cli/cli.ts
  - src/interop/compatibility.ts
  - src/coordinates/coordinates.ts
  - src/gameboard/gameboard.ts
  - src/coordinates/grid.ts
  - src/index.ts
  - src/interop/interop.ts
  - src/koota/koota.ts
  - src/coordinates/layout.ts
  - src/movement/movement.ts
  - src/gameboard/navigation.ts
  - src/gameboard/occupancy.ts
  - src/patrol/patrol.ts
  - src/pieces/pieces.ts
  - src/coordinates/projection.ts
  - src/quests/quests.ts
  - src/scenario/recipe.ts
  - src/scenario/registry.ts
  - src/rules/rule-types.ts
  - src/rules/rules.ts
  - src/runtime/runtime.ts
  - src/scenario/scenario.ts
  - src/simulation/simulation.ts
  - src/react/react.ts
  - src/systems/systems.ts
  - src/three/three.ts
  - src/rules/validation.ts
  - src/systems/world-rules-system.ts
  - examples/blueprint-board-usage.ts
  - tests/integration/simple-rpg/simple-rpg.ts
test_links:
  - tests/unit/catalog.test.ts
  - tests/unit/coverage.test.ts
  - tests/unit/blueprint.test.ts
  - tests/unit/actors.test.ts
  - tests/unit/commands.test.ts
  - tests/unit/cli.test.ts
  - tests/unit/grid.test.ts
  - tests/unit/compatibility.test.ts
  - tests/unit/gameboard.test.ts
  - tests/unit/interop.test.ts
  - tests/unit/koota.test.ts
  - tests/unit/layout.test.ts
  - tests/unit/movement.test.ts
  - tests/unit/navigation.test.ts
  - tests/unit/pieces.test.ts
  - tests/unit/quests.test.ts
  - tests/unit/recipe.test.ts
  - tests/unit/registry.test.ts
  - tests/unit/rules.test.ts
  - tests/unit/runtime.test.ts
  - tests/unit/scenario.test.ts
  - tests/unit/simulation.test.ts
  - tests/unit/systems.test.ts
  - tests/unit/three.test.ts
  - tests/unit/validation.test.ts
  - tests/unit/simple-rpg.test.ts
  - tests/unit/examples.test.ts
  - tests/browser/free-visual.test.ts
  - tests/browser/react-bindings.test.ts
  - tests/browser/simple-rpg-visual.test.ts
  - tests/e2e/local-assets/third-party-assets.test.ts
  - tests/browser/extra-visual.test.ts
  - scripts/smoke-built-cli.ts
  - scripts/smoke-packed-consumer.ts
---

# Koota Runtime Rules

The library runtime is Koota-first. A game should interact with a Koota world
containing tile entities, adjacency relations, decomposed tile traits, and
placement entities. `GameboardPlan` exists so a game can serialize, test, or render
the state as a deterministic placement list.

## Tile traits

- `TileCoordinates`: stable tile key plus axial `q/r`.
- `TileTerrain`: terrain kind.
- `TileElevation`: stack height and base/support asset ids.
- `TileConnectivity`: road, river, and coast edge masks plus guide modifiers.
- `TileRenderState`: texture set.
- `TileTagList`: generated tags used by consumers and tests.

The legacy `HexTileState` remains as a convenient aggregate view, but new rule
logic should query the decomposed traits.

## Engine-neutral contracts

Koota is the built-in runtime adapter, but it is not the only consumer. The
library also exposes neutral contracts for games with their own ECS:

- `GameboardPlan`: serializable board state and render placements.
- `summarizeGameboardPlan` and `runtime.summarizePlan`: aggregate plan
  inspection for terrain, texture, elevation, tile tag, placement, feature,
  asset, and local-only usage counts.
- `./projection`: lightweight Koota-world-to-plan projection for renderers,
  React hooks, and tests that do not need seeded map generation.
- `GameboardRecipe`: JSON-friendly board intent steps that compile to
  `GameboardPlan` for saved configs, generated maps, and docs.
- `GameboardScenario`: JSON-friendly board recipe plus optional named spawn
  groups, patrol routes, actors, movement agents, patrol agents, and quests that
  instantiate into a ready Koota world for tests, examples, and starter gameplay
  scenes.
- `createMedievalGameboardBlueprintScenario` and
  `createMedievalGameboardWorldFromBlueprint`: board-scale medieval intent plus
  scenario runtime content in one API, so generated 2.5D boards can ship with
  spawn groups, route-checked NPC/enemy patrols, actors, movement agents, and
  quests without a second stitching layer.
- `GameboardScenarioSimulationScript`: JSON-friendly scripted command/system
  steps that run a scenario headlessly and emit serializable event records,
  mutation records, final actors, quests, projected plan state, and optional
  expectation checks.
- `createGameboardInteropSnapshot`: plain tile, placement, adjacency, and spawn
  component records plus `AdjacentTo`, `PlacementOnTile`,
  `PlacementOccupiesTile`, and `SpawnOnTile` relations for external ECS
  mounting.
- `createGameboardRuntimeInteropSnapshot` and the bound runtime methods
  `createInteropSnapshot` / `mountInterop`: neutral projections of the current
  Koota board plus live actors, quests, `ActorPlacement`, `ActorOnTile`,
  `QuestReferencesActor`, and `QuestTargetsTile` relations for active game
  mirrors.
- `createGameboardScenarioInteropSnapshot`: the same neutral board snapshot plus
  spawn-group, patrol-route, actor, and quest entities. It carries
  `SpawnGroupHasLocation`, `SpawnGroupRouteCheck`, `PatrolRouteHasWaypoint`,
  `PatrolWaypointOnTile`, `PatrolRouteSegment`, `ActorOnTile`,
  `QuestReferencesActor`, and `QuestTargetsTile` relations for games that use
  their own ECS runtime.
- `createGameboardSimulationInteropSnapshot`: final actor/quest state plus
  simulation step, actor-target, command, movement, and mutation timeline
  entities for external ECS replay, save-log, and CI inspection adapters.
- `createGameboardInteropSnapshotIndex` and `selectGameboardInteropRelations`:
  relation indexes and filters for external ECS pipelines that need to query
  neutral relations by name, source entity, or target entity before mounting.
- `mountGameboardInteropSnapshot`: callback-based mounting into another ECS or
  store.
- `createInMemoryGameboardEcs`: a minimal reference adapter for tests and docs.
- `createHexTileRegistry` and `declareHexTile`: custom tile declarations for
  other hex tile sets with bounds, stack rules, and adjacency channels.
- `declareGameboardPiece`: custom non-tile asset declarations for buildings,
  units, props, scatter, trees, and landmarks that can be converted into layout
  rules.
- `applyTileDeclaration`: a bridge from declarations into authored plans.
- `validateGameboardPlan`: Koota-free validation for built-in, footprint,
  blocking-overlap, and custom declaration rules.
- `./rule-types`: shared rule config and violation types for consumers that only
  need TypeScript contracts.
- `./world-rules`: Koota runtime validation and edit predicates split from
  seeded generation so React and app renderers can import them cheaply.

New systems should preserve this split: rules may run through Koota, but the
underlying data should still be representable as declarations and plan records.
`validateGameboardRules` delegates through the neutral plan validator so Koota and
non-Koota paths stay aligned.

## Relations and rules

- `AdjacentTo` links every tile entity to neighboring tile entities and stores the
  clockwise edge index.
- `PlacementOnTile` links renderable placements to their canonical origin tile.
- `PlacementOccupiesTile` links renderable placements to every tile in their
  layout footprint, including the origin tile, and carries blocking and
  occupancy-group metadata for external ECS rule systems.
- `validateGameboardRules` checks max stack height, invalid stacked water,
  reciprocal road/river edges, coast-water adjacency, harbor-water adjacency,
  footprint validity, blocking footprint overlap, and structures on water.
- Registered custom tile/placement declarations are rotation-aware: edge masks,
  reciprocal checks, and per-edge neighbor terrain requirements are evaluated
  against the rotated placement footprint a renderer will show on the board.
- `canStackAt` and `canPlaceHarborAt` are small public predicates for game UI and
  procedural generators.
- Runtime placement helpers spawn, move, update, and remove renderable gameplay
  pieces inside the same Koota world:
  `spawnGameboardPlacement`, `moveGameboardPlacement`,
  `updateGameboardPlacement`, and `removeGameboardPlacement`.
- `inspectGameboardPlacementOccupancy` and `canOccupyGameboardPlacement`
  preflight runtime spawn/move intents against `PlacementOccupiesTile`, including
  multi-tile footprints, blocking placements, missing footprint tiles, ignored
  placement ids, and shared occupancy groups for composite pieces.
- Runtime spawn/move/update helpers accept `occupancyGuard` when gameplay or
  editor code wants the mutation itself to throw on blockers or missing
  footprint tiles. Guard options can ignore known placement ids for drag previews
  and self-overlap workflows.
- `gameboardActions` exposes those helpers alongside `loadPlan` and `clear` so
  React or game-loop code can use one action bundle.
- `useProjectedGameboardPlan` gives React renderers a live `GameboardPlan`
  projection of the Koota world, including runtime actor/marker placements that
  should be rendered by Three.js or another view layer. It imports from the
  lightweight `./projection` module rather than the seeded generation module.
  Derived React selectors subscribe to relevant gameboard trait and relation
  mutations, so runtime placement/actor moves refresh projected plans and
  occupancy preflight results even when the entity set itself is unchanged.
- `useGameboardOccupancyIndex`, `useGameboardNavigation`,
  `useGameboardSpawnLocations`, and `useGameboardPatrolRoute(s)` give React
  games the same board-aware blocking, path preview, reachability, deterministic
  spawn selection, and NPC/enemy schedule preflight APIs as the non-React
  runtime.
- `useGameboardLayoutSiteInspection`, `useGameboardLayoutFillAnalysis`, and
  `useGameboardLayoutPlacements` give React build cursors, seeded-board editors,
  and procedural map previews the same layout diagnostics and generated
  placement options as `./layout` without mutating Koota state.
- `useGameboardPieceRegistryAnalysis`, `useGameboardPieceSelection`,
  `useGameboardPiecePlacementInspection`, `useGameboardPieceFillInspection`, and
  `useGameboardPieceSourceUrlMap` give React external-pack setup screens and
  renderer panels the same declaration analysis, seeded piece-fill previews, and
  URL override maps as `./pieces`.
- `useGameboardRuntime` exposes the bound `./runtime` facade from the current
  provider world, so React components can spawn actors, dispatch commands, tick
  systems, project plans, and produce runtime snapshots without manually
  stitching action bundles together.
- `useGameboardRuntimeSnapshot`, `useGameboardPlacementSnapshots`,
  `useGameboardActorSnapshots`, and `useGameboardQuestSnapshots` expose
  serializable runtime reads for HUDs, editors, external stores, and React test
  probes. They should rerender on placement, actor, movement, patrol, and quest
  trait changes, not just entity membership changes.
- `GameboardRuntimeProvider`,
  `MedievalGameboardPlanProvider`, `MedievalGameboardRecipeProvider`, and
  `MedievalGameboardScenarioProvider` mount the matching Koota world while
  preserving any richer runtime facade in context, including recipe/scenario
  piece registries and source URL map helpers.
- `useGameboardPatrolActions`, `useGameboardPatrolAgentEntities`,
  `useGameboardPatrolAgent`, and `useGameboardPatrolState` expose live patrol
  route assignments to React without requiring components to import raw Koota
  trait objects.
- `usePlacementOccupancyForTile` and `useGameboardPlacementOccupancy` give React
  UIs the same serializable footprint records as the Koota snapshot helpers,
  while `usePlacementEntitiesForTile` remains available for relation-backed
  entity queries.
- `useGameboardPlacementOccupancyInspection` and
  `useCanOccupyGameboardPlacement` give React build cursors, drag previews, and
  movement UI the same blocker/missing-footprint preflight as the plain Koota
  helpers.
- `useGameboardTileInspection` gives React panels, hover targets, AI previews,
  and ECS bridge adapters the same actor-aware tile summary as
  `inspectGameboardTile`, including source-aware enterability after live actor
  moves.
- `useGameboardNeighborhoodInspection` gives React tactical overlays and local
  sensing panels the same filtered radius summary as
  `inspectGameboardNeighborhood`.
- `useGameboardActorSelection` gives React command menus, AI debug views, and
  HUD lists the same actor-centric selection surface as `selectGameboardActors`,
  including stable actor ids, placement ids, tile buckets, source-relative
  radius checks, hostility filters, teams/factions, and tags.
- `useGameboardActorTargets` gives React tactical overlays and command menus the
  same path-aware target report as `inspectGameboardActorTargets`, including
  command metadata, cheapest target/adjacent approach tile, path cost, and
  reachable/unreachable buckets.
- `useGameboardActorTargetCommand` gives React HUDs, command palettes, and AI
  debug panels the same chosen-target command plan as
  `planGameboardActorTargetCommand`, preserving the read-only targeting report
  while applying the same reachability gate before a host game enqueues work.

Runtime placements are for units, markers, build previews, constructed props, and
similar game pieces. They keep `PlacementOnTile` and `PlacementOccupiesTile`
current, recompute world position from the target tile elevation, retag query
traits when the asset or kind changes, and remain part of
`projectWorldToGameboardPlan` because their default orders are in the custom
placement range. `PlacementOnTile` is intentionally exclusive and origin-only;
`PlacementOccupiesTile` is non-exclusive so multi-hex props, landmarks, harbors,
and build previews can be queried from every covered tile in Koota and React.
`readPlacementsForTile`, `readPlacementOccupancyForTile`, and
`readGameboardPlacementOccupancy` expose the same data as serializable records
for UI, save, worker, or external ECS bridges that should not hold Koota entity
references. Runtime facades also expose `readActorsForTile` for one-hex reads
that need actor kind, team, tag, hostility, or interaction semantics.
Placement preflight helpers use those same occupancy records so editor previews,
build cursors, and movement UI can fail before mutating live Koota state;
`occupancyGuard` lets the mutator enforce the same result when the caller wants
fail-fast gameplay commands.

`./actors` adds gameplay semantics on top of those same placement entities.
`GameboardActor` marks player, NPC, enemy, prop, unit, or custom actor roles;
marker traits expose hostile, interactive, and blocking queries; and
`inspectGameboardActorCollision` reports whether a target tile contains passable
props, interactive actors, or hostile blockers. `createGameboardActorNavigationProfile`
bridges that actor layer into `./movement`, so a hostile actor can block movement
even when its visual placement is registered as a prop, while ordinary props and
NPCs can remain passable. Actor spawns call the same runtime placement mutation
path as raw placements, so `positionOffset`, `rotationSteps`, `scale`,
`requiresExtra`, and `occupancyGuard` stay consistent across player/NPC/enemy
pieces and non-actor markers. `moveGameboardActor` and the actor action bundle
resolve actor ids and preserve those placement offsets/guards while moving the
underlying placement entity. `inspectGameboardInteractionTarget` is the
renderer-to-gameplay bridge: it accepts `placementId`, `actorId`, `tileKey`, or
axial coordinates, resolves the Koota placement/actor/tile context, and
classifies the hit as move, interact, attack, or inspect.
`planGameboardInteractionCommand` turns that report into a stable non-executing
command payload such as `move`, `interact-actor`, `attack-actor`, or
`inspect-tile`. Use that command shape as the boundary between renderer
selection and game-specific movement, combat, dialog, or quest execution.
`inspectGameboardTile` is the compact tile-status read for UI, AI, and external
ECS bridges: it returns tile state, placements, footprint occupancy records,
actors, hostile/interactive/prop buckets, blocking placements, and source-aware
enterability from one public call.
`inspectGameboardNeighborhood` applies that same inspection contract across a
hex radius, with filters for terrain, tags, enterability, actors, hostiles,
interactive actors, and props. Use it for hover overlays, local AI sensing,
aggro checks, tactical panels, and external ECS adapters that should not rebuild
Koota query/filter logic.
`selectGameboardActors` is the actor-centric companion for AI, UI lists, quest
checks, and external ECS bridges that need actor snapshots rather than tile
summaries. It filters by actor id, placement id, kind, team, faction, tags,
tile keys, source-relative radius, hostility-to-source, interactivity, and
blocking state, then returns both live Koota actor snapshots and serializable
actor records with stable actor id, placement id, tile-key, distance, and
per-tile buckets. Use `selection.records` and `selection.recordsByTileKey` when
the result needs to cross into a worker, save log, UI store, or non-Koota ECS.
Use `gameboardActorActions(world).select`, `runtime.selectActors`, or the React
hook before adding ad hoc Koota query loops in examples, tests, or integrations.
`inspectGameboardActorTargets` is the path-aware companion. It starts from a
source actor, applies the same selection filters, plans a stable
`GameboardInteractionCommand` for each target, and ranks target-tile or adjacent
approach routes through `createGameboardActorNavigationProfile`. It returns
reachable and unreachable buckets plus serializable target records for AI,
command menus, workers, save logs, and external ECS mirrors. It must remain
read-only. When a consumer needs the chosen target and the command it would
enqueue, use `planGameboardActorTargetCommand`,
`gameboardCommandActions(world).targetCommand`, or
`runtime.planActorTargetCommand`; React consumers should use
`useGameboardActorTargetCommand` for the same surface inside HUDs and command
palettes. Those helpers preserve the target report and apply only a reachability
gate before returning the planned command. When UI or AI wants to immediately
send that chosen target through the neutral event pipeline, use
`dispatchGameboardActorTargetCommand`,
`runGameboardActorTargetInteraction`,
`gameboardSystemActions(world).dispatchActorTargetCommand`, or the matching
`runtime.dispatchActorTargetCommand` / `runtime.interactActorTarget` facades.
Those dispatch helpers still do not own pursuit state, aggro state, combat,
dialog, or inventory effects; those policies belong in host systems or explicit
`./commands` handlers.
`./commands` is the next layer up for consumers that want the common behavior
handled. `previewGameboardInteractionCommand` adds actor-aware movement path and
budget checks for `move` commands; `executeGameboardInteractionCommand` requests
movement through `./movement`; and interact, attack, or inspect commands return
`requires-game-handler` unless the caller passes explicit handlers. The package
provides small built-ins for common RPG effects: remove a target actor, remove a
target placement, or mark a target actor as interacted. Host games can still
provide their own handler functions and mirror the resulting effect records into
their own ECS. Three.js renderers should use `gameboardInteractionTargetForObject`
on raycast hits, then pass the returned target into `./commands`.

`./patrol` turns planned patrol routes into live Koota state. A
`GameboardPatrolAgent` stores the route id, waypoint keys, segment costs, loop
state, pause counters, and current/target waypoint indexes; `GameboardPatrolState`
stores the public status and last requested path. `setGameboardPatrolAgent`
accepts a route plan from `./navigation` or a plain route input, and
`runGameboardPatrolSystem` requests movement toward the next waypoint through
the same `./movement` layer used by player commands.

`./systems` is the game-loop boundary on top of commands, patrols, movement, and
quests. It emits neutral event records for command dispatch, patrol movement
requests, patrol waits/completions/blockers, movement stepping, movement
completion/blocking, quest advancement, quest completion, and quest blocking.
Use these records to mirror state into another ECS, update UI, or route
handler-required commands without making this package own host-game combat,
dialog, loot, or inventory. When opt-in handlers are supplied, `command-handled`
records include the handler id, handler status, effect types, and plain effect
payloads. Dispatch/run helpers return both in-process `events` and serializable
`eventRecords`; use the records across runtime boundaries so Koota entity
references are already replaced with plain placement, actor, patrol, movement,
and quest ids. Use `snapshotGameboardSystemEvent` or
`snapshotGameboardSystemEvents` only when an integration already has in-process
event objects.

`./runtime` is the high-level game-loop facade for consumers that want one
public object per board. `createGameboardRuntime` accepts a `GameboardPlan`, an
existing Koota world, or `{ world, plan }`, then exposes bound placement, actor,
movement, patrol, quest, command, and system action bundles alongside direct
helpers for placement occupancy inspection, placement spawn/update/move/remove,
actor spawn/register/update/find/read, quest spawn/find/read/advance, command
planning/preview/dispatch, actor-target command planning, interaction, tile
inspection, actor selection/targeting, ticks, live `GameboardPlan` projection,
aggregate plan summaries, validation projection, and serializable snapshots.
`runtime.summarizePlan()` projects the current world and returns the same
`GameboardPlanSummary` as `summarizeGameboardPlan(plan)`, so editor panels,
visual-test queues, CI assertions, and external ECS bridges can prove that a
fixed or seeded board includes the expected terrain, elevation, feature,
asset, and local-only cases before rendering.
Runtime navigation helpers (`createOccupancyIndex`, `createNavigation`,
`selectSpawnLocations`, `planSpawnGroups`, `planPatrolRoute`, and
`planPatrolRoutes`) project the live world before reading occupancy, so path
previews, spawn candidates, spawn-group routes, and patrol schedules account for
actors and blockers spawned after the board loaded.
It also exposes declared piece and layout helpers:
`inspectLayoutSites`, `createLayoutPlacements`, `analyzeLayoutFill`,
`createLayoutFillPlacements`, `inspectPiecePlacement`, `createPiecePlacements`,
`spawnPiece`, `spawnLayoutPlacements`, and `spawnLayoutFill` all run against the
current projected world so generated props, trees, landmarks, units, harbors,
and custom third-party pieces respect live occupancy before they mutate Koota
state. The inspection and `create*` helpers are dry-runs for editor previews,
tooltips, and seeded-generation diagnostics; the spawn helpers commit the same
checked placement options into Koota state.
Registry-level runtime helpers (`analyzePieceRegistry`, `selectPieces`,
`createPieceFillRules`, `createPiecePoolFillRule`, `analyzePieceFills`,
`inspectPieceFills`, and `spawnPieceFills`) are the recommended game-facing
surface when local external packs need tag/role/source selection, same-archetype
variant pools, seeded fill diagnostics, and live-world spawning from one bound
board object. `createPieceSourceUrlMap` is exposed beside those helpers so the
same checked registry can feed Three.js or host-renderer asset resolution for
local-only source roots.
Runtime snapshots include raw Koota state, the projected render plan, runtime
placements, footprint occupancy, actors, quests, and optional interop relations.
Those interop relations include the live actor and quest graph by default, so a
game can mirror active runtime state with `createInteropSnapshot` or
`mountInterop` instead of re-deriving actor/quest links from placements.
`createGameboardRuntimeFromRecipe` compiles saved recipe JSON into the same
facade and preserves `recipePieceRegistry` plus
`createRecipePieceSourceUrlMap` for generated local pieces.
`createGameboardRuntimeFromScenario` composes scenario instantiation with the
same facade and preserves resolved actor and quest entity indexes,
planned `spawnGroups`, planned `patrolRoutes`, `scenarioPieceRegistry`,
`createScenarioPieceSourceUrlMap`,
`createScenarioInteropSnapshot`, and `mountScenarioInterop` for SimpleRPG-style
startup flows.

`./quests` adds progression semantics without taking over a game's narrative
system. `GameboardQuestDefinition` is serializable, `GameboardQuest` stores
objective progress in Koota, and `advanceGameboardQuest` evaluates reach,
interaction, collision, and defeat objectives against the actor layer. Use this
for integration tests and example games whenever progression depends on board
state.

`./layout` is the seeded placement layer for board decoration and gameplay
pieces. It selects sites from a `GameboardPlan` or current Koota world using
terrain, elevation, terrain adjacency, placement adjacency, occupancy, edge
padding, footprint reservations, distance, and scoring preferences. Built-in
archetypes define default behavior for
surfaces, buildings, harbors, units, props, trees, scatter, and landmarks. The
harbor archetype is a structure rule that targets coast tiles with adjacent
water so generated docks and shipyards are not just generic landmarks. Tree and
scatter archetypes support multiple slots per tile, while fill rules place
deterministic percentages of a board and update occupancy between rules so
landmarks, buildings, units, and props do not silently collide. Footprint
`createGameboardLayoutArchetypeRegistry` is the public extension point for
pack-level placement behavior: consumers can declare custom archetypes such as
camp supplies, large towers, ship props, or special unit spawns while retaining
the built-in archetypes in the same registry. Fill rules, piece fill rules, and
saved recipes can carry that registry so custom archetype ids resolve the same
way in build tools, Koota runtime spawns, and external ECS projections.
Footprint
metadata is deliberately scalar (`layoutFootprintTiles` as a pipe-delimited
string) so it survives Koota placement state, plan projection, and package
serialization. Multi-slot tree/scatter placements also carry deterministic
`positionOffset` values and scalar `layoutPositionOffsetX/Y/Z` metadata so
same-hex props have a stable visual spread in Three.js, Koota snapshots, and
neutral ECS projections. Tree and scatter archetypes share the `soft-feature`
slot group, so later generated fill rules continue at the next available slot on
the same tile instead of reusing offset zero and visually overlapping earlier
generated props. Hard criteria such as `minElevation`, `maxElevation`,
`requiredAdjacentPlacementKind`, and `forbiddenAdjacentPlacementLayer` let
generated content target stacks, roads, structures, units, or prop-free buffers
without depending on renderer-only heuristics. `inspectGameboardLayoutSites`
returns accepted slot candidates plus rejected tile diagnostics for terrain,
adjacency, occupancy, footprint, distance, edge-padding, and full scatter-slot
failures, which gives editors and build scripts a concrete explanation for why
a piece cannot be placed. `analyzeGameboardLayoutFill` runs the same seeded fill
pass as placement generation but returns candidate counts, rejection counts,
requested counts, selected tile keys, and warnings when a rule is capped by
available sites, `minCount`, or missing assets before a game mutates the board.
`appendGameboardLayoutPlacementsToPlan` is the serialization bridge for build
steps and editors that want generated placement options written back into a
portable `GameboardPlan` instead of spawning them into Koota immediately.
Layout placement options preserve `occupancyGuard` when they are spawned into a
live Koota world, so generated gameplay pieces can still fail fast if another
runtime action occupied the selected footprint after the source plan was
inspected.

`./pieces` is the declaration layer for non-tile assets. It lets a game register
an external tower, tree, adventurer, crate, or other authored piece with role,
source, scale, footprint, default criteria, tags, and metadata, then produce
`./layout` fill rules or one-off placement options. Piece registries can be
selected by id, asset id, role, source, tags, and local-only state, then expanded
into per-piece rules or same-role variant pools. Batch compatibility helpers
turn multiple external asset reports into declarations in one pass, preserving
source attribution and local-only state. Per-asset overrides are keyed by report
id and are the public place to declare footprint reservations, scatter slot
rules, unit criteria, tags, and authored metadata for specific local assets.
Docks, harbors, shipyards, and ports infer to the `harbor` piece role so local
pack scans can immediately use coast-plus-water layout behavior.
`inspectGameboardPiecePlacement` and
`createGameboardLayoutPlacementsFromPiece` are the direct bridge for editors and
game code that need to test or instantiate one registered piece while preserving
its role, source metadata, archetype defaults, footprint, and rejection
diagnostics. Piece-to-layout conversions also preserve `occupancyGuard` so a
registered local unit, tower, or prop can use the same live-world overlap checks
as raw runtime placement actions.
`inspectSeededGameboardPieceFills` is the registry-level bridge for selected
piece groups: it reports matched pieces, invalid variant pools, generated fill
rules, layout fill analysis, and concrete placement options without mutating the
board. Use the equivalent runtime methods when the source of truth is a live
Koota world instead of a static `GameboardPlan`; they project the current board,
run the same inspection, and can commit the resulting fill rules through
`spawnPieceFills`.
This keeps third-party pack usage declarative without forcing consumers to adopt
Koota internally.

## Coordinates, paths, and spawns

`./coordinates` owns axial keys, neighbors, rings, ranges, lines, distance, and
A-star pathfinding. `./grid` owns Honeycomb setup plus axial/world conversion and
spawn locations for rectangle and hexagon board shapes. These helpers are the
public coordinate contract for AI, pathfinding, camera, spawn, and game-rule
systems.

`./navigation` is the board-aware layer on top of those primitives. It builds
tile occupancy indexes from `GameboardPlan`, expands `layoutFootprintTiles` into
tile occupancy, marks structures/units or custom placement metadata/kinds as
blockers, applies terrain costs and elevation-step limits, and exposes
plan-aware path, reachable-range, spawn-location, spawn-group, and patrol-route
planning helpers. `planGameboardSpawnGroups` layers deterministic player/NPC/enemy
spawn selection on top of board-aware passability, inter-group separation, and
route checks so generated boards can fail before gameplay when required starts
cannot reach each other. `planGameboardPatrolRoute` and
`planGameboardPatrolRoutes` use the same passability layer for NPC schedules,
guard loops, enemy patrols, and encounter waypoints; they can start from a named
spawn group or explicit tile and return route segments plus errors before those
routes are attached to Koota movement or an external ECS. The CLI commands
`spawn-groups --plan|--recipe|--scenario` and
`patrol-routes --plan|--recipe|--scenario` use the same functions for
build/editor preflight. `createGameboardPatrolSimulationScript` and the
`patrol-script` CLI convert complete route segments into actor movement command
steps so route plans can be executed by the scenario simulator or a host-game
scheduler. Saved scenarios may embed the same spawn-group and
patrol-route options, and actors can use `spawnGroupId` instead of fixed tile
coordinates; validation resolves those actor starts and surfaces route failures
before runtime. `./occupancy` exposes the same footprint parsing and blocking
checks for external ECS adapters. Use movement profiles for alternate agents such
as ships, workers, cavalry, or flying units instead of forking pathfinding logic.

`./movement` is the Koota runtime layer on top of `./navigation`. It adds
`MovementAgent`, `MovementPathState`, and `IsMoving`, plus built-in `ground`,
`worker`, `cavalry`, `ship`, and `flying` profiles. Games request a path for a
placement, step movement from a frame loop or event handler, spend/reset movement
budgets, and keep placement-to-tile relations synchronized through the normal
runtime placement actions.

`./compatibility` is the external-pack bridge. It analyzes local GLB/GLTF bounds
against the KayKit hex footprint, flags non-compatible tile shapes at build/test
time, recommends prop or unit placement metadata, and carries facing, footprint,
scale, blocking, and animation defaults into runtime spawn options.
`recommendExternalAssetFacing` maps a model's authored forward axis to a target
hex edge and reports the suggested rotation plus any angular error, which is the
contract for rigged Adventurers-style characters and other external units. The
Kenney Castle Kit and KayKit Adventurers fixtures exercise this only through
`tests/e2e/local-assets/`; their binaries remain ignored local references and
are not part of the npm package.

The CLI `analyze` command uses manifest bounds to report tile footprint, row
spacing, recommended scale, and warnings for off-center or irregular tile sets.
The CLI `declarations` command emits registry JSON. The CLI
`guide-permutations` command emits the exported selector matrix and can validate
that every guide permutation asset exists in a manifest. The CLI
`guide-scenarios` command emits the 19-page extracted guide scenario matrix and
can validate FREE page assets against a FREE manifest or all FREE+EXTRA page
assets against an EXTRA manifest. Its JSON payload also includes the public
`summarizeKayKitGuideCoverage()` result so tooling can consume stable page,
edition, role, unique-asset, and repeated-asset occurrence counts without
rejoining catalog data. Use `--page`, `--scenarioId`, or `--editionScope` to
isolate one use case, and `--includeTreatments` to include the
`describeKayKitGuideScenarioCoverage()` report for every selected page.
`guide-usages` emits the renderer-ready
`listKayKitGuideScenarioAssetUsages()` rows with repeated page-level
occurrences, labels, captions, source paths, roles, public APIs, docs, and
visual artifacts. Library users can feed the same filters into
`listKayKitGuideScenarioAssetRenderRequests()` or
`listKayKitGuideScenarioAssetRenderGroups()` to get URL-resolved contact-sheet
queues; the CLI `guide-render-requests` command exposes the same rows and can
write grouped queues with `--includeGroups`. Use these for README screenshot
work or agent audits that need every page occurrence rather than unique asset
coverage.
`guide-assets` emits the inverse `listKayKitGuideAssetCoverages()` map from an
exact FREE or local EXTRA asset id to guide pages, role, APIs, docs, and
screenshots.
`guide-roles` emits the inverse `listKayKitGuideRoleCoverages()` map from a
gameplay role such as prop, road, unit, or structure to guide pages, APIs,
treated assets, docs, and screenshots.
`guide-apis` emits the inverse `listKayKitGuidePublicApiCoverages()` map from a
public API surface to guide pages, treated assets, roles, docs, and screenshots.
`validate-plan` validates saved board JSON,
`validate-recipe` compiles a recipe JSON into a plan, and `validate-scenario`
validates scenario IDs, actor references, quest references, and asset manifest
membership before creating Koota runtime state. When those
validation commands receive `--manifest` or a local source folder, they also
check tile, placement, and scenario actor asset ids plus `requiresExtra`
consistency. `summarize-plan` accepts a saved plan, recipe, scenario, or
blueprint and emits validation counts plus the same `GameboardPlanSummary` as
the public API, which gives CI, visual queues, editors, and agents a no-code way
to prove terrain, texture, elevation, feature, asset, and local-only coverage
before rendering. `summarize-scenario` is the playable companion: it emits the
compiled board summary plus actor kind/team/asset counts, local-only actor
usage, spawn group route checks, patrol route coverage, quest objective kinds,
and validation counts so SimpleRPG-style fixtures can prove the scenario has
the expected spawns, enemies, props, routes, and objectives. `analyze-layout`
checks layout fill rule JSON against a saved plan,
recipe, or scenario and emits the same candidate, selected, warning, and error
diagnostics as `analyzeGameboardLayoutFill` for build-time tuning. With recipe
or scenario inputs, `--outPlan` also writes the compiled board JSON so one build
step can both tune layout feasibility and hand the board to a renderer. Explicit third-party
exceptions use `--allowUnknownAssetIds`; open
local prototyping can use `--allowUnknownAssets`. The CLI `snapshot` command
emits neutral ECS interop JSON from a plan, recipe, or scenario, including
optional deterministic spawn locations and scenario actor/quest relations for
build pipelines that do not instantiate Koota. The CLI `validate-simulation`
command preflights a scenario plus a simulation script without executing
gameplay. The CLI `patrol-script` command emits movement command steps from a
planned patrol route set and actor assignment. The CLI `simulate-scenario`
command runs the same preflight, then runs command/system/mutation steps against
a Koota world and writes a serializable event/mutation/final-state report plus
top-level command, actor-target, patrol, and movement timelines
and optional final plan. Its text summary includes actor-target record counts and
nearest target details even when JSON report/interop files are written; `--json`
keeps stdout machine-readable. Mutation steps cover `spawn-placement`,
`update-placement`, `spawn-actor`, `update-actor`, `remove-actor`, and
`remove-placement` so handler-owned effects can still be exercised through
public APIs. `spawn-actor` steps may use fixed coordinates or scenario
`spawnGroupId` resolution, so scripted reinforcements and NPCs can use the same
spawn contract as initial actors. Script validation checks schema, duplicate step
IDs, command target references, source actors, spawn targets, spawn groups,
update targets, remove targets, event names, mutation expectations, actor
expectations, command expectations, placement expectations, and quest/objective
references before execution. The `pnpm expectations` gate checks event sequences
or required event types, command records, movement records, mutations, actor
existence/positions/metadata/tags, placement existence/metadata, and
quest/objective status; the CLI exits non-zero on validation or expectation
failures unless explicitly allowed. `pnpm test:cli` runs those built commands
against the packaged SimpleRPG scenario so the documented CLI surface is checked
after compilation, not only through source-level unit tests.
The CLI `piece` command analyzes an external GLB/GLTF and emits a
starter custom piece declaration with suggested role, scale, footprint, facing,
and animation metadata. The CLI `pieces-from-assets` command scans one or more
local GLB/GLTF files or directories, emits compatibility reports plus piece
declarations, and lets a project convert an ignored local pack folder into a
checked registry JSON. `--pieceOverrides` / `--overrides` accepts a JSON object
or `{ "overrides": { ... } }` file for per-asset placement characteristics. The
batch output records source asset paths relative to the scanned folder and adds
that relative source metadata to each generated piece; absolute paths require
the explicit `--includeAbsolutePaths` diagnostic flag. The CLI `pieces` command
validates piece declaration files, summarizes
roles/sources/tags, rejects incompatible variant pools, and can emit seeded
piece-fill layout rules for build pipelines. With `--emitSourceUrls`, it also
emits a renderer-facing asset-id URL map from checked relative source metadata
and one or more caller-provided local source roots.
The CLI `place-piece` command uses one checked piece declaration against a saved
plan, recipe, or scenario, emits the same site rejection diagnostics as
`inspectGameboardPiecePlacement`, and can write a placed `GameboardPlan` for
editor previews or generated scenario artifacts.
The same `pieces` command can receive `--plan`, `--recipe`, or `--scenario` with
piece-fill flags to inspect and optionally append a selected registry subset as
a group, which is the CLI equivalent of `inspectSeededGameboardPieceFills`.

`./three` provides renderer-facing URL resolution so apps can use the same
`GameboardPlan` for packaged FREE assets, app-local EXTRA catalogs, and ignored
third-party pieces. `createGameboardPlacementAssetUrlResolver` accepts a manifest
catalog plus the asset-id map from `createGameboardPieceSourceUrlMap`, checks
placement `metadata.sourceUrl`, and falls back to a caller-provided resolver for
engine-specific asset stores. `loadGameboardPlacementObject` accepts a caller
owned GLTF loader, applies the placement transform, and optionally loads external
animation clips into a Three.js `AnimationMixer` so rigged Adventurers-style
units can use the same public board placement contract as static props.
`syncGameboardPlacementObjects` is the render-loop bridge: it loads missing
placement objects, updates transforms from projected Koota state, removes stale
objects from a scene parent, advances animation mixers for loaded units, and
tags roots with gameboard user data. Raycast handlers should use
`findGameboardPlacementObjectUserData` or
`findLoadedGameboardPlacementObjectForObject` so clicked mesh children resolve
back to placement IDs, tile keys, and actor metadata from Koota projection.

## Seeded generation

`createMedievalGameboardBlueprintRecipe`,
`createMedievalGameboardBlueprintPlan`, and
`inspectMedievalGameboardBlueprint` are the high-level public path for complete
2.5D board intent. Use them when a board should be specified in terms of biome
fill percentages, mountain range paths and maximum height, towns, road
networks, rivers, harbors/ports, transition tiles, sloped elevation ramps,
sloped roads, bridges, semantic prop-cluster dressing, and density fills. They
compile to ordinary recipes and plans, so Koota, renderers, external ECS
adapters, and validation do not need a separate blueprint runtime. Use
`propClusterDressing` when a generated board should attach camps, resource
caches, worksites, training yards, stable yards, or harbor support clusters to
town and harbor intent instead of relying on later loose scatter.

`createSeededGameboardPlan` and `createSeededGameboardWorld` use `seedrandom` to
produce deterministic 2.5D rectangle or hexagon boards with coastlines, harbors,
settlements, roads, rivers, mountains, hills, forests, and scatter.
`createMedievalHarborBoard` also accepts both rectangle and hexagon shapes for a
small authored harbor-town composition. New generation work should add Koota
traits/rules first, then expose recipes as projections. Percentage fills from
`./layout` are the public hook for biome-like density controls.
Use `GameboardBuilder.addBridge` or recipe `addBridge` when a bridge is authored
directly; blueprint road crossings can infer the same bridge metadata when
`transitionPolicy.bridges` is enabled.
Use `GameboardBuilder.addElevationRamp` or recipe `addElevationRamp` when a
sloped terrain transition is authored directly; blueprint elevation deltas can
infer the same ramp metadata when `transitionPolicy.elevationRamps` is enabled.
Use `GameboardBuilder.addFortification`, `addConstructionSite`, and
`addSiegeProjectile` or their recipe actions for authored walls/fences/gates,
construction stages, ruins, scaffolding, and neutral projectile structures;
blueprint towns emit fortification recipe steps for generated wall rings and
reserve those tiles before bridges are inferred.
Use `GameboardBuilder.addPropCluster` or recipe `addPropCluster` for authored
and generated camps, resource caches, worksites, training yards, stable yards,
and harbor support dressing when a map needs single-hex stacking, adjacent
spreads, density-controlled fill, FREE defaults, local EXTRA opt-in, and stable
cluster metadata for ECS adapters. `propClusterDressing` on blueprint options is
the board-scale wrapper for the same recipe action.
`layoutDensity` on seeded generation provides ergonomic presets for trees,
rocks, loose props, harbors, landmarks, and units; raw `layoutFills` remain the
lower level hook for custom-pack placements and exact ordering. Prefer `./pieces`
declarations when those custom placements should be reusable across maps,
recipes, tests, or ECS adapters. `pieceRegistry` and `pieceFills` on seeded
generation let those same declarations participate directly in deterministic
random boards as per-piece rules or same-role variant pools.

## Recipes

`./recipe` exposes serializable authoring steps for `setTerrain`,
`addRoadPath`, `addRiverPath`, `addMountainStack`, `addHarbor`, settlements,
transitions, units, props, scatter, and custom tile assets. Recipes also carry an
optional generation block with `layoutArchetypes`, `layoutFills`, reusable
`pieceDeclarations`, and seeded `pieceFills`, so saved scenarios can request
procedural trees, props, landmarks, and local-pack pieces without imperative
setup code. `layoutArchetypes` is the recipe-level place to declare custom
placement behavior once and let layout fills or piece declarations reference it
by id, which keeps local pack rules serializable and reusable across recipes,
scenarios, runtime facades, and build-time CLI analysis.
`createGameboardPlanFromRecipe` applies both authored steps and generation;
`applyGameboardRecipeGeneration` applies only the generated block to an existing
plan. Recipes are intended for agent-authored maps, saved scenario configs,
examples, and other places where imperative builder code would hide the board
contract. They compile to the same `GameboardPlan` as direct builder usage.
`inspectGameboardRecipe` and `validateGameboardRecipe` are the public preflight
APIs for authored recipe JSON; they return compile failures as validation
violations and can run manifest-backed asset checks against the compiled plan.
Recipe generation is checked before compilation for missing custom layout
archetype references, registry-key/id mismatches, and custom archetypes that
cannot infer placement `kind`; the `validate-recipe` CLI reports those as
specific recipe violations so build pipelines fail with actionable messages
before layout generation mutates a board.
`docs/examples/generated-piece-scenario.recipe.json` and the packaged
`examples/generated-piece-scenario.recipe.json`
are the canonical small JSON examples for generated piece declarations and fill
rules. The package export map exposes JSON examples as
`@jbcom/medieval-hexagon-gameboard/examples/*.json`; raw TypeScript examples
stay in the repo, while npm consumers use explicit compiled exports such as
`tests/integration/simple-rpg/simple-rpg.ts (test-only post-PRD R4)`.

## Scenarios

`./scenario` composes recipes with gameplay setup. A `GameboardScenario` carries
a board recipe, optional named spawn-group rules, patrol-route rules, actor
definitions, optional movement agents, and quest definitions. Actors may either
use direct `at` coordinates or `spawnGroupId` plus an optional
`spawnLocationIndex`; resolved actors carry spawn metadata for Koota and
external ECS consumers. Spawn group ids, patrol route ids, and claimed
spawn-location indexes are unique preflight contracts; duplicate claims fail
validation before runtime state is created.
`inspectGameboardScenario` and `validateGameboardScenario` check schema version,
duplicate actor/quest/objective ids, actor tile targets, unresolved spawn groups,
spawn-route failures, patrol-route failures, duplicate spawn-location claims,
quest actor references, collision targets, and optional plan rules before a game
creates runtime state.
`createGameboardWorldFromScenario`
compiles the recipe, resolves spawn-group actors, spawns actors through
`./actors`, attaches movement through `./movement`, plans patrol routes, spawns
quests through `./quests`, and returns the Koota world plus actor/quest entity
indexes and patrol-route plan. This is the portable form for SimpleRPG-like
examples where a game needs more than a static board but still wants
JSON-friendly content.
`createGameboardScenarioInteropSnapshot` gives non-Koota consumers the same
portable content without creating a Koota world: scenario actors become neutral
actor entities with tile coordinates, KayKit world positions, placement seeds,
and movement seed components, named spawn groups become neutral group entities
with selected locations and route-check records, patrol routes become neutral
route and waypoint entities with segment relations, quests become neutral quest
entities, and relations preserve spawn group locations/routes, patrol waypoints,
actor tile occupancy, and quest actor/tile targets.
The `blueprint` CLI command is the build-time shortcut for this full path: a
single blueprint JSON can emit its recipe, concrete plan, generated scenario,
scenario diagnostics, and `--outInterop` neutral ECS snapshot. Use that path for
external engines that want board-scale authoring plus spawn/patrol/quest records
without adopting the Koota runtime.
`@jbcom/medieval-hexagon-gameboard/examples/blueprint-board-usage` is the
packaged importable walkthrough for the same contract: it runs
`examples/blueprint-board.json` through blueprint compilation, scenario
inspection, Koota runtime creation, runtime facade snapshots, and scenario
interop summary counts from an installed package.

`./simulation` is the headless usage harness for scenarios. A
`GameboardScenarioSimulationScript` runs public command targets through
`./systems`, can run read-only `inspect-actor-targets` steps for the same
path-aware target records used by live AI/command menus, can run
`actor-target-command` steps that pick an actor through the same targeting
planner and then dispatch the planned attack/interact/inspect command, can apply explicit
game-handler mutations such as
`spawn-placement`, `update-placement`, `spawn-actor`, `update-actor`,
`remove-actor`, and `remove-placement`, and
returns a serializable report containing event records, mutation records, final
placements, final actors, final quests, the projected `GameboardPlan`, top-level
command/actor-target/patrol/movement timelines, and expectation failures. Use
the simulation `expectations` block to define success without writing test-only
code: event sequences, required event types, command records, actor-target records, movement records, actor
existence and tile positions, actor metadata/tags, placement existence and
metadata, mutation records, quest status, and objective status can all be checked from the
serialized report. Use
this for CI, agent-authored scenario checks, and external ECS integration tests
that need to prove a scenario behaves like a small game instead of only
validating static JSON. Use
`createGameboardSimulationInteropSnapshot` when that report should be mounted
into an external ECS: it preserves the projected final board, final actor/quest
state, removed-actor timeline references, and
actor-target/command/patrol/movement/mutation records as neutral entities and
relations.
Use
`inspectGameboardScenarioSimulationScript` or
`validateGameboardScenarioSimulationScript` before running authored JSON when a
tool needs structured validation records; the CLI uses the same path for
`simulate-scenario`. Tooling that authors or validates scripts can read
`GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS` instead of duplicating the action
list.

## Feature coverage expectation

Every guide feature should be represented at one of these levels:

- Catalog: named constants and asset id builders.
- Builder: typed authoring method.
- Koota: traits, relations, queries, or validators.
- React: hook/query surface when interactive UI would need it.
- Visual tests: composed screenshot or contact sheet.

`tests/simple-rpg/` is the integration fixture for proving the public API works
as a small game, not only as isolated helpers. It builds a fixed golden quest
map and a locked seedrandom map, spawns player/NPC/prop/enemy actors through
`./actors`, verifies that registered props are passable while registered enemies
block movement, resolves the quest line through `./quests` plus actor-aware
movement systems, projects the final Koota world back to a plan, and captures
browser screenshots of the completed scenes. The seeded scene also declares
FREE trees, supply scatter, and quest-marker pieces through `./pieces`, feeds
them into `createSeededGameboardPlan` with `pieceRegistry`/`pieceFills`, and
asserts that all generated piece placements survive quest completion and plan
projection. The fixed scene is the direct guide-builder exercise board: it now
places roads, rivers, coast/water, stacked mountains, hills, forests, harbors,
settlements, neutral buildings, bridges, walls, construction, siege, elevation
ramps, nature, flags, prop clusters, transitions, colored and neutral EXTRA unit
parts, unit presets, scatter, custom tile declarations, and authored tile asset
overrides while preserving the playable quest path.
`tests/integration/simple-rpg/simple-rpg.ts` exposes
`summarizeSimpleRpgGuidePublicApiExercises()` so the packaged consumer smoke can
assert that every current `listKayKitGuidePublicApiCoverages()` row has
SimpleRPG evidence and no stale evidence rows. It also exposes
`runSimpleRpgExecutableGuideApiSmoke()`, which directly invokes the lower-level
selector, manifest, registry, layout-piece, recipe, blueprint, seeded board,
spawn, and external compatibility helpers that games compose around the runtime.
That helper currently executes 40 guide-facing helper APIs and verifies the 404
KayKit public treatment rows plus all 19 decomposed guide pages. It is part of
the `pnpm expectations` gate and packed-consumer smoke so guide-facing APIs
cannot remain only documented. Evidence mode counts are memberships rather than
exclusive buckets; the tests require seeded generation, packaged scenario,
executable smoke, blueprint recipe, manifest package, compatibility adapter,
package boundary, fixed gameplay, and visual coverage modes to all stay active.
`./simulation` and `simple-rpg-simulation.script.json` are the package-facing
version of that same principle: a saved scenario can be exercised headlessly
through public command, system, spawn/update/remove mutation, and report APIs
before a renderer ever loads it. The packaged script can inspect reachable
hostile targets before it commits to combat, targets the enemy with the
`remove-target-actor` handler preset from the public `./commands` registry,
moves the player along the road to the elder, runs the elder interaction with
the `mark-target-interacted` preset, and checks command/patrol/movement
timelines plus actor-target records. Simulation scripts may also set `defaultCommandHandlerOptions` or
step-level `handlerOptions` to keep handler ids, hostile checks, command-kind
filters, and interaction metadata serialized with the fixture. JSON
expectations make the fixture self-verifying. Interop snapshots expose handled
command effects through
`CommandEffectActor` and `CommandEffectPlacement` relations with command
kind/status, handler id/status, and effect type metadata so external ECS adapters
can mirror the same outcome without inspecting Koota entities. Snapshot indexes
and relation selectors provide the same relation data in query-friendly form for
non-Koota stores that need to route by relation name, source entity, or target
entity before committing to an adapter mount.
