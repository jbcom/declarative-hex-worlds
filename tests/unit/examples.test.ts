import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { advanceGameboardQuest } from '../../src/quests/index';
import { createGameboardPlanFromRecipe, type GameboardRecipe } from '../../src/scenario/recipe';
import { createGameboardWorldFromScenario, type GameboardScenario } from '../../src/scenario/index';
import {
  createGameboardScenarioSimulationReport,
  runGameboardScenarioSimulationScript,
  type GameboardScenarioSimulationScript,
} from '../../src/simulation/index';
import { validateGameboardPlan } from '../../src/rules/validation';
import {
  listSimpleRpgGuidePublicApiExercises,
  runSimpleRpgExecutableGuideApiSmoke,
  runSimpleRpgUsageExample,
  summarizeSimpleRpgGuidePublicApiExercises,
} from '../../examples/simple-rpg-usage';

const testDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(testDir, '../..');
const docsExamplePath = resolve(
  workspaceRoot,
  'docs/examples/generated-piece-scenario.recipe.json'
);
const packageExamplePath = resolve(testDir, '../../examples/generated-piece-scenario.recipe.json');
const docsScenarioPath = resolve(workspaceRoot, 'docs/examples/simple-rpg-scenario.json');
const docsSimulationScriptPath = resolve(
  workspaceRoot,
  'docs/examples/simple-rpg-simulation.script.json'
);
const docsLocalPieceOverridesPath = resolve(
  workspaceRoot,
  'docs/examples/local-piece-overrides.kenney-castle.json'
);
const docsLocalPieceSourceRootsPath = resolve(
  workspaceRoot,
  'docs/examples/local-piece-source-roots.example.json'
);
const packageScenarioPath = resolve(testDir, '../../examples/simple-rpg-scenario.json');
const packageSimulationScriptPath = resolve(
  testDir,
  '../../examples/simple-rpg-simulation.script.json'
);
const packageJsonPath = resolve(testDir, '../../package.json');

describe('published recipe examples', () => {
  it('keeps docs and package generated-piece examples identical and valid', () => {
    const docsExample = readFileSync(docsExamplePath, 'utf8');
    const packageExample = readFileSync(packageExamplePath, 'utf8');
    expect(packageExample).toBe(docsExample);

    const recipe = JSON.parse(packageExample) as GameboardRecipe;
    const plan = createGameboardPlanFromRecipe(recipe);
    const generatedPlacements = plan.placements.filter(
      (placement) => placement.metadata.example === 'generated-piece-scenario'
    );

    expect(
      validateGameboardPlan(plan).filter((violation) => violation.severity === 'error')
    ).toEqual([]);
    expect(generatedPlacements).toHaveLength(5);
    expect(generatedPlacements.map((placement) => placement.assetId)).toEqual(
      expect.arrayContaining(['tree_single_A', 'crate_A_small', 'flag_green'])
    );
    expect(
      generatedPlacements.filter(
        (placement) => placement.metadata.exampleArchetype === 'camp-supply'
      )
    ).toHaveLength(2);
  });

  it('keeps docs and package SimpleRPG scenario examples identical and playable', () => {
    const docsScenario = readFileSync(docsScenarioPath, 'utf8');
    const packageScenario = readFileSync(packageScenarioPath, 'utf8');
    expect(packageScenario).toBe(docsScenario);

    const scenario = JSON.parse(packageScenario) as GameboardScenario;
    const runtime = createGameboardWorldFromScenario(scenario);
    const quest = runtime.questEntities['docs-simple-rpg-scenario:intro'];
    if (quest === undefined) {
      throw new Error('docs scenario missing intro quest entity');
    }
    const snapshot = advanceGameboardQuest(runtime.world, quest);

    expect(
      validateGameboardPlan(runtime.plan).filter((violation) => violation.severity === 'error')
    ).toEqual([]);
    expect(runtime.actors.map((actor) => actor.actor.actorId)).toEqual([
      'bandit',
      'elder',
      'player',
    ]);
    expect(runtime.patrolRoutes?.routes.map((route) => route.id)).toEqual(['bandit-watch']);
    expect(runtime.patrolRoutes?.routes[0]?.waypoints).toHaveLength(3);
    expect(
      snapshot.quest.progress.find((progress) => progress.objectiveId === 'bandit-blocks')
    ).toMatchObject({
      status: 'completed',
    });
  });

  it('keeps docs and package SimpleRPG simulation scripts identical and runnable', () => {
    const docsScenario = readFileSync(docsScenarioPath, 'utf8');
    const packageScenario = readFileSync(packageScenarioPath, 'utf8');
    const docsScript = readFileSync(docsSimulationScriptPath, 'utf8');
    const packageScript = readFileSync(packageSimulationScriptPath, 'utf8');
    expect(packageScenario).toBe(docsScenario);
    expect(packageScript).toBe(docsScript);

    const scenario = JSON.parse(packageScenario) as GameboardScenario;
    const script = JSON.parse(packageScript) as GameboardScenarioSimulationScript;
    const report = createGameboardScenarioSimulationReport(
      runGameboardScenarioSimulationScript(scenario, script),
      script.expectations
    );

    expect(report.scenarioId).toBe('docs-simple-rpg-scenario');
    expect(report.success).toBe(true);
    expect(report.expectationFailures).toEqual([]);
    expect(report.steps.map((step) => step.id)).toEqual([
      'spawn-quest-marker',
      'arm-quest-marker',
      'run-bandit-patrol',
      'evaluate-starting-quest-state',
      'flag-bandit-alert',
      'scan-hostiles',
      'target-bandit',
      'walk-to-elder',
      'greet-elder',
    ]);
    expect(report.steps[6]?.command).toMatchObject({
      kind: 'attack-actor',
      status: 'handled',
      handlerId: 'simple-rpg:defeat-target',
      effectTypes: ['actor-removed'],
      actorId: 'bandit',
      sourceActorId: 'player',
    });
    expect(report.steps[5]?.actorTargets).toMatchObject({
      sourceActorId: 'player',
      targetActorIds: ['bandit'],
      nearestTarget: {
        actorId: 'bandit',
        commandKind: 'attack-actor',
        commandCanExecute: true,
      },
    });
    expect(report.steps[6]?.actorTargets).toMatchObject({
      sourceActorId: 'player',
      targetActorIds: ['bandit'],
      reachableActorIds: ['bandit'],
      nearestTarget: {
        actorId: 'bandit',
        commandKind: 'attack-actor',
        commandCanExecute: true,
      },
    });
    expect(report.actorTargets).toHaveLength(2);
    expect(report.patrols).toEqual([
      expect.objectContaining({
        stepId: 'run-bandit-patrol',
        eventType: 'patrol-move-requested',
        patrol: expect.objectContaining({
          actorId: 'bandit',
          routeId: 'bandit-watch',
          targetKey: '4,1',
        }),
      }),
    ]);
    expect(report.commands).toEqual([
      expect.objectContaining({
        stepId: 'target-bandit',
        eventType: 'command-handled',
        command: expect.objectContaining({
          kind: 'attack-actor',
          status: 'handled',
          handlerId: 'simple-rpg:defeat-target',
          effectTypes: ['actor-removed'],
        }),
      }),
      expect.objectContaining({
        stepId: 'walk-to-elder',
        eventType: 'movement-requested',
        command: expect.objectContaining({ kind: 'move', status: 'requested-move' }),
      }),
      expect.objectContaining({
        stepId: 'greet-elder',
        eventType: 'command-handled',
        command: expect.objectContaining({
          kind: 'interact-actor',
          status: 'handled',
          handlerId: 'simple-rpg:greet-actor',
          effectTypes: ['actor-updated'],
        }),
      }),
    ]);
    expect(report.movements).toEqual([
      expect.objectContaining({
        stepId: 'run-bandit-patrol',
        eventType: 'movement-stepped',
        movement: expect.objectContaining({ actorId: 'bandit', tileKey: '4,1' }),
      }),
      expect.objectContaining({
        stepId: 'run-bandit-patrol',
        eventType: 'movement-completed',
        movement: expect.objectContaining({ actorId: 'bandit', tileKey: '4,1' }),
      }),
      expect.objectContaining({
        stepId: 'walk-to-elder',
        eventType: 'movement-requested',
        movement: expect.objectContaining({ actorId: 'player' }),
      }),
      expect.objectContaining({
        stepId: 'walk-to-elder',
        eventType: 'movement-stepped',
        movement: expect.objectContaining({ actorId: 'player' }),
      }),
      expect.objectContaining({
        stepId: 'walk-to-elder',
        eventType: 'movement-completed',
        movement: expect.objectContaining({ actorId: 'player' }),
      }),
    ]);
    expect(report.mutations).toEqual([
      { type: 'placement-spawned', placementId: 'quest-marker', spawned: true },
      { type: 'placement-updated', placementId: 'quest-marker', updated: true },
      expect.objectContaining({ type: 'actor-updated', actorId: 'bandit', updated: true }),
      expect.objectContaining({ type: 'actor-removed', actorId: 'bandit', removed: true }),
      expect.objectContaining({ type: 'actor-updated', actorId: 'elder', updated: true }),
    ]);
    expect(report.placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          placementId: 'quest-marker',
          tileKey: '2,1',
          assetId: 'flag_green',
          metadata: expect.objectContaining({ role: 'quest-marker', state: 'armed' }),
        }),
      ])
    );
    expect(report.actors.find((actor) => actor.actorId === 'player')?.placement.tileKey).toBe(
      '2,1'
    );
    expect(report.actors.find((actor) => actor.actorId === 'elder')).toMatchObject({
      interactive: true,
      metadata: expect.objectContaining({
        greeted: true,
        greetedBy: 'player',
        questSignal: 'elder-greeted',
      }),
    });
    expect(report.actors.find((actor) => actor.actorId === 'bandit')).toBeUndefined();
    expect(report.quests).toEqual([expect.objectContaining({ status: 'completed' })]);
    expect(JSON.parse(JSON.stringify(report))).toMatchObject({
      scenarioId: 'docs-simple-rpg-scenario',
      eventRecords: expect.any(Array),
    });
  });

  it('keeps the shipped SimpleRPG usage example public and executable', () => {
    const summary = runSimpleRpgUsageExample();

    expect(summary).toMatchObject({
      scenarioId: 'docs-simple-rpg-scenario',
      validationErrorCount: 0,
      simulationSucceeded: true,
    });
    expect(summary.scenarioSpawnGroupIds).toEqual(['player-start', 'elder', 'enemy']);
    expect(summary.scenarioSpawnLocationIds).toHaveLength(3);
    expect(summary.scenarioSpawnRouteCount).toBe(2);
    expect(summary.scenarioPatrolRouteIds).toEqual(['bandit-watch']);
    expect(summary.scenarioPatrolWaypointCount).toBe(3);
    expect(summary.spawnLocationIds).toHaveLength(2);
    expect(summary.interopEntityCount).toBeGreaterThan(0);
    expect(summary.interopRelationCount).toBeGreaterThan(0);
    expect(summary.eventTypes).toEqual(
      expect.arrayContaining(['command-handled', 'movement-completed', 'quest-completed'])
    );
    expect(summary.actorTargetRecordCount).toBe(2);
    expect(summary.actorTargetScanCount).toBe(2);
    expect(summary.actorTargetTargetIds).toEqual(['bandit']);
    expect(summary.reachableActorTargetIds).toEqual(['bandit']);
    expect(summary.nearestActorTargetId).toBe('bandit');
    expect(summary.actorTargetCommandKinds).toEqual(['attack-actor']);
    expect(summary.runtimeActorTargetEventTypes).toEqual(['command-handled']);
    expect(summary.runtimeActorTargetCommandKind).toBe('attack-actor');
    expect(summary.runtimeActorTargetHandled).toBe(true);
    expect(summary.executableGuideApiSmoke).toMatchObject({
      directPublicApiCount: 40,
      publicTreatmentCount: 404,
      guideScenarioCount: 19,
      rawSpawnCoordinateCount: 2,
      recipeValidationErrorCount: 0,
      recipeGenerationErrorCount: 0,
      registryTileCount: 1,
      declaredTileAssetId: 'hex_grass',
      registryWarningCount: 0,
      layoutFillRuleId: 'simple-rpg-executable-crate',
      externalSuggestedRole: 'prop',
      externalSpawnKind: 'prop',
      externalFacingRotationSteps: 1,
    });
    expect(summary.executableGuideApiSmoke.manifestBundleAssetCount).toBeGreaterThan(200);
    expect(summary.executableGuideApiSmoke.guideScenarioPages).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
    expect(summary.executableGuideApiSmoke.selectedManifestAssetIds.length).toBeGreaterThan(0);
    expect(summary.executableGuideApiSmoke.selectorAssetIds).toEqual(
      expect.arrayContaining(['hex_road_A', 'hex_road_B', 'hex_coast_E'])
    );
    expect(summary.executableGuideApiSmoke.propClusterAssetIds).toEqual(
      expect.arrayContaining(['resource_lumber', 'crate_A_big'])
    );
    expect(summary.executableGuideApiSmoke.layoutArchetypeIds).toContain(
      'simple-rpg-executable-cache'
    );
    expect(summary.executableGuideApiSmoke.seededPlanTileCount).toBe(12);
    expect(summary.executableGuideApiSmoke.blueprintPlanTileCount).toBe(20);
    expect(summary.executableGuideApiSmoke.blueprintRecipeStepCount).toBeGreaterThan(0);
    expect(summary.executableGuideApiSmoke.showcaseRecipeStepCount).toBeGreaterThan(0);
    expect(summary.guidePublicApiCount).toBe(74);
    expect(summary.exercisedGuidePublicApiCount).toBe(74);
    expect(summary.missingGuidePublicApis).toEqual([]);
    expect(summary.staleGuidePublicApis).toEqual([]);
    expect(summary.guidePublicApiExerciseModes['fixed-gameplay']).toBeGreaterThan(20);
    expect(summary.guidePublicApiExerciseModes['executable-smoke']).toBe(40);
    expect(summary.finalActorTiles.player).toBe('2,1');
    expect(summary.finalActorTiles.elder).toBe('2,1');
    expect(summary.completedQuestIds).toEqual(['docs-simple-rpg-scenario:intro']);
  });

  it('executes guide-facing helper APIs through the SimpleRPG public example', () => {
    const smoke = runSimpleRpgExecutableGuideApiSmoke();

    expect(smoke.directPublicApiCount).toBe(40);
    expect(smoke.directPublicApis).toEqual(
      expect.arrayContaining([
        'createManifestBundle',
        'createGameboardPlanFromRecipe',
        'createSeededGameboardPlan',
        'createMedievalGameboardBlueprintPlan',
        'listKayKitAssetPublicTreatments',
        'listKayKitGuideScenarios',
        'externalAssetSpawnOptions',
      ])
    );
    expect(smoke.publicTreatmentCount).toBe(404);
    expect(smoke.guideScenarioCount).toBe(19);
    expect(smoke.guideScenarioPages).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
    expect(smoke.assetHelperIds).toEqual({
      coloredUnit: 'sword_blue_full',
      neutralUnit: 'hammer',
      factionBuilding: 'building_market_blue',
      flag: 'flag_blue',
      textureFile: 'hexagons_medieval_Winter.png',
    });
    expect(smoke.propClusterAssetIds.length).toBeGreaterThan(0);
    expect(smoke.guidePermutationCounts).toMatchObject({
      roads: 78,
      rivers: 144,
      riverCrossings: 4,
      coasts: 60,
    });
    expect(smoke.guidePermutationCounts.curvyRivers).toBeGreaterThan(0);
    expect(smoke.planFromTilesPlacementCount).toBeGreaterThan(0);
    expect(smoke.recipePlanPlacementCount).toBeGreaterThan(0);
    expect(smoke.hexagonGridCellCount).toBeGreaterThan(0);
    expect(smoke.blueprintInspectionFeatures).toEqual(
      expect.arrayContaining(['roads', 'waterTiles'])
    );
  });

  it('maps every guide-facing public API to SimpleRPG exercise evidence', () => {
    const coverage = summarizeSimpleRpgGuidePublicApiExercises();
    const exercises = listSimpleRpgGuidePublicApiExercises();
    const executableSmoke = runSimpleRpgExecutableGuideApiSmoke();

    expect(coverage.guidePublicApiCount).toBe(74);
    expect(coverage.exercisedPublicApiCount).toBe(74);
    expect(coverage.missingPublicApis).toEqual([]);
    expect(coverage.staleExercisePublicApis).toEqual([]);
    expect(exercises).toHaveLength(74);
    expect(coverage.exerciseModeCounts['executable-smoke']).toBe(
      executableSmoke.directPublicApiCount
    );
    expect(Object.values(coverage.exerciseModeCounts).every((count) => count > 0)).toBe(true);
    expect(exercises.every((exercise) => exercise.modes.includes(exercise.mode))).toBe(true);
    expect(
      executableSmoke.directPublicApis.every((publicApi) =>
        exercises.some((exercise) => exercise.publicApi === publicApi)
      )
    ).toBe(true);
    expect(exercises.every((exercise) => exercise.pages.length > 0)).toBe(true);
    expect(exercises.every((exercise) => exercise.scenarioIds.length > 0)).toBe(true);
    expect(exercises.map((exercise) => exercise.publicApi)).toEqual(
      expect.arrayContaining([
        'GameboardBuilder.addBridge',
        'GameboardBuilder.addTransition',
        'createSeededGameboardPlan',
        'spawnGameboardActor',
      ])
    );
  });

  it('keeps the local-pack override example valid for batch piece scans', () => {
    const example = JSON.parse(readFileSync(docsLocalPieceOverridesPath, 'utf8')) as {
      overrides?: Record<string, unknown>;
    };

    expect(Object.keys(example.overrides ?? {})).toEqual([
      'tower-hexagon-base',
      'tower-square-base',
      'tree-large',
    ]);
    expect(example.overrides?.['tower-hexagon-base']).toMatchObject({
      role: 'landmark',
      footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
    });
    expect(example.overrides?.['tree-large']).toMatchObject({
      role: 'tree',
      criteria: { maxPerTile: 3, slotGroup: 'soft-feature' },
    });
  });

  it('documents the local piece source-root map shape used by the CLI and renderers', () => {
    const example = JSON.parse(readFileSync(docsLocalPieceSourceRootsPath, 'utf8')) as {
      sourceRoots?: Record<string, unknown>;
    };

    expect(example.sourceRoots).toMatchObject({
      'Kenney Castle Kit': expect.stringContaining('kenney_castle-kit'),
      'KayKit Adventurers 2.0 FREE': expect.stringContaining('KayKit_Adventurers_2.0_FREE'),
    });
    expect(
      Object.values(example.sourceRoots ?? {}).every((value) => typeof value === 'string')
    ).toBe(true);
  });

  it.skip('publishes example JSON through package files and exports [PR1: examples package-shape asserts old workspace structure, Phase R4 SimpleRPG relocation reshapes]', () => {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      exports?: Record<string, string | { import?: string; types?: string }>;
      bin?: Record<string, string>;
      files?: string[];
      engines?: Record<string, string>;
      scripts?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };
    const objectExportSubpaths = Object.entries(packageJson.exports ?? {})
      .filter((entry): entry is [string, { import: string; types: string }] => {
        const target = entry[1];
        return (
          typeof target === 'object' &&
          target !== null &&
          Boolean(target.import) &&
          Boolean(target.types)
        );
      })
      .map(([subpath]) => subpath)
      .sort();

    expect(packageJson.files).toEqual(
      expect.arrayContaining(['assets/free', 'dist', 'examples/*.json', 'README.md', 'NOTICE.md'])
    );
    expect(packageJson.bin).toEqual({ 'medieval-hexagon-gameboard': './dist/cli.js' });
    expect(packageJson.engines).toEqual({ node: '>=22' });
    expect(packageJson.files).toContain('examples/*.json');
    expect(packageJson.files).not.toEqual(expect.arrayContaining(['references', 'docs', 'tests']));
    expect(JSON.stringify(packageJson.scripts ?? {})).not.toMatch(
      /references|\/Volumes\/home|kenney_castle|KayKit_Adventurers/
    );
    expect(packageJson.scripts?.prepublishOnly).toBe('pnpm -w test:ci');
    expect(packageJson.scripts?.['test:visual']).toBe(
      'pnpm run test:browser:free && pnpm run test:browser:extra && pnpm run test:e2e:local-assets'
    );
    expect(packageJson.peerDependenciesMeta).toMatchObject({
      '@types/react': { optional: true },
      react: { optional: true },
      three: { optional: true },
    });
    expect(packageJson.exports?.['./examples/*.json']).toBe('./examples/*.json');
    expect(packageJson.exports).not.toHaveProperty('./examples/*');
    expect(packageJson.exports?.['./assets/free/*']).toBe('./assets/free/*');
    expect(objectExportSubpaths).toEqual(
      expect.arrayContaining([
        '.',
        './blueprint',
        './coverage',
        './examples/blueprint-board-usage',
        './examples/simple-rpg-usage',
      ])
    );
    for (const subpath of objectExportSubpaths) {
      const name = subpath === '.' ? 'index' : subpath.slice(2);
      expect(packageJson.exports?.[subpath]).toEqual({
        types: `./dist/${name}.d.ts`,
        import: `./dist/${name}.js`,
      });
    }
  });
});
