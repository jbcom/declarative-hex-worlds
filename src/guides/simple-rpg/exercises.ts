/**
 * SimpleRPG guide public API exercise catalog — pure functions with no test-fixture dependency.
 *
 * @module
 */
import {
  listKayKitGuidePublicApiCoverages,
  type KayKitGuidePublicApiCoverage,
} from 'declarative-hex-worlds/catalog';
import type {
  SimpleRpgGuidePublicApiExercise,
  SimpleRpgGuidePublicApiExerciseCoverage,
  SimpleRpgGuidePublicApiExerciseMode,
} from './types';

interface SimpleRpgGuidePublicApiExerciseEvidence {
  readonly mode: SimpleRpgGuidePublicApiExerciseMode;
  readonly modes?: readonly SimpleRpgGuidePublicApiExerciseMode[];
  readonly evidence: string;
}

export const SIMPLE_RPG_EXECUTABLE_GUIDE_PUBLIC_APIS = [
  'analyzeHexTileRegistry',
  'coloredUnitAssetId',
  'createGameboardLayoutArchetypeRegistry',
  'createGameboardLayoutFillRuleFromPiece',
  'createGameboardPlanFromRecipe',
  'createGameboardPlanFromTiles',
  'createHexagonGameboardGrid',
  'createManifestBundle',
  'createGameboardBlueprintPlan',
  'createGameboardBlueprintRecipe',
  'createMedievalShowcaseBlueprintRecipe',
  'createSeededGameboardPlan',
  'declareHexTile',
  'externalAssetSpawnOptions',
  'factionBuildingAssetId',
  'flagAssetId',
  'freeManifest',
  'inspectGameboardBlueprint',
  'listCoastGuidePermutations',
  'listKayKitAssetPublicTreatments',
  'listKayKitGuideScenarios',
  'listPropClusterAssets',
  'listRiverCrossingGuidePermutations',
  'listRiverCurvyGuidePermutations',
  'listRiverGuidePermutations',
  'listRoadGuidePermutations',
  'neutralUnitAssetId',
  'recommendExternalAssetFacing',
  'selectCoastVariant',
  'selectCoastVariantByLabel',
  'selectManifestAssets',
  'selectRiverCrossingVariant',
  'selectRiverVariant',
  'selectRiverVariantByLabel',
  'selectRoadVariant',
  'selectRoadVariantByLabel',
  'selectSpawnCoordinates',
  'textureFileName',
  'validateGameboardRecipe',
  'validateGameboardRecipeGeneration',
] as const;

const SIMPLE_RPG_GUIDE_PUBLIC_API_EXERCISE_EVIDENCE = {
  'GameboardBuilder.addBridge': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places a bridge beside the harbor approach.',
  },
  'GameboardBuilder.addConstructionSite': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places a staged worksite off the golden path.',
  },
  'GameboardBuilder.addElevationRamp': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places a ramp against an elevated tile.',
  },
  'GameboardBuilder.addFactionBuilding': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed and packaged SimpleRPG boards place faction buildings.',
  },
  'GameboardBuilder.addFlag': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places a faction flag and runtime actors use flag assets.',
  },
  'GameboardBuilder.addForest': {
    mode: 'fixed-gameplay',
    modes: ['seeded-generation', 'visual-coverage'],
    evidence: 'Fixed and seeded SimpleRPG boards include forests and tree scatter.',
  },
  'GameboardBuilder.addFortification': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places a town wall segment with enclosure metadata.',
  },
  'GameboardBuilder.addHarbor': {
    mode: 'fixed-gameplay',
    modes: ['seeded-generation', 'visual-coverage'],
    evidence: 'Fixed and seeded SimpleRPG boards include a playable harbor/coast relationship.',
  },
  'GameboardBuilder.addHill': {
    mode: 'fixed-gameplay',
    modes: ['seeded-generation', 'visual-coverage'],
    evidence: 'Fixed and seeded SimpleRPG boards include hill terrain and decorations.',
  },
  'GameboardBuilder.addMountainStack': {
    mode: 'fixed-gameplay',
    modes: ['seeded-generation', 'visual-coverage'],
    evidence: 'Fixed, seeded, and packaged SimpleRPG boards place stacked mountains.',
  },
  'GameboardBuilder.addNature': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places standalone nature assets.',
  },
  'GameboardBuilder.addNeutralStructure': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places a neutral grain building.',
  },
  'GameboardBuilder.addProp': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG quest uses a registered crate prop as a passable actor target.',
  },
  'GameboardBuilder.addPropCluster': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places a resource-cache cluster.',
  },
  'GameboardBuilder.addRiverPath': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board routes a curvy waterless river through the quest road.',
  },
  'GameboardBuilder.addRoadPath': {
    mode: 'fixed-gameplay',
    modes: ['seeded-generation', 'visual-coverage'],
    evidence: 'Fixed, seeded, and packaged SimpleRPG boards use roads for movement routes.',
  },
  'GameboardBuilder.addSettlement': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places a settlement home through the settlement alias.',
  },
  'GameboardBuilder.addSiegeProjectile': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places a catapult projectile beside the town wall.',
  },
  'GameboardBuilder.addTransition': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places a local-only texture transition and marks it EXTRA.',
  },
  'GameboardBuilder.addUnit': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places colored and neutral EXTRA unit parts.',
  },
  'GameboardBuilder.addUnitPreset': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board places a composed soldier preset.',
  },
  'GameboardBuilder.scatterDecorations': {
    mode: 'fixed-gameplay',
    modes: ['seeded-generation', 'visual-coverage'],
    evidence: 'Fixed and seeded SimpleRPG boards scatter decorations deterministically.',
  },
  'GameboardBuilder.setCoastEdges': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board marks the water edge as coast before adding a harbor.',
  },
  'GameboardBuilder.setElevation': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed SimpleRPG board raises a tile and then adds an elevation ramp.',
  },
  'GameboardBuilder.setTerrain': {
    mode: 'fixed-gameplay',
    modes: ['seeded-generation', 'visual-coverage'],
    evidence: 'Fixed SimpleRPG board authors a full water row and seeded generation fills terrain.',
  },
  'GameboardBuilder.setTileAsset': {
    mode: 'fixed-gameplay',
    modes: ['visual-coverage'],
    evidence: 'Fixed and packaged SimpleRPG boards override authored tile assets and tags.',
  },
  'NOTICE.md': {
    mode: 'package-boundary',
    modes: ['manifest-package'],
    evidence: 'Release/package audits keep KayKit attribution with the SimpleRPG packaged smoke.',
  },
  analyzeHexTileRegistry: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage analyzes a runtime tile registry in its executable guide API smoke.',
  },
  coloredUnitAssetId: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage resolves a colored unit asset id in executable smoke.',
  },
  createGameboardBuilder: {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG board starts from the public fluent builder.',
  },
  createGameboardLayoutArchetypeRegistry: {
    mode: 'executable-smoke',
    modes: ['seeded-generation'],
    evidence: 'Packaged SimpleRPG usage creates a layout archetype registry in executable smoke.',
  },
  createGameboardLayoutFillRuleFromPiece: {
    mode: 'executable-smoke',
    modes: ['seeded-generation'],
    evidence: 'Packaged SimpleRPG usage creates a piece-backed layout fill rule in executable smoke.',
  },
  createGameboardPlanFromRecipe: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage compiles a recipe into a concrete plan in executable smoke.',
  },
  createGameboardPlanFromTiles: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage rebuilds a plan from explicit tiles in executable smoke.',
  },
  createGameboardRuntimeFromScenario: {
    mode: 'packaged-scenario',
    evidence: 'Packaged SimpleRPG usage creates a runtime facade directly from the scenario JSON.',
  },
  createHexagonGameboardGrid: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage creates a Honeycomb hexagon grid in executable smoke.',
  },
  createManifestBundle: {
    mode: 'executable-smoke',
    modes: ['manifest-package'],
    evidence: 'Packaged SimpleRPG usage bundles the FREE manifest in executable smoke.',
  },
  createGameboardBlueprintPlan: {
    mode: 'executable-smoke',
    modes: ['blueprint-recipe'],
    evidence: 'Packaged SimpleRPG usage compiles a blueprint plan in executable smoke.',
  },
  createGameboardBlueprintRecipe: {
    mode: 'executable-smoke',
    modes: ['blueprint-recipe'],
    evidence: 'Packaged SimpleRPG usage compiles a blueprint recipe in executable smoke.',
  },
  createMedievalShowcaseBlueprintRecipe: {
    mode: 'executable-smoke',
    modes: ['blueprint-recipe'],
    evidence: 'Packaged SimpleRPG usage compiles the showcase blueprint recipe in executable smoke.',
  },
  createSeededGameboardPlan: {
    mode: 'executable-smoke',
    modes: ['seeded-generation'],
    evidence: 'Packaged SimpleRPG usage builds a seeded board in executable smoke.',
  },
  declareHexTile: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage declares a tile for registry analysis in executable smoke.',
  },
  executeGameboardInteractionCommand: {
    mode: 'fixed-gameplay',
    evidence: 'SimpleRPG quest execution moves, interacts, attacks, and removes enemies through commands.',
  },
  externalAssetSpawnOptions: {
    mode: 'executable-smoke',
    modes: ['compatibility-adapter'],
    evidence: 'Packaged SimpleRPG usage converts compatibility analysis into spawn options in executable smoke.',
  },
  factionBuildingAssetId: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage resolves a faction building asset id in executable smoke.',
  },
  flagAssetId: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage resolves a faction flag asset id in executable smoke.',
  },
  freeManifest: {
    mode: 'executable-smoke',
    modes: ['manifest-package'],
    evidence: 'Packaged SimpleRPG usage reads the FREE manifest in executable smoke.',
  },
  inspectGameboardBlueprint: {
    mode: 'executable-smoke',
    modes: ['blueprint-recipe'],
    evidence: 'Packaged SimpleRPG usage inspects a blueprint in executable smoke.',
  },
  listCoastGuidePermutations: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists coast guide permutations in executable smoke.',
  },
  listKayKitAssetPublicTreatments: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists every KayKit asset public treatment in executable smoke.',
  },
  listKayKitGuideScenarios: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists every decomposed KayKit guide scenario in executable smoke.',
  },
  listPropClusterAssets: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage resolves prop-cluster assets in executable smoke.',
  },
  listRiverCrossingGuidePermutations: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists river crossing permutations in executable smoke.',
  },
  listRiverCurvyGuidePermutations: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists curvy river permutations in executable smoke.',
  },
  listRiverGuidePermutations: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists river permutations in executable smoke.',
  },
  listRoadGuidePermutations: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage lists road permutations in executable smoke.',
  },
  'declarative-hex-worlds manifest': {
    mode: 'package-boundary',
    modes: ['manifest-package'],
    evidence: 'Package smoke validates the CLI manifest and packaged SimpleRPG imports together.',
  },
  neutralUnitAssetId: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage resolves a neutral unit asset id in executable smoke.',
  },
  'package.json files': {
    mode: 'package-boundary',
    modes: ['manifest-package'],
    evidence: 'Package audit verifies exports, files, examples, and SimpleRPG package imports.',
  },
  planGameboardInteractionCommand: {
    mode: 'fixed-gameplay',
    evidence: 'Fixed SimpleRPG tests plan prop interaction and enemy attack commands.',
  },
  recommendExternalAssetFacing: {
    mode: 'executable-smoke',
    modes: ['compatibility-adapter'],
    evidence: 'Packaged SimpleRPG usage recommends external asset facing in executable smoke.',
  },
  selectCoastVariant: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a coast variant in executable smoke.',
  },
  selectCoastVariantByLabel: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a labeled coast variant in executable smoke.',
  },
  selectManifestAssets: {
    mode: 'executable-smoke',
    modes: ['manifest-package'],
    evidence: 'Packaged SimpleRPG usage selects manifest assets in executable smoke.',
  },
  selectRiverCrossingVariant: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a river crossing variant in executable smoke.',
  },
  selectRiverVariant: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a river variant in executable smoke.',
  },
  selectRiverVariantByLabel: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a labeled river variant in executable smoke.',
  },
  selectRoadVariant: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a road variant in executable smoke.',
  },
  selectRoadVariantByLabel: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects a labeled road variant in executable smoke.',
  },
  selectSpawnCoordinates: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage selects raw deterministic spawn coordinates in executable smoke.',
  },
  spawnGameboardActor: {
    mode: 'fixed-gameplay',
    evidence: 'Fixed and seeded SimpleRPG fixtures spawn player, NPC, prop, and enemy actors.',
  },
  textureFileName: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage resolves a texture filename in executable smoke.',
  },
  validateGameboardRecipe: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage validates a compiled recipe in executable smoke.',
  },
  validateGameboardRecipeGeneration: {
    mode: 'executable-smoke',
    evidence: 'Packaged SimpleRPG usage validates recipe generation config in executable smoke.',
  },
} satisfies Readonly<Record<string, SimpleRpgGuidePublicApiExerciseEvidence>>;

/**
 * Lists the SimpleRPG evidence rows for every guide-facing public API.
 */
export function listSimpleRpgGuidePublicApiExercises(): readonly SimpleRpgGuidePublicApiExercise[] {
  const coverageByPublicApi = new Map(
    listKayKitGuidePublicApiCoverages().map((coverage) => [coverage.publicApi, coverage] as const)
  );

  return Object.entries(SIMPLE_RPG_GUIDE_PUBLIC_API_EXERCISE_EVIDENCE)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([publicApi, evidence]) => {
      const coverage = coverageByPublicApi.get(publicApi);
      return exerciseFromCoverage(publicApi, evidence, coverage);
    });
}

/**
 * Summarizes whether the packaged SimpleRPG fixture accounts for the full guide
 * public API surface.
 */
export function summarizeSimpleRpgGuidePublicApiExercises(): SimpleRpgGuidePublicApiExerciseCoverage {
  const guidePublicApis = listKayKitGuidePublicApiCoverages().map((coverage) => coverage.publicApi);
  const guidePublicApiSet = new Set(guidePublicApis);
  const exercises = listSimpleRpgGuidePublicApiExercises();
  const exercisePublicApiSet = new Set(exercises.map((exercise) => exercise.publicApi));
  const missingPublicApis = guidePublicApis.filter((publicApi) => !exercisePublicApiSet.has(publicApi));
  const staleExercisePublicApis = exercises
    .map((exercise) => exercise.publicApi)
    .filter((publicApi) => !guidePublicApiSet.has(publicApi));

  return {
    guidePublicApiCount: guidePublicApis.length,
    exercisedPublicApiCount: guidePublicApis.length - missingPublicApis.length,
    missingPublicApis,
    staleExercisePublicApis,
    exerciseModeCounts: countExerciseModes(exercises),
    exercises,
  };
}

function exerciseFromCoverage(
  publicApi: string,
  evidence: SimpleRpgGuidePublicApiExerciseEvidence,
  coverage: KayKitGuidePublicApiCoverage | undefined
): SimpleRpgGuidePublicApiExercise {
  const modes = Array.from(new Set([evidence.mode, ...(evidence.modes ?? [])]));
  return {
    publicApi,
    mode: evidence.mode,
    modes,
    evidence: evidence.evidence,
    pages: coverage?.pages ?? [],
    scenarioIds: coverage?.scenarioIds ?? [],
    assetCount: coverage?.assetCounts.unique ?? 0,
    visualArtifacts: coverage?.visualArtifacts ?? [],
  };
}

function countExerciseModes(
  exercises: readonly SimpleRpgGuidePublicApiExercise[]
): Readonly<Record<SimpleRpgGuidePublicApiExerciseMode, number>> {
  const counts: Record<SimpleRpgGuidePublicApiExerciseMode, number> = {
    'fixed-gameplay': 0,
    'seeded-generation': 0,
    'packaged-scenario': 0,
    'executable-smoke': 0,
    'blueprint-recipe': 0,
    'manifest-package': 0,
    'compatibility-adapter': 0,
    'package-boundary': 0,
    'visual-coverage': 0,
  };
  for (const exercise of exercises) {
    for (const mode of exercise.modes) {
      counts[mode] += 1;
    }
  }
  return counts;
}
