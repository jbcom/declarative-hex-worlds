/**
 * `declarative-hex-worlds` CLI help text.
 *
 * Split into its own module so that `--help` / `-h` / unknown-command paths in
 * the dispatcher can dynamic-import this file without pulling in the heavy
 * helper graph (`_shared.ts`, the freeManifest, the blueprint engine, the
 * simulation surface). Critical for PRD E5 cold-start budget — `--help`
 * resolves only this module.
 *
 * @module
 */
export function usage(exitCode: number): never {
  console.log(`declarative-hex-worlds <command> [options]

Commands:
  doctor     Report local source and docs status
  validate   Validate local FREE or EXTRA source counts
  manifest   Generate a manifest JSON from a source folder
  validate-manifest Validate a generated manifest JSON and optionally write a normalized copy
  analyze    Analyze tile bounds, grid scale, row spacing, and warnings
  declarations  Emit tile declarations from a source folder, manifest, or registry
  guide-permutations Emit guide-labeled road, river, crossing, and coast permutation metadata
  guide-scenarios Emit extracted guide-page scenario metadata and validate page assets
  guide-usages Emit renderer-ready page-level guide asset occurrence metadata
  guide-render-requests Emit URL-resolved guide render request queues and optional page groups
  guide-assets Emit asset id to guide-page, API, docs, and visual coverage metadata
  guide-roles Emit public role to guide-page, asset, and API coverage metadata
  guide-apis Emit public API to guide-page and asset coverage metadata
  coverage  Emit release-readiness coverage JSON or Markdown
  blueprint Compile high-level 2.5D board intent to a recipe, plan, scenario, and diagnostics
  summarize-plan Summarize terrain, placement, feature, asset, and local-only usage in a plan, recipe, scenario, or blueprint
  summarize-scenario Summarize board, actor, spawn, patrol, quest, and local-only usage in a scenario
  pieces    Validate piece declarations and optionally emit seeded piece fill rules
  place-piece Inspect and append one declared piece against a saved GameboardPlan, recipe, or scenario
  validate-plan Validate a GameboardPlan JSON with optional registry rules
  analyze-layout Analyze seeded layout fill rules against a saved GameboardPlan, recipe, or scenario
  spawn-groups Plan separated spawn groups and route diagnostics against a plan, recipe, or scenario
  patrol-routes Plan NPC/enemy patrol waypoints and segment diagnostics against a plan, recipe, or scenario
  patrol-script Create executable simulation command steps from planned patrol routes and actor assignments
  validate-recipe Validate a GameboardRecipe JSON and optionally compile it to a plan
  validate-scenario Validate a GameboardScenario JSON and optionally compile its plan
  validate-simulation Validate a GameboardScenario simulation script without executing it
  snapshot   Emit a neutral ECS interop snapshot from a plan, recipe, or scenario
  simulate-scenario Run a GameboardScenario simulation script and emit event records, final plan, or ECS interop
  compatibility Analyze one external GLB/GLTF for hex-tile compatibility and placement suggestions
  piece      Emit a custom piece declaration from an external GLB/GLTF compatibility scan
  pieces-from-assets Scan GLB/GLTF files and emit custom piece declarations plus compatibility summaries
  extract    Copy GLTF assets and write a manifest to an output folder
  bootstrap  Materialize KayKit GLTF assets under a consumer asset root (PRD RB)

Options:
  --edition free|extra
  --source <path>
  --manifest <path>
  --registry <path>
  --pieces <path>
  --plan <path>
  --rules <path>
  --groups <path>
  --recipe <path>
  --scenario <path>
  --script <path>
  --blueprint <path>
  --config <path>
  --outScenario <path>
  --outScenarioInspection <path>
  --includeScenario
  --includeScenarioInspection
  --assignments <path>
  --routeId <id>
  --actorId <id>
  --rounds <number>
  --shape rectangle|hexagon
  --width <number>
  --height <number>
  --radius <number>
  --scenarioId <comma,separated,guide-scenario-ids>
  --page <comma,separated,guide-pages>
  --editionScope free|extra|mixed|reference
  --publicApi <comma,separated,api-names>
  --guideRole <comma,separated,asset-treatment-roles>
  --includeTreatments
  --asset <path>
  --assets <comma,separated,paths>
  --intendedRole tile|prop|structure|unit
  --modelForward +z|-z|+x|-x
  --boardForwardEdge 0..5
  --role surface|building|unit|prop|tree|scatter|landmark|custom
  --pieceIdPrefix <prefix>
  --assetIdPrefix <prefix>
  --pieceOverrides <path>
  --overrides <path>
  --pieceSourceRoot <url-or-path>
  --pieceSourceRoots <json-path-or-inline-json>
  --roles <comma,separated,roles>
  --sourcePack <name>
  --sources <comma,separated,sources>
  --tags <comma,separated,tags>
  --ids <comma,separated,pieceIds>
  --pieceId <pieceId>
  --assetIds <comma,separated,assetIds>
  --assetId <assetId>
  --minimumEdition free|extra|all
  --assetBaseUrl <url-or-path>
  --groups
  --includeGroups
  --coverage
  --checksPassed
  --outJson <path>
  --outMarkdown <path>
  --generatedAt <iso-timestamp>
  --category <comma,separated,tiles|buildings|decoration|units>
  --excludeTags <comma,separated,tags>
  --requiresExtra
  --freeOnly
  --allowUnknownAssets
  --allowUnknownAssetIds <comma,separated,assetIds>
  --assetScope free|extra|all
  --allowInvalid
  --allowExpectationFailures
  --excludePlacements
  --excludeActors
  --excludeQuests
  --excludeSpawnGroups
  --excludeTimeline
  --spawnCount <number>
  --spawnSeed <seed>
  --spawnMinDistance <number>
  --spawnEdgePadding <number>
  --mode per-piece|pool
  --emitRules
  --emitSourceUrls
  --unencodedSourceUrls
  --ruleIdPrefix <prefix>
  --idPrefix <prefix>
  --seed <seed>
  --waterFill <number>
  --maxElevation <number>
  --towns <number>
  --harbors <number>
  --textureSet <texture-set>
  --defaultTerrain <terrain>
  --count <number>
  --fill <number>
  --minCount <number>
  --maxCount <number>
  --topAssetLimit <number>
  --failOnWarning
  --failOnBlockedQuest
  --includeReport
  --includeReports
  --includeRecipe
  --includePlan
  --includeInterop
  --includeAbsolutePaths
  --outManifest <path>
  --outRecipe <path>
  --outPlan <path>
  --outInterop <path>
  --out <path>
  --format json|markdown
  --markdown
  --assetBasePath <path>
  --force
  --json

Bootstrap subcommand:
  --source github|zip          Source mode (default: github; zip requires --zip)
  --zip <path>                 Path to a user-supplied KayKit zip (FREE or EXTRA)
  --commit <sha>               Pin the GitHub source to a specific commit/ref (default: main)
  --out <path>                 Consumer asset root (default: ./public/assets/models)
  --edition free|extra         Pack edition (default: free; extra requires --source zip)
  --force                      Wipe existing target before mirroring
  --verify                     Re-hash an existing bootstrap target and report drift
  --include-source-formats     Mirror .fbx/.obj/.mtl alongside the gltf tree
  --json                       Emit machine-readable BootstrapResult / verify report`);
  process.exit(exitCode);
}
