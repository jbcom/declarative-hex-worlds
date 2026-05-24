# Medieval Hexagon Gameboard

Workspace for `@jbcom/medieval-hexagon-gameboard`, a Koota-first TypeScript
runtime for building 2.5D KayKit Medieval Hexagon gameboards.

The workspace and published CLI target Node 22+ and pnpm 9 for local development
and release automation.

The package is not just an asset bundle. It provides:

- FREE KayKit GLTF assets and typed manifests.
- Public asset treatment metadata for every FREE and local EXTRA asset id,
  connecting each file to a gameboard role, source guide image, placement
  kind/layer, and the builder/selector/unit API that intentionally exercises it.
- A decomposed 19-page guide scenario matrix that maps every extracted KayKit
  README page to source imagery, covered assets, public APIs, docs, and visual
  artifacts through `listKayKitGuideScenarios()`, with
  `listKayKitGuideScenarioTreatments()`,
  `listKayKitGuideScenarioAssetUsages()`,
  `describeKayKitGuideScenarioCoverage()`, and
  `summarizeKayKitGuideCoverage()` for tools that need page-to-treatment joins
  or stable coverage counts. The usage API preserves all 1,108 page-level FREE
  and EXTRA asset occurrences with labels, captions, source paths, roles, and
  categories for renderer/contact-sheet tests; `listKayKitGuideScenarioAssetRenderRequests()`
  and `listKayKitGuideScenarioAssetRenderGroups()` turn those rows into
  URL-resolved render queues grouped by guide page. `listKayKitGuideAssetCoverages()`
  starts from any FREE or local EXTRA asset id and returns its guide pages, role,
  public APIs, docs, and screenshots. `listKayKitGuidePublicApiCoverages()`
  provides the inverse index from builder/selector/runtime APIs back to guide
  pages and treated assets, while `listKayKitGuideRoleCoverages()` starts from
  gameplay roles such as props, roads, units, and structures and returns the
  pages, assets, APIs, docs, and screenshots that intentionally exercise them.
- Deterministic seeded rectangle and hexagon board generation with `seedrandom`.
- Koota tile traits, adjacency, origin-tile, and footprint-occupancy relations,
  serializable occupancy snapshots, placement state, rule validators, and
  queries.
- Runtime Koota actions for spawning, moving, updating, and removing board
  placements during gameplay, with occupancy preflight and opt-in mutation
  guards for checking unit/building footprint blockers before mutating live
  state.
- Koota actor traits/actions for players, NPCs, enemies, props, collision
  inspection, actor-aware tile summaries, actor-aware movement rules, and the
  same guarded placement mutation/move options used by raw runtime placements.
- Koota quest definitions and progression for reach, interaction, collision,
  and defeat objectives driven by board actors.
- Layout archetypes, placement criteria, footprint reservations, shared scatter
  slot groups, custom archetype registries, density presets, and percentage
  fill rules for seeded props, trees, harbors, landmarks, units, and custom
  pieces, with fill analysis for candidate counts, clamped count warnings, and
  guard propagation when generated placements are committed into a live Koota
  world.
- Declarative custom piece registration that turns external buildings, props,
  units, and scatter assets into reusable layout rules, single-piece placement
  previews, and runtime placement options.
- A build-time `place-piece` CLI path for testing one declared piece against a
  plan, recipe, or scenario and optionally writing a placed `GameboardPlan`.
- Batch local GLB/GLTF piece declaration from compatibility scans, so a
  third-party folder can become a checked piece registry without bundling the
  source assets.
- Direct seeded generation from declared custom piece registries, including
  per-piece rules, same-role variant pools, and registry-fill inspection before
  mutating a board, plus runtime facade helpers for selecting, inspecting, and
  spawning those registries against live Koota state.
- Runtime facade helpers for layout site inspection, single-placement previews,
  fill analysis, and fill placement previews against the live projected board
  before committing generated props or landmarks into Koota state.
- Runtime facade helpers for live occupancy indexes, pathfinding, spawn
  locations, spawn groups, and patrol route previews after actors or blockers
  have changed Koota state.
- Runtime facade helpers for reading and mutating live placements, registering
  and updating actors, and advancing quests without reaching into raw action
  bundles from game-loop code.
- Plan summary helpers for editor panels, CI diagnostics, visual-test queues,
  and external ECS bridges that need aggregate terrain, texture, elevation,
  placement-kind, feature, asset, and local-only usage counts from either a
  static `GameboardPlan` or live runtime projection.
- Recipe- and scenario-backed runtime startup that preserves generated
  archetype registries, piece registries, and renderer source URL maps for saved
  game content.
- Koota movement agents, reusable movement profiles, path requests, movement
  budgets, and frame-loop movement systems.
- Koota patrol agents that attach authored patrol-route plans to actors and run
  before movement ticks, so scheduled NPC/enemy routes are normal game-loop
  state.
- Neutral tile declarations and ECS interop snapshots for engines that do not
  use Koota internally.
- Generic ECS adapter mounting for callback-based stores and external ECS
  libraries, including adjacency, placement-on-tile, placement-footprint
  occupancy, spawn-on-tile, actor-on-tile, quest actor reference, and quest tile
  target relations, plus relation indexes/selectors for non-Koota stores that
  need to query by relation name, source entity, or target entity before
  mounting.
- Live runtime interop snapshots and mount helpers that include the current
  Koota-projected board, actor state, quest state, actor-placement links, and
  quest target links for mirroring an active game into another ECS.
- Honeycomb-compatible coordinate, pathfinding, shape-grid, and board-aware
  spawn-location helpers.
- Board-aware navigation and footprint occupancy helpers for terrain costs,
  blockers, elevation steps, movement ranges, and alternate unit profiles.
- Seeded spawn-group planning for player/NPC/enemy starts, including inter-group
  separation and route diagnostics through the same board-aware navigation layer.
- Deterministic patrol-route planning for guards, enemies, NPC schedules, and
  encounter loops, including spawn-group starts, selected waypoints, route
  segments, and passability diagnostics.
- Patrol-route simulation script generation that turns planned route segments
  into executable actor movement command steps for SimpleRPG-style integration
  tests or host-game scheduling.
- Board builder helpers for roads, rivers, coasts, elevated terrain stacks,
  elevation ramps, bridges, harbors, faction buildings, fortifications,
  construction sites, siege projectiles, neutral structures, props, prop
  clusters,
  transitions, and unit combinations.
- Serializable board recipes for saved configs, AI-authored maps, and portable
  board intent, including recipe-level custom layout archetypes and generated
  placement blocks for custom pieces.
- Recipe preflight helpers that compile authored JSON, return plan output, and
  surface custom-archetype, compile, and asset validation issues as normal rule
  violations.
- Serializable scenarios that combine board recipes, named spawn groups, patrol
  routes, actors, movement agents, patrol agents, and quests into ready Koota
  worlds, with validation for duplicate IDs, unresolved spawn groups, duplicate
  spawn-location claims, patrol/spawn route failures, missing patrol-agent
  routes, and broken actor/tile references before runtime instantiation.
- Blueprint-to-scenario helpers that turn high-level medieval board intent into
  a playable scenario or ready Koota runtime with the generated board recipe,
  authored spawn groups, patrol routes, actors, movement agents, and quests
  kept together.
- Scenario simulation scripts that run commands, actor-target command planning,
  handler mutations, movement, actor-target inspections,
  runtime spawn/update/removal mutations, and quests headlessly while emitting serializable event logs, top-level command,
  actor-target, patrol, and movement timelines, final placement records, and
  JSON-declared expectations. Simulation `spawn-actor` steps can use scenario
  spawn groups as well as fixed coordinates, and command steps use the same
  named handler presets exported by `./commands` for common RPG effects, with
  serializable handler options and script preflight validation for command,
  actor-target, and movement records, references, actor metadata/tags, event
  names, and quest objectives before execution.
- Scenario interop snapshots for mounting the same board, spawn groups, patrol
  routes, actors, and quest graph into non-Koota ECS/runtime stores.
- Simulation interop snapshots for mounting final actor/quest state plus
  actor-target, command, handled-effect, patrol, movement, and mutation
  timelines into non-Koota ECS/runtime stores.
- Actor interaction target inspection and non-executing command planning for
  routing renderer clicks into move, interact, attack, or inspect workflows.
- Tile inspection summaries for UI, AI, and ECS bridge code that need tile
  state, placements, occupancy, actors, hostile/interactive/prop buckets, and
  source-aware enterability from one public call.
- Neighborhood inspection summaries for hover overlays, local AI sensing,
  aggro checks, and ECS bridge adapters that need filtered tile and actor
  buckets across a hex radius.
- Actor selection queries for UI lists, local AI, quests, and external ECS
  bridges that need actor ids, placement ids, tile buckets, hostility filters,
  tag filters, serializable actor records, and source-relative radius checks
  without duplicating Koota query logic.
- Path-aware actor targeting reports that combine actor selection with
  actor-aware navigation, approach tile choice, interaction command planning,
  reachable/unreachable buckets, chosen-target command plans, and neutral
  dispatch helpers for host AI, command menus, and ECS mirrors.
- Command preview/execution helpers that turn renderer clicks into actor-aware
  movement requests, handler-required interact/attack/inspect commands, or
  explicit opt-in handler effects.
- Runtime system helpers that dispatch commands, advance patrol agents, tick
  movement, advance quests, dispatch chosen actor targets, and emit
  serializable neutral event records for game loops or external ECS mirrors.
- A `./runtime` facade that binds the Koota world, placement actions, actor and
  quest helpers, command and actor-target dispatch, system ticks, projection,
  interop snapshots, declared piece placement, layout fills, and scenario
  instantiation into one game-loop surface.
- React bindings with browser-tested Koota provider/query/action hooks,
  projected navigation, occupancy snapshots/preflight, actor-aware tile
  inspection, layout/piece preview hooks, deterministic spawn hooks, live
  placement/actor/quest/runtime snapshot hooks, and Three.js placement helpers.
- Three.js placement asset URL resolvers that combine packaged manifests,
  placement `sourceUrl` metadata, and local custom-piece URL maps.
- Three.js scene sync helpers that load missing placements, update transforms,
  remove stale objects, tag objects for raycast lookup, and attach optional
  animation clips for rigged units.
- Lightweight projection and world-rule subpaths so renderers can consume live
  Koota worlds without importing seeded generation helpers.
- Local-only EXTRA ingest for purchased assets.
- Node/build-time `./ingest` helpers for apps that want to validate a local pack,
  copy GLTF files, or generate their own FREE/EXTRA manifest without shelling out
  to the CLI.
- FREE/EXTRA manifest bundle helpers for app-local EXTRA catalogs and URL
  resolution, plus runtime manifest inspection for schema, duplicate id, enum,
  bounds, stale count, and stale index issues in app-local ingest output.
- Manifest-backed asset validation for plans, recipes, and scenarios so missing
  assets and incorrect EXTRA flags fail before rendering.
- CLI geometry analysis for tile footprint, scale, row spacing, and warnings.
- Koota-free `GameboardPlan` validation for custom tile declarations and
  non-Koota ECS pipelines.
- Layout criteria for terrain, elevation bands, adjacency to existing placement
  kinds/layers, occupancy, footprints, distance, and deterministic multi-slot
  scatter, with a harbor archetype for coast tiles adjacent to water and
  per-tile inspection diagnostics for rejected generated placements.
- SimpleRPG integration coverage that uses the public API to run fixed and
  deterministic seeded quest maps through movement, collision, custom-piece
  generation, and visual tests.
- Guide permutation visual coverage for every road/coast rotation input plus
  river, curvy river, waterless, and crossing variants through exported selector
  permutation helpers.
- Local-only third-party asset E2E coverage for Kenney Castle Kit and KayKit
  Adventurers through Vite `@fs`, proving external compatibility without
  bundling those assets.
- Browser screenshot artifact checks that parse saved PNGs after capture and
  fail on undersized, low-variance, or visually flat output.

## Documentation

The docs site is split between durable source-of-truth pillars and task-oriented
usage guides:

- `docs/pillars/` records the implementation contract, source guide imagery,
  package editions, asset taxonomy, Koota runtime model, and visual coverage.
- [`docs/guides/public-api.md`](docs/guides/public-api.md) explains the public subpaths and when to use a
  neutral plan, live Koota runtime, manifest bundle, or external ECS bridge.
- [`docs/guides/guide-scenario-coverage.md`](docs/guides/guide-scenario-coverage.md) maps all 19 extracted guide pages to
  roles, asset counts, public API surfaces, docs, and visual artifacts.
- [`docs/guides/release-readiness.md`](docs/guides/release-readiness.md) is the generated release ledger that joins
  guide coverage, manifests, public API treatment, visual artifacts, local
  references, and package gate evidence.
- [`docs/guides/runtime-integration.md`](docs/guides/runtime-integration.md) covers runtime ownership, mutations,
  React hook families, external ECS snapshots, and integration-test patterns.
- [`docs/guides/recipes-scenarios-and-simulation.md`](docs/guides/recipes-scenarios-and-simulation.md) covers recipes, scenarios,
  generated fills, SimpleRPG-style integration fixtures, and simulation scripts.
- [`docs/guides/rendering-assets-and-external-packs.md`](docs/guides/rendering-assets-and-external-packs.md) covers packaged FREE
  assets, local EXTRA ingest, Three.js sync, external compatibility checks, and
  local-only asset-pack rendering tests.

TypeDoc API output is generated during `pnpm docs` / `pnpm docs:build`; the
generated `docs/api/` tree is not committed. Public exports are expected to have
useful JSDoc, and every TypeDoc entry point must carry top-level `@module`
JSDoc so the generated module pages explain each public subpath. Before claiming
the API docs are complete, run the strict audit:

```bash
pnpm test:api-docs
```

## Development

```bash
pnpm install
pnpm assets:guide
pnpm assets:free
pnpm lint
pnpm typecheck
pnpm build
pnpm docs
pnpm docs:build
pnpm test
pnpm test:api-docs
pnpm test:docs-contract
pnpm test:assets
pnpm test:reference-assets
pnpm test:workspace
pnpm test:workflows
pnpm test:browser:free
pnpm test:browser:extra
pnpm test:e2e:local-assets
pnpm test:visual
pnpm test:package
pnpm test:cli
pnpm test:consumer
pnpm pack:dry-run
```

For the serialized non-browser release gate, run `pnpm test:ci`.
`pnpm assets:guide` renders the FREE guide PDF into
`docs/assets/kaykit-guide/pages/` and `docs/assets/kaykit-guide/montage.png`
through the TypeScript entrypoint `scripts/extract-kaykit-guide.ts`. On macOS it
uses the existing Swift/PDFKit renderer for deterministic output when `swift` is
available; elsewhere it expects `pdftoppm` and ImageMagick's `magick` on `PATH`.
`pnpm test:cli` runs the built `dist/cli.js` against the packaged FREE manifest,
packaged examples, the SimpleRPG scenario/simulation, and synthetic external
GLTF fixtures for compatibility and custom-piece declarations.
`pnpm test:assets` audits the packaged FREE asset tree against its manifest,
including GLTF/BIN/PNG coverage, bounds, counts, local-path exclusion, and
NOTICE attribution.
`pnpm test:reference-assets` also checks the exact FREE/EXTRA source inventory
when the gitignored `references/` folders are available locally, including
EXTRA-only categories, seasonal texture sets, and duplicate basename handling.
When the Kenney Castle Kit and KayKit Adventurers reference folders are present,
the same audit verifies the third-party fixture inventories used by local E2E:
Kenney GLB count and documented override keys, Adventurers character GLBs,
Rig_Medium animation GLBs, prop GLTF count, and the exact knight/movement assets
used for actor-facing coverage.
That audit also fails if a source asset is merely present but lacks a public
asset treatment via `listKayKitAssetPublicTreatments()` or guide-page coverage
via `listKayKitGuideScenarios()` and
`listKayKitGuideScenarioAssetUsages()`.
`pnpm test:consumer` packs the npm tarball into a temporary app, installs it
through npm, compiles public subpath imports with TypeScript, runs the shipped
SimpleRPG usage example from `node_modules`, and invokes the installed CLI bin.
`pnpm test:workspace` audits Nx targets, pnpm workspace config, VitePress docs
dependency alignment, and tsup entries against the package export map.
`pnpm test:workflows` audits the CI/CD, Release Please, automerge, and Dependabot
contracts requested for this package.
For local visual review, run `pnpm test:visual`; it serializes the FREE browser
suite, local EXTRA suite, and local third-party asset E2E suite.

The browser commands run both in-browser render assertions and post-capture PNG
artifact checks. FREE guide coverage includes all 19 extracted source pages,
FREE treatment usages grouped by guide page through
`listKayKitGuideScenarioAssetUsages({ minimumEdition: 'free' })`, and labeled
sheets for roads, rivers, curvy/crossing rivers, coasts, and non-connectivity
guide treatments instead of one ambiguous repeated-looking montage. EXTRA local
coverage renders all 404 source assets by category and the 791 mixed/EXTRA
guide-page asset occurrences from the decomposed README pages. To re-check
existing screenshots without relaunching Chromium, run
`pnpm test:screenshots:free`, `pnpm test:screenshots:extra`, or
`pnpm test:screenshots:local-assets`.

See `docs/examples/generated-piece-scenario.recipe.json` and
`packages/medieval-hexagon-gameboard/examples/generated-piece-scenario.recipe.json`
for a complete JSON recipe that combines authored steps with generated
custom-piece placement.
See `packages/medieval-hexagon-gameboard/examples/simple-rpg-usage.ts` and
`packages/medieval-hexagon-gameboard/examples/blueprint-board-usage.ts` in this
repo and the compiled
`@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-usage` and
`@jbcom/medieval-hexagon-gameboard/examples/blueprint-board-usage` package
exports for typed public-import walkthroughs. The SimpleRPG example instantiates
the packaged scenario, resolves embedded actor spawn groups, selects additional
spawn locations, emits an ECS interop snapshot, and runs the scripted quest
flow. The blueprint example compiles `examples/blueprint-board.json` into a
scenario, resolves spawn groups and patrols, creates a runtime facade, and emits
an ECS interop summary.
Packaged JSON examples are exposed as `@jbcom/medieval-hexagon-gameboard/examples/*.json`
so consumers can import scenarios and recipes. The npm package ships compiled
example JS/DTS and JSON example data, not raw TypeScript example source.

Useful package CLI checks after `pnpm build`. The workspace shortcut is
`pnpm cli <command>`; the release-readiness ledger has the dedicated
`pnpm coverage:ledger` shortcut so contributors do not need to remember the
built `dist/cli.js` path.

```bash
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js doctor --edition free
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js manifest --edition free --out /tmp/kaykit-manifest.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js validate-manifest --manifest /tmp/kaykit-manifest.json --outManifest /tmp/kaykit-manifest.normalized.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js analyze --edition free
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js declarations --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --out /tmp/kaykit-declarations.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-permutations --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --out /tmp/kaykit-guide-permutations.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-scenarios --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --out /tmp/kaykit-guide-scenarios.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-scenarios --markdown > docs/guides/guide-scenario-coverage.md
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-scenarios --page 14 --includeTreatments --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-usages --page 16,17,18 --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-render-requests --page 16,17,18 --assetBaseUrl /assets/extra --includeGroups --out /tmp/kaykit-guide-render-requests.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-assets --assetId hex_road_M --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-roles --role prop --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-apis --publicApi GameboardBuilder.addHarbor --json
pnpm coverage:ledger
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js analyze --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js blueprint --blueprint packages/medieval-hexagon-gameboard/examples/blueprint-board.json --outRecipe /tmp/blueprint.recipe.json --outPlan /tmp/blueprint.plan.json --outScenario /tmp/blueprint.scenario.json --outScenarioInspection /tmp/blueprint.scenario-inspection.json --outInterop /tmp/blueprint.interop.json --out /tmp/blueprint.inspection.json --allowUnknownAssets
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js summarize-plan --blueprint packages/medieval-hexagon-gameboard/examples/blueprint-board.json --out /tmp/blueprint.summary.json --outPlan /tmp/blueprint.summary.plan.json --allowUnknownAssets
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js summarize-scenario --scenario packages/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json --out /tmp/simple-rpg.scenario-summary.json --allowUnknownAssets
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js validate-recipe --recipe scenario.json --outPlan /tmp/scenario-plan.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js analyze-layout --recipe docs/examples/generated-piece-scenario.recipe.json --rules layout-rules.json --out /tmp/layout-analysis.json --outPlan /tmp/scenario-plan.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js spawn-groups --recipe docs/examples/generated-piece-scenario.recipe.json --groups spawn-groups.json --out /tmp/spawn-groups.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js patrol-routes --scenario packages/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json --out /tmp/patrol-routes.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js patrol-script --routes /tmp/patrol-routes.json --routeId bandit-watch --actorId bandit --out /tmp/patrol.script.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js validate-scenario --scenario packages/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --outPlan /tmp/simple-rpg-plan.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js validate-simulation --scenario packages/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json --script packages/medieval-hexagon-gameboard/examples/simple-rpg-simulation.script.json --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js snapshot --scenario packages/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --spawnCount 2 --spawnSeed simple-rpg --out /tmp/simple-rpg-interop.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js simulate-scenario --scenario packages/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json --script packages/medieval-hexagon-gameboard/examples/simple-rpg-simulation.script.json --manifest packages/medieval-hexagon-gameboard/assets/free/manifest.json --out /tmp/simple-rpg-simulation.json --outPlan /tmp/simple-rpg-final-plan.json --outInterop /tmp/simple-rpg-simulation-interop.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js compatibility --asset "references/kenney_castle-kit/Models/GLB format/tower-hexagon-base.glb" --intendedRole tile --sourcePack "Kenney Castle Kit" --modelForward +z --boardForwardEdge 1
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js piece --asset "references/kenney_castle-kit/Models/GLB format/tower-hexagon-base.glb" --id kenney:tower-hexagon-base --intendedRole tile --sourcePack "Kenney Castle Kit" --tags castle,landmark --out /tmp/kenney-piece.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js pieces-from-assets --assets "references/kenney_castle-kit/Models/GLB format" --sourcePack "Kenney Castle Kit" --intendedRole tile --assetIdPrefix kenney --pieceIdPrefix kenney-castle --tags castle --pieceOverrides docs/examples/local-piece-overrides.kenney-castle.json --includeReports --out /tmp/kenney-pieces.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js pieces --pieces /tmp/kenney-piece.json --emitRules --mode pool --role landmark --count 1 --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js pieces --pieces /tmp/kenney-pieces.json --emitSourceUrls --pieceSourceRoots docs/examples/local-piece-source-roots.example.json --json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js pieces --pieces /tmp/kenney-pieces.json --recipe docs/examples/generated-piece-scenario.recipe.json --mode pool --role tree --count 3 --seed preview --out /tmp/piece-fill-inspection.json --outPlan /tmp/piece-fill-plan.json
pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js place-piece --recipe docs/examples/generated-piece-scenario.recipe.json --pieces /tmp/kenney-pieces.json --pieceId kenney-castle:tower-hexagon-base --count 1 --seed preview --idPrefix preview:tower --out /tmp/piece-placement.json --outPlan /tmp/piece-placement-plan.json
```

`simulate-scenario` prints the simulation summary even when `--out`,
`--outPlan`, or `--outInterop` are provided, including actor-target record counts
and nearest target details. Use `--json` when stdout must be machine-readable.

The canonical implementation notes live in `docs/pillars/`. The package README
is at `packages/medieval-hexagon-gameboard/README.md`.
