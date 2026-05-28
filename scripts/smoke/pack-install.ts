/**
 * Runtime smoke for the packed `medieval-hexagon-gameboard` tarball.
 *
 * Responsibilities (per PRD D10 split):
 *   1. `npm pack` the workspace into a tmpdir.
 *   2. Install the tarball into a sibling consumer fixture app.
 *   3. Hit the installed CLI directly (guide-usages, summarize-plan,
 *      summarize-scenario, coverage --json/--markdown) and assert behavior.
 *   4. Write a runtime smoke `smoke.mjs` that exercises every public subpath
 *      against the installed package, run it under `node`, and assert the
 *      JSON output covers every documented capability.
 *   5. Hit the installed `medieval-hexagon-gameboard` bin (`doctor`,
 *      `doctor --coverage`) and assert the release-readiness output.
 *
 * The compile-time API attestation lives in
 * {@link ./types#runTypesAttestation} so a runtime failure is never
 * indistinguishable from a `tsc` failure in the orchestrator's log.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { assert, COVERAGE_CLI_MAX_BUFFER_BYTES, type SmokeContext } from './_shared.js';

interface PackResult {
  filename: string;
}

/**
 * Run the runtime smoke phase against the resolved {@link SmokeContext}.
 *
 * Mutates the tempdir tree (writes `app/package.json`, `app/smoke.mjs`, pulls
 * the tarball into `pack/`) and calls out to `npm` + `node`. The orchestrator
 * is responsible for cleaning up the tempdir in a `finally` block.
 */
export function runPackInstallSmoke(ctx: SmokeContext): void {
  const { packageRoot, tempRoot, packRoot, appRoot, keepTemp } = ctx;
  for (const requiredFile of [
    'dist/index.js',
    'dist/examples/blueprint-board-usage.js',
    'dist/cli.js',
  ]) {
    assert(
      existsSync(join(packageRoot, requiredFile)),
      `missing ${requiredFile}; run pnpm build before pnpm test:consumer`
    );
  }

  const [pack] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', packRoot], {
      cwd: packageRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  ) as PackResult[];
  if (pack === undefined) {
    throw new Error('npm pack did not return any tarball metadata');
  }
  const tarballPath = join(packRoot, pack.filename);
  assert(existsSync(tarballPath), `npm pack did not create ${tarballPath}`);

  writeFileSync(
    join(appRoot, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        type: 'module',
        dependencies: {
          'medieval-hexagon-gameboard': `file:${tarballPath}`,
          '@types/react': '^19.0.0',
          react: '^19.0.0',
          three: '^0.180.0',
        },
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--fund=false'], {
    cwd: appRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const installedPackageRoot = join(appRoot, 'node_modules/medieval-hexagon-gameboard');
  const installedCliPath = join(installedPackageRoot, 'dist/cli.js');
  assert(
    existsSync(join(installedPackageRoot, 'dist/examples/blueprint-board-usage.js')),
    'compiled blueprint usage example is missing'
  );
  assert(
    existsSync(join(installedPackageRoot, 'examples/blueprint-board.json')),
    'blueprint JSON example is missing'
  );
  assert(
    !existsSync(join(installedPackageRoot, 'examples/blueprint-board-usage.ts')),
    'raw TypeScript blueprint usage example must not be published'
  );
  // PRD R4: SimpleRPG is a test driver, not a published example. The
  // tarball must NOT ship its compiled module, the JSON fixtures, or the
  // raw TypeScript source.
  assert(
    !existsSync(join(installedPackageRoot, 'dist/examples/simple-rpg-usage.js')),
    'SimpleRPG usage module must not ship in the published tarball'
  );
  assert(
    !existsSync(join(installedPackageRoot, 'examples/simple-rpg-usage.ts')),
    'raw TypeScript SimpleRPG usage example must not be published'
  );
  assert(
    !existsSync(join(installedPackageRoot, 'examples/simple-rpg-scenario.json')),
    'SimpleRPG scenario JSON must not ship in the published tarball'
  );
  assert(
    !existsSync(join(installedPackageRoot, 'examples/simple-rpg-simulation.script.json')),
    'SimpleRPG simulation script JSON must not ship in the published tarball'
  );
  // PRD R4: SimpleRPG fixtures live under tests/ and are NOT shipped. To
  // exercise the packed CLI against a real scenario the workspace fixture
  // is staged into the consumer tempdir as if the consumer had supplied
  // their own scenario file.
  const stagedScenarioPath = join(appRoot, 'simple-rpg-scenario.json');
  const stagedSimulationScriptPath = join(appRoot, 'simple-rpg-simulation.script.json');
  copyFileSync(
    join(packageRoot, 'tests/integration/simple-rpg/fixtures/simple-rpg-scenario.json'),
    stagedScenarioPath
  );
  copyFileSync(
    join(packageRoot, 'tests/integration/simple-rpg/fixtures/simple-rpg-simulation.script.json'),
    stagedSimulationScriptPath
  );
  const installedGuideUsageOutput = execFileSync(
    process.execPath,
    [
      installedCliPath,
      'guide-usages',
      '--source',
      join(tempRoot, 'missing-guide-source'),
      '--page',
      '14',
      '--json',
    ],
    {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const installedGuideUsage = JSON.parse(installedGuideUsageOutput) as {
    count: number;
    occurrenceCounts: { extra: number; scenarios: number; pages: number };
    assetIds: string[];
  };
  assert(
    installedGuideUsage.count === 137 &&
      installedGuideUsage.occurrenceCounts.extra === 137 &&
      installedGuideUsage.occurrenceCounts.scenarios === 1 &&
      installedGuideUsage.occurrenceCounts.pages === 1 &&
      installedGuideUsage.assetIds.includes('unit_blue_full'),
    'packed CLI guide-usages command did not emit page 14 renderer rows'
  );
  const installedSummaryOutput = execFileSync(
    process.execPath,
    [
      installedCliPath,
      'summarize-plan',
      '--scenario',
      stagedScenarioPath,
      '--manifest',
      join(installedPackageRoot, 'assets/free/manifest.json'),
      '--json',
    ],
    {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const installedSummary = JSON.parse(installedSummaryOutput) as {
    source: { kind: string };
    validation: { errorCount: number };
    summary: {
      tileCount: number;
      placementCount: number;
      placementKindCounts: Record<string, number>;
    };
  };
  assert(
    installedSummary.source.kind === 'scenario' &&
      installedSummary.validation.errorCount === 0 &&
      installedSummary.summary.tileCount > 0 &&
      installedSummary.summary.placementCount > 0 &&
      (installedSummary.summary.placementKindCounts.terrain ?? 0) > 0,
    'packed CLI summarize-plan command did not emit scenario board counts'
  );
  const installedScenarioSummaryOutput = execFileSync(
    process.execPath,
    [
      installedCliPath,
      'summarize-scenario',
      '--scenario',
      stagedScenarioPath,
      '--manifest',
      join(installedPackageRoot, 'assets/free/manifest.json'),
      '--json',
    ],
    {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const installedScenarioSummary = JSON.parse(installedScenarioSummaryOutput) as {
    scenarioId: string;
    validation: { errorCount: number };
    actorCount: number;
    questCount: number;
    objectiveCount: number;
    actorKindCounts: Record<string, number>;
  };
  assert(
    installedScenarioSummary.scenarioId === 'docs-simple-rpg-scenario' &&
      installedScenarioSummary.validation.errorCount === 0 &&
      installedScenarioSummary.actorCount > 0 &&
      installedScenarioSummary.questCount > 0 &&
      installedScenarioSummary.objectiveCount > 0 &&
      (installedScenarioSummary.actorKindCounts.player ?? 0) > 0,
    'packed CLI summarize-scenario command did not emit playable scenario counts'
  );
  const installedCoverageOutput = execFileSync(
    process.execPath,
    [installedCliPath, 'coverage', '--checksPassed', '--json'],
    {
      cwd: appRoot,
      encoding: 'utf8',
      maxBuffer: COVERAGE_CLI_MAX_BUFFER_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const installedCoverage = JSON.parse(installedCoverageOutput) as {
    simpleRpgEvidence?: {
      publicApiExercises?: Array<{
        assetCount: number;
        modes: string[];
        pages: number[];
        publicApi: string;
      }>;
    };
  };
  const installedCoverageBridgeExercise =
    installedCoverage.simpleRpgEvidence?.publicApiExercises?.find(
      (exercise) => exercise.publicApi === 'GameboardBuilder.addBridge'
    );
  const installedCoverageMarkdown = execFileSync(
    process.execPath,
    [installedCliPath, 'coverage', '--checksPassed', '--markdown'],
    {
      cwd: appRoot,
      encoding: 'utf8',
      maxBuffer: COVERAGE_CLI_MAX_BUFFER_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  assert(
    installedCoverage.simpleRpgEvidence?.publicApiExercises?.length === 74 &&
      installedCoverageBridgeExercise?.assetCount === 2 &&
      installedCoverageBridgeExercise.pages.join(',') === '2,7,9' &&
      installedCoverageBridgeExercise.modes.includes('visual-coverage') &&
      installedCoverageMarkdown.includes('### SimpleRPG Exercise Matrix') &&
      installedCoverageMarkdown.includes(
        '| `GameboardBuilder.addBridge` | fixed-gameplay, visual-coverage | 2, 7, 9 | 2 |'
      ),
    'packed CLI coverage command did not emit the SimpleRPG public API exercise matrix'
  );

  writeFileSync(
    join(appRoot, 'smoke.mjs'),
    `
import {
  createGameboardBuilder,
  createGameboardInteropSnapshot,
  createGameboardInteropSnapshotIndex,
  createGameboardLayoutArchetypeRegistryFromRecipe,
  createGameboardRecipe,
  createGameboardWorld,
  createInMemoryGameboardEcs,
  createSeededGameboardPlan,
  dispatchGameboardActorTargetCommand,
  axialToWorld,
  findPlacementEntity,
  findTileEntity,
  GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS,
  inspectGameboardActorTargets,
  inspectGameboardPlacementOccupancy,
  inspectGameboardNeighborhood,
  inspectGameboardTile,
  listKayKitGuideScenarioAssetRenderGroups,
  listKayKitGuideScenarioAssetRenderRequests,
  listKayKitGuideScenarioAssetUsages,
  moveGameboardActor,
  PlacementOccupiesTile,
  PlacementState,
  planGameboardActorTargetCommand,
  readPlacementOccupancyForTile,
  runGameboardActorTargetInteraction,
  selectGameboardActors,
  selectGameboardInteropRelations,
  spawnGameboardActor,
  spawnGameboardPlacement,
  summarizeGameboardCoverage,
  summarizeGameboardPlan,
  summarizeGameboardScenario,
} from 'medieval-hexagon-gameboard';
import { runBlueprintBoardUsageExample } from 'medieval-hexagon-gameboard/examples/blueprint-board-usage';
// PRD R4: SimpleRPG no longer exports through the package; the smoke
// consumer only verifies the published surface. SimpleRPG evidence is
// asserted via the installed CLI \`coverage\` and \`doctor --coverage\`
// commands above (which still bundle the SimpleRPG evidence inside
// \`dist/cli.js\`).
import {
  GAMEBOARD_INTERACTION_HANDLER_PRESETS,
  createGameboardInteractionHandlerPreset,
  isGameboardInteractionHandlerPreset,
} from 'medieval-hexagon-gameboard/commands';
import {
  GAMEBOARD_LAYOUT_ARCHETYPES,
  analyzeGameboardLayoutFill,
  appendGameboardLayoutPlacementsToPlan,
  createGameboardLayoutArchetypeRegistry,
  createGameboardLayoutPlacements,
  inspectGameboardLayoutSites,
  spawnGameboardLayoutPlacements,
} from 'medieval-hexagon-gameboard/layout';
import { freeManifest } from 'medieval-hexagon-gameboard/manifest/free';
import { inspectMedievalHexagonManifest } from 'medieval-hexagon-gameboard/manifest/schema';
import {
  createGameboardNavigation,
  planGameboardSpawnGroups,
} from 'medieval-hexagon-gameboard/navigation';
import { gameboardPlacementFootprintKeys } from 'medieval-hexagon-gameboard/occupancy';
import {
  createGameboardLayoutPlacementsFromPiece,
  createGameboardLayoutPlacementOptionsFromPiece,
  createGameboardPieceRegistry,
  declareGameboardPiece,
  inspectGameboardPiecePlacement,
} from 'medieval-hexagon-gameboard/pieces';
import { inspectSeededGameboardPieceFills } from 'medieval-hexagon-gameboard/rules';
import {
  createGameboardRuntime,
  createGameboardRuntimeFromRecipe,
  createGameboardRuntimeFromScenario,
} from 'medieval-hexagon-gameboard/runtime';
import {
  GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS as GAMEBOARD_SCENARIO_SIMULATION_SUBPATH_STEP_ACTIONS,
} from 'medieval-hexagon-gameboard/simulation';
import {
  defaultSourceRoot,
  expectedModelCount,
  validateSourceRoot,
} from 'medieval-hexagon-gameboard/ingest';
import { validateGameboardPlan } from 'medieval-hexagon-gameboard/validation';
import { readGameboardActors as readGameboardActorsFromActors } from 'medieval-hexagon-gameboard/actors';
import {
  GAMEBOARD_SCHEMA_VERSION,
  createGameboardBuilder as createGameboardBuilderFromGameboard,
  summarizeGameboardPlan as summarizeGameboardPlanFromGameboard,
} from 'medieval-hexagon-gameboard/gameboard';
import {
  FACTION_BUILDING_KINDS,
  NATURE_ASSET_IDS,
  factionBuildingAssetId,
  flagAssetId,
  listKayKitGuideScenarioAssetRenderGroups as listKayKitGuideScenarioAssetRenderGroupsFromCatalog,
  listKayKitGuideScenarioAssetRenderRequests as listKayKitGuideScenarioAssetRenderRequestsFromCatalog,
  listKayKitGuideScenarioAssetUsagesForScenario as listKayKitGuideScenarioAssetUsagesForScenarioFromCatalog,
} from 'medieval-hexagon-gameboard/catalog';
import {
  findHexPath,
  hexKey as hexKeyFromCoordinates,
  parseHexKey,
} from 'medieval-hexagon-gameboard/coordinates';
import {
  analyzeExternalAssetCompatibility,
  externalAssetSpawnOptions,
  recommendExternalAssetFacing,
} from 'medieval-hexagon-gameboard/compatibility';
import {
  renderGameboardCoverageMarkdown as renderGameboardCoverageMarkdownFromCoverage,
  summarizeGameboardCoverage as summarizeGameboardCoverageFromCoverage,
} from 'medieval-hexagon-gameboard/coverage';
import { readGameboardPlacements as readGameboardPlacementsFromKoota } from 'medieval-hexagon-gameboard/koota';
import {
  GAMEBOARD_MOVEMENT_PROFILES,
  gameboardMovementActions as gameboardMovementActionsFromMovement,
} from 'medieval-hexagon-gameboard/movement';
import {
  createMedievalGameboardBlueprintPlan,
  inspectMedievalGameboardBlueprint,
} from 'medieval-hexagon-gameboard/blueprint';
import { gameboardPatrolActions as gameboardPatrolActionsFromPatrol } from 'medieval-hexagon-gameboard/patrol';
import {
  GAMEBOARD_QUEST_SCHEMA_VERSION,
  readGameboardQuests as readGameboardQuestsFromQuests,
} from 'medieval-hexagon-gameboard/quests';
import {
  projectWorldToGameboardPlan,
  readValidationGameboardPlanFromWorld,
} from 'medieval-hexagon-gameboard/projection';
import {
  GAMEBOARD_RECIPE_SCHEMA_VERSION,
  createGameboardRecipe as createGameboardRecipeFromRecipe,
} from 'medieval-hexagon-gameboard/recipe';
import { summarizeGameboardScenario as summarizeGameboardScenarioFromScenario } from 'medieval-hexagon-gameboard/scenario';
import {
  KAYKIT_HEX_WIDTH,
  createGameboardCoordinateSystem,
} from 'medieval-hexagon-gameboard/grid';
import { createGameboardInteropSnapshot as createGameboardInteropSnapshotFromInterop } from 'medieval-hexagon-gameboard/interop';
import {
  analyzeHexTileRegistry,
  createHexTileRegistry,
  createHexTileRegistryFromManifest,
  declareHexTile,
} from 'medieval-hexagon-gameboard/registry';
import {
  HEX_EDGE_COUNT,
  edgeMask,
  selectRoadVariant,
} from 'medieval-hexagon-gameboard/selectors';
import { runGameboardSystems as runGameboardSystemsFromSystems } from 'medieval-hexagon-gameboard/systems';
import {
  canStackAt,
  validateGameboardRules,
} from 'medieval-hexagon-gameboard/world-rules';
import {
  MEDIEVAL_HEXAGON_SCHEMA_VERSION,
  PACK_EDITIONS,
  TEXTURE_SETS,
} from 'medieval-hexagon-gameboard/types';
import {
  createGameboardPlacementAssetUrlResolver,
  transformForHex,
} from 'medieval-hexagon-gameboard/three';

const assetManifestModule = await import('medieval-hexagon-gameboard/assets/free/manifest.json', {
  with: { type: 'json' },
});
const scenarioModule = await import('./simple-rpg-scenario.json', {
  with: { type: 'json' },
});
const blueprintBoardModule = await import('medieval-hexagon-gameboard/examples/blueprint-board.json', {
  with: { type: 'json' },
});
const ruleTypesModule = await import('medieval-hexagon-gameboard/rule-types');
const manifestInspection = inspectMedievalHexagonManifest(assetManifestModule.default);
if (manifestInspection.errorCount !== 0 || manifestInspection.warningCount !== 0) {
  throw new Error(\`packed FREE manifest inspection failed: \${JSON.stringify(manifestInspection.issues)}\`);
}
const ingestRoot = defaultSourceRoot('free', process.cwd());
const ingestValidation = validateSourceRoot('/tmp/packed-consumer-missing-kaykit-source', 'free');
if (
  expectedModelCount('free') !== 221 ||
  !ingestRoot.endsWith('/references/KayKit_Medieval_Hexagon_Pack_1.0_FREE') ||
  ingestValidation.gltfCount !== 0 ||
  ingestValidation.expectedCount !== 221 ||
  ingestValidation.ok !== false
) {
  throw new Error(\`packed ingest subpath helpers failed: \${JSON.stringify({ ingestRoot, ingestValidation })}\`);
}
const plan = createSeededGameboardPlan({
  seed: 'packed-consumer-smoke',
  shape: { kind: 'rectangle', width: 4, height: 3 },
  layoutDensity: { harbors: { count: 1 }, trees: 0.1, props: 0.05 },
});
const planSummary = summarizeGameboardPlan(plan);
const blueprintInspection = inspectMedievalGameboardBlueprint({
  seed: 'packed-consumer-blueprint-runtime',
  shape: { kind: 'rectangle', width: 6, height: 4 },
  waterFill: 0.16,
  maxElevation: 2,
  towns: 1,
  harbors: 1,
  biomeFills: [{ textureSet: 'fall', fill: 0.18, center: { q: 2, r: 2 }, radius: 2 }],
});
const blueprintPlan = createMedievalGameboardBlueprintPlan({
  seed: 'packed-consumer-blueprint-plan-runtime',
  shape: { kind: 'hexagon', radius: 2 },
  towns: 1,
});
const densityHarbors = plan.placements.filter((placement) => placement.metadata.densityPreset === 'harbors');
if (densityHarbors.length !== 1 || densityHarbors[0]?.metadata.layoutArchetype !== 'harbor') {
  throw new Error('packed seeded density harbors did not generate one harbor placement');
}
const errors = validateGameboardPlan(plan).filter((violation) => violation.severity === 'error');
if (errors.length > 0) {
  throw new Error(\`packed consumer plan had validation errors: \${JSON.stringify(errors)}\`);
}
const navigation = createGameboardNavigation(plan, {
  blockedTerrain: ['water'],
  blockingPlacementKinds: ['structure', 'unit'],
});
if (!navigation.canEnter('0,0')) {
  throw new Error('packed consumer navigation could not enter origin tile');
}
const subpathWorld = createGameboardWorld(plan);
const subpathProjectedPlan = projectWorldToGameboardPlan(subpathWorld);
const subpathPlanSummary = summarizeGameboardPlanFromGameboard(subpathProjectedPlan);
const packagedScenarioSummary = summarizeGameboardScenario(scenarioModule.default);
const packagedScenarioSummaryFromScenario =
  summarizeGameboardScenarioFromScenario(scenarioModule.default);
const packagedCoverageSummary = summarizeGameboardCoverage();
const packagedCoverageSummaryFromCoverage = summarizeGameboardCoverageFromCoverage();
const packagedCoverageMarkdown = renderGameboardCoverageMarkdownFromCoverage(packagedCoverageSummaryFromCoverage);
if (
  packagedCoverageSummary.guide.pageCount !== 19 ||
  packagedCoverageSummary.manifest.freeGuideAssetsInManifest !== 221 ||
  packagedCoverageSummaryFromCoverage.publicApi.length !== 74 ||
  !packagedCoverageMarkdown.includes('Release Readiness Coverage')
) {
  throw new Error('packed coverage report did not expose guide, manifest, public API, and markdown data');
}
// PRD R4: SimpleRPG guide-public-api exercise matrix is no longer
// reachable from the published surface. The installed CLI \`coverage\`
// command above already asserts the matrix via the bundled cli.js.
const subpathValidationPlan = readValidationGameboardPlanFromWorld(subpathWorld);
const subpathInteropSnapshot = createGameboardInteropSnapshotFromInterop(plan);
const subpathCoordinateSystem = createGameboardCoordinateSystem();
const subpathSpawnLocations = subpathCoordinateSystem.spawnLocations({
  shape: { kind: 'rectangle', width: 2, height: 1 },
  count: 1,
  seed: 'packed-consumer-subpath-spawns',
});
const subpathDeclaredHexTile = declareHexTile({
  id: 'packed-consumer-subpath-grass',
  assetId: 'hex_grass',
  role: 'base',
  terrain: 'grass',
});
const subpathTileRegistry = createHexTileRegistry([
  { id: 'packed-consumer-subpath-grass', assetId: 'hex_grass', role: 'base', terrain: 'grass' },
]);
const subpathManifestTileRegistry = createHexTileRegistryFromManifest(assetManifestModule.default);
const subpathRegistryAnalysis = analyzeHexTileRegistry(subpathTileRegistry);
const subpathCompatibilityReport = analyzeExternalAssetCompatibility({
  id: 'packed-consumer-kenney-square-tower',
  sourcePack: 'Packed Consumer Fixtures',
  bounds: { min: [-0.5, 0, -0.5], max: [0.5, 2, 0.5], size: [1, 2, 1] },
  intendedRole: 'tile',
  hasRig: false,
});
const subpathCompatibilitySpawn = externalAssetSpawnOptions({
  at: '0,0',
  assetId: 'packed-consumer-kenney-square-tower',
  report: subpathCompatibilityReport,
  sourceUrl: '/fixtures/kenney-square-tower.glb',
});
const subpathFacing = recommendExternalAssetFacing({ modelForward: '+z', boardForwardEdge: 1 });
const subpathPlacementUrlResolver = createGameboardPlacementAssetUrlResolver({
  catalog: assetManifestModule.default,
  baseUrl: 'https://example.test/pkg/',
});
const subpathPlacementUrl = subpathPlacementUrlResolver(plan.placements[0]);
const subpathHexKey = hexKeyFromCoordinates({ q: 1, r: 0 });
const subpathParsedHex = parseHexKey(subpathHexKey);
const subpathPath = findHexPath({ q: 0, r: 0 }, { q: 1, r: 0 });
const subpathTransform = transformForHex(subpathParsedHex);
const guideUsagePages16To18 = listKayKitGuideScenarioAssetUsages({ pages: [16, 17, 18] });
const guideUsageFreeAssets = listKayKitGuideScenarioAssetUsages({ minimumEdition: 'free' });
const guideRenderRequestsPages16To18 = listKayKitGuideScenarioAssetRenderRequests({
  pages: [16, 17, 18],
  assetBaseUrl: '/assets/extra',
});
const guideRenderGroupsPages16To18 = listKayKitGuideScenarioAssetRenderGroups({ pages: [16, 17, 18] });
const guideRenderRequestsFreeFromCatalog =
  listKayKitGuideScenarioAssetRenderRequestsFromCatalog({ minimumEdition: 'free' });
const guideRenderGroupsFromCatalog = listKayKitGuideScenarioAssetRenderGroupsFromCatalog({
  pages: [16, 17, 18],
});
const guideUsageRoadsFromCatalog =
  listKayKitGuideScenarioAssetUsagesForScenarioFromCatalog('page-03-road-variations');
const subpathSystemsResult = runGameboardSystemsFromSystems(subpathWorld, {
  movement: false,
  patrols: false,
  quests: false,
});
const subpathRuleErrors = validateGameboardRules(subpathWorld).filter((violation) => violation.severity === 'error');
if (
  typeof ruleTypesModule !== 'object' ||
  GAMEBOARD_SCHEMA_VERSION !== '1.0.0' ||
  GAMEBOARD_QUEST_SCHEMA_VERSION !== '1.0.0' ||
  GAMEBOARD_RECIPE_SCHEMA_VERSION !== '1.0.0' ||
  MEDIEVAL_HEXAGON_SCHEMA_VERSION !== '1.0.0' ||
  !PACK_EDITIONS.includes('free') ||
  !TEXTURE_SETS.includes('winter') ||
  createGameboardBuilderFromGameboard({ seed: 'packed-consumer-gameboard-subpath', shape: { kind: 'rectangle', width: 1, height: 1 } }).build().schemaVersion !== GAMEBOARD_SCHEMA_VERSION ||
  createGameboardRecipeFromRecipe(
    { seed: 'packed-consumer-recipe-subpath', shape: { kind: 'rectangle', width: 1, height: 1 } },
    []
  ).schemaVersion !== GAMEBOARD_RECIPE_SCHEMA_VERSION ||
  blueprintInspection.plan.tiles.length === 0 ||
  blueprintInspection.counts.townBuildings < 1 ||
  blueprintInspection.counts.harbors < 1 ||
  blueprintPlan.placements.length < 1 ||
  FACTION_BUILDING_KINDS.length < 1 ||
  factionBuildingAssetId(FACTION_BUILDING_KINDS[0], 'blue') !== 'building_archeryrange_blue' ||
  flagAssetId('green') !== 'flag_green' ||
  NATURE_ASSET_IDS.length < 1 ||
  subpathHexKey !== '1,0' ||
  subpathParsedHex.q !== 1 ||
  !subpathPath.found ||
  readGameboardActorsFromActors(subpathWorld).length !== 0 ||
  readGameboardPlacementsFromKoota(subpathWorld).length !== plan.placements.length ||
  planSummary.tileCount !== plan.tiles.length ||
  subpathPlanSummary.placementCount !== subpathProjectedPlan.placements.length ||
  packagedScenarioSummary.actorCount < 1 ||
  packagedScenarioSummaryFromScenario.questCount < 1 ||
  GAMEBOARD_MOVEMENT_PROFILES.ground.id !== 'ground' ||
  typeof gameboardMovementActionsFromMovement(subpathWorld).runSystem !== 'function' ||
  gameboardPatrolActionsFromPatrol(subpathWorld).read().length !== 0 ||
  readGameboardQuestsFromQuests(subpathWorld).length !== 0 ||
  subpathProjectedPlan.tiles.length !== plan.tiles.length ||
  subpathValidationPlan.placements.length !== plan.placements.length ||
  subpathCoordinateSystem.toWorld({ q: 1, r: 0 }).x !== KAYKIT_HEX_WIDTH ||
  subpathSpawnLocations[0]?.key !== '0,0' ||
  subpathDeclaredHexTile.assetId !== 'hex_grass' ||
  subpathInteropSnapshot.entities.length < plan.tiles.length ||
  subpathRegistryAnalysis.tileCount !== 1 ||
  subpathManifestTileRegistry.declarations.length < 1 ||
  subpathCompatibilityReport.suggestedRole !== 'prop' ||
  subpathCompatibilityReport.warnings.length < 1 ||
  subpathCompatibilitySpawn.requiresExtra !== true ||
  subpathCompatibilitySpawn.kind !== 'prop' ||
  subpathFacing.rotationSteps !== 1 ||
  HEX_EDGE_COUNT !== 6 ||
  edgeMask([0, 3]) <= 0 ||
  selectRoadVariant([0, 3]).assetId !== 'hex_road_A' ||
  guideUsagePages16To18.length !== 462 ||
  guideUsageFreeAssets.length !== 474 ||
  guideUsageFreeAssets[0]?.label.startsWith('p') !== true ||
  guideRenderRequestsPages16To18.length !== 462 ||
  !guideRenderRequestsPages16To18[0]?.url?.startsWith('/assets/extra/') ||
  guideRenderGroupsPages16To18.length !== 3 ||
  guideRenderGroupsPages16To18[0]?.count !== 155 ||
  guideRenderRequestsFreeFromCatalog.length !== 474 ||
  guideRenderGroupsFromCatalog.length !== 3 ||
  guideUsageRoadsFromCatalog.length !== 15 ||
  guideUsageRoadsFromCatalog[0]?.caption !== 'page-03-road-variations free' ||
  subpathSystemsResult.eventRecords.length !== 0 ||
  subpathRuleErrors.length !== 0 ||
  typeof canStackAt(subpathWorld, '0,0', 0) !== 'boolean' ||
  !subpathPlacementUrl?.includes('https://example.test/pkg/assets/free/') ||
  subpathTransform.position.x !== KAYKIT_HEX_WIDTH
) {
  throw new Error('packed public subpath imports failed');
}
const runtimePlan = createGameboardBuilder({
  seed: 'packed-consumer-runtime',
  shape: { kind: 'rectangle', width: 2, height: 1 },
}).build();
const runtime = createGameboardRuntime(runtimePlan);
const runtimeActor = runtime.spawnActor({
  id: 'packed-runtime-player-placement',
  actorId: 'packed-runtime-player',
  actorKind: 'player',
  at: '0,0',
  assetId: 'flag_blue',
  kind: 'unit',
});
runtime.movement.setAgent(runtimeActor, { profile: 'ground', movementBudget: 2 });
const runtimeDispatch = runtime.dispatchCommand('1,0', { sourceActor: 'packed-runtime-player' });
if (runtimeDispatch.execution.status !== 'requested-move') {
  throw new Error(\`packed runtime command did not request movement: \${JSON.stringify(runtimeDispatch.eventRecords)}\`);
}
runtime.tick({ patrols: false, movement: { steps: 10 }, quests: false });
const runtimeSnapshot = runtime.snapshot({ includeValidationPlan: true, includeInterop: false });
if (
  runtimeSnapshot.actors.find((actor) => actor.actor.actorId === 'packed-runtime-player')?.placement.tileKey !== '1,0' ||
  !runtimeSnapshot.validationPlan?.placements.some((placement) => placement.id === 'packed-runtime-player-placement')
) {
  throw new Error('packed runtime facade did not move and snapshot the runtime actor');
}
const runtimeMarker = runtime.spawnPlacement({
  id: 'packed-runtime-marker',
  at: '0,0',
  assetId: 'flag_green',
  kind: 'prop',
});
runtime.updatePlacement(runtimeMarker, { scale: 1.25, metadata: { marker: 'packed' } });
runtime.registerActor(runtimeMarker, {
  actorId: 'packed-runtime-guide',
  actorKind: 'npc',
  interactive: true,
});
runtime.updateActor('packed-runtime-guide', {
  tags: ['guide'],
  actorMetadata: { greeting: 'hello' },
});
const runtimeQuestEntity = runtime.spawnQuest({
  id: 'packed-runtime-quest',
  objectives: [{ id: 'meet-guide', kind: 'reach-tile', actor: 'packed-runtime-guide', tile: '0,0' }],
});
const runtimeQuestBefore = runtime.findQuest(runtimeQuestEntity);
const runtimeQuestAfter = runtime.advanceQuest('packed-runtime-quest');
const runtimePlacementOccupancy = runtime.inspectPlacementOccupancy({ at: '1,0', kind: 'unit' });
if (
  runtime.readPlacements().find((placement) => placement.id === 'packed-runtime-marker')?.scale !== 1.25 ||
  runtime.findActor('packed-runtime-guide')?.actor.metadata.greeting !== 'hello' ||
  !runtime.readActors().some((actor) => actor.actor.actorId === 'packed-runtime-guide') ||
  !runtime.readActorsForTile('0,0').some((actor) => actor.actor.actorId === 'packed-runtime-guide') ||
  runtimeQuestBefore?.quest.status !== 'active' ||
  runtimeQuestAfter.quest.status !== 'completed' ||
  runtime.readQuests().find((quest) => quest.quest.questId === 'packed-runtime-quest')?.quest.status !== 'completed' ||
  runtime.canOccupyPlacement({ at: '1,0', kind: 'unit' }) !== false ||
  runtimePlacementOccupancy.canOccupy !== false ||
  !runtime.readPlacementOccupancy().some((record) => record.placement.id === 'packed-runtime-player-placement') ||
  !runtime.readPlacementsForTile('1,0').some((placement) => placement.id === 'packed-runtime-player-placement') ||
  !runtime
    .readPlacementOccupancyForTile('1,0')
    .some((record) => record.placement.id === 'packed-runtime-player-placement')
) {
  throw new Error('packed runtime direct mutation/read helpers failed');
}
if (!runtime.removePlacement('packed-runtime-marker') || runtime.removePlacement('packed-runtime-marker')) {
  throw new Error('packed runtime removePlacement helper failed');
}
const runtimeTileInspection = runtime.inspectTile('1,0', { sourceActor: 'packed-runtime-player' });
const rootRuntimeTileInspection = inspectGameboardTile(runtime.world, '1,0', { sourceActor: 'packed-runtime-player' });
const runtimeNeighborhoodInspection = runtime.inspectNeighborhood('packed-runtime-player', {
  radius: 1,
  sourceActor: 'packed-runtime-player',
});
const rootRuntimeNeighborhoodInspection = inspectGameboardNeighborhood(runtime.world, 'packed-runtime-player', {
  radius: 1,
  sourceActor: 'packed-runtime-player',
});
const runtimeActorSelection = runtime.selectActors({
  sourceActor: 'packed-runtime-player',
  radius: 1,
});
const rootRuntimeActorSelection = selectGameboardActors(runtime.world, {
  sourceActor: 'packed-runtime-player',
  radius: 1,
});
const runtimeActorTargets = runtime.inspectActorTargets({
  sourceActor: 'packed-runtime-player',
  includeSource: true,
});
const rootRuntimeActorTargets = inspectGameboardActorTargets(runtime.world, {
  sourceActor: 'packed-runtime-player',
  includeSource: true,
});
if (
  !runtimeTileInspection.exists ||
  runtimeTileInspection.actors[0]?.actor.actorId !== 'packed-runtime-player' ||
  rootRuntimeTileInspection.tileKey !== runtimeTileInspection.tileKey ||
  runtimeNeighborhoodInspection.centerKey !== '1,0' ||
  rootRuntimeNeighborhoodInspection.actors[0]?.actor.actorId !== 'packed-runtime-player' ||
  runtimeActorSelection.actorIds[0] !== 'packed-runtime-player' ||
  rootRuntimeActorSelection.actorIds[0] !== 'packed-runtime-player' ||
  runtimeActorSelection.records[0]?.tileKey !== '1,0' ||
  rootRuntimeActorSelection.recordsByTileKey['1,0']?.[0]?.actorId !== 'packed-runtime-player' ||
  runtimeActorTargets.nearestTarget?.approach !== 'self' ||
  rootRuntimeActorTargets.nearestTarget?.record.actorId !== 'packed-runtime-player'
) {
  throw new Error('packed runtime tile/neighborhood/actor selection/targeting facade did not expose live actor contents');
}
runtime.spawnActor({
  id: 'packed-runtime-raider-placement',
  actorId: 'packed-runtime-raider',
  actorKind: 'enemy',
  team: 'red',
  hostile: true,
  at: '0,0',
  assetId: 'flag_red',
  kind: 'unit',
});
const rootRuntimeActorTargetCommand = planGameboardActorTargetCommand(runtime.world, {
  sourceActor: 'packed-runtime-player',
  hostileToSource: true,
  targetActorId: 'packed-runtime-raider',
  maxPathCost: 1,
});
const runtimeActorTargetCommand = runtime.planActorTargetCommand({
  sourceActor: 'packed-runtime-player',
  hostileToSource: true,
  targetActorId: 'packed-runtime-raider',
  maxPathCost: 1,
});
const rootRuntimeActorTargetDispatch = dispatchGameboardActorTargetCommand(runtime.world, {
  sourceActor: 'packed-runtime-player',
  hostileToSource: true,
  targetActorId: 'packed-runtime-raider',
  maxPathCost: 1,
});
const runtimeActorTargetInteraction = runGameboardActorTargetInteraction(
  runtime.world,
  {
    sourceActor: 'packed-runtime-player',
    hostileToSource: true,
    targetActorId: 'packed-runtime-raider',
    maxPathCost: 1,
  },
  { systems: false }
);
const runtimeActorTargetDispatch = runtime.dispatchActorTargetCommand({
  sourceActor: 'packed-runtime-player',
  hostileToSource: true,
  targetActorId: 'packed-runtime-raider',
  maxPathCost: 1,
});
const runtimeActorTargetRuntimeInteraction = runtime.interactActorTarget(
  {
    sourceActor: 'packed-runtime-player',
    hostileToSource: true,
    targetActorId: 'packed-runtime-raider',
    maxPathCost: 1,
  },
  { systems: false }
);
if (
  !rootRuntimeActorTargetCommand.canExecute ||
  !runtimeActorTargetCommand.canExecute ||
  !rootRuntimeActorTargetDispatch.targetCommand.canExecute ||
  !runtimeActorTargetInteraction.targetCommand.canExecute ||
  !runtimeActorTargetDispatch.targetCommand.canExecute ||
  !runtimeActorTargetRuntimeInteraction.targetCommand.canExecute ||
  rootRuntimeActorTargetDispatch.dispatch?.events[0]?.type !== 'command-handler-required' ||
  runtimeActorTargetInteraction.events[0]?.type !== 'command-handler-required' ||
  runtimeActorTargetCommand.command?.kind !== 'attack-actor' ||
  runtimeActorTargetCommand.target?.actor.actor.actorId !== 'packed-runtime-raider'
) {
  throw new Error('packed runtime actor-target command planner/dispatcher did not expose a reachable attack command');
}
const runtimeInteropSnapshot = runtime.createInteropSnapshot();
const runtimeActorPlacementRelations = selectGameboardInteropRelations(runtimeInteropSnapshot, {
  name: 'ActorPlacement',
  fromId: 'actor:packed-runtime-player',
});
const runtimeMountedEcs = createInMemoryGameboardEcs();
const runtimeMounted = runtime.mountInterop(runtimeMountedEcs.adapter);
if (
  !runtimeInteropSnapshot.entities.some((entity) => entity.id === 'actor:packed-runtime-player') ||
  runtimeActorPlacementRelations[0]?.toId !== 'placement:packed-runtime-player-placement' ||
  runtimeMounted.missingRelations.length !== 0 ||
  runtimeMountedEcs.entities.get('actor:packed-runtime-player')?.components.get('GameboardActorState')?.placement.tileKey !== '1,0'
) {
  throw new Error('packed runtime interop facade did not expose live actors for external ECS mounting');
}
const packagedScenarioRuntime = createGameboardRuntimeFromScenario(scenarioModule.default);
const packagedScenarioRuntimeSummary = packagedScenarioRuntime.summarizeScenario();
if (
  !packagedScenarioRuntime.actorEntities.player ||
  packagedScenarioRuntime.snapshot({ includeInterop: false }).actors.length < 1 ||
  packagedScenarioRuntimeSummary.actorCount < 1 ||
  packagedScenarioRuntimeSummary.questCount < 1
) {
  throw new Error('packed scenario runtime facade did not expose actor indexes');
}
const packagedScenarioInterop = packagedScenarioRuntime.createScenarioInteropSnapshot();
const packagedScenarioEcs = createInMemoryGameboardEcs();
const packagedScenarioMounted = packagedScenarioRuntime.mountScenarioInterop(packagedScenarioEcs.adapter);
if (
  !packagedScenarioInterop.entities.some((entity) => entity.id === 'actor:player') ||
  packagedScenarioMounted.missingRelations.length !== 0 ||
  !packagedScenarioEcs.entities.has('actor:player')
) {
  throw new Error('packed scenario runtime facade did not expose scenario interop for external ECS mounting');
}
const packedRecipeRuntimeRecipe = createGameboardRecipe(
  { seed: 'packed-consumer-recipe-runtime-smoke', shape: { kind: 'rectangle', width: 3, height: 2 } },
  [],
  {
    pieceDeclarations: [
      {
        id: 'packed-runtime-recipe-tree',
        assetId: 'tree_single_A',
        source: 'Packed Runtime Recipe Fixtures',
        role: 'tree',
        metadata: { sourceRelativePath: 'trees/runtime-recipe-tree.gltf' },
      },
    ],
    pieceFills: [{ selection: { ids: ['packed-runtime-recipe-tree'] }, count: 1 }],
  }
);
const packedRecipeRuntime = createGameboardRuntimeFromRecipe(packedRecipeRuntimeRecipe);
if (
  packedRecipeRuntime.recipePieceRegistry?.pieces.length !== 1 ||
  packedRecipeRuntime.snapshot({ includeInterop: false }).plan.placements.filter(
    (placement) => placement.metadata.pieceId === 'packed-runtime-recipe-tree'
  ).length !== 1 ||
  packedRecipeRuntime.createRecipePieceSourceUrlMap({
    sourceRoots: { 'Packed Runtime Recipe Fixtures': '/packed-runtime-recipe-fixtures' },
  }).tree_single_A !== '/packed-runtime-recipe-fixtures/trees/runtime-recipe-tree.gltf'
) {
  throw new Error('packed recipe runtime facade did not expose generated pieces and source URLs');
}
const runtimeTreePiece = declareGameboardPiece({
  id: 'packed-runtime-tree',
  assetId: 'tree_single_A',
  source: 'Packed Consumer Fixtures',
  role: 'tree',
});
const runtimePieceInspection = runtime.inspectPiecePlacement(runtimeTreePiece, {
  count: 1,
  seed: 'packed-consumer-runtime-piece-inspection',
});
const runtimePiecePlacements = runtime.createPiecePlacements(runtimeTreePiece, {
  count: 1,
  seed: 'packed-consumer-runtime-piece-create',
});
const runtimePieceEntities = runtime.spawnPiece(runtimeTreePiece, {
  count: 1,
  seed: 'packed-consumer-runtime-piece-spawn',
});
const runtimeLayoutEntities = runtime.spawnLayoutFill({
  seed: 'packed-consumer-runtime-layout-fill',
  rules: [{ id: 'runtime-crates', archetype: 'scatter', assetId: 'crate_A_small', count: 1 }],
});
if (
  runtimePieceInspection.siteInspection.selectedCount !== 1 ||
  runtimePiecePlacements.length !== 1 ||
  runtimePieceEntities.length !== 1 ||
  runtimeLayoutEntities.length !== 1
) {
  throw new Error('packed runtime piece/layout facade failed');
}
const runtimeRegistryRuntime = createGameboardRuntime(
  createGameboardBuilder({
    seed: 'packed-consumer-runtime-registry',
    shape: { kind: 'rectangle', width: 4, height: 2 },
  }).build()
);
const runtimePieceRegistry = createGameboardPieceRegistry([
  runtimeTreePiece,
  {
    id: 'packed-runtime-tree-b',
    assetId: 'tree_single_B',
    source: 'Packed Consumer Fixtures',
    role: 'tree',
    tags: ['nature'],
  },
  {
    id: 'packed-runtime-crate',
    assetId: 'crate_A_small',
    source: 'Packed Consumer Fixtures',
    role: 'scatter',
    tags: ['camp'],
    metadata: { sourceRelativePath: 'props/crate.gltf' },
  },
]);
const runtimeRegistryAnalysis = runtimeRegistryRuntime.analyzePieceRegistry(runtimePieceRegistry, {
  checks: [{ id: 'packed-runtime-nature-pool', mode: 'pool', selection: { roles: ['tree'] } }],
});
const runtimeSelectedTrees = runtimeRegistryRuntime.selectPieces(runtimePieceRegistry, { roles: ['tree'] });
const runtimeCampRules = runtimeRegistryRuntime.createPieceFillRules(runtimePieceRegistry, {
  selection: { tags: ['camp'] },
  count: 1,
});
const runtimeNaturePoolRule = runtimeRegistryRuntime.createPiecePoolFillRule(runtimeSelectedTrees, {
  id: 'packed-runtime-nature-pool',
  count: 2,
});
const runtimeRegistryFills = [
  { id: 'packed-runtime-nature-pool', mode: 'pool', selection: { roles: ['tree'] }, count: 2 },
  { ruleIdPrefix: 'packed-runtime-camp', selection: { tags: ['camp'] }, count: 1 },
];
const runtimeRegistryFillAnalysis = runtimeRegistryRuntime.analyzePieceFills(runtimePieceRegistry, runtimeRegistryFills, {
  seed: 'packed-consumer-runtime-registry-fills',
});
const runtimeRegistryFillInspection = runtimeRegistryRuntime.inspectPieceFills(runtimePieceRegistry, runtimeRegistryFills, {
  seed: 'packed-consumer-runtime-registry-fills',
});
const runtimeRegistryFillEntities = runtimeRegistryRuntime.spawnPieceFills(runtimePieceRegistry, runtimeRegistryFills, {
  seed: 'packed-consumer-runtime-registry-fills',
});
const runtimeRegistrySourceUrls = runtimeRegistryRuntime.createPieceSourceUrlMap(runtimePieceRegistry, {
  sourceRoots: { 'Packed Consumer Fixtures': '/packed-consumer-fixtures' },
});
if (
  runtimeRegistryAnalysis.errors.length !== 0 ||
  runtimeSelectedTrees.length !== 2 ||
  runtimeCampRules.length !== 1 ||
  runtimeNaturePoolRule.assets?.length !== 2 ||
  runtimeRegistryFillAnalysis.placementCount !== 3 ||
  runtimeRegistryFillInspection.placements.length !== 3 ||
  runtimeRegistryFillEntities.length !== 3 ||
  runtimeRegistrySourceUrls.crate_A_small !== '/packed-consumer-fixtures/props/crate.gltf'
) {
  throw new Error('packed runtime registry facade failed');
}
const fillAnalysis = analyzeGameboardLayoutFill(plan, {
  seed: 'packed-consumer-layout-analysis',
  rules: [{ id: 'trees', archetype: 'tree', assetId: 'tree_single_A', count: 1 }],
});
if (fillAnalysis.errorCount !== 0 || fillAnalysis.placementCount !== 1) {
  throw new Error(\`packed layout analysis failed: \${JSON.stringify(fillAnalysis)}\`);
}
const siteInspection = inspectGameboardLayoutSites(plan, {
  count: 1,
  seed: 'packed-consumer-site-inspection',
  criteria: { allowOccupied: false },
});
if (siteInspection.selectedCount !== 1 || siteInspection.candidateCount < 1) {
  throw new Error(\`packed layout site inspection failed: \${JSON.stringify(siteInspection)}\`);
}
const harborBuilder = createGameboardBuilder({
  seed: 'packed-consumer-harbor',
  shape: { kind: 'rectangle', width: 3, height: 3 },
});
for (let q = 0; q < 3; q += 1) {
  harborBuilder.setTerrain({ q, r: 2 }, 'water');
  harborBuilder.setCoastEdges({ q, r: 1 }, [1]);
}
const harborPlan = harborBuilder.build();
const footprintBase = harborPlan.placements[0];
if (!footprintBase) {
  throw new Error('packed consumer fixture did not produce base placements');
}
const spawnGroupPlan = planGameboardSpawnGroups(harborPlan, {
  seed: 'packed-consumer-spawn-groups',
  groups: [
    { id: 'player', count: 1, terrain: 'grass' },
    { id: 'enemy', count: 1, terrain: 'grass', minDistanceFromGroups: 1, pathToGroups: ['player'] },
  ],
});
if (spawnGroupPlan.errors.length > 0 || spawnGroupPlan.routeChecks[0]?.found !== true) {
  throw new Error('packed spawn group planner failed: ' + JSON.stringify(spawnGroupPlan));
}
harborPlan.placements.push({
  ...footprintBase,
  id: 'packed-consumer-footprint',
  tileKey: '0,0',
  coordinates: { q: 0, r: 0 },
  assetId: 'external:gatehouse',
  kind: 'prop',
  layer: 'feature',
  requiresExtra: true,
  metadata: {
    layoutBlocksMovement: true,
    layoutFootprintTiles: '0,0|1,0',
    layoutOccupancyGroup: 'packed-gatehouse',
  },
});
const harborPlacements = createGameboardLayoutPlacements(harborPlan, {
  archetype: 'harbor',
  assetId: 'building_docks_blue',
  count: 1,
  seed: 'packed-consumer-harbor',
  requiresExtra: true,
});
const packedCustomArchetypes = createGameboardLayoutArchetypeRegistry({
  'packed-camp-supply': {
    id: 'packed-camp-supply',
    label: 'Packed Camp Supply',
    kind: 'prop',
    layer: 'feature',
    criteria: { terrain: ['grass', 'road'], allowOccupied: true, maxPerTile: 2 },
  },
});
const packedCustomRecipe = createGameboardRecipe(
  { seed: 'packed-custom-archetype', shape: { kind: 'rectangle', width: 1, height: 1 } },
  [],
  { layoutArchetypes: packedCustomArchetypes }
);
const packedCustomRecipeArchetypes = createGameboardLayoutArchetypeRegistryFromRecipe(packedCustomRecipe);
if (GAMEBOARD_LAYOUT_ARCHETYPES.harbor.criteria.requiredAdjacentTerrain !== 'water' || harborPlacements.length !== 1) {
  throw new Error('packed harbor archetype did not select a coast tile with adjacent water');
}
if (packedCustomRecipeArchetypes?.['packed-camp-supply']?.kind !== 'prop') {
  throw new Error('packed custom recipe archetype registry failed');
}
const shipyardPiece = declareGameboardPiece({
  id: 'packed-local-shipyard',
  assetId: 'packed-local:shipyard',
  source: 'Packed Consumer Fixtures',
  role: 'harbor',
  metadata: { fixture: true },
});
const shipyardInspection = inspectGameboardPiecePlacement(harborPlan, shipyardPiece, {
  count: 1,
  seed: 'packed-consumer-shipyard-piece',
  idPrefix: 'packed-shipyard',
});
const shipyardOptions = createGameboardLayoutPlacementOptionsFromPiece(shipyardPiece, {
  count: 1,
  seed: 'packed-consumer-shipyard-piece',
  idPrefix: 'packed-shipyard',
  occupancyGuard: true,
});
const shipyardPlacements = createGameboardLayoutPlacementsFromPiece(harborPlan, shipyardPiece, {
  count: 1,
  seed: 'packed-consumer-shipyard-piece',
  idPrefix: 'packed-shipyard',
  occupancyGuard: true,
});
const shipyardFillInspection = inspectSeededGameboardPieceFills(
  harborPlan,
  createGameboardPieceRegistry([shipyardPiece]),
  [{ selection: { ids: ['packed-local-shipyard'] }, count: 1 }],
  { seed: 'packed-consumer-shipyard-fill' }
);
if (
  shipyardInspection.siteInspection.selectedCount !== 1 ||
  shipyardPlacements.length !== 1 ||
  shipyardOptions.occupancyGuard !== true ||
  shipyardPlacements[0]?.occupancyGuard !== true ||
  shipyardPlacements[0]?.metadata?.pieceId !== 'packed-local-shipyard' ||
  shipyardPlacements[0]?.metadata?.pieceRole !== 'harbor' ||
  shipyardPlacements[0]?.requiresExtra !== true
) {
  throw new Error(\`packed piece placement helper failed: \${JSON.stringify(shipyardInspection)}\`);
}
if (
  shipyardFillInspection.errors.length !== 0 ||
  shipyardFillInspection.analysis.placementCount !== 1 ||
  shipyardFillInspection.placements[0]?.metadata?.pieceId !== 'packed-local-shipyard'
) {
  throw new Error(\`packed piece fill inspection failed: \${JSON.stringify(shipyardFillInspection)}\`);
}
const shipyardPlan = appendGameboardLayoutPlacementsToPlan(harborPlan, shipyardPlacements);
if (!shipyardPlan.placements.some((placement) => placement.id === 'packed-shipyard:0')) {
  throw new Error('packed layout append helper did not persist generated piece placement');
}
const footprintPlacement = harborPlan.placements.find((placement) => placement.id === 'packed-consumer-footprint');
if (!footprintPlacement) {
  throw new Error('packed consumer fixture did not produce footprint placement');
}
const footprint = gameboardPlacementFootprintKeys(footprintPlacement);
const interopSnapshot = createGameboardInteropSnapshot(harborPlan);
const interopIndex = createGameboardInteropSnapshotIndex(interopSnapshot);
const occupancyRelations = selectGameboardInteropRelations(interopIndex, {
  name: 'PlacementOccupiesTile',
  fromId: 'placement:packed-consumer-footprint',
});
const coveredTileRelations = selectGameboardInteropRelations(interopIndex, {
  name: 'PlacementOccupiesTile',
  toId: 'tile:1,0',
});
if (
  footprint.join('|') !== '0,0|1,0' ||
  occupancyRelations.length !== 2 ||
  !coveredTileRelations.some((relation) => relation.fromId === 'placement:packed-consumer-footprint') ||
  !interopIndex.entitiesById.has('tile:1,0')
) {
  throw new Error('packed occupancy helpers or interop occupancy relations did not include the full footprint');
}
const footprintWorld = createGameboardWorld(harborPlan);
const blockedFootprintInspection = inspectGameboardPlacementOccupancy(footprintWorld, {
  at: '1,0',
  kind: 'unit',
});
if (
  blockedFootprintInspection.canOccupy ||
  !blockedFootprintInspection.blockers.some((blocker) => blocker.placement.id === 'packed-consumer-footprint')
) {
  throw new Error('packed Koota placement occupancy preflight did not catch a blocking footprint');
}
let occupancyGuardBlocked = false;
try {
  spawnGameboardPlacement(footprintWorld, {
    id: 'blocked-packed-unit',
    at: '1,0',
    assetId: 'flag_red',
    kind: 'unit',
    occupancyGuard: true,
  });
} catch {
  occupancyGuardBlocked = true;
}
if (!occupancyGuardBlocked || findPlacementEntity(footprintWorld, 'blocked-packed-unit')) {
  throw new Error('packed Koota placement occupancy guard did not reject a blocking footprint');
}
const layoutGuardWorld = createGameboardWorld(
  createGameboardBuilder({
    seed: 'packed-consumer-layout-guard',
    shape: { kind: 'rectangle', width: 1, height: 1 },
  })
    .addFactionBuilding({ at: { q: 0, r: 0 }, faction: 'blue', building: 'market' })
    .build()
);
let layoutGuardBlocked = false;
try {
  spawnGameboardLayoutPlacements(layoutGuardWorld, {
    count: 1,
    seed: 'packed-consumer-layout-guard',
    idPrefix: 'packed-layout-guard',
    assetId: 'flag_blue',
    kind: 'unit',
    layer: 'unit',
    criteria: {
      terrain: 'grass',
      allowOccupied: true,
      blockingPlacementKinds: [],
    },
    occupancyGuard: true,
  });
} catch {
  layoutGuardBlocked = true;
}
if (!layoutGuardBlocked || findPlacementEntity(layoutGuardWorld, 'packed-layout-guard:0')) {
  throw new Error('packed layout occupancy guard did not reject a live-world blocker');
}
const guardedUnit = spawnGameboardPlacement(footprintWorld, {
  id: 'guarded-packed-unit',
  at: '1,0',
  assetId: 'flag_red',
  kind: 'unit',
  occupancyGuard: { ignorePlacementIds: ['packed-consumer-footprint'] },
});
if (guardedUnit.get(PlacementState)?.tileKey !== '1,0') {
  throw new Error('packed Koota placement occupancy guard did not honor ignored placement ids');
}
let actorGuardBlocked = false;
try {
  spawnGameboardActor(footprintWorld, {
    id: 'blocked-packed-actor',
    actorId: 'blocked-packed-actor',
    actorKind: 'enemy',
    at: '1,0',
    assetId: 'flag_red',
    kind: 'unit',
    occupancyGuard: true,
  });
} catch {
  actorGuardBlocked = true;
}
if (!actorGuardBlocked || findPlacementEntity(footprintWorld, 'blocked-packed-actor')) {
  throw new Error('packed actor spawn occupancy guard did not reject a blocking footprint');
}
const actorCenter = axialToWorld({ q: 2, r: 0 }, 0);
const offsetActor = spawnGameboardActor(footprintWorld, {
  id: 'offset-packed-actor',
  actorId: 'offset-packed-actor',
  actorKind: 'npc',
  at: '2,0',
  assetId: 'flag_green',
  kind: 'prop',
  positionOffset: { x: 0.2, z: -0.1 },
  occupancyGuard: true,
});
const offsetActorState = offsetActor.get(PlacementState);
if (
  !offsetActorState ||
  Math.abs(offsetActorState.position.x - (actorCenter.x + 0.2)) > 1e-9 ||
  Math.abs(offsetActorState.position.z - (actorCenter.z - 0.1)) > 1e-9
) {
  throw new Error('packed actor spawn did not preserve runtime placement offsets');
}
const movedActorCenter = axialToWorld({ q: 2, r: 1 }, 0);
const movedActor = moveGameboardActor(footprintWorld, 'offset-packed-actor', '2,1', {
  occupancyGuard: true,
});
const movedActorState = movedActor.get(PlacementState);
if (
  !movedActorState ||
  movedActorState.tileKey !== '2,1' ||
  Math.abs(movedActorState.position.x - (movedActorCenter.x + 0.2)) > 1e-9 ||
  Math.abs(movedActorState.position.z - (movedActorCenter.z - 0.1)) > 1e-9
) {
  throw new Error('packed actor move did not resolve actor ids or preserve offsets');
}
const coveredTile = findTileEntity(footprintWorld, '1,0');
const footprintEntity = findPlacementEntity(footprintWorld, 'packed-consumer-footprint');
const occupancyValue = coveredTile && footprintEntity ? footprintEntity.get(PlacementOccupiesTile(coveredTile)) : undefined;
if (!occupancyValue || occupancyValue.originTileKey !== '0,0' || occupancyValue.footprintIndex !== 1 || occupancyValue.blocksMovement !== true) {
  throw new Error('packed Koota PlacementOccupiesTile relation did not expose footprint occupancy metadata');
}
const occupancySnapshots = readPlacementOccupancyForTile(footprintWorld, '1,0');
const footprintSnapshot = occupancySnapshots.find((snapshot) => snapshot.placement.id === 'packed-consumer-footprint');
if (!footprintSnapshot || footprintSnapshot.footprintIndex !== 1) {
  throw new Error('packed Koota placement occupancy snapshot did not include the covered footprint tile');
}
// PRD R4: SimpleRPG usage example (\`runSimpleRpgUsageExample\`,
// \`summarizeSimpleRpgGuidePublicApiExercises\`,
// \`listSimpleRpgGuidePublicApiExercises\`) is a test driver, not a
// published surface. The installed CLI \`coverage\` / \`doctor --coverage\`
// commands above already assert SimpleRPG evidence end-to-end via the
// bundled \`dist/cli.js\`. The packed-consumer smoke only verifies the
// remaining (published) blueprint-board usage example.
const blueprintUsage = runBlueprintBoardUsageExample();
if (
  blueprintUsage.scenarioId !== 'docs-blueprint-board:intro' ||
  blueprintUsage.validationErrorCount !== 0 ||
  blueprintUsage.scenarioValidationErrorCount !== 0 ||
  blueprintUsage.spawnGroupIds.join('|') !== 'party|raiders' ||
  blueprintUsage.spawnLocationIds.length !== 3 ||
  blueprintUsage.successfulSpawnRouteCount !== 1 ||
  blueprintUsage.patrolRouteIds.join('|') !== 'raider-watch' ||
  blueprintUsage.completePatrolRouteCount !== 1 ||
  blueprintUsage.actorIds.length !== 3 ||
  blueprintUsage.questIds.length !== 1 ||
  blueprintUsage.worldActorCount !== 3 ||
  blueprintUsage.runtimeActorCount !== 3 ||
  blueprintUsage.interopActorCount !== 3 ||
  blueprintUsage.interopQuestCount !== 1 ||
  blueprintUsage.interopSpawnGroupCount !== 2 ||
  blueprintUsage.interopPatrolRouteCount !== 1
) {
  throw new Error(\`packed blueprint-board usage failed: \${JSON.stringify(blueprintUsage)}\`);
}
if (freeManifest.counts.total !== assetManifestModule.default.counts.total) {
  throw new Error('manifest/free export and assets/free JSON disagree');
}
if (scenarioModule.default.id !== 'docs-simple-rpg-scenario') {
  throw new Error('packaged JSON example export returned the wrong scenario');
}
if (blueprintBoardModule.default.scenarioId !== 'docs-blueprint-board:intro') {
  throw new Error('packaged blueprint JSON example export returned the wrong scenario');
}
const defaultRpgHandlers = createGameboardInteractionHandlerPreset('default-rpg');
const simulationActions = GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS;
const simulationSubpathActions = GAMEBOARD_SCENARIO_SIMULATION_SUBPATH_STEP_ACTIONS;
const simulationActorTargetCommandStep = {
  action: 'actor-target-command',
  sourceActor: 'packed-runtime-player',
  targetActorId: 'packed-runtime-player',
  requireReachable: true,
};
if (
  GAMEBOARD_INTERACTION_HANDLER_PRESETS.length !== 4 ||
  !isGameboardInteractionHandlerPreset('default-rpg') ||
  isGameboardInteractionHandlerPreset('missing-handler') ||
  defaultRpgHandlers.length !== 3
) {
  throw new Error('packed commands handler preset registry failed');
}
console.log(JSON.stringify({
  freeAssets: freeManifest.counts.total,
  commandHandlerPresets: GAMEBOARD_INTERACTION_HANDLER_PRESETS.length,
  defaultRpgHandlers: defaultRpgHandlers.length,
  harborArchetype: GAMEBOARD_LAYOUT_ARCHETYPES.harbor.id,
  customArchetype: packedCustomRecipeArchetypes?.['packed-camp-supply']?.id,
  blueprintTiles: blueprintInspection.plan.tiles.length,
  blueprintHarbors: blueprintInspection.counts.harbors,
  densityHarbors: densityHarbors.length,
  harborPlacements: harborPlacements.length,
  shipyardPieceCandidates: shipyardInspection.siteInspection.candidateCount,
  shipyardPiecePlacements: shipyardPlacements.length,
  shipyardFillPlacements: shipyardFillInspection.placements.length,
  shipyardPlanPlacements: shipyardPlan.placements.length,
  spawnGroupRoutes: spawnGroupPlan.routeChecks.length,
  footprintRelations: occupancyRelations.length,
  footprintRelationsForCoveredTile: coveredTileRelations.length,
  footprintPreflightBlockers: blockedFootprintInspection.blockers.length,
  footprintRelationIndex: occupancyValue.footprintIndex,
  footprintSnapshotCount: occupancySnapshots.length,
  footprintSnapshotIndex: footprintSnapshot.footprintIndex,
  layoutAnalysisPlacements: fillAnalysis.placementCount,
  layoutInspectionCandidates: siteInspection.candidateCount,
  layoutInspectionRejected: siteInspection.rejectedCount,
  manifestWarnings: manifestInspection.warningCount,
  planTiles: plan.tiles.length,
  scenarioExampleId: scenarioModule.default.id,
  blueprintUsageScenarioId: blueprintUsage.scenarioId,
  blueprintUsageActors: blueprintUsage.actorIds.length,
  blueprintUsageInteropActors: blueprintUsage.interopActorCount,
  simulationActionCount: simulationActions.length,
  simulationSubpathActionCount: simulationSubpathActions.length,
  simulationActorTargetCommandStepAction: simulationActorTargetCommandStep.action,
}, null, 2));
`,
    'utf8'
  );

  const smokeOutput = execFileSync(process.execPath, ['smoke.mjs'], {
    cwd: appRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const binOutput = execFileSync(
    join(appRoot, 'node_modules/.bin/medieval-hexagon-gameboard'),
    ['doctor', '--source', join(appRoot, 'missing-free')],
    {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const binCoverageDoctorOutput = execFileSync(
    join(appRoot, 'node_modules/.bin/medieval-hexagon-gameboard'),
    ['doctor', '--coverage', '--checksPassed'],
    {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  assert(
    smokeOutput.includes('"blueprintUsageScenarioId": "docs-blueprint-board:intro"'),
    'consumer smoke did not run blueprint usage example'
  );
  assert(
    smokeOutput.includes('"defaultRpgHandlers": 3'),
    'consumer smoke did not run command preset registry'
  );
  assert(
    binOutput.includes('source exists: no'),
    'installed CLI doctor did not report the missing source'
  );
  assert(
    binCoverageDoctorOutput.includes('guide pages: 19/19') &&
      binCoverageDoctorOutput.includes('public APIs: 74') &&
      binCoverageDoctorOutput.includes('manifest: 221 asset(s), 221/221 FREE guide asset(s)') &&
      binCoverageDoctorOutput.includes(
        'SimpleRPG API evidence: 74/74 represented, 40 directly executed, 9 active mode(s)'
      ),
    'installed CLI doctor --coverage did not emit release-readiness and SimpleRPG evidence'
  );

  console.log(
    keepTemp
      ? `packed consumer runtime smoke passed in ${appRoot}`
      : 'packed consumer runtime smoke passed'
  );
}
