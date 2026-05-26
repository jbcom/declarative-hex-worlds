# Medieval Hexagon Gameboard Agent Guide

This repo builds `@jbcom/medieval-hexagon-gameboard`, a Koota-first 2.5D
gameboard runtime for KayKit Medieval Hexagon assets.

Use Node 22+ and pnpm 9. The workflow and package audits enforce this runtime
contract for CI and npm consumers.

## Source Of Truth

- Start with `docs/pillars/`, especially `05-koota-runtime-rules.md`.
- Use `docs/guides/` for the public API workflow: plan versus runtime, recipes
  and scenarios, guide scenario coverage, simulation, rendering, manifests, and
  external pack ingestion.
- Use `docs/guides/release-readiness.md` and `docs/release-readiness.json` as
  the generated release ledger. Regenerate them with `pnpm coverage:ledger`
  after screenshot, docs, API, or package-gate changes; use `pnpm cli <command>`
  for ad hoc built-CLI checks.
- The guide imagery lives in `docs/assets/kaykit-guide/` and is generated from
  `references/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Medieval_Hexagon_UserGuide_v1.pdf`.
  Regenerate it with `pnpm assets:guide`; that command runs the TypeScript
  entrypoint in `scripts/extract-kaykit-guide.ts`, using the deterministic Swift
  renderer on macOS when available and falling back to `pdftoppm` plus
  ImageMagick's `magick` command on other contributor machines.
- Use `listKayKitGuideScenarios()` from `./catalog` when mapping guide pages to
  assets, public APIs, docs, and screenshot artifacts. Keep
  `docs/guides/guide-scenario-coverage.md` synchronized with those scenario ids
  through `renderKayKitGuideScenarioCoverageMarkdown()` and do not duplicate the
  page-to-asset matrix in ad hoc test data. Use
  `listKayKitGuideScenarioAssetUsages()` for renderer/contact-sheet-ready
  page-level asset occurrences, and
  `listKayKitGuideScenarioAssetRenderRequests()` /
  `listKayKitGuideScenarioAssetRenderGroups()` when a tool needs URL-resolved
  render queues grouped by guide page. Use `listKayKitGuideAssetCoverages()` when
  starting from an exact manifest asset id and `listKayKitGuideRoleCoverages()`
  when starting from a gameplay role such as prop, road, unit, or structure;
  those are the canonical asset/role-to-page/API/docs/screenshot inverse
  indexes.
- Keep pillar frontmatter current when implementation or tests change.
- Keep TypeDoc comments useful on exported symbols. Every TypeDoc entry point
  in `typedoc.json` must start with top-level `@module` JSDoc, and public
  symbol docs should explain lifecycle, validation, and caller responsibility
  instead of restating a name.
- Run `pnpm docs` or `pnpm docs:build` for docs or public API comment changes.
  TypeDoc writes `docs/api/`, which is generated, ignored, and must remain
  untracked; `pnpm test:workspace` also enforces ignored/untracked boundaries
  for package `dist/`, VitePress `dist/`, browser screenshots, and local
  `references/` assets.
- For JSDoc completion claims, also run `pnpm test:api-docs`; it verifies that
  TypeDoc entry points match every public object export, enforces the `@module`
  entry-point contract, and keeps the strict TypeDoc warning count at zero.

## Asset Rules

- `references/` is local-only and gitignored.
- FREE assets under `packages/medieval-hexagon-gameboard/assets/free/` are
  generated, committed, and published.
- EXTRA assets are never committed or published. APIs may model EXTRA concepts,
  but generated placements must set `requiresExtra: true` when the asset is not
  in the FREE manifest.
- Optional wider asset-library smoke tests should read
  `MEDIEVAL_HEXAGON_ASSET_LIBRARY_ROOT` when a contributor provides it. For
  mounted NAS or removable-disk paths, verify the configured mount point before
  running local smoke tests:
  `ASSET_LIBRARY_ROOT=${MEDIEVAL_HEXAGON_ASSET_LIBRARY_ROOT:-/path/to/assets}; ASSET_LIBRARY_MOUNT=${ASSET_LIBRARY_ROOT%/assets}; mount | grep -q "$ASSET_LIBRARY_MOUNT" && echo MOUNTED || echo "NOT MOUNTED"`.

## Architecture Rules

- Prefer Koota state over parallel state. Tiles are entities.
- Keep `GameboardPlan`, tile declarations, and interop snapshots engine-neutral
  so non-Koota games can map the same data into their own ECS, including
  adjacency, placement-on-tile, placement-footprint occupancy, spawn-on-tile,
  actor-on-tile, and quest target relations.
- Use decomposed traits for rule logic:
  `TileCoordinates`, `TileTerrain`, `TileElevation`, `TileConnectivity`,
  `TileRenderState`, and `TileTagList`.
- Use `AdjacentTo` relations for neighbor-aware systems and validation.
- Use `spawnGameboardPlacement`, `moveGameboardPlacement`,
  `updateGameboardPlacement`, `removeGameboardPlacement`, or `gameboardActions`
  for in-game pieces after a plan has loaded. Keep runtime pieces in the same
  Koota world unless there is a strong reason to project into another ECS. These
  helpers keep both `PlacementOnTile` and `PlacementOccupiesTile` relations
  current; do not update `PlacementState` directly when footprint occupancy
  matters. Use `readPlacementsForTile`, `readPlacementOccupancyForTile`,
  `readActorsForTile`, or `readGameboardPlacementOccupancy` when code needs
  tile-scoped placements, actors, or serializable footprint records instead of
  Koota relation stores. Use
  `inspectGameboardPlacementOccupancy` or `canOccupyGameboardPlacement` before
  runtime spawn/move UI commits when a game needs to block units or structures
  from overlapping existing blocking footprints. Pass `occupancyGuard: true` to
  runtime spawn/move/update helpers when the mutation itself must fail instead
  of only reporting the preflight result; use guard `ignorePlacementIds` for
  drag previews or self-overlap cases.
- Treat `GameboardPlan` as a serializable projection/export format, not the only
  authoring model. Use `summarizeGameboardPlan(plan)` or
  `runtime.summarizePlan()` when docs, tests, screenshot queues, editor panels,
  or ECS bridge code need aggregate proof of terrain, texture, elevation, tile
  tags, placement kinds/layers, semantic features, asset ids, and local-only
  asset usage.
- Use `createGameboardRecipe` / `createGameboardPlanFromRecipe` when board
  intent needs to be saved, generated by agents, diffed in docs, or shared across
  runtimes. Use recipe generation blocks when saved scenarios need seeded
  `layoutFills`, `pieceDeclarations`, or `pieceFills`; use
  `applyGameboardRecipeGeneration` when an existing plan needs only that
  generated block applied. Use `createGameboardRuntimeFromRecipe` when a game
  should load a saved recipe directly into a live runtime while retaining the
  generated piece registry and renderer source URL map.
- Use `createHexTileRegistry` / `declareHexTile` for custom tile sets instead of
  hardcoding asset IDs into rules.
- Use `validateGameboardPlan` for engine-neutral checks before adding a Koota-only
  validator. Koota validators can wrap the neutral plan validator, but should not
  be the only way to enforce declaration, footprint, or blocking-overlap rules.
- Use `createGameboardInteropSnapshot` plus `mountGameboardInteropSnapshot` when
  adding examples for BiteCS, Miniplex, server stores, or custom ECS runtimes.
  Use `createGameboardInteropSnapshotIndex` and
  `selectGameboardInteropRelations` when an external runtime needs relation
  queries by name, source entity, or target entity before mounting.
- Use `runtime.createInteropSnapshot()` or `runtime.mountInterop(adapter)` when
  a live Koota board should mirror current actors, quests, actor-placement
  links, and quest references into another ECS. Use
  `createGameboardRuntimeInteropSnapshot` only for tools that already have
  serialized `{ plan, actors, quests }` records.
- Use `createGameboardScenarioInteropSnapshot` when non-Koota examples need the
  same authored board, resolved spawn-group locations/routes, patrol-route
  waypoints/segments, actors, movement seeds, and quest graph as a Koota
  `GameboardScenario`.
- Use coordinate helpers from `./coordinates` and `./grid` for paths, spawns,
  world positions, and Honeycomb-compatible axial math.
- Use `./navigation` and `./occupancy` for board-aware paths, movement ranges,
  footprint occupancy checks, blockers, movement profiles, seeded spawn groups,
  and deterministic patrol routes for NPC/enemy schedules. Saved scenarios may
  embed spawn groups and patrol routes, and actors may reference `spawnGroupId`;
  duplicate group ids and duplicate actor claims on the same `spawnLocationIndex`
  must stay validation errors. Use the `spawn-groups` and `patrol-routes` CLI
  commands for build/editor preflight of those authored rules, then
  `patrol-script` when a planned route should become executable simulation
  command steps.
  Keep raw `findHexPath` for pure coordinate math only.
- Use `./movement` for Koota movement agents, reusable profiles, budget resets,
  path requests, and frame-loop stepping. Do not make gameplay tests move units
  by directly editing `PlacementState` when movement behavior is under test.
- Use `./patrol` when a planned patrol route should become live Koota state.
  `setGameboardPatrolAgent` attaches a route to an actor/placement, and
  `runGameboardSystems` advances patrols before movement so schedules exercise
  the same path requests and blockers as player movement.
- Use `./actors` when placements need gameplay semantics such as player, NPC,
  enemy, prop, hostile, interactive, or blocking behavior. Actor-aware collision
  should drive gameplay tests instead of private fixture-only actor maps. Actor
  spawns use the same runtime placement path as raw placements, including
  `positionOffset` and `occupancyGuard`, and `moveGameboardActor`/actor actions
  move by actor id while preserving those placement options, so do not bypass
  them when spawning or moving player/NPC/enemy entities. Use
  `inspectGameboardInteractionTarget` to classify renderer hits or tile clicks
  as move, interact, attack, or inspect, then
  `planGameboardInteractionCommand` to produce a stable non-executing command
  payload before routing into movement or quests. Use `inspectGameboardTile` or
  `runtime.inspectTile` when UI, AI, or external ECS code needs a compact live
  tile summary. Use `inspectGameboardNeighborhood` or
  `runtime.inspectNeighborhood` for local sensing, aggro, hover overlays, and
  nearby actor/prop buckets; do not duplicate ad hoc filters over placements,
  actors, and occupancy records in examples or tests. Use
  `selectGameboardActors`, `gameboardActorActions(world).select`, or
  `runtime.selectActors` when code needs actor-centric results such as stable
  actor ids, placement ids, tile buckets, source-relative radius checks,
  hostility filters, teams/factions, and tags. Use `selection.records` or
  `recordsByTileKey` when handing the result to UI stores, save logs, workers,
  or non-Koota ECS adapters. Use `inspectGameboardActorTargets`, actor action
  `targets`, `runtime.inspectActorTargets`, or `useGameboardActorTargets` when
  the caller also needs actor-aware path cost, reachable buckets, and target or
  adjacent approach tiles. Keep that helper read-only; use
  `planGameboardActorTargetCommand`, `gameboardCommandActions(world).targetCommand`,
  `runtime.planActorTargetCommand`, or `useGameboardActorTargetCommand` when UI
  or AI code needs the selected target plus a stable command payload to enqueue
  elsewhere. Use `dispatchGameboardActorTargetCommand`,
  `runGameboardActorTargetInteraction`, `gameboardSystemActions(world)`, or the
  runtime dispatch/interact actor-target facades when that chosen target should
  enter the neutral event-record pipeline. Combat, dialog, aggro state, and
  inventory policy stay in host-game systems or explicit command handlers.
- Use `./commands` at renderer/input boundaries when a click should be previewed
  or executed through public APIs. It should request actor-aware movement for
  executable `move` commands and return `requires-game-handler` for interact,
  attack, and inspect commands so game code owns dialog, combat, loot, and quest
  side effects. When a test or example needs common RPG behavior, pass explicit
  handlers such as `createRemoveTargetActorHandler`,
  `createRemoveTargetPlacementHandler`, or
  `createMarkTargetActorInteractedHandler`, or a named preset from
  `createGameboardInteractionHandlerPreset`; do not make those effects
  implicit. Simulation JSON must use the same preset names exported by
  `./commands`.
- Use `./systems` when examples or integrations need a game-loop boundary. It
  should emit neutral event records for command dispatch, patrol requests,
  movement stepping, and quest advancement without owning host-game combat,
  dialog, or inventory. Use result `eventRecords` before crossing out of Koota
  into logs, workers, or external ECS stores; use snapshot helpers only when an
  integration already has in-process event objects.
- Use `./runtime` when a game or integration needs one bound public surface for
  a board. It should compose the same lower-level Koota action bundles, actor
  helpers, direct placement/actor/quest mutation and read helpers, live
  navigation/spawn/patrol-route previews, declared piece/layout placement
  helpers, command helpers, system ticks, projection, snapshots, live interop
  records/mounting, recipe startup, and scenario startup rather than adding
  parallel orchestration state.
- Use `./quests` when gameplay progression is under test. Prefer serializable
  quest objectives for reach, interaction, collision, and defeat checks instead
  of ad hoc fixture-only objective arrays.
- Use `./scenario` when a saved example or integration test needs to instantiate
  a board recipe, named actor spawn groups, patrol routes, actors, movement
  agents, patrol agents, and quests together into a ready Koota world. Prefer
  `createGameboardRuntimeFromScenario` when the consumer needs the bound runtime
  facade, actor/quest indexes, planned spawn groups/patrol routes, and scenario
  piece registry/source URL helpers.
- Use `./simulation` when saved scenarios need to be exercised as a headless
  game flow. Scripts should dispatch public commands, run systems, apply explicit
  read-only actor target scans with `inspect-actor-targets`, use
  `actor-target-command` when a script should choose an actor through the public
  targeting planner before dispatching the planned attack/interact/inspect command, apply explicit
  handler mutations such as `spawn-placement`, `update-placement`,
  `spawn-actor`, `update-actor`, `remove-actor`, and `remove-placement`, and
  use named command handler presets such as `remove-target-actor`,
  `remove-target-placement`, `mark-target-interacted`, or `default-rpg` when
  authored JSON should exercise common combat/interaction effects. Use
  `defaultCommandHandlerOptions` or step `handlerOptions` when JSON needs custom
  handler ids, hostile checks, command-kind filters, or interaction metadata
  fields. Consume serializable reports with top-level command/actor-target/patrol/movement
  timelines rather than peeking into Koota entities. `spawn-actor` may use direct `at`
  coordinates or scenario-owned `spawnGroupId`; keep spawn-group claim
  validation shared with `./scenario`. Use
  `createGameboardPatrolSimulationScript` for NPC/enemy route-following scripts
  instead of hand-authoring per-waypoint move commands. Keep `pnpm expectations`
  focused on quest status, actor positions/existence/metadata/tags, final
  placements, required event types, and command/actor-target/patrol/movement/
  mutation records so CI can fail on behavior drift. Run
  `validateGameboardScenarioSimulationScript` or the `simulate-scenario` CLI
  preflight before executing authored JSON so broken actor, placement, tile,
  event, quest, or objective references fail clearly. `simulate-scenario`
  prints actor-target record counts and nearest target details in its text summary
  even when report, final-plan, or interop JSON artifacts are written; use
  `--json` for machine-only stdout.
- Use `./layout` for seeded placement criteria, archetypes, scatter mechanics,
  footprint reservations, percentage fills, and multi-slot prop placement. Use
  `layoutDensity` on seeded generation for common tree, rock, prop, harbor,
  landmark, and unit fill presets. Criteria can hard-filter terrain, elevation
  bands, terrain adjacency, adjacent placement kind/layer, occupancy, distance,
  and footprints. Use `createGameboardLayoutArchetypeRegistry` when a local pack
  needs reusable custom placement behavior, and pass the registry through layout
  fills, piece fills, seeded generation, or recipe `generation.layoutArchetypes`
  instead of restating the same criteria on every placement. Prefer these APIs
  over hand-picked coordinates when tests or examples need to prove general
  placement behavior. Use
  `inspectGameboardLayoutSites` when placement tuning needs per-tile
  accept/reject diagnostics, and `analyzeGameboardLayoutFill` before mutating a
  board when generated rules may exceed available sites or when custom pieces
  are being tuned. Use `appendGameboardLayoutPlacementsToPlan` when a build step
  needs to persist generated placement options back into a serializable
  `GameboardPlan`. Preserve `occupancyGuard` on layout spawn options when
  generated placements are committed into a live Koota world, because the world
  may have changed since the source plan was inspected. Multi-slot
  scatter/tree placement should preserve `positionOffset` and
  `layoutPositionOffsetX/Y/Z` metadata so renderers can separate same-hex props;
  keep related generated scatter in a shared `slotGroup` when later fill rules
  should reserve earlier same-tile visual slots.
- Use `./blueprint` when the goal is a complete 2.5D board rather than a
  single placement or low-level seeded scatter pass. It compiles biome fill
  percentages, stacked multi-tile mountain ranges, towns, road networks,
  rivers, harbors/ports, generated prop-cluster dressing, elevation ramps,
  sloped roads, bridges, and density fills into ordinary recipe JSON. Use
  `propClusterDressing` when the board-level spec should auto-place or
  explicitly place camps, resource caches, worksites, training yards, stable
  yards, and harbor support clusters around authored towns and harbors. Prefer
  `createMedievalGameboardBlueprintRecipe` when the result should be saved or
  inspected, `createMedievalGameboardBlueprintPlan` when a game needs the plan
  directly, `createMedievalGameboardBlueprintScenario` when the generated board
  should also carry spawn groups, actors, patrol routes, movement agents, and
  quests, `createMedievalGameboardWorldFromBlueprint` when a game/test needs the
  ready Koota runtime, and `inspectMedievalGameboardBlueprintScenario` when an
  agent/editor needs both board counts and scenario route diagnostics before
  rendering. The `blueprint` CLI can also write `--outInterop` from the same
  blueprint scenario so external ECS examples do not need a second
  `snapshot --scenario` pass. Keep new board-scale README examples and
  screenshots anchored to the blueprint API unless the task is specifically
  about low-level builder behavior.
- Use `GameboardBuilder.addBridge` or recipe `addBridge` for authored road,
  river, or water crossings that need a specific FREE KayKit bridge variant.
  Do not make callers place `building_bridge_A` or `building_bridge_B` as raw
  neutral structures when bridge semantics matter to docs, metadata, or tests.
- Use `GameboardBuilder.addElevationRamp` or recipe `addElevationRamp` for
  authored vertical transitions that need the FREE sloped grass tiles. Do not
  make callers place `hex_grass_sloped_high` or `hex_grass_sloped_low` directly
  when ramp direction, facing, source/target elevation, or guide coverage should
  be visible to tests, docs, runtime metadata, or external ECS adapters.
- Use `GameboardBuilder.addFortification`, `addConstructionSite`, and
  `addSiegeProjectile` or their recipe actions for authored walls, fences,
  gates, construction stages, ruins, scaffolding, grain/dirt piles, and catapult
  projectiles. Keep `addNeutralStructure` available as an escape hatch, but do
  not use it for guide-described neutral pieces when a semantic helper exists.
- Use `GameboardBuilder.addPropCluster` or recipe `addPropCluster` for authored
  and generated camps, resource caches, worksites, training yards, stable yards,
  and harbor support dressing. Prefer it over raw `addProp` when the placement
  needs density, single-hex stacking, adjacent spread, local EXTRA opt-in, or
  queryable cluster metadata.
- Use `./pieces` for reusable non-tile asset declarations. Custom buildings,
  trees, loose props, units, harbors, landmarks, and scatter assets should carry
  role, footprint, scale, source, criteria, and metadata there before being
  converted into layout fill rules or placement options. Use
  `inspectGameboardPiecePlacement` and
  `createGameboardLayoutPlacementsFromPiece` when a game/editor needs to test or
  instantiate one declared piece without hand-merging archetype criteria.
  Pieces may reference custom archetype ids; keep those registries on the
  recipe, seeded-generation options, or caller-provided layout options so saved
  content remains declarative.
  Preserve `occupancyGuard` when declared pieces become live placement rules or
  options. Docks,
  harbors, shipyards, and ports infer to the `harbor` role. Use registry
  selectors when a seeded board should consume a whole declared pack by role,
  source, tags, or local-only state. Use the batch compatibility helpers or CLI
  `pieces-from-assets` when a whole local GLB/GLTF folder needs checked piece
  declarations. Use per-asset overrides for footprint reservations, scatter
  slots, unit criteria, and authored metadata instead of hard-coding those rules
  inside visual tests. Keep emitted source paths relative unless diagnosing a
  local machine path issue, and use `pieces --emitSourceUrls` to create
  renderer-facing URL maps from checked registries. Use the `place-piece` CLI
  when a build/editor pipeline needs to preview one declared piece against a
  plan, recipe, or scenario and optionally write a placed plan. Use
  `inspectSeededGameboardPieceFills` or the `pieces --plan/--recipe/--scenario`
  CLI path when a whole selected registry subset needs concrete rule, placement,
  and rejection diagnostics before mutating a board. Prefer `pieceRegistry` plus
  `pieceFills` on seeded generation when those declarations should participate
  in deterministic random boards. Prefer `./runtime` registry helpers when the
  consumer already has a live board object; `analyzePieceRegistry`,
  `selectPieces`, `createPieceFillRules`, `createPiecePoolFillRule`,
  `inspectPieceFills`, and `spawnPieceFills` keep those workflows on the same
  facade as actor, command, tick, projection, and snapshot code. Use
  `createPieceSourceUrlMap` on that facade when the renderer needs URLs for
  checked registry entries with local-only source roots.
- Use `./compatibility` for third-party pack fit checks and placement metadata.
  External binaries from `references/kenney_castle-kit` or
  `references/KayKit_Adventurers_2.0_FREE` must stay local-only and be loaded
  only by `vitest.browser.local-assets.config.ts`.
- Use `createGameboardPlacementAssetUrlResolver` from `./three` when browser
  renderers need one resolver for packaged FREE/EXTRA manifests, local
  `metadata.sourceUrl`, and `createGameboardPieceSourceUrlMap` output. Keep
  renderer tests on this resolver instead of rebuilding asset URL maps by hand.
  Use `loadGameboardPlacementObject` when rigged external units need their model
  transform plus optional external animation clips attached through a Three.js
  `AnimationMixer`. Use `syncGameboardPlacementObjects` in render loops to keep
  scene children, placement transforms, stale-object removal, and animation mixer
  ticks aligned with the latest Koota projection. Use
  `findGameboardPlacementObjectUserData` or
  `findLoadedGameboardPlacementObjectForObject` to turn raycast mesh hits back
  into placement IDs and actor metadata.
- Add new guide features as typed catalog/builders first, then expose them through
  Koota projections, React hooks, and visual tests.
- Treat `tests/simple-rpg/` as the integration fixture for using the library as a
  small game. Keep the quest-line helper runtime-first with
  `createGameboardRuntime` so gameplay flows exercise the public facade for
  command dispatch, movement ticks, quest advancement, actor-target interaction,
  enemy removal, projection, and runtime reads. Extend it when adding
  gameplay-facing APIs so fixed, seeded, and packaged scenes keep exercising
  public imports, command timelines, movement, enemy removal, NPC interaction,
  custom-piece generation, collisions, actor classification, and browser
  screenshots. The fixed scene should keep every gameplay-facing guide builder
  API represented on the board, including bridges, ramps, settlements,
  fortifications, construction, siege, transitions, EXTRA unit parts, prop
  clusters, scatter, coast/water, roads, rivers, hills, forests, and stacked
  mountains.
- Keep `packages/medieval-hexagon-gameboard/examples/simple-rpg-usage.ts` as the
  repo source for the compiled public package subpath exported as
  `@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-usage`. It should remain
  the human-facing example for scenario instantiation, board-aware spawn
  selection, ECS interop snapshots, simulation playback, and serializable
  smoke-test summaries. It also owns `summarizeSimpleRpgGuidePublicApiExercises()`,
  which joins `listKayKitGuidePublicApiCoverages()` to SimpleRPG exercise
  evidence. Update that evidence map whenever a new guide-facing public API is
  added. Keep `runSimpleRpgExecutableGuideApiSmoke()` in the same file aligned
  with the evidence map for low-level helper APIs such as selectors, manifests,
  registries, layout pieces, recipes, blueprints, seeded generation, spawn
  selection, and external compatibility; package smoke tests import that helper
  from `node_modules`.
- Keep `packages/medieval-hexagon-gameboard/examples/blueprint-board-usage.ts`
  as the repo source for the compiled public package subpath exported as
  `@jbcom/medieval-hexagon-gameboard/examples/blueprint-board-usage`. It should
  remain the human-facing example for board-scale blueprint JSON, generated
  scenarios, spawn groups, patrol routes, runtime facade snapshots, and neutral
  ECS interop summaries.
- Keep packaged JSON scenarios and recipes exposed through
  `@jbcom/medieval-hexagon-gameboard/examples/*.json`; do not restore a broad
  `./examples/*` export or package raw TypeScript example source. The tarball
  should carry compiled `dist/examples/*` JS/DTS and `examples/*.json` data only.
- Treat `tests/e2e/local-assets/` as the isolated third-party asset harness. It
  may consume ignored `references/` assets through Vite `@fs`, but package code,
  manifests, and npm files must not copy or publish those binaries.

## Public API Surfaces

- `.` main package: manifests, catalog, builders, Koota runtime, rules, selectors,
  and grid helpers.
- `./catalog`: typed asset-family constants, id builders, public treatment
  metadata for every FREE/EXTRA asset id, 19 extracted guide-page scenarios,
  scenario treatment joins, per-scenario coverage reports, and stable guide
  coverage summaries, including inverse public API coverage reports.
- `./coordinates`: axial keys, neighbors, ranges, lines, pathfinding, and spawn
  coordinate selection.
- `./compatibility`: external GLB/GLTF fit checks, KayKit hex-footprint warnings,
  prop/unit placement recommendations, `recommendExternalAssetFacing`, facing
  metadata, and spawn option helpers.
- `./actors`: Koota actor traits, actor action bundles, actor selection and
  path-aware targeting queries, collision reports, actor classification,
  interaction command planning, and actor-aware navigation profile helpers.
- `./blueprint`: board-scale 2.5D intent compiler for biome percentages,
  mountain ranges, towns, roads, rivers, harbors, elevation ramps, sloped roads,
  bridges, semantic prop-cluster dressing, density fills, showcase recipes, and
  playable scenario/world helpers that attach spawn groups, actors, patrols,
  movement agents, and quests to the generated board recipe. The packaged
  `examples/blueprint-board.json` should stay playable and interop-ready, not
  just a static terrain recipe.
- `./commands`: command action bundles plus preview/execution helpers that turn
  interaction targets into actor-aware movement requests or handler-required
  interact/attack/inspect commands, actor-target command planners for UI/AI
  queues, and explicit opt-in handler helpers for common RPG effects.
- `./coverage`: release-readiness reports that join guide pages, public API
  treatment, manifest coverage, screenshots, local references, package gate
  status, and optional SimpleRPG public API evidence. Use the `coverage` CLI
  command or `doctor --coverage` before release closeout so README/docs claims,
  screenshots, SimpleRPG evidence modes, and package checks share one
  machine-readable ledger.
- `./systems`: game-loop action bundles and neutral event records for command
  dispatch, actor-target dispatch, patrol route advancement, movement ticks,
  quest advancement, and serializable event snapshots.
- `./runtime`: high-level bound facade around Koota world actions, actor/quest
  helpers, actor selection/targeting, actor-target command planning/dispatch,
  live occupancy/navigation, spawn group and patrol route previews, declared
  pieces, registry selection/fills/source URL maps, layout inspection, layout
  placement/fill previews and spawns,
  command dispatch, system ticks, projection, snapshots, interop records,
  recipe startup, and scenario startup.
- `./quests`: serializable quest definitions, Koota quest entities, objective
  progress, and reach/interaction/collision/defeat evaluators.
- `./scenario`: serializable board recipe plus actor/quest/movement/patrol
  definitions that instantiate into a ready Koota world.
- `./simulation`: scenario scripts and reports for headless command/system/
  mutation playback, serializable event logs,
  actor-target/command/patrol/movement timelines, final placements, actors,
  quests, plans, actor-target command steps, and JSON-declared expectation checks
  plus script preflight validation against scenario actors, placements, tiles, quests, objectives, event names,
  and mutation records.
- `./layout`: seeded site selection, built-in placement archetypes, shared
  scatter slot groups, percentage fill rules, plan append helpers, and Koota
  spawn helpers.
- `./pieces`: typed custom piece declarations, registry selectors, variant-pool
  rules, single/batch conversions from compatibility reports, and conversions
  from external buildings, props, units, scatter assets, and landmarks into
  layout rules.
- `./gameboard`: pure serializable plans and builder helpers.
- `./recipe`: JSON-friendly board intent steps that compile into
  `GameboardPlan`; use `inspectGameboardRecipe`/`validateGameboardRecipe` for
  authored JSON preflight. Recipe generation can carry
  `layoutArchetypes`, `pieceDeclarations`, `pieceFills`, and `layoutFills`;
  keep custom archetype ids resolvable and give custom archetypes a placement
  `kind` when fills or pieces rely on the archetype to infer placement kind.
- `./grid`: Honeycomb grid setup, world/axial conversion, coordinate systems, and
  spawn locations.
- `./projection`: lightweight Koota-world-to-`GameboardPlan` projection helpers
  for renderers and React consumers.
- `./registry`: custom tile declarations, manifest-derived declarations, geometry
  analysis, and declaration application.
- `./manifest/free`: packaged FREE KayKit manifest data for consumers that want
  the catalog without building a bundle.
- `./manifest/schema`: attribution constants plus manifest validation,
  normalization, FREE/EXTRA bundle creation, asset filtering, and URL resolution
  for app-local EXTRA manifests.
- `./assets/free/*`: direct published FREE GLTF, BIN, PNG, and manifest files
  for bundlers or renderers that need package asset URLs.
- `./examples/simple-rpg-usage`: compiled SimpleRPG public-import walkthrough
  used by humans, agents, and packed consumer smoke tests.
- `./examples/blueprint-board-usage`: compiled blueprint-board public-import
  walkthrough for board-scale authoring, runtime, and interop smoke tests.
- `./examples/*.json`: packaged recipe, scenario, and simulation fixtures.
- `./ingest`: Node/build-time source validation, GLTF tree copying, and manifest
  generation helpers for app-local FREE/EXTRA bundles. Keep this out of browser
  runtime imports because it uses Node filesystem APIs.
- `./interop`: neutral ECS-style component snapshots, live runtime snapshots,
  scenario snapshots, simulation report snapshots, generic ECS adapter mounting,
  tile/placement-origin/placement-footprint/spawn/actor/quest/patrol/simulation
  timeline relations, relation indexes/selectors, and the in-memory reference
  adapter for tests. Preserve command kind/status, handler id/status, and effect
  type metadata on command/effect relations so external ECS adapters can react
  without inspecting Koota entities.
- `./validation`: Koota-free plan, stack, adjacency, and declaration validation.
  Pass `assetCatalog` when validating authored JSON so missing FREE/EXTRA
  assets and incorrect `requiresExtra` flags fail before browser rendering.
  Use explicit unknown-asset allowances only for third-party pieces that are
  registered through a separate local pipeline.
- `./rule-types`: shared rule config and violation types without runtime code.
- `./world-rules`: lightweight Koota runtime predicates and validation helpers
  without seeded board generation.
- `./koota`: traits, relations, runtime placement actions, queries, and
  snapshots, plus live occupancy preflight and opt-in mutation guards for
  spawn/move UI.
- `./navigation` / `./occupancy`: board-aware footprint occupancy indexes,
  pathfinding, movement ranges, terrain costs, blockers, and alternate movement
  profiles, plus spawn-group and patrol-route planning for separated
  player/NPC/enemy starts and schedules that must prove passable routes before
  gameplay.
- `./movement`: Koota movement traits, built-in movement profiles, path requests,
  range queries, movement budget resets, and movement stepping systems.
- `./patrol`: Koota patrol traits and systems that turn patrol-route plans into
  scheduled movement requests for NPCs, enemies, guards, or neutral actors.
- `./rules`: seeded rectangle/hexagon generation, density and custom-piece fill
  rule generation, piece-fill inspection, and compatibility re-exports for
  projection and world-rule helpers.
- `./selectors`: guide-defined road, river, coast, mask, rotation, and label
  selectors for exact tile-variant authoring. Use `listGuideTilePermutations`
  when visual tests or editors need the full guide-labeled matrix instead of
  mask-canonicalized selector output.
- `./react`: React bindings backed by `koota/react`.
  Keep browser coverage in `tests/browser/react-bindings.test.ts` when adding
  provider, query, action, actor, quest, patrol, movement, command, system,
  runtime, navigation, occupancy, layout, piece, actor-selection,
  actor-targeting, runtime-snapshot, tile-inspection, neighborhood-inspection,
  or spawn hooks. React occupancy, layout, piece, runtime snapshot,
  actor-selection/targeting, actor tile-read, and tile/neighborhood inspection
  hooks should mirror the plain Koota snapshot, layout/piece analyzers, and
  preflight helpers so UI code can avoid raw relation store access.
  Derived plan/occupancy hooks must react to trait and relation value changes,
  not just query membership, because runtime moves often update existing
  placement entities in place. Prefer runtime-aware React providers when
  examples or apps mount saved plans, recipes, or scenarios so
  `useGameboardRuntime` retains recipe/scenario piece registries and source URL
  helpers.
- `./three`: Three.js transforms, placement asset URL resolvers, placement
  loaders, raycast-to-command target helpers, and scene sync helpers with
  optional animation mixer setup for packaged manifests plus local piece URL
  maps.
- `./types`: shared manifest, asset, coordinate, shape, texture, faction, and
  edge types/constants.

## Verification

Run the relevant narrow command while iterating, then finish with:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm expectations
pnpm test:docs-contract
pnpm test:assets
pnpm test:reference-assets
pnpm test:workspace
pnpm test:workflows
pnpm test:browser:free
pnpm test:browser:extra
pnpm test:e2e:local-assets
pnpm test:visual
pnpm showcases:promote
pnpm showcases:promote -- --check
pnpm docs:build
pnpm test:package
pnpm test:cli
pnpm test:consumer
pnpm coverage:ledger
pnpm pack:dry-run
```

Use `pnpm test:ci` for the serialized non-browser release gate. Keep browser
visual commands separate because EXTRA and local third-party assets are
machine-local inputs. Use `pnpm test:visual` when a change needs the complete
manual screenshot review pass. `pnpm test:reference-assets` must fail if an
asset exists only as a manifest entry without `listKayKitAssetPublicTreatments()`
coverage or without `listKayKitGuideScenarios()` page coverage. FREE guide
screenshots include the extracted source-page matrix, FREE treatments grouped by
guide page via `listKayKitGuideScenarioAssetUsages()`, and selector sheets
labeled by guide label, rotation, water mode, and role; EXTRA screenshots
include category-wide sheets for all 404 local source assets plus mixed/EXTRA
guide-page sheets for all 791 page-level occurrences, not a sampled subset.
Use `pnpm test:assets` when touching generated FREE assets, manifests, asset
taxonomy, NOTICE attribution, or ingest output paths.
Use `pnpm test:reference-assets` when local `references/` source inventory,
EXTRA support, ingest taxonomy, seasonal textures, unit/building/prop/tile
coverage, duplicate source basename handling, or third-party E2E fixture paths
change. It skips local source checks when the gitignored reference folders are
not present; when local reference packs are available, it should audit FREE and
EXTRA sources plus the Kenney Castle Kit and KayKit Adventurers fixture
inventories used by the local browser E2E harness.
Use `pnpm test:workspace` when touching Nx targets, package exports, tsup
entries, pnpm workspace settings, docs package dependency versions, or Markdown
TypeScript examples; it also rejects duplicate object keys in documented
snippets.
Use `pnpm test:cli` after `pnpm build` when CLI commands, packaged examples,
scenario simulation, compatibility scans, or custom piece declarations change;
it executes the built `dist/cli.js` with packaged and synthetic fixture inputs.
Use `pnpm expectations` when simulation reports, SimpleRPG examples, quests,
actors, commands, actor-target records, patrols, movement, mutations, or final
placement assertions change; `pnpm test:ci` runs it before the full unit suite.
Use `pnpm test:consumer` when package exports, built examples, dependency
metadata, CLI bin behavior, or npm tarball layout changes; it installs the
packed tarball into a fresh temporary app, compiles a TypeScript consumer, and
imports from `node_modules`. It must keep proving that mixed root/subpath imports
share live Koota trait identities; the tsup build should keep ESM code splitting
enabled for that reason.
Use `pnpm test:package` when README images or package file lists change; it
validates local README links, requires the published README gallery to reference
every curated package showcase image, validates packed KayKit attribution and
NOTICE text, and checks every packed `docs/showcases/*.png` through the shared
PNG quality analyzer.
Use `pnpm test:workflows` when touching GitHub Actions, Release Please,
automerge, Dependabot, or the CI/CD release scripts.

Run `pnpm build` before local CLI geometry analysis when adding or changing tile
declarations:

```bash
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js analyze --edition free
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js doctor --edition free
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js manifest --edition free --out /tmp/kaykit-manifest.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js validate-manifest --manifest /tmp/kaykit-manifest.json --outManifest /tmp/kaykit-manifest.normalized.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js declarations --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --out /tmp/kaykit-declarations.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-permutations --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --out /tmp/kaykit-guide-permutations.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-scenarios --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --out /tmp/kaykit-guide-scenarios.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-scenarios --page 14 --includeTreatments --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-usages --page 16,17,18 --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-render-requests --page 16,17,18 --assetBaseUrl /assets/extra --includeGroups --out /tmp/kaykit-guide-render-requests.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-assets --assetId hex_road_M --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-roles --role prop --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-apis --publicApi GameboardBuilder.addHarbor --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js blueprint --blueprint packages/medieval-hexagon-gameboard/examples/blueprint-board.json --outRecipe /tmp/blueprint.recipe.json --outPlan /tmp/blueprint.plan.json --outScenario /tmp/blueprint.scenario.json --outScenarioInspection /tmp/blueprint.scenario-inspection.json --outInterop /tmp/blueprint.interop.json --out /tmp/blueprint.inspection.json --allowUnknownAssets
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js summarize-plan --blueprint packages/medieval-hexagon-gameboard/examples/blueprint-board.json --out /tmp/blueprint.summary.json --outPlan /tmp/blueprint.summary.plan.json --allowUnknownAssets
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js summarize-scenario --scenario packages/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json --out /tmp/simple-rpg.scenario-summary.json --allowUnknownAssets
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js validate-recipe --recipe scenario.json --outPlan /tmp/scenario-plan.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js analyze-layout --recipe docs/examples/generated-piece-scenario.recipe.json --rules layout-rules.json --out /tmp/layout-analysis.json --outPlan /tmp/scenario-plan.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js spawn-groups --recipe docs/examples/generated-piece-scenario.recipe.json --groups spawn-groups.json --out /tmp/spawn-groups.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js patrol-routes --scenario packages/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json --out /tmp/package-simple-rpg-patrol-routes.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js patrol-script --routes /tmp/package-simple-rpg-patrol-routes.json --routeId bandit-watch --actorId bandit --out /tmp/package-simple-rpg-patrol.script.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js validate-recipe --recipe docs/examples/generated-piece-scenario.recipe.json --outPlan /tmp/generated-piece-scenario.plan.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js validate-recipe --recipe packages/medieval-hexagon-gameboard/examples/generated-piece-scenario.recipe.json --outPlan /tmp/package-generated-piece-scenario.plan.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js validate-scenario --scenario packages/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --outPlan /tmp/package-simple-rpg-scenario.plan.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js validate-simulation --scenario packages/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json --script packages/medieval-hexagon-gameboard/examples/simple-rpg-simulation.script.json --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js snapshot --scenario packages/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --spawnCount 2 --spawnSeed simple-rpg --out /tmp/package-simple-rpg-interop.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js simulate-scenario --scenario packages/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json --script packages/medieval-hexagon-gameboard/examples/simple-rpg-simulation.script.json --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --out /tmp/package-simple-rpg-simulation.json --outPlan /tmp/package-simple-rpg-final-plan.json --outInterop /tmp/package-simple-rpg-simulation-interop.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js compatibility --asset "references/kenney_castle-kit/Models/GLB format/tower-hexagon-base.glb" --intendedRole tile --sourcePack "Kenney Castle Kit" --failOnWarning
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js piece --asset "references/kenney_castle-kit/Models/GLB format/tower-hexagon-base.glb" --id kenney:tower-hexagon-base --intendedRole tile --sourcePack "Kenney Castle Kit" --tags castle,landmark --out /tmp/kenney-piece.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js pieces-from-assets --assets "references/kenney_castle-kit/Models/GLB format" --sourcePack "Kenney Castle Kit" --intendedRole tile --assetIdPrefix kenney --pieceIdPrefix kenney-castle --tags castle --pieceOverrides docs/examples/local-piece-overrides.kenney-castle.json --includeReports --out /tmp/kenney-pieces.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js pieces --pieces /tmp/kenney-piece.json --emitRules --mode pool --role landmark --count 1 --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js pieces --pieces /tmp/kenney-pieces.json --emitSourceUrls --pieceSourceRoots docs/examples/local-piece-source-roots.example.json --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js pieces --pieces /tmp/kenney-pieces.json --recipe docs/examples/generated-piece-scenario.recipe.json --mode pool --role tree --count 3 --seed preview --out /tmp/piece-fill-inspection.json --outPlan /tmp/piece-fill-plan.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js place-piece --recipe docs/examples/generated-piece-scenario.recipe.json --pieces /tmp/kenney-pieces.json --pieceId kenney-castle:tower-hexagon-base --count 1 --seed preview --idPrefix preview:tower --out /tmp/piece-placement.json --outPlan /tmp/piece-placement-plan.json
```

Browser screenshots are generated under
`packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/` and are
ignored. The browser scripts run `tests/scripts/assert-screenshots.ts` after
capture, so existing artifacts can be rechecked with the package-level
`test:screenshots:free`, `test:screenshots:extra`, and
`test:screenshots:local-assets` scripts. Review screenshots manually when
selectors, manifests, public asset treatments, rules, loaders, or board recipes
change.

Every PNG asserted by those `test:screenshots:*` scripts must also be listed in
`GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS` and appear in the generated
release-readiness ledger. `pnpm test:workspace` compares the package scripts,
coverage source, and `docs/release-readiness.json` so visual evidence cannot
drift silently.

Curated README screenshots must be promoted out of the ignored browser output.
For blueprint board examples, keep matching copies in `docs/assets/showcases/`
for VitePress and `packages/medieval-hexagon-gameboard/docs/showcases/` for the
published package README. After `pnpm test:visual`, run
`pnpm showcases:promote` to refresh those committed copies from
`packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/`; run
`pnpm showcases:promote -- --check` when you only need to verify the committed
copies already match the latest ignored screenshots. The promotion check also
parses the source and committed PNGs through the same quality analyzer as
`test:screenshots:*`, so blank or visually flat README images fail before
release.
