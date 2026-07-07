/**
 * `declarative-hex-worlds` CLI help text.
 *
 * Split into its own module so that `--help` / `-h` / unknown-command paths in
 * the dispatcher can dynamic-import this file without pulling in the heavy
 * helper graph (`_shared.ts`, the freeManifest, the blueprint engine, the
 * simulation surface). Critical for PRD E5 cold-start budget - `--help`
 * resolves only this module.
 *
 * Every subcommand's flags are declared once, in {@link COMMANDS}, and two
 * renderers derive their output from that single source of truth:
 * - {@link HELP_TEXT} - the top-level `declarative-hex-worlds --help` banner
 *   (command list + a flattened, de-duplicated global options reference).
 * - {@link renderCommandHelp} - `declarative-hex-worlds <command> --help`,
 *   printing only the flags that command actually reads.
 *
 * Flag descriptions are grounded in the corresponding `src/cli/commands/*.ts`
 * module (and the shared helpers in `src/cli/_shared.ts` they call into) -
 * never invented. Keep this file in sync when a command gains/loses a flag.
 *
 * @module
 */

/** One documented flag for a subcommand's `--help` output. */
export interface CommandOption {
  /** Flag spelling as typed on the command line, e.g. `--out <path>` or `--force`. */
  readonly flag: string;
  /** One-line description of what the flag does. */
  readonly description: string;
}

/** Structured per-command help metadata (PRD RB2 follow-up: per-command `--help`). */
export interface CommandHelp {
  /** Subcommand name as it appears in {@link SUBCOMMAND_LOADERS} in `cli.ts`. */
  readonly name: string;
  /** One-line summary shown in the top-level command list and command banner. */
  readonly summary: string;
  /** Every flag the command's `run()` (directly or via shared helpers) reads. */
  readonly options: readonly CommandOption[];
  /** Other command names that resolve to the same module (e.g. `ingest` -> `extract`). */
  readonly aliases?: readonly string[];
}

/**
 * Global flags parsed by `cli.ts`'s dispatch wrapper for EVERY subcommand
 * (see `readEdition`/`defaultSourceRoot` in `src/cli/cli.ts`), before the
 * subcommand's own `run()` ever sees `parsed.flags`. These are never listed
 * in an individual command's {@link CommandOption} array — they apply
 * uniformly — so they get their own top-level section instead.
 */
const GLOBAL_DISPATCH_OPTIONS: readonly CommandOption[] = [
  {
    flag: '--source <path>',
    description:
      'Override the source root every command resolves against (default: ./references/KayKit_Medieval_Hexagon_Pack_1.0_<FREE|EXTRA>, chosen by --edition).',
  },
  {
    flag: '--edition free|extra',
    description:
      'Pack edition used to pick the default --source root and validate assets (default: free).',
  },
];

/** Flags shared by every command that resolves a plan-validation catalog via `validationConfigFromArgs`. */
const VALIDATION_OPTIONS: readonly CommandOption[] = [
  {
    flag: '--registry <path>',
    description: 'HexTileRegistry JSON used instead of one derived from the manifest.',
  },
  {
    flag: '--manifest <path>',
    description: 'Manifest JSON used to build the asset validation catalog.',
  },
  {
    flag: '--allowUnknownAssets',
    description: 'Do not fail validation on asset ids missing from the catalog.',
  },
  {
    flag: '--allowUnknownAssetIds <comma,separated,assetIds>',
    description: 'Specific asset ids to allow even when missing from the catalog.',
  },
];

/** `--plan`/`--recipe`/`--scenario` "exactly one of" input flags used by several board-analysis commands. */
const BOARD_SOURCE_OPTIONS: readonly CommandOption[] = [
  {
    flag: '--plan <path>',
    description: 'GameboardPlan JSON input (exactly one of --plan/--recipe/--scenario).',
  },
  {
    flag: '--recipe <path>',
    description:
      'GameboardRecipe JSON input, compiled to a plan (exactly one of --plan/--recipe/--scenario).',
  },
  {
    flag: '--scenario <path>',
    description:
      'GameboardScenario JSON input, compiled to a plan (exactly one of --plan/--recipe/--scenario).',
  },
];

/**
 * `--excludePlacements`/`--excludeActors`/`--excludeQuests`/`--excludeSpawnGroups`
 * interop-snapshot omission flags, shared verbatim by every command that builds
 * its snapshot via `snapshotOptionsFromFlags` (`blueprint` and `snapshot`).
 */
const INTEROP_SNAPSHOT_EXCLUDE_OPTIONS: readonly CommandOption[] = [
  { flag: '--excludePlacements', description: 'Omit placements from the interop snapshot.' },
  { flag: '--excludeActors', description: 'Omit actors from the interop snapshot.' },
  { flag: '--excludeQuests', description: 'Omit quests from the interop snapshot.' },
  { flag: '--excludeSpawnGroups', description: 'Omit spawn groups from the interop snapshot.' },
];

/**
 * `--excludePlacements`/`--excludeActors`/`--excludeQuests`/`--excludeTimeline`
 * interop-snapshot omission flags read by `simulate-scenario` (which has no
 * spawn groups to omit, unlike {@link INTEROP_SNAPSHOT_EXCLUDE_OPTIONS}, but
 * does have a timeline).
 */
const SIMULATION_INTEROP_SNAPSHOT_EXCLUDE_OPTIONS: readonly CommandOption[] = [
  {
    flag: '--excludePlacements',
    description: 'Omit placements from the interop snapshot (used with --outInterop).',
  },
  {
    flag: '--excludeActors',
    description: 'Omit actors from the interop snapshot (used with --outInterop).',
  },
  {
    flag: '--excludeQuests',
    description: 'Omit quests from the interop snapshot (used with --outInterop).',
  },
  {
    flag: '--excludeTimeline',
    description: 'Omit the timeline from the interop snapshot (used with --outInterop).',
  },
];

/** Guide-scenario selection flags shared by every `guide-*` coverage command. */
const GUIDE_SCENARIO_SELECTION_OPTIONS: readonly CommandOption[] = [
  {
    flag: '--scenarioId <comma,separated,ids>',
    description: 'Filter to specific guide scenario ids (alias: --scenario).',
  },
  { flag: '--scenario <comma,separated,ids>', description: 'Alias for --scenarioId.' },
  {
    flag: '--page <comma,separated,numbers>',
    description: 'Filter to specific one-based guide page numbers.',
  },
  {
    flag: '--editionScope free|extra|mixed|reference',
    description: 'Filter guide scenarios by edition scope (comma-list accepted).',
  },
  {
    flag: '--publicApi <comma,separated,names>',
    description: 'Filter to guide scenarios that exercise the given public API name(s).',
  },
];

/** Guide asset id filter flags (`readGuideAssetIdFilter` unions `--assetId` and `--assetIds`). */
const GUIDE_ASSET_ID_OPTIONS: readonly CommandOption[] = [
  {
    flag: '--assetId <comma,separated,ids>',
    description: 'Filter to specific asset ids (unioned with --assetIds).',
  },
  {
    flag: '--assetIds <comma,separated,ids>',
    description: 'Filter to specific asset ids (unioned with --assetId).',
  },
];

/** `--out`/`--json`/`--format json` output-mode flags shared by most `guide-*` reporting commands. */
const GUIDE_JSON_OUTPUT_OPTIONS: readonly CommandOption[] = [
  { flag: '--out <path>', description: 'Write the JSON payload to this file instead of stdout.' },
  {
    flag: '--json',
    description: 'Print the JSON payload to stdout (default is a human-readable summary).',
  },
  { flag: '--format json', description: 'Same as --json.' },
];

export const COMMANDS: readonly CommandHelp[] = [
  {
    name: 'doctor',
    summary: 'Report local source and docs status',
    options: [
      {
        flag: '--coverage',
        description:
          'Delegate entirely to the coverage command and print its release-readiness summary instead.',
      },
      { flag: '--checksPassed', description: 'Forwarded to coverage when --coverage is set.' },
    ],
  },
  {
    name: 'validate',
    summary: 'Validate local FREE or EXTRA source counts',
    options: [],
  },
  {
    name: 'manifest',
    summary: 'Generate a manifest JSON from a source folder',
    options: [
      {
        flag: '--out <path>',
        description: 'Write the generated manifest to this file (default: print to stdout).',
      },
    ],
  },
  {
    name: 'validate-manifest',
    summary: 'Validate a generated manifest JSON and optionally write a normalized copy',
    options: [
      { flag: '--manifest <path>', description: 'Manifest JSON file to inspect. Required.' },
      {
        flag: '--outManifest <path>',
        description:
          'Write a normalized copy of the manifest here when inspection produced a valid manifest.',
      },
      {
        flag: '--json',
        description: 'Print the inspection result as JSON instead of formatted text.',
      },
    ],
  },
  {
    name: 'analyze',
    summary: 'Analyze tile bounds, grid scale, row spacing, and warnings',
    options: [
      { flag: '--json', description: 'Print the analysis as JSON instead of formatted text.' },
      {
        flag: '--registry <path>',
        description:
          'Registry JSON (declaration array or {declarations:[...]}) to analyze instead of deriving one from the source/manifest.',
      },
      {
        flag: '--manifest <path>',
        description:
          'Manifest JSON to build the registry from (used only when --registry is absent).',
      },
    ],
  },
  {
    name: 'declarations',
    summary: 'Emit tile declarations from a source folder, manifest, or registry',
    options: [
      {
        flag: '--out <path>',
        description: 'Write the declarations JSON to this file (default: print to stdout).',
      },
      {
        flag: '--registry <path>',
        description:
          'Registry JSON to read declarations from instead of deriving one from the source/manifest.',
      },
      {
        flag: '--manifest <path>',
        description:
          'Manifest JSON to build the registry from (used only when --registry is absent).',
      },
    ],
  },
  {
    name: 'guide-permutations',
    summary: 'Emit guide-labeled road, river, crossing, and coast permutation metadata',
    options: [
      {
        flag: '--out <path>',
        description: 'Write the JSON payload to this file instead of stdout/console.',
      },
      { flag: '--json', description: 'Print the JSON payload to stdout.' },
      { flag: '--format json', description: 'Same as --json.' },
      {
        flag: '--manifest <path>',
        description: 'Manifest JSON to build the asset validation catalog from.',
      },
    ],
  },
  {
    name: 'guide-scenarios',
    summary: 'Emit extracted guide-page scenario metadata and validate page assets',
    options: [
      ...GUIDE_SCENARIO_SELECTION_OPTIONS,
      {
        flag: '--role <comma,separated,roles>',
        description: 'Filter scenarios by treatment role (alias: --guideRole).',
      },
      { flag: '--guideRole <comma,separated,roles>', description: 'Alias for --role.' },
      ...GUIDE_ASSET_ID_OPTIONS,
      {
        flag: '--assetScope free|extra|all',
        description:
          "Asset scope checked against the catalog (default: 'free' for a FREE manifest, else 'all').",
      },
      {
        flag: '--includeTreatments',
        description: 'Include per-scenario asset treatment coverage detail in the JSON payload.',
      },
      {
        flag: '--markdown',
        description: 'Render output as a Markdown coverage table (same as --format markdown).',
      },
      {
        flag: '--format markdown|json',
        description: "'markdown' behaves like --markdown; 'json' behaves like --json.",
      },
      {
        flag: '--out <path>',
        description: 'Write the payload (JSON, or Markdown if --markdown) to this file.',
      },
      { flag: '--json', description: 'Print the JSON payload to stdout.' },
      {
        flag: '--manifest <path>',
        description: 'Manifest JSON to build the asset validation catalog from.',
      },
    ],
  },
  {
    name: 'guide-usages',
    summary: 'Emit renderer-ready page-level guide asset occurrence metadata',
    options: [
      ...GUIDE_SCENARIO_SELECTION_OPTIONS,
      {
        flag: '--role <comma,separated,roles>',
        description:
          'Filter by guide asset treatment role (alias: --guideRole); validated against the known role set.',
      },
      { flag: '--guideRole <comma,separated,roles>', description: 'Alias for --role.' },
      ...GUIDE_ASSET_ID_OPTIONS,
      {
        flag: '--category tiles|buildings|decoration|units',
        description: 'Filter by asset category (comma-list accepted; alias: --categories).',
      },
      { flag: '--categories <comma,separated,values>', description: 'Alias for --category.' },
      {
        flag: '--minimumEdition free|extra|all',
        description:
          "Minimum edition an asset must require to be included (default: 'all'; alias: --assetEdition).",
      },
      { flag: '--assetEdition free|extra|all', description: 'Alias for --minimumEdition.' },
      ...GUIDE_JSON_OUTPUT_OPTIONS,
      {
        flag: '--manifest <path>',
        description: 'Manifest JSON to build the asset validation catalog from.',
      },
    ],
  },
  {
    name: 'guide-render-requests',
    summary: 'Emit URL-resolved guide render request queues and optional page groups',
    options: [
      ...GUIDE_SCENARIO_SELECTION_OPTIONS,
      {
        flag: '--role <comma,separated,roles>',
        description: 'Filter by guide asset treatment role (alias: --guideRole).',
      },
      { flag: '--guideRole <comma,separated,roles>', description: 'Alias for --role.' },
      ...GUIDE_ASSET_ID_OPTIONS,
      {
        flag: '--category tiles|buildings|decoration|units',
        description: 'Filter by asset category (comma-list accepted; alias: --categories).',
      },
      { flag: '--categories <comma,separated,values>', description: 'Alias for --category.' },
      {
        flag: '--minimumEdition free|extra|all',
        description:
          "Minimum edition an asset must require to be included (default: 'all'; alias: --assetEdition).",
      },
      { flag: '--assetEdition free|extra|all', description: 'Alias for --minimumEdition.' },
      {
        flag: '--assetBaseUrl <url-or-path>',
        description: 'Base URL/path prefix used to resolve each render request URL.',
      },
      {
        flag: '--groups',
        description:
          'Include page-grouped render requests in the JSON payload (aliases: --grouped, --includeGroups).',
      },
      { flag: '--grouped', description: 'Alias for --groups.' },
      { flag: '--includeGroups', description: 'Alias for --groups.' },
      ...GUIDE_JSON_OUTPUT_OPTIONS,
      {
        flag: '--manifest <path>',
        description: 'Manifest JSON to build the asset validation catalog from.',
      },
    ],
  },
  {
    name: 'guide-apis',
    summary: 'Emit public API to guide-page and asset coverage metadata',
    options: [
      {
        flag: '--publicApi <comma,separated,api-names>',
        description: 'Filter coverage records by public API name.',
      },
      ...GUIDE_JSON_OUTPUT_OPTIONS,
    ],
  },
  {
    name: 'guide-assets',
    summary: 'Emit asset id to guide-page, API, docs, and visual coverage metadata',
    options: [
      ...GUIDE_SCENARIO_SELECTION_OPTIONS,
      {
        flag: '--role <comma,separated,roles>',
        description: 'Filter by treatment role, unvalidated (alias: --guideRole).',
      },
      { flag: '--guideRole <comma,separated,roles>', description: 'Alias for --role.' },
      ...GUIDE_ASSET_ID_OPTIONS,
      ...GUIDE_JSON_OUTPUT_OPTIONS,
    ],
  },
  {
    name: 'guide-roles',
    summary: 'Emit public role to guide-page, asset, and API coverage metadata',
    options: [
      {
        flag: '--role <comma,separated,asset-treatment-roles>',
        description: 'Filter coverage records by role (alias: --guideRole).',
      },
      { flag: '--guideRole <comma,separated,roles>', description: 'Alias for --role.' },
      ...GUIDE_JSON_OUTPUT_OPTIONS,
    ],
  },
  {
    name: 'coverage',
    summary: 'Emit release-readiness coverage JSON or Markdown',
    options: [
      { flag: '--manifest <path>', description: 'Manifest JSON used to compute asset coverage.' },
      {
        flag: '--checksPassed',
        description: "Mark package checks status as 'passed' instead of 'not-run'.",
      },
      {
        flag: '--generatedAt <iso-timestamp>',
        description:
          "ISO timestamp override for the report's generatedAt field (default: current time).",
      },
      { flag: '--markdown', description: 'Render the report as Markdown instead of JSON/text.' },
      { flag: '--outJson <path>', description: 'Write the JSON report to this file.' },
      { flag: '--outMarkdown <path>', description: 'Write the Markdown report to this file.' },
      {
        flag: '--out <path>',
        description: 'Write the report to this file, in the format selected by --markdown.',
      },
      { flag: '--json', description: 'Print the JSON report to stdout.' },
    ],
  },
  {
    name: 'blueprint',
    summary: 'Compile high-level 2.5D board intent to a recipe, plan, scenario, and diagnostics',
    options: [
      {
        flag: '--blueprint <path>',
        description: 'JSON file of blueprint options (alias: --config).',
      },
      { flag: '--config <path>', description: 'Alias for --blueprint.' },
      { flag: '--width <number>', description: 'Rectangle shape width.' },
      { flag: '--height <number>', description: 'Rectangle shape height.' },
      {
        flag: '--radius <number>',
        description: 'Hexagon shape radius (default: 4 when --shape hexagon is given alone).',
      },
      { flag: '--seed <seed>', description: 'RNG seed string.' },
      {
        flag: '--faction <faction>',
        description: 'Faction identifier applied to generated placements.',
      },
      { flag: '--textureSet <texture-set>', description: 'Default texture set identifier.' },
      { flag: '--defaultTerrain <terrain>', description: 'Default terrain identifier.' },
      { flag: '--waterFill <number>', description: 'Water fill amount.' },
      { flag: '--maxElevation <number>', description: 'Maximum elevation value.' },
      { flag: '--towns <number>', description: 'Number of towns to generate.' },
      { flag: '--harbors <number>', description: 'Number of harbors to generate.' },
      {
        flag: '--shape rectangle|hexagon',
        description:
          'Board shape kind (default: rectangle, width 12 x height 9, unless overridden).',
      },
      {
        flag: '--includeRecipe',
        description: 'Include the compiled GameboardRecipe in the JSON payload.',
      },
      {
        flag: '--includePlan',
        description: 'Include the compiled GameboardPlan in the JSON payload.',
      },
      {
        flag: '--includeScenario',
        description: 'Include the generated GameboardScenario in the JSON payload.',
      },
      {
        flag: '--includeScenarioInspection',
        description:
          'Include the scenario inspection (validation + spawn/patrol diagnostics) in the JSON payload.',
      },
      {
        flag: '--includeInterop',
        description: 'Include an ECS interop snapshot in the JSON payload.',
      },
      {
        flag: '--outScenario <path>',
        description: 'Write the generated GameboardScenario JSON to this path.',
      },
      {
        flag: '--outScenarioInspection <path>',
        description: 'Write the scenario inspection JSON to this path.',
      },
      { flag: '--outInterop <path>', description: 'Write the interop snapshot JSON to this path.' },
      {
        flag: '--outRecipe <path>',
        description: 'Write the compiled GameboardRecipe JSON to this path.',
      },
      {
        flag: '--outPlan <path>',
        description: 'Write the compiled GameboardPlan JSON to this path.',
      },
      { flag: '--out <path>', description: 'Write the full inspection payload JSON to this path.' },
      { flag: '--json', description: 'Print the JSON payload to stdout.' },
      {
        flag: '--failOnWarning',
        description: 'Exit 1 if any warnings are present and there are no errors.',
      },
      ...INTEROP_SNAPSHOT_EXCLUDE_OPTIONS,
      {
        flag: '--spawnCount <number>',
        description: 'Number of spawn locations to generate for the interop snapshot.',
      },
      { flag: '--spawnSeed <seed>', description: 'RNG seed for generated spawn locations.' },
      {
        flag: '--spawnMinDistance <number>',
        description: 'Minimum distance between generated spawn locations.',
      },
      {
        flag: '--spawnEdgePadding <number>',
        description: 'Edge padding for generated spawn locations.',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'summarize-plan',
    summary:
      'Summarize terrain, placement, feature, asset, and local-only usage in a plan, recipe, scenario, or blueprint',
    options: [
      {
        flag: '--plan <path>',
        description:
          'GameboardPlan JSON input (exactly one of --plan/--recipe/--scenario/--blueprint).',
      },
      {
        flag: '--recipe <path>',
        description:
          'GameboardRecipe JSON input (exactly one of --plan/--recipe/--scenario/--blueprint).',
      },
      {
        flag: '--scenario <path>',
        description:
          'GameboardScenario JSON input (exactly one of --plan/--recipe/--scenario/--blueprint).',
      },
      {
        flag: '--blueprint <path>',
        description:
          'Blueprint options JSON to generate a plan from (exactly one of --plan/--recipe/--scenario/--blueprint; alias: --config).',
      },
      { flag: '--config <path>', description: 'Alias for --blueprint.' },
      { flag: '--allowInvalid', description: 'Do not exit 1 on validation errors.' },
      {
        flag: '--outPlan <path>',
        description: 'Write the compiled GameboardPlan JSON to this path.',
      },
      { flag: '--out <path>', description: 'Write the full summary payload JSON to this path.' },
      { flag: '--json', description: 'Print the JSON payload to stdout.' },
      { flag: '--failOnWarning', description: 'Exit 1 if the summary reports any warnings.' },
      {
        flag: '--topAssetLimit <number>',
        description: 'Limit how many top assets are reported (alias: --topAssets).',
      },
      { flag: '--topAssets <number>', description: 'Alias for --topAssetLimit.' },
      {
        flag: '--width, --height, --radius, --seed, --faction, --textureSet, --defaultTerrain, --waterFill, --maxElevation, --towns, --harbors, --shape',
        description:
          'Blueprint options, used only in --blueprint/--config mode (same as the blueprint command).',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'summarize-scenario',
    summary: 'Summarize board, actor, spawn, patrol, quest, and local-only usage in a scenario',
    options: [
      { flag: '--scenario <path>', description: 'GameboardScenario JSON to summarize. Required.' },
      { flag: '--allowInvalid', description: 'Do not exit 1 on validation errors.' },
      { flag: '--out <path>', description: 'Write the JSON summary payload to this path.' },
      { flag: '--json', description: 'Print the JSON payload to stdout.' },
      { flag: '--failOnWarning', description: 'Exit 1 if the summary reports any warnings.' },
      {
        flag: '--topAssetLimit <number>',
        description: 'Limit how many top actor assets are reported (alias: --topAssets).',
      },
      { flag: '--topAssets <number>', description: 'Alias for --topAssetLimit.' },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'pieces',
    summary: 'Validate piece declarations and optionally emit seeded piece fill rules',
    options: [
      { flag: '--pieces <path>', description: 'Piece registry JSON to analyze. Required.' },
      {
        flag: '--plan <path>',
        description:
          'Plan to inspect a fill-rule placement against (mutually exclusive with --recipe/--scenario).',
      },
      {
        flag: '--recipe <path>',
        description:
          'Recipe to inspect a fill-rule placement against (mutually exclusive with --plan/--scenario).',
      },
      {
        flag: '--scenario <path>',
        description:
          'Scenario to inspect a fill-rule placement against (mutually exclusive with --plan/--recipe).',
      },
      {
        flag: '--emitRules',
        description: 'Include generated seeded piece fill rules in the output.',
      },
      {
        flag: '--emitSourceUrls',
        description: 'Include a source-url map for pieces in the output.',
      },
      {
        flag: '--outPlan <path>',
        description:
          'Write the piece-filled GameboardPlan JSON here (only when a placement was inspected).',
      },
      { flag: '--out <path>', description: 'Write the full payload JSON to this path.' },
      { flag: '--json', description: 'Print the JSON payload to stdout.' },
      {
        flag: '--failOnWarning',
        description: 'Exit 1 if registry analysis or placement inspection reports warnings.',
      },
      {
        flag: '--ids <comma,separated,pieceIds>',
        description: 'Restrict the fill-rule selection to these piece ids.',
      },
      {
        flag: '--assetIds <comma,separated,assetIds>',
        description: 'Restrict the fill-rule selection to these asset ids.',
      },
      {
        flag: '--role surface|building|unit|prop|tree|scatter|landmark|custom',
        description:
          'Restrict the fill-rule selection to a single piece role (unioned with --roles).',
      },
      {
        flag: '--roles <comma,separated,roles>',
        description:
          'Restrict the fill-rule selection to multiple piece roles (unioned with --role).',
      },
      {
        flag: '--sourcePack <name>',
        description:
          'Restrict the fill-rule selection to a single source pack (overrides --sources).',
      },
      {
        flag: '--sources <comma,separated,sources>',
        description: 'Restrict the fill-rule selection to these source packs.',
      },
      {
        flag: '--tags <comma,separated,tags>',
        description: 'Restrict the fill-rule selection to pieces with these tags.',
      },
      {
        flag: '--excludeTags <comma,separated,tags>',
        description: 'Exclude pieces with these tags from the fill-rule selection.',
      },
      {
        flag: '--requiresExtra',
        description: 'Restrict the fill-rule selection to pieces that require the EXTRA edition.',
      },
      { flag: '--freeOnly', description: 'Restrict the fill-rule selection to FREE-only pieces.' },
      {
        flag: '--mode per-piece|pool',
        description: 'Seeded fill mode for the generated fill rule.',
      },
      {
        flag: '--id <id>',
        description: 'Fill rule id (fallback: --ruleIdPrefix, then "cli-selection").',
      },
      {
        flag: '--ruleIdPrefix <prefix>',
        description: 'Fill rule id prefix, used when --id is absent.',
      },
      { flag: '--count <number>', description: 'Fixed fill count for the generated fill rule.' },
      { flag: '--fill <number>', description: 'Fill amount/ratio for the generated fill rule.' },
      {
        flag: '--minCount <number>',
        description: 'Minimum fill count for the generated fill rule.',
      },
      {
        flag: '--maxCount <number>',
        description: 'Maximum fill count for the generated fill rule.',
      },
      {
        flag: '--pieceSourceRoot <url-or-path>',
        description: 'Single source-root override, used only with --emitSourceUrls.',
      },
      {
        flag: '--pieceSourceRoots <json-path-or-inline-json>',
        description:
          'Per-source-pack root map (JSON file path or inline JSON), used only with --emitSourceUrls.',
      },
      {
        flag: '--unencodedSourceUrls',
        description: 'Disable URL-encoding of generated source URLs.',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'place-piece',
    summary:
      'Inspect and append one declared piece against a saved GameboardPlan, recipe, or scenario',
    options: [
      ...BOARD_SOURCE_OPTIONS,
      {
        flag: '--pieces <path>',
        description: 'Piece registry JSON to select the placed piece from. Required.',
      },
      { flag: '--allowInvalid', description: 'Do not exit 1 on plan validation errors.' },
      { flag: '--count <number>', description: 'Number of placements to make.' },
      { flag: '--seed <seed>', description: 'Placement RNG seed.' },
      { flag: '--idPrefix <prefix>', description: 'Prefix for generated placement ids.' },
      {
        flag: '--outPlan <path>',
        description: 'Write the plan with placements appended to this path.',
      },
      {
        flag: '--out <path>',
        description: 'Write the full placement inspection JSON to this path.',
      },
      {
        flag: '--json',
        description: 'Print the inspection as JSON to stdout (used only when --out is absent).',
      },
      {
        flag: '--minCount <number>',
        description: 'Minimum placements required, else exit 1 (default: 1).',
      },
      { flag: '--pieceId <id>', description: 'Select a piece by id (takes priority over --id).' },
      { flag: '--id <id>', description: 'Select a piece by id (fallback for --pieceId).' },
      { flag: '--assetId <assetId>', description: 'Select a piece by exact asset id.' },
      { flag: '--ids <comma,separated,pieceIds>', description: 'Select pieces by id list.' },
      {
        flag: '--assetIds <comma,separated,assetIds>',
        description: 'Select pieces by asset id list.',
      },
      {
        flag: '--tags <comma,separated,tags>',
        description: 'Restrict selection to pieces with these tags.',
      },
      {
        flag: '--excludeTags <comma,separated,tags>',
        description: 'Exclude pieces with these tags.',
      },
      {
        flag: '--sources <comma,separated,sources>',
        description: 'Restrict selection to these source packs (overridden by --sourcePack).',
      },
      {
        flag: '--sourcePack <name>',
        description: 'Restrict selection to a single source pack; takes priority over --sources.',
      },
      {
        flag: '--role surface|building|unit|prop|tree|scatter|landmark|custom',
        description: 'Restrict selection to a single piece role.',
      },
      {
        flag: '--roles <comma,separated,roles>',
        description: 'Restrict selection to multiple piece roles.',
      },
      {
        flag: '--requiresExtra',
        description: 'Restrict selection to pieces that require the EXTRA edition.',
      },
      { flag: '--freeOnly', description: 'Restrict selection to FREE-only pieces.' },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'validate-plan',
    summary: 'Validate a GameboardPlan JSON with optional registry rules',
    options: [
      { flag: '--plan <path>', description: 'GameboardPlan JSON to validate. Required.' },
      {
        flag: '--json',
        description: 'Print the violations array as JSON instead of formatted text.',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'analyze-layout',
    summary: 'Analyze seeded layout fill rules against a saved GameboardPlan, recipe, or scenario',
    options: [
      ...BOARD_SOURCE_OPTIONS,
      {
        flag: '--rules <path>',
        description: 'Layout fill rules JSON (array or {rules:[...]}). Required.',
      },
      { flag: '--allowInvalid', description: 'Do not exit 1 on plan validation errors.' },
      {
        flag: '--outPlan <path>',
        description: 'Write the compiled GameboardPlan JSON to this path.',
      },
      { flag: '--seed <seed>', description: 'Override the rules file seed for the layout fill.' },
      { flag: '--out <path>', description: 'Write the full analysis JSON to this path.' },
      {
        flag: '--json',
        description: 'Print the analysis as JSON (used only when --out is absent).',
      },
      {
        flag: '--failOnWarning',
        description:
          'Exit 1 if the analysis reports any warnings, in addition to always exiting on errors.',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'spawn-groups',
    summary:
      'Plan separated spawn groups and route diagnostics against a plan, recipe, or scenario',
    options: [
      ...BOARD_SOURCE_OPTIONS,
      {
        flag: '--groups <path>',
        description: 'Spawn group options JSON (array or {groups:[...]}). Required.',
      },
      { flag: '--allowInvalid', description: 'Do not exit 1 on plan validation errors.' },
      { flag: '--seed <seed>', description: 'Override the embedded groups file seed.' },
      { flag: '--out <path>', description: 'Write the spawn group plan JSON to this path.' },
      { flag: '--json', description: 'Print the plan as JSON (used only when --out is absent).' },
      {
        flag: '--failOnWarning',
        description:
          'Exit 1 if the plan reports any warnings, in addition to always exiting on errors.',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'patrol-routes',
    summary:
      'Plan NPC/enemy patrol waypoints and segment diagnostics against a plan, recipe, or scenario',
    options: [
      ...BOARD_SOURCE_OPTIONS,
      {
        flag: '--routes <path>',
        description:
          'Patrol route rules JSON (array or {routes:[...]}); required unless --scenario already has patrolRoutes.',
      },
      {
        flag: '--allowInvalid',
        description: 'Do not exit 1 on plan or spawn-group validation errors.',
      },
      {
        flag: '--groups <path>',
        description: 'Spawn group options JSON used to seed patrol routes.',
      },
      {
        flag: '--seed <seed>',
        description:
          'Override the routes/spawn-groups seed (default: "<scenario.id or plan.seed>:patrol-routes").',
      },
      { flag: '--out <path>', description: 'Write the route set JSON to this path.' },
      {
        flag: '--json',
        description: 'Print the route set as JSON (used only when --out is absent).',
      },
      {
        flag: '--failOnWarning',
        description:
          'Exit 1 if the route set reports any warnings, in addition to always exiting on errors.',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'patrol-script',
    summary:
      'Create executable simulation command steps from planned patrol routes and actor assignments',
    options: [
      {
        flag: '--scenario <path>',
        description: 'GameboardScenario JSON used to derive routes and simulation context.',
      },
      {
        flag: '--routes <path>',
        description:
          'Patrol route set/rules JSON; required unless a planned route set or scenario.patrolRoutes is usable.',
      },
      {
        flag: '--plan <path>',
        description:
          'GameboardPlan JSON, used with --scenario when routes still need to be planned.',
      },
      {
        flag: '--recipe <path>',
        description:
          'GameboardRecipe JSON, used with --scenario when routes still need to be planned.',
      },
      {
        flag: '--allowInvalid',
        description:
          'Relax plan/spawn-group errors during route derivation and missing-route errors during scripting.',
      },
      {
        flag: '--rounds <number>',
        description: 'Default round count applied to assignments lacking their own rounds.',
      },
      {
        flag: '--assignments <path>',
        description: 'Actor/route assignment list JSON (array or {assignments:[...]}).',
      },
      {
        flag: '--routeId <id>',
        description:
          'Single assignment route id, used only when --assignments is absent (paired with --actorId).',
      },
      {
        flag: '--actorId <id>',
        description:
          'Single assignment actor id, used only when --assignments is absent (paired with --routeId).',
      },
      {
        flag: '--idPrefix <prefix>',
        description: 'Step id prefix for the single inline --routeId/--actorId assignment.',
      },
      {
        flag: '--includeReport',
        description:
          'Include the full script plan (steps + diagnostics) instead of just the script.',
      },
      { flag: '--out <path>', description: 'Write the script/report JSON to this path.' },
      {
        flag: '--json',
        description: 'Print the payload as JSON (used only when --out is absent).',
      },
      { flag: '--failOnWarning', description: 'Exit 1 if the script plan reports any warnings.' },
      {
        flag: '--groups <path>',
        description: 'Spawn group options JSON used during route derivation.',
      },
      {
        flag: '--seed <seed>',
        description: 'Seed override used during route/spawn-group derivation.',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'validate-recipe',
    summary: 'Validate a GameboardRecipe JSON and optionally compile it to a plan',
    options: [
      {
        flag: '--recipe <path>',
        description: 'GameboardRecipe JSON to validate/compile. Required.',
      },
      {
        flag: '--outPlan <path>',
        description: 'Write the compiled GameboardPlan JSON here (only if compilation succeeded).',
      },
      {
        flag: '--json',
        description: 'Print the violations array as JSON instead of formatted text.',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'validate-scenario',
    summary: 'Validate a GameboardScenario JSON and optionally compile its plan',
    options: [
      {
        flag: '--scenario <path>',
        description: 'GameboardScenario JSON to validate/compile. Required.',
      },
      {
        flag: '--outPlan <path>',
        description: 'Write the compiled GameboardPlan JSON here (only if compilation succeeded).',
      },
      {
        flag: '--json',
        description:
          'Print the full structured result (scenario id, actors, quests, spawn groups, patrol routes, violations) as JSON.',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'validate-simulation',
    summary: 'Validate a GameboardScenario simulation script without executing it',
    options: [
      { flag: '--scenario <path>', description: 'GameboardScenario JSON. Required.' },
      { flag: '--script <path>', description: 'Simulation script JSON. Required.' },
      {
        flag: '--outPlan <path>',
        description: 'Write the compiled GameboardPlan JSON here (only if compilation succeeded).',
      },
      {
        flag: '--json',
        description:
          'Print the full structured result (scenario id, step count, actors, quests, violations) as JSON.',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'snapshot',
    summary: 'Emit a neutral ECS interop snapshot from a plan, recipe, or scenario',
    options: [
      ...BOARD_SOURCE_OPTIONS,
      ...INTEROP_SNAPSHOT_EXCLUDE_OPTIONS,
      {
        flag: '--spawnCount <number>',
        description: 'Number of spawn locations to compute and include as spawnLocations.',
      },
      {
        flag: '--spawnSeed <seed>',
        description:
          'Deterministic RNG seed for computed spawn locations (used with --spawnCount).',
      },
      {
        flag: '--spawnMinDistance <number>',
        description: 'Minimum distance between computed spawn points (used with --spawnCount).',
      },
      {
        flag: '--spawnEdgePadding <number>',
        description: 'Edge padding for computed spawn points (used with --spawnCount).',
      },
      { flag: '--allowInvalid', description: 'Do not exit 1 on plan validation errors.' },
      {
        flag: '--out <path>',
        description: 'Write the JSON snapshot to this path (default: print to stdout).',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'simulate-scenario',
    summary:
      'Run a GameboardScenario simulation script and emit event records, final plan, or ECS interop',
    options: [
      { flag: '--scenario <path>', description: 'GameboardScenario JSON. Required.' },
      { flag: '--script <path>', description: 'Simulation script JSON. Required.' },
      {
        flag: '--allowInvalid',
        description: 'Do not exit 1 when scenario/script validation has errors.',
      },
      {
        flag: '--outPlan <path>',
        description: 'Write the final simulated GameboardPlan JSON to this path.',
      },
      {
        flag: '--outInterop <path>',
        description: 'Write a simulation interop snapshot JSON to this path.',
      },
      ...SIMULATION_INTEROP_SNAPSHOT_EXCLUDE_OPTIONS,
      {
        flag: '--out <path>',
        description: 'Write the full scenario simulation report JSON to this path.',
      },
      {
        flag: '--json',
        description: 'Print the report as JSON to stdout (used only when --out is absent).',
      },
      {
        flag: '--allowExpectationFailures',
        description: 'Do not exit 1 when the report reports success: false.',
      },
      {
        flag: '--failOnBlockedQuest',
        description: 'Exit 1 if any quest ends with status "blocked".',
      },
      ...VALIDATION_OPTIONS,
    ],
  },
  {
    name: 'compatibility',
    summary: 'Analyze one external GLB/GLTF for hex-tile compatibility and placement suggestions',
    options: [
      { flag: '--asset <path>', description: 'External GLB/GLTF file to analyze. Required.' },
      {
        flag: '--id <id>',
        description: 'Asset id used in the report (default: derived from the filename).',
      },
      {
        flag: '--sourcePack <name>',
        description: "Source pack name attributed to the asset (default: 'external').",
      },
      { flag: '--creator <name>', description: 'Creator/author attribution string.' },
      { flag: '--license <license>', description: 'License string.' },
      {
        flag: '--intendedRole tile|prop|structure|unit',
        description: 'Intended placement role hint.',
      },
      { flag: '--modelForward +z|-z|+x|-x', description: "Model's forward-facing axis." },
      { flag: '--boardForwardEdge 0..5', description: 'Hex edge index treated as forward.' },
      { flag: '--json', description: 'Print the report as JSON instead of formatted text.' },
      {
        flag: '--failOnWarning',
        description: 'Exit 1 if the report has warnings (errors always exit 1).',
      },
    ],
  },
  {
    name: 'piece',
    summary: 'Emit a custom piece declaration from an external GLB/GLTF compatibility scan',
    options: [
      { flag: '--asset <path>', description: 'GLB/GLTF file to scan. Required.' },
      {
        flag: '--id <id>',
        description: 'Asset id for the compatibility scan (default: derived from the filename).',
      },
      { flag: '--sourcePack <name>', description: "Source pack name (default: 'external')." },
      { flag: '--creator <name>', description: 'Creator/author attribution string.' },
      { flag: '--license <license>', description: 'License string.' },
      {
        flag: '--intendedRole tile|prop|structure|unit',
        description: 'Intended placement role hint.',
      },
      { flag: '--modelForward +z|-z|+x|-x', description: "Model's forward-facing axis." },
      { flag: '--boardForwardEdge 0..5', description: 'Hex edge index treated as forward.' },
      {
        flag: '--role surface|building|unit|prop|tree|scatter|landmark|custom',
        description: 'Declared piece role.',
      },
      {
        flag: '--pieceId <id>',
        description: 'Id for the emitted piece declaration (default: derived from the asset id).',
      },
      {
        flag: '--tags <comma,separated,tags>',
        description: 'Tags attached to the piece declaration.',
      },
      {
        flag: '--includeReport',
        description: 'Include the raw compatibility report alongside the declaration.',
      },
      {
        flag: '--out <path>',
        description: 'Write the JSON payload to this file instead of stdout.',
      },
      {
        flag: '--failOnWarning',
        description: 'Exit 1 if the compatibility report has warnings (errors always exit 1).',
      },
    ],
  },
  {
    name: 'pieces-from-assets',
    summary: 'Scan GLB/GLTF files and emit custom piece declarations plus compatibility summaries',
    options: [
      {
        flag: '--assets <comma,separated,paths>',
        description: 'Files/directories to scan (required unless --asset is given).',
      },
      {
        flag: '--asset <path>',
        description: 'Single file/directory to scan (required unless --assets is given).',
      },
      {
        flag: '--includeAbsolutePaths',
        description: 'Include the absolute path field in each scanned-asset record.',
      },
      {
        flag: '--sourcePack <name>',
        description: "Source pack name attributed to all scanned assets (default: 'external').",
      },
      {
        flag: '--intendedRole tile|prop|structure|unit',
        description: 'Intended placement role hint applied to all scanned assets.',
      },
      { flag: '--creator <name>', description: 'Creator/author attribution string.' },
      { flag: '--license <license>', description: 'License string.' },
      {
        flag: '--modelForward +z|-z|+x|-x',
        description: 'Model forward-facing axis applied to all scanned assets.',
      },
      {
        flag: '--boardForwardEdge 0..5',
        description: 'Hex edge index treated as forward, applied to all scanned assets.',
      },
      {
        flag: '--role surface|building|unit|prop|tree|scatter|landmark|custom',
        description: 'Role applied to all declared pieces.',
      },
      {
        flag: '--pieceOverrides <path>',
        description: 'JSON file of per-asset-id piece declaration overrides (alias: --overrides).',
      },
      { flag: '--overrides <path>', description: 'Alias for --pieceOverrides.' },
      { flag: '--pieceIdPrefix <prefix>', description: 'Prefix applied to generated piece ids.' },
      { flag: '--assetIdPrefix <prefix>', description: 'Prefix applied to generated asset ids.' },
      {
        flag: '--tags <comma,separated,tags>',
        description: 'Tags applied to all declared pieces.',
      },
      {
        flag: '--includeReports',
        description:
          'Include full per-asset compatibility reports in the JSON payload (alias: --includeReport).',
      },
      { flag: '--includeReport', description: 'Alias for --includeReports.' },
      {
        flag: '--out <path>',
        description: 'Write the JSON payload to this file instead of stdout.',
      },
      { flag: '--json', description: 'Print the JSON payload to stdout.' },
      {
        flag: '--failOnWarning',
        description:
          'Exit 1 if any per-asset, registry, or override-mismatch warnings are present (errors always exit 1).',
      },
    ],
  },
  {
    name: 'bind',
    summary: 'Scan an assets directory and emit a Zod-validated AssetSourceSpec JSON',
    options: [
      {
        flag: '--dir <path>',
        description: 'Assets root to scan (required). Subdirs tiles/models/sprites/tilesets/ set roles.',
      },
      {
        flag: '--name <name>',
        description: "Source name recorded in the spec (default: the dir's basename).",
      },
      {
        flag: '--asset-root <path>',
        description: 'assetRoot recorded in the spec (default: the scanned --dir).',
      },
      {
        flag: '--out <path>',
        description: 'Write the JSON here (default: print to stdout).',
      },
    ],
  },
  {
    name: 'extract',
    summary: 'Copy GLTF assets and write a manifest to an output folder',
    aliases: ['ingest'],
    options: [
      {
        flag: '--out <path>',
        description:
          "Output folder root (default: 'kaykit-medieval-hexagon-<edition>'). Assets are copied to <out>/assets and the manifest is written to <out>/manifest.json.",
      },
      {
        flag: '--force',
        description: 'Wipe an existing non-empty destination before remirroring.',
      },
    ],
  },
  {
    name: 'bootstrap',
    summary: 'Materialize KayKit GLTF assets under a consumer asset root (PRD RB)',
    options: [
      {
        flag: '--verify',
        description:
          'Skip fetch/mirror and instead re-hash an existing bootstrap target against its integrity sidecar, reporting drift.',
      },
      {
        flag: '--out <path>',
        description:
          'Consumer asset root (default: the existing ./models or ./public/models, else ./models).',
      },
      {
        flag: '--json',
        description:
          'Print a machine-readable BootstrapResult (or verify report) instead of a human-readable summary.',
      },
      {
        flag: '--source github|zip',
        description: "Source mode (default: 'github'; 'zip' requires --zip).",
      },
      {
        flag: '--zip <path>',
        description:
          'Path to a user-supplied KayKit zip archive (FREE or EXTRA). Required when --source zip.',
      },
      {
        flag: '--commit <sha>',
        description:
          'Pin the GitHub source to a specific commit/ref (default: main). Only used with --source github.',
      },
      {
        flag: '--edition free|extra',
        description: 'Pack edition (default: free; extra requires --source zip).',
      },
      { flag: '--force', description: 'Wipe an existing non-empty target before mirroring.' },
      {
        flag: '--include-source-formats',
        description: 'Also mirror .fbx/.fbx(unity)/.obj/.mtl source files alongside the gltf tree.',
      },
    ],
  },
];

/** Lookup from every command name (including aliases) to its {@link CommandHelp}. */
const COMMAND_LOOKUP: ReadonlyMap<string, CommandHelp> = new Map(
  COMMANDS.flatMap((command) => [
    [command.name, command] as const,
    ...(command.aliases ?? []).map((alias) => [alias, command] as const),
  ])
);

/** Find a command's help metadata by name or alias (e.g. `ingest` resolves to `extract`). */
export function findCommandHelp(name: string): CommandHelp | undefined {
  return COMMAND_LOOKUP.get(name);
}

/**
 * Global options reference: every option flag from every command, de-duplicated
 * by flag spelling and sorted for a stable, readable top-level `--help` output.
 * Does NOT include {@link GLOBAL_DISPATCH_OPTIONS} - those are rendered in
 * their own dedicated section (see {@link HELP_TEXT} and
 * {@link renderCommandHelp}) since they apply to every command uniformly
 * rather than being one more per-command flag.
 */
function globalOptionLines(): string[] {
  const seen = new Map<string, string>();
  for (const command of COMMANDS) {
    for (const option of command.options) {
      if (!seen.has(option.flag)) {
        seen.set(option.flag, option.description);
      }
    }
  }
  return [...seen.keys()].sort((a, b) => a.localeCompare(b)).map((flag) => `  ${flag}`);
}

/** Render a `Global options:` section listing {@link GLOBAL_DISPATCH_OPTIONS} with descriptions. */
function globalDispatchOptionLines(): string[] {
  const lines: string[] = [];
  for (const option of GLOBAL_DISPATCH_OPTIONS) {
    lines.push(`  ${option.flag}`, `      ${option.description}`);
  }
  return lines;
}

function commandSummaryLine(command: CommandHelp): string {
  const aliasSuffix =
    command.aliases && command.aliases.length > 0 ? ` (alias: ${command.aliases.join(', ')})` : '';
  return `  ${command.name}    ${command.summary}${aliasSuffix}`;
}

export const HELP_TEXT = [
  'declarative-hex-worlds <command> [options]',
  '',
  'Commands:',
  ...COMMANDS.map(commandSummaryLine),
  '',
  "Run `declarative-hex-worlds <command> --help` for that command's full flag reference.",
  '',
  'Global options (accepted by every command):',
  ...globalDispatchOptionLines(),
  '',
  'Options:',
  ...globalOptionLines(),
].join('\n');

export function usage(exitCode: number): never {
  console.log(HELP_TEXT);
  process.exit(exitCode);
}

/**
 * Render `declarative-hex-worlds <command> --help`: the command's summary plus
 * every flag it reads (grounded in the corresponding `src/cli/commands/*.ts`
 * module). Returns `undefined` for an unknown command name so the caller can
 * fall through to the standard "unknown command" handling.
 */
export function renderCommandHelp(name: string): string | undefined {
  const command = findCommandHelp(name);
  if (!command) {
    return undefined;
  }
  const aliasSuffix =
    command.aliases && command.aliases.length > 0 ? ` (alias: ${command.aliases.join(', ')})` : '';
  const lines = [
    `declarative-hex-worlds ${command.name} [options]${aliasSuffix}`,
    '',
    command.summary,
    '',
    'Options:',
  ];
  if (command.options.length === 0) {
    lines.push('  This command takes no flags.');
  } else {
    for (const option of command.options) {
      lines.push(`  ${option.flag}`, `      ${option.description}`);
    }
  }
  lines.push('', 'Global options (accepted by every command):', ...globalDispatchOptionLines());
  return lines.join('\n');
}

/** Print a command's `--help` output and exit. */
export function commandUsage(name: string, exitCode: number): never {
  const text = renderCommandHelp(name);
  if (text !== undefined) {
    console.log(text);
  }
  process.exit(exitCode);
}
