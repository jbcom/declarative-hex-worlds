import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

interface TileRegistryAnalysisSmoke {
  analyzedCount: number;
  recommendedScale: number;
  tileCount: number;
  warnings: string[];
}

interface GuidePermutationSmoke {
  count: number;
  counts: Record<string, number>;
  missingAssetIds: string[];
}

interface GuideScenarioSmoke {
  count: number;
  pages: number[];
  assetScope: string;
  assetCounts: {
    total: number;
    selected: number;
    free: number;
    extra: number;
    occurrences: number;
    freeOccurrences: number;
    extraOccurrences: number;
    checked: number;
    missing: number;
  };
  coverage: {
    scenarioCount: number;
    pageCount: number;
    sourceImageCount: number;
    assetCounts: {
      unique: number;
      free: number;
      extra: number;
      occurrences: number;
      freeOccurrences: number;
      extraOccurrences: number;
    };
    scenariosByEdition: Record<string, number>;
    pages: Array<{
      page: number;
      scenarioId: string;
      assetOccurrences: number;
      uniqueAssets: number;
      freeAssets: number;
      extraAssets: number;
    }>;
  };
  sourceImages: string[];
  docs: string[];
  visualArtifacts: string[];
  missingAssetIds: string[];
  scenarioCoverage?: Array<{
    scenario: { id: string; page: number };
    assetCounts: { unique: number; extra: number; occurrences: number };
    treatments: Array<{ assetId: string; role: string }>;
  }>;
}

interface GuidePublicApiSmoke {
  count: number;
  publicApis: string[];
  coverage: Array<{
    publicApi: string;
    pages: number[];
    assetCounts: { unique: number; free: number; extra: number };
    treatmentRoles: string[];
  }>;
}

interface GuideAssetSmoke {
  count: number;
  assetIds: string[];
  coverage: Array<{
    assetId: string;
    role: string;
    pages: number[];
    publicApi: string[];
    occurrences: number;
  }>;
}

interface GuideRoleSmoke {
  count: number;
  roles: string[];
  coverage: Array<{
    role: string;
    pages: number[];
    assetCounts: { unique: number; free: number; extra: number };
    publicApi: string[];
  }>;
}

interface LayoutAnalysisSmoke {
  placementCount: number;
  warningCount: number;
  errorCount: number;
  rules: Array<{ id: string; candidateCount: number; selectedCount: number; warnings: string[] }>;
}

interface SimulationReportSmoke {
  success: boolean;
  scenarioId: string;
  expectationFailures: unknown[];
  completedQuestIds?: string[];
  eventRecords: Array<{ type: string }>;
  commands?: Array<{
    eventType: string;
    command: {
      kind: string;
      status: string;
      handlerId?: string;
      effectTypes?: string[];
    };
  }>;
  patrols?: Array<{ eventType: string; patrol: { actorId?: string; routeId: string } }>;
}

interface PatrolRouteSetSmoke {
  routeCount: number;
  errors: string[];
  routes: Array<{ id: string; found: boolean; segments: unknown[] }>;
}

interface PatrolScriptSmoke {
  schemaVersion: string;
  steps: Array<{ action: string; sourceActor: string; target: string }>;
}

interface CompatibilitySmoke {
  compatibleAsTile: boolean;
  suggestedRole: string;
  placement: {
    modelForward: string;
    boardForwardEdge: number;
    rotationSteps: number;
  };
  warnings: string[];
}

interface PieceDeclarationSmoke {
  declaration?: {
    id: string;
    assetId: string;
    role: string;
    requiresExtra: boolean;
    metadata: Record<string, unknown>;
  };
}

interface PieceRegistrySmoke {
  pieces: Array<{ id: string; role: string; metadata: Record<string, unknown> }>;
  summary: {
    assetCount: number;
    pieceRoles: Record<string, number>;
    warningCount: number;
  };
  reports?: Array<{ id: string; suggestedRole: string; warnings: string[] }>;
}

interface PieceRulesSmoke {
  rules: Array<{ assetId: string; count: number }>;
  analysis: {
    pieceCount: number;
    checks: Array<{ selectedCount: number; selectedIds: string[] }>;
  };
}

interface InteropSnapshotSmoke {
  scenario?: { id: string };
  spawnLocations: Array<{ id: string }>;
  entities: Array<{ kind: string; id: string }>;
  relations: Array<{
    name: string;
    fromId?: string;
    toId?: string;
    data?: {
      commandKind?: string;
      commandStatus?: string;
      effectType?: string;
      effectTypes?: string[];
      handlerId?: string;
      handlerStatus?: string;
    };
  }>;
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const packageRoot = join(workspaceRoot, 'packages/medieval-hexagon-gameboard');
const cliPath = join(packageRoot, 'dist/cli.js');
const freeManifestPath = join(packageRoot, 'assets/free/manifest.json');
const recipePath = join(packageRoot, 'examples/generated-piece-scenario.recipe.json');
const scenarioPath = join(packageRoot, 'examples/simple-rpg-scenario.json');
const simulationScriptPath = join(packageRoot, 'examples/simple-rpg-simulation.script.json');
const tempRoot = mkdtempSync(join(tmpdir(), 'medieval-built-cli-'));
const keepTemp = process.env.MEDIEVAL_HEXAGON_KEEP_CLI_SMOKE === '1';

try {
  assert(existsSync(cliPath), `missing ${cliPath}; run pnpm build before pnpm test:cli`);
  assert(existsSync(freeManifestPath), `missing packaged FREE manifest: ${freeManifestPath}`);

  const doctorOutput = runCli(['doctor', '--source', join(tempRoot, 'missing-free')]);
  assert(
    doctorOutput.includes('source exists: no'),
    'doctor did not report a missing explicit source'
  );

  const normalizedManifestPath = join(tempRoot, 'normalized-free-manifest.json');
  const validateManifestOutput = runCli([
    'validate-manifest',
    '--manifest',
    freeManifestPath,
    '--outManifest',
    normalizedManifestPath,
  ]);
  assert(
    validateManifestOutput.includes('validation: 0 error(s), 0 warning(s)'),
    'FREE manifest did not validate cleanly'
  );
  assert(
    existsSync(normalizedManifestPath),
    'validate-manifest did not write a normalized manifest'
  );

  const analysis = JSON.parse(
    runCli(['analyze', '--manifest', freeManifestPath, '--json'])
  ) as TileRegistryAnalysisSmoke;
  assert(
    analysis.tileCount === 60,
    `expected 60 analyzed tile declarations, got ${analysis.tileCount}`
  );
  assert(
    analysis.analyzedCount === 60,
    `expected 60 tile bounds analyses, got ${analysis.analyzedCount}`
  );
  assert(
    analysis.recommendedScale === 1,
    `expected recommended scale 1, got ${analysis.recommendedScale}`
  );
  assert(
    analysis.warnings.length === 0,
    `expected no packaged manifest geometry warnings, got ${analysis.warnings.join('; ')}`
  );

  const declarationsPath = join(tempRoot, 'kaykit-declarations.json');
  const declarationsOutput = runCli([
    'declarations',
    '--manifest',
    freeManifestPath,
    '--out',
    declarationsPath,
  ]);
  const declarations = readJson<unknown[]>(declarationsPath);
  assert(
    declarationsOutput.includes('Wrote 60 tile declarations'),
    'declarations command did not report 60 tiles'
  );
  assert(declarations.length === 60, `declarations output had ${declarations.length} entries`);

  const guidePermutationsPath = join(tempRoot, 'kaykit-guide-permutations.json');
  const guideOutput = runCli([
    'guide-permutations',
    '--manifest',
    freeManifestPath,
    '--out',
    guidePermutationsPath,
  ]);
  const guide = readJson<GuidePermutationSmoke>(guidePermutationsPath);
  assert(
    guideOutput.includes('Wrote 298 guide permutations'),
    'guide-permutations output count changed'
  );
  assert(guide.count === 298, `guide permutation count changed to ${guide.count}`);
  assert(guide.counts.road === 78, `road permutation count changed to ${guide.counts.road}`);
  assert(guide.counts.river === 144, `river permutation count changed to ${guide.counts.river}`);
  assert(guide.counts.coast === 60, `coast permutation count changed to ${guide.counts.coast}`);
  assert(
    guide.missingAssetIds.length === 0,
    `guide permutations reference missing assets: ${guide.missingAssetIds.join(', ')}`
  );

  const guideScenariosPath = join(tempRoot, 'kaykit-guide-scenarios.json');
  const guideScenariosOutput = runCli([
    'guide-scenarios',
    '--manifest',
    freeManifestPath,
    '--out',
    guideScenariosPath,
  ]);
  const guideScenarios = readJson<GuideScenarioSmoke>(guideScenariosPath);
  assert(
    guideScenariosOutput.includes('Wrote 19 guide scenarios'),
    'guide-scenarios output count changed'
  );
  assert(guideScenarios.count === 19, `guide scenario count changed to ${guideScenarios.count}`);
  assert(
    guideScenarios.pages.join(',') === '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19',
    `guide scenario page sequence changed to ${guideScenarios.pages.join(',')}`
  );
  assert(
    guideScenarios.assetScope === 'free',
    `guide scenario manifest validation scope changed to ${guideScenarios.assetScope}`
  );
  assert(
    guideScenarios.assetCounts.total === 404,
    `guide scenario total asset count changed to ${guideScenarios.assetCounts.total}`
  );
  assert(
    guideScenarios.assetCounts.selected === 404,
    `guide scenario selected asset count changed to ${guideScenarios.assetCounts.selected}`
  );
  assert(
    guideScenarios.assetCounts.free === 221,
    `guide scenario FREE asset count changed to ${guideScenarios.assetCounts.free}`
  );
  assert(
    guideScenarios.assetCounts.extra === 183,
    `guide scenario EXTRA-only asset count changed to ${guideScenarios.assetCounts.extra}`
  );
  assert(
    guideScenarios.assetCounts.occurrences === 1093,
    `guide scenario asset occurrence count changed to ${guideScenarios.assetCounts.occurrences}`
  );
  assert(
    guideScenarios.assetCounts.freeOccurrences === 459,
    `guide scenario FREE asset occurrence count changed to ${guideScenarios.assetCounts.freeOccurrences}`
  );
  assert(
    guideScenarios.assetCounts.extraOccurrences === 634,
    `guide scenario EXTRA asset occurrence count changed to ${guideScenarios.assetCounts.extraOccurrences}`
  );
  assert(
    guideScenarios.assetCounts.checked === 221,
    `guide scenario checked asset count changed to ${guideScenarios.assetCounts.checked}`
  );
  assert(guideScenarios.coverage.scenarioCount === 19, 'guide scenario coverage summary count changed');
  assert(guideScenarios.coverage.pageCount === 19, 'guide scenario coverage page count changed');
  assert(
    guideScenarios.coverage.assetCounts.unique === guideScenarios.assetCounts.total,
    'guide scenario coverage unique asset count does not match assetCounts.total'
  );
  assert(
    guideScenarios.coverage.assetCounts.occurrences === guideScenarios.assetCounts.occurrences,
    'guide scenario coverage occurrence count does not match assetCounts.occurrences'
  );
  assert(
    guideScenarios.coverage.scenariosByEdition.free === 8 &&
      guideScenarios.coverage.scenariosByEdition.extra === 7 &&
      guideScenarios.coverage.scenariosByEdition.mixed === 2 &&
      guideScenarios.coverage.scenariosByEdition.reference === 2,
    'guide scenario edition coverage counts changed'
  );
  assert(
    guideScenarios.coverage.pages.find((page) => page.page === 18)?.assetOccurrences === 137,
    'guide scenario page 18 coverage count changed'
  );
  assert(
    guideScenarios.missingAssetIds.length === 0,
    `guide scenarios reference missing FREE assets: ${guideScenarios.missingAssetIds.join(', ')}`
  );
  assert(
    guideScenarios.sourceImages.length === 19,
    `guide scenario source image count changed to ${guideScenarios.sourceImages.length}`
  );
  assert(guideScenarios.docs.length > 0, 'guide-scenarios did not emit docs');
  assert(
    guideScenarios.visualArtifacts.length > 0,
    'guide-scenarios did not emit visual artifacts'
  );

  const guideScenarioPage14 = JSON.parse(
    runCli([
      'guide-scenarios',
      '--source',
      join(tempRoot, 'missing-guide-source'),
      '--assetScope',
      'all',
      '--page',
      '14',
      '--includeTreatments',
      '--json',
    ])
  ) as GuideScenarioSmoke;
  assert(
    guideScenarioPage14.count === 1 && guideScenarioPage14.pages.join(',') === '14',
    'guide-scenarios page filter did not isolate page 14'
  );
  assert(
    guideScenarioPage14.assetCounts.selected === 137 &&
      guideScenarioPage14.assetCounts.extra === 137 &&
      guideScenarioPage14.assetCounts.occurrences === 137,
    'guide-scenarios page 14 selected asset counts changed'
  );
  assert(
    guideScenarioPage14.scenarioCoverage?.[0]?.scenario.id === 'page-14-units',
    'guide-scenarios did not include page 14 scenario coverage'
  );
  assert(
    guideScenarioPage14.scenarioCoverage?.[0]?.treatments.some(
      (treatment) => treatment.assetId === 'unit_blue_full' && treatment.role === 'colored-unit-part'
    ) === true,
    'guide-scenarios did not include page 14 unit treatment metadata'
  );
  const guideScenarioMarkdownPath = join(tempRoot, 'kaykit-guide-scenarios.md');
  const guideScenarioMarkdownOutput = runCli([
    'guide-scenarios',
    '--page',
    '14',
    '--markdown',
    '--out',
    guideScenarioMarkdownPath,
  ]);
  const guideScenarioMarkdown = readFileSync(guideScenarioMarkdownPath, 'utf8');
  assert(
    guideScenarioMarkdownOutput.includes('Wrote 1 guide scenario markdown rows'),
    'guide-scenarios markdown output count changed'
  );
  assert(
    guideScenarioMarkdown.includes('Scenario: `page-14-units`') &&
      guideScenarioMarkdown.includes('GameboardBuilder.addUnitPreset'),
    'guide-scenarios markdown output did not include page 14 unit API coverage'
  );

  const guideApiHarbor = JSON.parse(
    runCli(['guide-apis', '--publicApi', 'GameboardBuilder.addHarbor', '--json'])
  ) as GuidePublicApiSmoke;
  assert(
    guideApiHarbor.count === 1 && guideApiHarbor.publicApis.join(',') === 'GameboardBuilder.addHarbor',
    'guide-apis did not isolate GameboardBuilder.addHarbor'
  );
  assert(
    guideApiHarbor.coverage[0]?.pages.join(',') === '2,5,7,15',
    'guide-apis harbor page coverage changed'
  );
  assert(
    guideApiHarbor.coverage[0]?.assetCounts.free > 0 && guideApiHarbor.coverage[0]?.assetCounts.extra > 0,
    'guide-apis harbor asset edition coverage changed'
  );

  const guideAssetRoadM = JSON.parse(runCli(['guide-assets', '--assetId', 'hex_road_M', '--json'])) as GuideAssetSmoke;
  assert(
    guideAssetRoadM.count === 1 && guideAssetRoadM.assetIds.join(',') === 'hex_road_M',
    'guide-assets did not isolate hex_road_M'
  );
  assert(
    guideAssetRoadM.coverage[0]?.pages.join(',') === '3,9' &&
      guideAssetRoadM.coverage[0]?.role === 'road-tile' &&
      guideAssetRoadM.coverage[0]?.occurrences === 2,
    'guide-assets road page/role coverage changed'
  );
  assert(
    guideAssetRoadM.coverage[0]?.publicApi.includes('GameboardBuilder.addRoadPath') &&
      !guideAssetRoadM.coverage[0]?.publicApi.includes('GameboardBuilder.addForest'),
    'guide-assets road API treatment changed'
  );

  const guideRoleRoad = JSON.parse(runCli(['guide-roles', '--role', 'road-tile', '--json'])) as GuideRoleSmoke;
  assert(
    guideRoleRoad.count === 1 && guideRoleRoad.roles.join(',') === 'road-tile',
    'guide-roles did not isolate road-tile'
  );
  assert(
    guideRoleRoad.coverage[0]?.pages.join(',') === '3,9',
    'guide-roles road page coverage changed'
  );
  assert(
    guideRoleRoad.coverage[0]?.assetCounts.unique === 15 &&
      guideRoleRoad.coverage[0]?.assetCounts.free === 15 &&
      guideRoleRoad.coverage[0]?.publicApi.includes('GameboardBuilder.addRoadPath'),
    'guide-roles road role/API coverage changed'
  );

  const recipePlanPath = join(tempRoot, 'generated-piece-scenario.plan.json');
  const recipeOutput = runCli([
    'validate-recipe',
    '--recipe',
    recipePath,
    '--manifest',
    freeManifestPath,
    '--outPlan',
    recipePlanPath,
  ]);
  assert(
    recipeOutput.includes('validation: 0 error(s), 0 warning(s)'),
    'generated piece recipe did not validate cleanly'
  );
  assert(existsSync(recipePlanPath), 'validate-recipe did not write a compiled plan');

  const layoutRulesPath = join(tempRoot, 'layout-rules.json');
  const layoutAnalysisPath = join(tempRoot, 'layout-analysis.json');
  writeFileSync(
    layoutRulesPath,
    `${JSON.stringify(
      {
        seed: 'built-cli-layout-analysis',
        rules: [
          {
            id: 'too-many-trees',
            archetype: 'tree',
            assetId: 'tree_single_A',
            count: 999,
            minCount: 500,
          },
        ],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  const layoutOutput = runCli([
    'analyze-layout',
    '--recipe',
    recipePath,
    '--manifest',
    freeManifestPath,
    '--rules',
    layoutRulesPath,
    '--outPlan',
    recipePlanPath,
    '--out',
    layoutAnalysisPath,
  ]);
  const layout = readJson<LayoutAnalysisSmoke>(layoutAnalysisPath);
  assert(
    layoutOutput.includes(`Wrote layout analysis to ${layoutAnalysisPath}`),
    'analyze-layout did not write output'
  );
  assert(
    layoutOutput.includes(`Wrote compiled GameboardPlan to ${recipePlanPath}`),
    'analyze-layout did not write compiled plan'
  );
  assert(layout.errorCount === 0, `analyze-layout reported errors: ${JSON.stringify(layout)}`);
  assert(layout.warningCount > 0, 'analyze-layout did not warn about clamped layout counts');
  assert(layout.placementCount > 0, 'analyze-layout selected no placements');
  assert(layout.rules[0]?.id === 'too-many-trees', 'analyze-layout returned the wrong rule id');
  assert(
    layout.rules[0].selectedCount <= layout.rules[0].candidateCount,
    'analyze-layout selected more than the available sites'
  );

  const scenarioPlanPath = join(tempRoot, 'simple-rpg-scenario.plan.json');
  const scenarioOutput = runCli([
    'validate-scenario',
    '--scenario',
    scenarioPath,
    '--manifest',
    freeManifestPath,
    '--outPlan',
    scenarioPlanPath,
  ]);
  assert(
    scenarioOutput.includes('scenario: docs-simple-rpg-scenario'),
    'validate-scenario did not inspect the packaged SimpleRPG scenario'
  );
  assert(
    scenarioOutput.includes('validation: 0 error(s), 0 warning(s)'),
    'SimpleRPG scenario did not validate cleanly'
  );

  const patrolRoutesPath = join(tempRoot, 'simple-rpg-patrol-routes.json');
  const patrolRoutesOutput = runCli([
    'patrol-routes',
    '--scenario',
    scenarioPath,
    '--out',
    patrolRoutesPath,
  ]);
  const patrolRoutes = readJson<PatrolRouteSetSmoke>(patrolRoutesPath);
  assert(
    patrolRoutesOutput.includes(`Wrote patrol route plan to ${patrolRoutesPath}`),
    'patrol-routes did not write a route plan'
  );
  assert(
    patrolRoutes.errors.length === 0,
    `patrol-routes failed: ${patrolRoutes.errors.join('; ')}`
  );
  assert(
    patrolRoutes.routeCount === 1,
    `expected one SimpleRPG patrol route, got ${patrolRoutes.routeCount}`
  );
  const banditRoute = patrolRoutes.routes[0];
  assert(banditRoute?.id === 'bandit-watch', 'patrol-routes omitted bandit-watch');
  assert(banditRoute.found, 'bandit-watch route was not passable');

  const patrolScriptPath = join(tempRoot, 'simple-rpg-patrol.script.json');
  const patrolScriptOutput = runCli([
    'patrol-script',
    '--routes',
    patrolRoutesPath,
    '--routeId',
    'bandit-watch',
    '--actorId',
    'bandit',
    '--out',
    patrolScriptPath,
  ]);
  const patrolScript = readJson<PatrolScriptSmoke>(patrolScriptPath);
  assert(
    patrolScriptOutput.includes(`Wrote patrol simulation script to ${patrolScriptPath}`),
    'patrol-script did not write a simulation script'
  );
  assert(patrolScript.schemaVersion === '1.0.0', 'patrol-script wrote the wrong schema version');
  assert(
    patrolScript.steps.length === banditRoute.segments.length,
    `patrol-script wrote ${patrolScript.steps.length} steps for ${banditRoute.segments.length} segments`
  );
  assert(
    patrolScript.steps.every((step) => step.action === 'command' && step.sourceActor === 'bandit'),
    'patrol-script emitted non-command or wrong-actor steps'
  );

  const simulationValidationOutput = runCli([
    'validate-simulation',
    '--scenario',
    scenarioPath,
    '--script',
    simulationScriptPath,
    '--manifest',
    freeManifestPath,
  ]);
  assert(
    simulationValidationOutput.includes('steps: 9'),
    'validate-simulation did not inspect all packaged SimpleRPG steps'
  );
  assert(
    simulationValidationOutput.includes('validation: 0 error(s), 0 warning(s)'),
    'SimpleRPG simulation script did not validate cleanly'
  );

  const snapshotPath = join(tempRoot, 'simple-rpg-snapshot.json');
  runCli([
    'snapshot',
    '--scenario',
    scenarioPath,
    '--manifest',
    freeManifestPath,
    '--spawnCount',
    '2',
    '--spawnSeed',
    'built-cli',
    '--out',
    snapshotPath,
  ]);
  const snapshot = readJson<InteropSnapshotSmoke>(snapshotPath);
  assert(
    snapshot.scenario?.id === 'docs-simple-rpg-scenario',
    'snapshot omitted scenario metadata'
  );
  assert(
    ['spawn:0', 'spawn:1', 'spawn:player-start:0', 'spawn:elder:0', 'spawn:enemy:0'].every((id) =>
      snapshot.spawnLocations.some((spawn) => spawn.id === id)
    ),
    `snapshot had unexpected spawn locations: ${snapshot.spawnLocations.map((spawn) => spawn.id).join(', ')}`
  );
  assert(
    snapshot.entities.some((entity) => entity.kind === 'spawn-group'),
    'snapshot omitted spawn group entities'
  );
  assert(
    snapshot.entities.some((entity) => entity.kind === 'actor'),
    'snapshot omitted actor entities'
  );
  assert(
    snapshot.relations.some((relation) => relation.name === 'SpawnGroupRouteCheck'),
    'snapshot omitted spawn group route relations'
  );
  assert(
    snapshot.relations.some((relation) => relation.name === 'QuestReferencesActor'),
    'snapshot omitted quest actor relations'
  );

  const simulationReportPath = join(tempRoot, 'simple-rpg-simulation.json');
  const finalPlanPath = join(tempRoot, 'simple-rpg-final.plan.json');
  const simulationInteropPath = join(tempRoot, 'simple-rpg-simulation-interop.json');
  runCli([
    'simulate-scenario',
    '--scenario',
    scenarioPath,
    '--script',
    simulationScriptPath,
    '--manifest',
    freeManifestPath,
    '--out',
    simulationReportPath,
    '--outPlan',
    finalPlanPath,
    '--outInterop',
    simulationInteropPath,
  ]);
  const simulation = readJson<SimulationReportSmoke>(simulationReportPath);
  assert(
    simulation.scenarioId === 'docs-simple-rpg-scenario',
    'simulate-scenario ran the wrong scenario'
  );
  assert(
    simulation.success,
    `simulate-scenario failed: ${JSON.stringify(simulation.expectationFailures)}`
  );
  assert(simulation.expectationFailures.length === 0, 'simulate-scenario had expectation failures');
  assert(
    simulation.eventRecords.some((event) => event.type === 'quest-completed'),
    'simulate-scenario never completed a quest'
  );
  assert(
    simulation.commands?.some(
      (event) =>
        event.eventType === 'command-handled' &&
        event.command.kind === 'attack-actor' &&
        event.command.status === 'handled' &&
        event.command.handlerId === 'simple-rpg:defeat-target' &&
        event.command.effectTypes?.includes('actor-removed')
    ),
    'simulate-scenario did not report the packaged handled attack command'
  );
  assert(
    simulation.commands?.some(
      (event) =>
        event.eventType === 'command-handled' &&
        event.command.kind === 'interact-actor' &&
        event.command.status === 'handled' &&
        event.command.handlerId === 'simple-rpg:greet-actor' &&
        event.command.effectTypes?.includes('actor-updated')
    ),
    'simulate-scenario did not report the packaged handled interaction command'
  );
  assert(
    simulation.patrols?.some(
      (event) =>
        event.eventType === 'patrol-move-requested' &&
        event.patrol.actorId === 'bandit' &&
        event.patrol.routeId === 'bandit-watch'
    ),
    'simulate-scenario did not report the packaged bandit patrol'
  );
  assert(existsSync(finalPlanPath), 'simulate-scenario did not write the final plan');
  assert(existsSync(simulationInteropPath), 'simulate-scenario did not write the interop snapshot');
  const simulationInterop = readJson<InteropSnapshotSmoke>(simulationInteropPath);
  assert(
    simulationInterop.relations.some(
      (relation) =>
        relation.name === 'CommandEffectActor' &&
        relation.toId === 'actor:bandit' &&
        relation.data?.effectType === 'actor-removed' &&
        relation.data.effectTypes?.includes('actor-removed') &&
        relation.data.commandKind === 'attack-actor' &&
        relation.data.commandStatus === 'handled' &&
        relation.data.handlerId === 'simple-rpg:defeat-target' &&
        relation.data.handlerStatus === 'handled'
    ),
    'simulate-scenario interop omitted the handled attack actor-effect metadata'
  );
  assert(
    simulationInterop.relations.some(
      (relation) =>
        relation.name === 'CommandEffectPlacement' &&
        relation.toId?.startsWith('placement:') &&
        relation.data?.effectType === 'actor-removed' &&
        relation.data.effectTypes?.includes('actor-removed') &&
        relation.data.commandKind === 'attack-actor' &&
        relation.data.commandStatus === 'handled' &&
        relation.data.handlerId === 'simple-rpg:defeat-target' &&
        relation.data.handlerStatus === 'handled'
    ),
    'simulate-scenario interop omitted the handled attack placement-effect metadata'
  );
  assert(
    simulationInterop.relations.some(
      (relation) =>
        relation.name === 'CommandEffectActor' &&
        relation.toId === 'actor:elder' &&
        relation.data?.effectType === 'actor-updated' &&
        relation.data.effectTypes?.includes('actor-updated') &&
        relation.data.commandKind === 'interact-actor' &&
        relation.data.commandStatus === 'handled' &&
        relation.data.handlerId === 'simple-rpg:greet-actor' &&
        relation.data.handlerStatus === 'handled'
    ),
    'simulate-scenario interop omitted the handled interaction actor-effect metadata'
  );
  assert(
    simulationInterop.relations.some(
      (relation) =>
        relation.name === 'SimulationStepCommand' &&
        relation.data?.commandKind === 'interact-actor' &&
        relation.data.commandStatus === 'handled' &&
        relation.data.handlerId === 'simple-rpg:greet-actor' &&
        relation.data.handlerStatus === 'handled' &&
        relation.data.effectTypes?.includes('actor-updated')
    ),
    'simulate-scenario interop omitted handled interaction command metadata'
  );

  const fixtureAssetRoot = join(tempRoot, 'fixture-assets');
  const towerPath = join(fixtureAssetRoot, 'tower-hexagon-base.gltf');
  const adventurerPath = join(fixtureAssetRoot, 'adventurer-knight.gltf');
  writeGltfFixture(towerPath, [-0.45, 0, -0.39], [0.45, 1.25, 0.39]);
  writeGltfFixture(adventurerPath, [-0.2, 0, -0.2], [0.2, 1.8, 0.2], {
    animations: ['Idle', 'Walk'],
    rigged: true,
  });

  const compatibility = JSON.parse(
    runCli([
      'compatibility',
      '--asset',
      towerPath,
      '--intendedRole',
      'tile',
      '--sourcePack',
      'Fixture Castle Kit',
      '--modelForward',
      '+z',
      '--boardForwardEdge',
      '1',
      '--json',
    ])
  ) as CompatibilitySmoke;
  assert(
    !compatibility.compatibleAsTile,
    'non-hex tower fixture was incorrectly accepted as a KayKit tile'
  );
  assert(
    compatibility.suggestedRole === 'prop',
    `expected prop suggestion, got ${compatibility.suggestedRole}`
  );
  assert(
    compatibility.placement.rotationSteps === 1,
    `expected rotation step 1, got ${compatibility.placement.rotationSteps}`
  );
  assert(
    compatibility.warnings.some((warning) =>
      warning.includes('does not match the KayKit hex footprint')
    ),
    'compatibility command did not warn about non-KayKit tile footprint'
  );

  const piecePath = join(tempRoot, 'tower-piece.json');
  runCli([
    'piece',
    '--asset',
    towerPath,
    '--id',
    'fixture:tower',
    '--pieceId',
    'fixture-piece:tower',
    '--intendedRole',
    'tile',
    '--sourcePack',
    'Fixture Castle Kit',
    '--tags',
    'castle,landmark',
    '--includeReport',
    '--out',
    piecePath,
  ]);
  const piece = readJson<PieceDeclarationSmoke>(piecePath).declaration;
  assert(piece?.id === 'fixture-piece:tower', 'piece command wrote the wrong declaration id');
  assert(piece.assetId === 'fixture:tower', 'piece command wrote the wrong asset id');
  assert(piece.role === 'landmark', `expected tower fixture role landmark, got ${piece.role}`);
  assert(piece.requiresExtra, 'external piece declaration must stay local-only/requiresExtra');
  assert(piece.metadata.externalAsset === true, 'piece command omitted external asset metadata');

  const piecesPath = join(tempRoot, 'pieces-from-assets.json');
  runCli([
    'pieces-from-assets',
    '--assets',
    fixtureAssetRoot,
    '--sourcePack',
    'Fixture Castle Kit',
    '--intendedRole',
    'tile',
    '--assetIdPrefix',
    'fixture',
    '--pieceIdPrefix',
    'fixture-piece',
    '--tags',
    'fixture,test',
    '--includeReports',
    '--out',
    piecesPath,
  ]);
  const pieces = readJson<PieceRegistrySmoke>(piecesPath);
  assert(
    pieces.summary.assetCount === 2,
    `pieces-from-assets scanned ${pieces.summary.assetCount} assets`
  );
  assert(
    pieces.summary.pieceRoles.landmark === 1,
    'pieces-from-assets did not classify the tower as a landmark'
  );
  assert(
    pieces.summary.pieceRoles.unit === 1,
    'pieces-from-assets did not classify the rigged adventurer as a unit'
  );
  assert(
    pieces.reports?.some((report) => report.suggestedRole === 'prop'),
    'pieces-from-assets omitted compatibility reports'
  );

  const rules = JSON.parse(
    runCli([
      'pieces',
      '--pieces',
      piecesPath,
      '--role',
      'landmark',
      '--emitRules',
      '--count',
      '1',
      '--json',
    ])
  ) as PieceRulesSmoke;
  assert(
    rules.analysis.pieceCount === 2,
    `pieces command analyzed ${rules.analysis.pieceCount} pieces`
  );
  assert(
    rules.analysis.checks[0]?.selectedCount === 1,
    'pieces command did not select exactly one landmark'
  );
  assert(rules.rules.length === 1, `pieces command emitted ${rules.rules.length} fill rules`);

  console.log(keepTemp ? `built CLI smoke passed in ${tempRoot}` : 'built CLI smoke passed');
} finally {
  if (!keepTemp) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function runCli(args: readonly string[]): string {
  return execFileSync(process.execPath, [cliPath, ...args], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function writeGltfFixture(
  path: string,
  min: [number, number, number],
  max: [number, number, number],
  options: { animations?: readonly string[]; rigged?: boolean } = {}
): void {
  mkdirSync(dirname(path), { recursive: true });
  const id = basename(path, '.gltf');
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        asset: { version: '2.0' },
        accessors: [{ min, max }],
        ...(options.rigged ? { skins: [{}], nodes: [{ skin: 0 }] } : {}),
        ...(options.animations ? { animations: options.animations.map((name) => ({ name })) } : {}),
        buffers: [{ uri: `${id}.bin`, byteLength: 0 }],
        materials: [{ name: `${id}_material` }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
