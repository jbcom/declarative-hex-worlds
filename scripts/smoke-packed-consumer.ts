import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface PackResult {
  filename: string;
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const packageRoot = join(workspaceRoot, 'packages/medieval-hexagon-gameboard');
const tempRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-consumer-'));
const packRoot = join(tempRoot, 'pack');
const appRoot = join(tempRoot, 'app');
const keepTemp = process.env.MEDIEVAL_HEXAGON_KEEP_CONSUMER_SMOKE === '1';

try {
  for (const requiredFile of [
    'dist/index.js',
    'dist/examples/simple-rpg-usage.js',
    'dist/cli.js',
  ]) {
    assert(
      existsSync(join(packageRoot, requiredFile)),
      `missing ${requiredFile}; run pnpm build before pnpm test:consumer`
    );
  }

  mkdirSync(packRoot);
  mkdirSync(appRoot);

  const [pack] = JSON.parse(
    execFileSync('npm', ['pack', '--json', '--pack-destination', packRoot], {
      cwd: packageRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  ) as PackResult[];
  const tarballPath = join(packRoot, pack.filename);
  assert(existsSync(tarballPath), `npm pack did not create ${tarballPath}`);

  writeFileSync(
    join(appRoot, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        type: 'module',
        dependencies: {
          '@jbcom/medieval-hexagon-gameboard': `file:${tarballPath}`,
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

  const installedPackageRoot = join(appRoot, 'node_modules/@jbcom/medieval-hexagon-gameboard');
  assert(
    existsSync(join(installedPackageRoot, 'dist/examples/simple-rpg-usage.js')),
    'compiled usage example is missing'
  );
  assert(
    existsSync(join(installedPackageRoot, 'examples/simple-rpg-scenario.json')),
    'scenario JSON example is missing'
  );
  assert(
    !existsSync(join(installedPackageRoot, 'examples/simple-rpg-usage.ts')),
    'raw TypeScript usage example must not be published'
  );

  writeFileSync(
    join(appRoot, 'smoke-types.ts'),
    `
import {
  createGameboardInteropSnapshot,
  createGameboardInteropSnapshotIndex,
  createGameboardRuntimeInteropSnapshot,
  createGameboardBuilder,
  createInMemoryGameboardEcs,
  createGameboardLayoutArchetypeRegistryFromRecipe,
  createGameboardPieceRegistryFromRecipe,
  createGameboardRecipe,
  createGameboardRecipeGenerationFillRules,
  createGameboardWorld,
  createSeededGameboardPlan,
  dispatchGameboardActorTargetCommand,
  findPlacementEntity,
  findTileEntity,
  GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS,
  inspectGameboardActorTargets,
  inspectGameboardPlacementOccupancy,
  inspectGameboardNeighborhood,
  inspectGameboardTile,
  moveGameboardActor,
  PlacementOccupiesTile,
  planGameboardActorTargetCommand,
  readPlacementOccupancyForTile,
  runGameboardActorTargetInteraction,
  selectGameboardActors,
  selectGameboardInteropRelations,
  spawnGameboardActor,
  validateGameboardRecipeGeneration,
  type DispatchGameboardActorTargetCommandResult,
  type GameboardActorSelection,
  type GameboardActorSnapshot,
  type GameboardActorTargetCommandPlan,
  type GameboardActorSelectionOptions,
  type GameboardActorTargetingOptions,
  type GameboardActorTargetingReport,
  type GameboardPlacementOccupancyInspection,
  type GameboardPlacementOccupancyGuard,
  type GameboardInteropSnapshotIndex,
  type GameboardRuntimeInteropOptions,
  type GameboardRuntimeInteropState,
  type RunGameboardActorTargetInteractionResult,
  type GameboardNeighborhoodInspection,
  type GameboardNeighborhoodInspectionOptions,
  type GameboardTileInspection,
  type GameboardTileInspectionOptions,
  type GameboardLayoutArchetypeRegistry,
  type GameboardPiecePlacementInspection,
  type MoveGameboardActorOptions,
  type SpawnGameboardActorOptions,
  type SpawnGameboardPlacementOptions,
  type InspectGameboardPlacementOccupancyOptions,
  type GameboardPlan,
  type GameboardPlacementOccupancyRecord,
  type GameboardQuestSnapshot,
  type PlacementOccupancySnapshot,
  type PlacementOccupancyValue,
  type PlacementStateValue,
} from '@jbcom/medieval-hexagon-gameboard';
import assetManifest from '@jbcom/medieval-hexagon-gameboard/assets/free/manifest.json' with { type: 'json' };
import simpleRpgScenario from '@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json' with { type: 'json' };
import {
  runSimpleRpgUsageExample,
  type SimpleRpgUsageSummary,
} from '@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-usage';
import {
  GAMEBOARD_INTERACTION_HANDLER_PRESETS,
  createGameboardInteractionHandlerPreset,
  isGameboardInteractionHandlerPreset,
  type GameboardInteractionHandlerPreset,
} from '@jbcom/medieval-hexagon-gameboard/commands';
import {
  inspectMedievalHexagonManifest,
  type MedievalHexagonManifestInspection,
} from '@jbcom/medieval-hexagon-gameboard/manifest/schema';
import {
  GAMEBOARD_LAYOUT_ARCHETYPES,
  analyzeGameboardLayoutFill,
  appendGameboardLayoutPlacementsToPlan,
  createGameboardLayoutArchetypeRegistry,
  createGameboardLayoutPlacements,
  inspectGameboardLayoutSites,
  type GameboardLayoutArchetype,
  type GameboardLayoutCriteria,
  type GameboardLayoutFillAnalysis,
  type GameboardLayoutFillRule,
  type GameboardLayoutSiteInspection,
} from '@jbcom/medieval-hexagon-gameboard/layout';
import {
  createGameboardNavigation,
  planGameboardSpawnGroups,
  type GameboardSpawnGroupPlan,
} from '@jbcom/medieval-hexagon-gameboard/navigation';
import { gameboardPlacementFootprintKeys } from '@jbcom/medieval-hexagon-gameboard/occupancy';
import {
  createGameboardLayoutPlacementsFromPiece,
  createGameboardLayoutPlacementOptionsFromPiece,
  createGameboardLayoutFillRuleFromPiece,
  createGameboardPieceRegistry,
  declareGameboardPiece,
  inspectGameboardPiecePlacement,
  type GameboardPieceRegistryAnalysis,
} from '@jbcom/medieval-hexagon-gameboard/pieces';
import {
  inspectSeededGameboardPieceFills,
  type SeededGameboardPieceFillInspection,
} from '@jbcom/medieval-hexagon-gameboard/rules';
import {
  createGameboardRuntime,
  createGameboardRuntimeFromRecipe,
  createGameboardRuntimeFromScenario,
  type GameboardRecipeGameRuntime,
  type GameboardRuntimeSnapshot,
} from '@jbcom/medieval-hexagon-gameboard/runtime';
import type { GameboardScenario } from '@jbcom/medieval-hexagon-gameboard/scenario';
import {
  GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS as GAMEBOARD_SCENARIO_SIMULATION_SUBPATH_STEP_ACTIONS,
  type GameboardScenarioSimulationActorTargetCommandStep,
  type GameboardScenarioSimulationActorTargetsRecord,
} from '@jbcom/medieval-hexagon-gameboard/simulation';

const plan: GameboardPlan = createSeededGameboardPlan({
  seed: 'packed-consumer-types',
  shape: { kind: 'rectangle', width: 2, height: 2 },
  layoutDensity: { harbors: { count: 0 } },
});
const usage: SimpleRpgUsageSummary = runSimpleRpgUsageExample();
const manifestInspection: MedievalHexagonManifestInspection = inspectMedievalHexagonManifest(assetManifest);
const fillAnalysis: GameboardLayoutFillAnalysis = analyzeGameboardLayoutFill(plan, {
  seed: 'packed-consumer-layout-analysis',
  rules: [{ id: 'trees', archetype: 'tree', assetId: 'tree_single_A', count: 1 }],
});
const siteInspection: GameboardLayoutSiteInspection = inspectGameboardLayoutSites(plan, {
  count: 1,
  seed: 'packed-consumer-site-inspection',
  criteria: { allowOccupied: false },
});
const harborCriteria: GameboardLayoutCriteria = {
  minElevation: 0,
  requiredAdjacentPlacementKind: 'road',
};
const occupancyGuard: GameboardPlacementOccupancyGuard = true;
const navigation = createGameboardNavigation(plan);
const spawnGroupPlan: GameboardSpawnGroupPlan = planGameboardSpawnGroups(plan, {
  seed: 'packed-consumer-spawn-groups',
  groups: [
    { id: 'alpha', count: 1, terrain: 'grass' },
    { id: 'beta', count: 1, terrain: 'grass', minDistanceFromGroups: 1, pathToGroups: ['alpha'] },
  ],
});
const piece = declareGameboardPiece({ id: 'packed-fixture-tree', source: 'Packed Fixtures', role: 'tree' });
const pieceInspection: GameboardPiecePlacementInspection = inspectGameboardPiecePlacement(plan, piece, {
  count: 1,
  seed: 'packed-consumer-piece-inspection',
});
const pieceRuleWithGuard = createGameboardLayoutFillRuleFromPiece(piece, {
  count: 1,
  occupancyGuard,
});
const pieceOptionsWithGuard = createGameboardLayoutPlacementOptionsFromPiece(piece, {
  count: 1,
  occupancyGuard: { requireUnblocked: true },
});
const piecePlacements = createGameboardLayoutPlacementsFromPiece(plan, piece, {
  count: 1,
  seed: 'packed-consumer-piece-inspection',
  occupancyGuard,
});
const appendedPlan = appendGameboardLayoutPlacementsToPlan(plan, piecePlacements);
const pieceFillInspection: SeededGameboardPieceFillInspection = inspectSeededGameboardPieceFills(
  plan,
  createGameboardPieceRegistry([piece]),
  [{ selection: { ids: ['packed-fixture-tree'] }, count: 1 }],
  { seed: 'packed-consumer-piece-fill-inspection' }
);
const packedRecipe = createGameboardRecipe(
  { seed: 'packed-consumer-recipe-runtime', shape: { kind: 'rectangle', width: 3, height: 2 } },
  [],
  {
    pieceDeclarations: [
      {
        id: 'packed-recipe-tree',
        assetId: 'tree_single_A',
        source: 'Packed Recipe Fixtures',
        role: 'tree',
        metadata: { sourceRelativePath: 'trees/packed-recipe-tree.gltf' },
      },
    ],
    pieceFills: [{ selection: { ids: ['packed-recipe-tree'] }, count: 1 }],
  }
);
const packedRecipeRegistry = createGameboardPieceRegistryFromRecipe(packedRecipe);
const packedRecipeRules: readonly GameboardLayoutFillRule[] = createGameboardRecipeGenerationFillRules(
  packedRecipe.generation
);
const typedArchetype: GameboardLayoutArchetype = {
  id: 'typed-camp-supply',
  label: 'Typed Camp Supply',
  kind: 'prop',
  layer: 'feature',
  criteria: { terrain: 'grass', allowOccupied: true },
};
const typedArchetypes: GameboardLayoutArchetypeRegistry = createGameboardLayoutArchetypeRegistry([
  typedArchetype,
]);
void createGameboardLayoutArchetypeRegistryFromRecipe(
  createGameboardRecipe(
    { seed: 'typed-recipe', shape: { kind: 'rectangle', width: 1, height: 1 } },
    [],
    { layoutArchetypes: typedArchetypes }
  )
)?.['typed-camp-supply'];
const typedRecipeGenerationViolations = validateGameboardRecipeGeneration(
  createGameboardRecipe(
    { seed: 'typed-bad-recipe', shape: { kind: 'rectangle', width: 1, height: 1 } },
    [],
    { layoutFills: [{ id: 'missing', archetype: 'missing-archetype', assetId: 'crate_A_small', count: 1 }] }
  )
);
const snapshot = createGameboardInteropSnapshot(plan);
const snapshotIndex: GameboardInteropSnapshotIndex = createGameboardInteropSnapshotIndex(snapshot);
const occupancyRecord: GameboardPlacementOccupancyRecord | undefined = selectGameboardInteropRelations(snapshotIndex, { name: 'PlacementOccupiesTile' })[0]?.data as GameboardPlacementOccupancyRecord | undefined;
const footprintKeys: string[] = gameboardPlacementFootprintKeys(plan.placements[0]!);
const world = createGameboardWorld(plan);
const runtime = createGameboardRuntime(
  createGameboardBuilder({
    seed: 'packed-consumer-runtime-types',
    shape: { kind: 'rectangle', width: 2, height: 1 },
  }).build()
);
const runtimeActor = runtime.spawnActor({
  actorId: 'packed-runtime-player',
  at: '0,0',
  assetId: 'flag_blue',
  kind: 'unit',
});
runtime.movement.setAgent(runtimeActor, { profile: 'ground', movementBudget: 2 });
runtime.dispatchCommand('1,0', { sourceActor: 'packed-runtime-player' });
runtime.tick({ patrols: false, movement: { steps: 2 }, quests: false });
const runtimeSnapshot: GameboardRuntimeSnapshot = runtime.snapshot({ includeInterop: false });
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
runtime.updateActor('packed-runtime-guide', { tags: ['guide'], actorMetadata: { greeting: 'hello' } });
const runtimePlacementRecords: readonly PlacementStateValue[] = runtime.readPlacements();
const runtimeActorRecords: readonly GameboardActorSnapshot[] = runtime.readActors();
const runtimeTileActorRecords: readonly GameboardActorSnapshot[] = runtime.readActorsForTile('0,0');
const runtimeQuestEntity = runtime.spawnQuest({
  id: 'packed-runtime-quest',
  objectives: [{ id: 'meet-guide', kind: 'reach-tile', actor: 'packed-runtime-guide', tile: '0,0' }],
});
const runtimeQuestBefore: GameboardQuestSnapshot | undefined = runtime.findQuest(runtimeQuestEntity);
const runtimeQuestAfter: GameboardQuestSnapshot = runtime.advanceQuest('packed-runtime-quest');
const runtimeQuestRecords: readonly GameboardQuestSnapshot[] = runtime.readQuests();
const runtimeCanEnterActorTile: boolean = runtime.canOccupyPlacement({ at: '1,0', kind: 'unit' });
const runtimePlacementOccupancy = runtime.inspectPlacementOccupancy({ at: '1,0', kind: 'unit' });
const runtimePlacementOccupancyRecords: readonly PlacementOccupancySnapshot[] = runtime.readPlacementOccupancy();
const runtimeTilePlacements: readonly PlacementStateValue[] = runtime.readPlacementsForTile('1,0');
const runtimeTileOccupancyRecords: readonly PlacementOccupancySnapshot[] = runtime.readPlacementOccupancyForTile('1,0');
const runtimeRemovedMarker: boolean = runtime.removePlacement('packed-runtime-marker');
const runtimeTileInspectionOptions: GameboardTileInspectionOptions = { sourceActor: 'packed-runtime-player' };
const runtimeNeighborhoodInspectionOptions: GameboardNeighborhoodInspectionOptions = {
  radius: 1,
  sourceActor: 'packed-runtime-player',
};
const runtimeActorSelectionOptions: GameboardActorSelectionOptions = {
  sourceActor: 'packed-runtime-player',
  radius: 1,
};
const rootRuntimeTileInspection: GameboardTileInspection = inspectGameboardTile(
  runtime.world,
  '1,0',
  runtimeTileInspectionOptions
);
const rootRuntimeNeighborhoodInspection: GameboardNeighborhoodInspection = inspectGameboardNeighborhood(
  runtime.world,
  'packed-runtime-player',
  runtimeNeighborhoodInspectionOptions
);
const runtimeTileInspection: GameboardTileInspection = runtime.inspectTile(
  '1,0',
  runtimeTileInspectionOptions
);
const runtimeNeighborhoodInspection: GameboardNeighborhoodInspection = runtime.inspectNeighborhood(
  'packed-runtime-player',
  runtimeNeighborhoodInspectionOptions
);
const rootRuntimeActorSelection: GameboardActorSelection = selectGameboardActors(
  runtime.world,
  runtimeActorSelectionOptions
);
const runtimeActorSelection: GameboardActorSelection = runtime.selectActors(
  runtimeActorSelectionOptions
);
const runtimeActorTargetingOptions: GameboardActorTargetingOptions = {
  sourceActor: 'packed-runtime-player',
  includeSource: true,
};
const rootRuntimeActorTargets: GameboardActorTargetingReport = inspectGameboardActorTargets(
  runtime.world,
  runtimeActorTargetingOptions
);
const runtimeActorTargets: GameboardActorTargetingReport = runtime.inspectActorTargets(
  runtimeActorTargetingOptions
);
const runtimeActorTargetCommandPlan: GameboardActorTargetCommandPlan =
  runtime.planActorTargetCommand(runtimeActorTargetingOptions);
const rootRuntimeActorTargetDispatch: DispatchGameboardActorTargetCommandResult =
  dispatchGameboardActorTargetCommand(runtime.world, runtimeActorTargetingOptions);
const runtimeActorTargetInteraction: RunGameboardActorTargetInteractionResult =
  runtime.interactActorTarget(runtimeActorTargetingOptions, { systems: false });
const simulationActorTargetCommandStep: GameboardScenarioSimulationActorTargetCommandStep = {
  action: 'actor-target-command',
  sourceActor: 'packed-runtime-player',
  targetActorId: 'packed-runtime-player',
  requireReachable: true,
};
const simulationActions: readonly string[] = GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS;
const simulationSubpathActions: readonly string[] = GAMEBOARD_SCENARIO_SIMULATION_SUBPATH_STEP_ACTIONS;
const simulationActorTargets: readonly GameboardScenarioSimulationActorTargetsRecord[] = [];
const runtimeInteropOptions: GameboardRuntimeInteropOptions = { includeActors: true, includeQuests: true };
const runtimeInteropState: GameboardRuntimeInteropState = {
  plan: runtimeSnapshot.plan,
  actors: runtimeSnapshot.actors,
  quests: runtimeSnapshot.quests,
};
const runtimeInteropSnapshot = runtime.createInteropSnapshot(runtimeInteropOptions);
const runtimeInteropSnapshotFromState = createGameboardRuntimeInteropSnapshot(
  runtimeInteropState,
  runtimeInteropOptions
);
const runtimeInteropMount = runtime.mountInterop(createInMemoryGameboardEcs().adapter);
const scenarioRuntime = createGameboardRuntimeFromScenario(simpleRpgScenario as GameboardScenario);
const scenarioRuntimeInteropSnapshot = scenarioRuntime.createScenarioInteropSnapshot();
const scenarioRuntimeInteropMount = scenarioRuntime.mountScenarioInterop(createInMemoryGameboardEcs().adapter);
const recipeRuntime: GameboardRecipeGameRuntime = createGameboardRuntimeFromRecipe(packedRecipe);
const recipeRuntimeSourceUrls: Readonly<Record<string, string>> = recipeRuntime.createRecipePieceSourceUrlMap({
  sourceRoots: { 'Packed Recipe Fixtures': '/packed-recipe-fixtures' },
});
const runtimePieceInspection: GameboardPiecePlacementInspection = runtime.inspectPiecePlacement(piece, {
  count: 1,
  seed: 'packed-consumer-runtime-piece-inspection',
});
const runtimePieceOptions = runtime.createPiecePlacementOptions(piece, { count: 1, occupancyGuard });
const runtimePiecePlacements: readonly SpawnGameboardPlacementOptions[] = runtime.createPiecePlacements(piece, {
  count: 1,
  seed: 'packed-consumer-runtime-piece-create',
});
const runtimePieceEntities = runtime.spawnPiece(piece, {
  count: 1,
  seed: 'packed-consumer-runtime-piece-spawn',
  occupancyGuard,
});
const runtimeLayoutEntities = runtime.spawnLayoutFill({
  seed: 'packed-consumer-runtime-layout-fill',
  rules: [{ id: 'runtime-crates', archetype: 'scatter', assetId: 'crate_A_small', count: 1 }],
});
const runtimePieceRegistryRuntime = createGameboardRuntime(
  createGameboardBuilder({
    seed: 'packed-consumer-runtime-piece-registry-types',
    shape: { kind: 'rectangle', width: 4, height: 2 },
  }).build()
);
const runtimePieceRegistry = createGameboardPieceRegistry([
  piece,
  { id: 'packed-fixture-tree-b', assetId: 'tree_single_B', source: 'Packed Fixtures', role: 'tree', tags: ['nature'] },
  { id: 'packed-fixture-crate', assetId: 'crate_A_small', source: 'Packed Fixtures', role: 'scatter', tags: ['camp'], metadata: { sourceRelativePath: 'props/crate.gltf' } },
]);
const runtimePieceRegistryAnalysis: GameboardPieceRegistryAnalysis = runtimePieceRegistryRuntime.analyzePieceRegistry(runtimePieceRegistry, {
  checks: [{ id: 'packed-nature-pool', mode: 'pool', selection: { roles: ['tree'] } }],
});
const runtimeSelectedPieces = runtimePieceRegistryRuntime.selectPieces(runtimePieceRegistry, { tags: ['nature'] });
const runtimePieceFillRules: readonly GameboardLayoutFillRule[] = runtimePieceRegistryRuntime.createPieceFillRules(runtimePieceRegistry, {
  selection: { tags: ['camp'] },
  count: 1,
});
const runtimePiecePoolFillRule: GameboardLayoutFillRule = runtimePieceRegistryRuntime.createPiecePoolFillRule(
  runtimePieceRegistryRuntime.selectPieces(runtimePieceRegistry, { roles: ['tree'] }),
  { id: 'packed-nature-pool', count: 1 }
);
const runtimePieceFillAnalysis: GameboardLayoutFillAnalysis = runtimePieceRegistryRuntime.analyzePieceFills(
  runtimePieceRegistry,
  [{ selection: { tags: ['camp'] }, count: 1 }],
  { seed: 'packed-consumer-runtime-piece-fill-analysis' }
);
const runtimePieceFillInspection: SeededGameboardPieceFillInspection = runtimePieceRegistryRuntime.inspectPieceFills(
  runtimePieceRegistry,
  [{ selection: { tags: ['camp'] }, count: 1 }],
  { seed: 'packed-consumer-runtime-piece-fill-inspection' }
);
const runtimePieceFillEntities = runtimePieceRegistryRuntime.spawnPieceFills(
  runtimePieceRegistry,
  [{ selection: { tags: ['camp'] }, count: 1 }],
  { seed: 'packed-consumer-runtime-piece-fill-spawn' }
);
const runtimePieceSourceUrls: Readonly<Record<string, string>> = runtimePieceRegistryRuntime.createPieceSourceUrlMap(
  runtimePieceRegistry,
  { sourceRoots: { 'Packed Fixtures': '/packed-fixtures' } }
);
const occupancyInspectionOptions: InspectGameboardPlacementOccupancyOptions = { at: '0,0', kind: 'unit' };
const actorSpawnOptions: SpawnGameboardActorOptions = {
  actorId: 'packed-types-actor',
  at: '1,1',
  assetId: 'flag_blue',
  kind: 'unit',
  occupancyGuard,
};
const actorMoveOptions: MoveGameboardActorOptions = { occupancyGuard };
const placementOccupancyInspection: GameboardPlacementOccupancyInspection = inspectGameboardPlacementOccupancy(
  world,
  occupancyInspectionOptions
);
const tileEntity = findTileEntity(world, '0,0');
const placementEntity = plan.placements[0] ? findPlacementEntity(world, plan.placements[0].id) : undefined;
const occupancyValue: PlacementOccupancyValue | undefined = tileEntity && placementEntity ? placementEntity.get(PlacementOccupiesTile(tileEntity)) : undefined;
const occupancySnapshots: readonly PlacementOccupancySnapshot[] = readPlacementOccupancyForTile(world, '0,0');
const totalAssets: number = assetManifest.counts.total;
const scenarioId: string = simpleRpgScenario.id;
const handlerPreset: GameboardInteractionHandlerPreset = 'default-rpg';
const handlerPresetCount: number = GAMEBOARD_INTERACTION_HANDLER_PRESETS.length;
const handlerCount: number = createGameboardInteractionHandlerPreset(handlerPreset).length;
const handlerPresetIsValid: boolean = isGameboardInteractionHandlerPreset(handlerPreset);

void GAMEBOARD_LAYOUT_ARCHETYPES.harbor;
void typedArchetype;
void typedArchetypes;
void typedRecipeGenerationViolations;
void fillAnalysis;
void handlerCount;
void handlerPresetCount;
void handlerPresetIsValid;
void harborCriteria;
void footprintKeys;
void manifestInspection;
void navigation;
void actorSpawnOptions;
void actorMoveOptions;
void occupancyRecord;
void occupancyGuard;
void placementOccupancyInspection;
void occupancySnapshots;
void occupancyValue;
void runtimeSnapshot;
void runtimePlacementRecords;
void runtimeActorRecords;
void runtimeTileActorRecords;
void runtimeQuestBefore;
void runtimeQuestAfter;
void runtimeQuestRecords;
void runtimeCanEnterActorTile;
void runtimePlacementOccupancy;
void runtimePlacementOccupancyRecords;
void runtimeTilePlacements;
void runtimeTileOccupancyRecords;
void runtimeRemovedMarker;
void rootRuntimeTileInspection;
void runtimeTileInspection;
void rootRuntimeNeighborhoodInspection;
void runtimeNeighborhoodInspection;
void rootRuntimeActorSelection;
void runtimeActorSelection;
void rootRuntimeActorTargets;
void runtimeActorTargets;
void runtimeActorTargetCommandPlan;
void rootRuntimeActorTargetDispatch;
void runtimeActorTargetInteraction;
void runtimeInteropSnapshot;
void runtimeInteropSnapshotFromState;
void runtimeInteropMount;
void scenarioRuntime;
void scenarioRuntimeInteropSnapshot;
void scenarioRuntimeInteropMount;
void recipeRuntime;
void recipeRuntimeSourceUrls;
void packedRecipeRegistry;
void packedRecipeRules;
void runtimePieceInspection;
void runtimePieceOptions;
void runtimePiecePlacements;
void runtimePieceEntities;
void runtimeLayoutEntities;
void runtimePieceRegistryRuntime;
void runtimePieceRegistry;
void runtimePieceRegistryAnalysis;
void runtimeSelectedPieces;
void runtimePieceFillRules;
void runtimePiecePoolFillRule;
void runtimePieceFillAnalysis;
void runtimePieceFillInspection;
void runtimePieceFillEntities;
void runtimePieceSourceUrls;
void pieceInspection;
void pieceRuleWithGuard;
void pieceOptionsWithGuard;
void piecePlacements;
void pieceFillInspection;
void spawnGroupPlan;
void appendedPlan;
void scenarioId;
void siteInspection;
void totalAssets;
void usage;
`,
    'utf8'
  );

  execFileSync(
    process.execPath,
    [
      join(workspaceRoot, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--target',
      'ES2022',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--resolveJsonModule',
      '--skipLibCheck',
      'smoke-types.ts',
    ],
    {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
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
} from '@jbcom/medieval-hexagon-gameboard';
import { runSimpleRpgUsageExample } from '@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-usage';
import {
  GAMEBOARD_INTERACTION_HANDLER_PRESETS,
  createGameboardInteractionHandlerPreset,
  isGameboardInteractionHandlerPreset,
} from '@jbcom/medieval-hexagon-gameboard/commands';
import {
  GAMEBOARD_LAYOUT_ARCHETYPES,
  analyzeGameboardLayoutFill,
  appendGameboardLayoutPlacementsToPlan,
  createGameboardLayoutArchetypeRegistry,
  createGameboardLayoutPlacements,
  inspectGameboardLayoutSites,
  spawnGameboardLayoutPlacements,
} from '@jbcom/medieval-hexagon-gameboard/layout';
import { freeManifest } from '@jbcom/medieval-hexagon-gameboard/manifest/free';
import { inspectMedievalHexagonManifest } from '@jbcom/medieval-hexagon-gameboard/manifest/schema';
import {
  createGameboardNavigation,
  planGameboardSpawnGroups,
} from '@jbcom/medieval-hexagon-gameboard/navigation';
import { gameboardPlacementFootprintKeys } from '@jbcom/medieval-hexagon-gameboard/occupancy';
import {
  createGameboardLayoutPlacementsFromPiece,
  createGameboardLayoutPlacementOptionsFromPiece,
  createGameboardPieceRegistry,
  declareGameboardPiece,
  inspectGameboardPiecePlacement,
} from '@jbcom/medieval-hexagon-gameboard/pieces';
import { inspectSeededGameboardPieceFills } from '@jbcom/medieval-hexagon-gameboard/rules';
import {
  createGameboardRuntime,
  createGameboardRuntimeFromRecipe,
  createGameboardRuntimeFromScenario,
} from '@jbcom/medieval-hexagon-gameboard/runtime';
import {
  GAMEBOARD_SCENARIO_SIMULATION_STEP_ACTIONS as GAMEBOARD_SCENARIO_SIMULATION_SUBPATH_STEP_ACTIONS,
} from '@jbcom/medieval-hexagon-gameboard/simulation';
import { validateGameboardPlan } from '@jbcom/medieval-hexagon-gameboard/validation';

const assetManifestModule = await import('@jbcom/medieval-hexagon-gameboard/assets/free/manifest.json', {
  with: { type: 'json' },
});
const scenarioModule = await import('@jbcom/medieval-hexagon-gameboard/examples/simple-rpg-scenario.json', {
  with: { type: 'json' },
});
const manifestInspection = inspectMedievalHexagonManifest(assetManifestModule.default);
if (manifestInspection.errorCount !== 0 || manifestInspection.warningCount !== 0) {
  throw new Error(\`packed FREE manifest inspection failed: \${JSON.stringify(manifestInspection.issues)}\`);
}
const plan = createSeededGameboardPlan({
  seed: 'packed-consumer-smoke',
  shape: { kind: 'rectangle', width: 4, height: 3 },
  layoutDensity: { harbors: { count: 1 }, trees: 0.1, props: 0.05 },
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
if (
  !packagedScenarioRuntime.actorEntities.player ||
  packagedScenarioRuntime.snapshot({ includeInterop: false }).actors.length < 1
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
const usage = runSimpleRpgUsageExample();
if (!usage.simulationSucceeded || usage.validationErrorCount !== 0) {
  throw new Error(\`packed SimpleRPG usage failed: \${JSON.stringify(usage)}\`);
}
if (
  usage.scenarioSpawnGroupIds.join('|') !== 'player-start|elder|enemy' ||
  usage.scenarioSpawnLocationIds.length !== 3 ||
  usage.scenarioSpawnRouteCount !== 2
) {
  throw new Error(\`packed SimpleRPG scenario spawn groups were not resolved: \${JSON.stringify(usage)}\`);
}
if (
  usage.actorTargetRecordCount !== 2 ||
  usage.actorTargetScanCount !== 2 ||
  usage.nearestActorTargetId !== 'bandit' ||
  usage.actorTargetCommandKinds.join('|') !== 'attack-actor'
) {
  throw new Error(\`packed SimpleRPG actor-target usage was not resolved: \${JSON.stringify(usage)}\`);
}
if (freeManifest.counts.total !== assetManifestModule.default.counts.total) {
  throw new Error('manifest/free export and assets/free JSON disagree');
}
if (scenarioModule.default.id !== 'docs-simple-rpg-scenario') {
  throw new Error('packaged JSON example export returned the wrong scenario');
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
  usageScenarioId: usage.scenarioId,
  actorTargetScanCount: usage.actorTargetScanCount,
  actorTargetRecordCount: usage.actorTargetRecordCount,
  nearestActorTargetId: usage.nearestActorTargetId,
  simulationActionCount: simulationActions.length,
  simulationSubpathActionCount: simulationSubpathActions.length,
  simulationActorTargetCommandStepAction: simulationActorTargetCommandStep.action,
  completedQuestIds: usage.completedQuestIds,
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

  assert(
    smokeOutput.includes('"usageScenarioId": "docs-simple-rpg-scenario"'),
    'consumer smoke did not run usage example'
  );
  assert(
    smokeOutput.includes('"defaultRpgHandlers": 3'),
    'consumer smoke did not run command preset registry'
  );
  assert(
    binOutput.includes('source exists: no'),
    'installed CLI doctor did not report the missing source'
  );

  console.log(
    keepTemp ? `packed consumer smoke passed in ${appRoot}` : 'packed consumer smoke passed'
  );
} finally {
  if (!keepTemp) {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
