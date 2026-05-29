/**
 * SimpleRPG executable guide API smoke — exercises public helpers in a single
 * deterministic pass. Accepts the scenario as a parameter so this module
 * remains free of test-fixture imports.
 *
 * @module
 */
import {
  analyzeExternalAssetCompatibility,
  analyzeHexTileRegistry,
  coloredUnitAssetId,
  createGameboardLayoutArchetypeRegistry,
  createGameboardLayoutFillRuleFromPiece,
  createGameboardBlueprintPlan,
  createGameboardBlueprintRecipe,
  createGameboardPlanFromRecipe,
  createGameboardPlanFromTiles,
  createGameboardRecipe,
  createHexagonGameboardGrid,
  createHexTileRegistry,
  createManifestBundle,
  createMedievalShowcaseBlueprintRecipe,
  createSeededGameboardPlan,
  declareGameboardPiece,
  declareHexTile,
  externalAssetSpawnOptions,
  factionBuildingAssetId,
  flagAssetId,
  freeManifest,
  inspectGameboardBlueprint,
  listCoastGuidePermutations,
  listPropClusterAssets,
  listRiverCrossingGuidePermutations,
  listRiverCurvyGuidePermutations,
  listRiverGuidePermutations,
  listRoadGuidePermutations,
  neutralUnitAssetId,
  recommendExternalAssetFacing,
  selectCoastVariant,
  selectCoastVariantByLabel,
  selectManifestAssets,
  selectRiverCrossingVariant,
  selectRiverVariant,
  selectRiverVariantByLabel,
  selectRoadVariant,
  selectRoadVariantByLabel,
  selectSpawnCoordinates,
  textureFileName,
  validateGameboardRecipe,
  validateGameboardRecipeGeneration,
  type GameboardPlan,
} from 'declarative-hex-worlds';
import {
  listKayKitAssetPublicTreatments,
  listKayKitGuideScenarios,
} from 'declarative-hex-worlds/catalog';
import { createGameboardWorldFromScenario, type GameboardScenario } from 'declarative-hex-worlds/scenario';
import { SIMPLE_RPG_EXECUTABLE_GUIDE_PUBLIC_APIS } from './exercises';
import type { SimpleRpgExecutableGuideApiSmokeSummary } from './types';

/**
 * Runs direct public helper calls that are useful to games but too low-level to
 * prove only through the playable scenario path.
 *
 * @param scenario - The gameboard scenario to use as the runtime base.
 */
export function runSimpleRpgExecutableGuideApiSmoke(
  scenario: GameboardScenario
): SimpleRpgExecutableGuideApiSmokeSummary {
  const runtime = createGameboardWorldFromScenario(scenario);
  const manifestBundle = createManifestBundle([freeManifest]);
  const selectedManifestAssets = selectManifestAssets(manifestBundle, {
    categories: ['buildings'],
    factions: ['blue'],
  }).slice(0, 3);
  const roads = listRoadGuidePermutations();
  const rivers = listRiverGuidePermutations();
  const curvyRivers = listRiverCurvyGuidePermutations();
  const riverCrossings = listRiverCrossingGuidePermutations();
  const coasts = listCoastGuidePermutations();
  const publicTreatments = listKayKitAssetPublicTreatments();
  const guideScenarios = listKayKitGuideScenarios();
  const propClusterAssetIds = listPropClusterAssets('resource-cache', { includeExtra: true });
  const selectorAssetIds = [
    selectRoadVariant([0, 3]).assetId,
    selectRoadVariantByLabel('B').assetId,
    selectRiverVariant([0, 3], { waterless: true }).assetId,
    selectRiverVariantByLabel('A', { curvy: true }).assetId,
    selectRiverCrossingVariant('A', { waterless: true }).assetId,
    selectCoastVariant([0, 1], { waterless: true }).assetId,
    selectCoastVariantByLabel('E').assetId,
  ];
  const rawSpawns = selectSpawnCoordinates({
    shape: { kind: 'rectangle', width: 4, height: 3 },
    count: 2,
    seed: 'simple-rpg-executable-spawns',
    minDistance: 2,
  });
  const hexagonGridCellCount = [...createHexagonGameboardGrid({ radius: 2 })].length;
  const firstTile = runtime.plan.tiles.find((tile) => tile.key === '0,0') ?? runtime.plan.tiles[0];
  if (!firstTile) {
    throw new Error('SimpleRPG executable smoke requires at least one plan tile');
  }
  const planFromTiles: GameboardPlan = createGameboardPlanFromTiles({
    seed: 'simple-rpg-plan-from-tiles-smoke',
    shape: { kind: 'rectangle', width: 1, height: 1 },
    textureSet: runtime.plan.textureSet,
    tiles: [firstTile],
  });
  const recipe = createGameboardRecipe(
    { seed: 'simple-rpg-recipe-smoke', shape: { kind: 'rectangle', width: 2, height: 1 } },
    [{ action: 'addRoadPath', path: [{ q: 0, r: 0 }, { q: 1, r: 0 }] }]
  );
  const recipePlan = createGameboardPlanFromRecipe(recipe);
  const grassTileDeclaration = {
    id: 'simple-rpg-executable-grass',
    assetId: 'hex_grass',
    role: 'base',
    terrain: 'grass',
    bounds: freeManifest.assetsById['hex_grass']?.bounds,
  } as const;
  const declaredGrassTile = declareHexTile(grassTileDeclaration);
  const registry = createHexTileRegistry([grassTileDeclaration]);
  const registryAnalysis = analyzeHexTileRegistry(registry);
  const archetypes = createGameboardLayoutArchetypeRegistry([
    {
      id: 'simple-rpg-executable-cache',
      label: 'SimpleRPG Executable Cache',
      kind: 'prop',
      layer: 'feature',
      criteria: { terrain: 'grass', allowOccupied: true },
    },
  ]);
  const piece = declareGameboardPiece({
    id: 'simple-rpg-executable-crate',
    assetId: 'crate_A_small',
    source: 'SimpleRPG executable smoke',
    role: 'prop',
    kind: 'prop',
    layer: 'feature',
    archetype: 'simple-rpg-executable-cache',
  });
  const layoutFillRule = createGameboardLayoutFillRuleFromPiece(piece, {
    count: 1,
    archetypes,
  });
  const seededPlan = createSeededGameboardPlan({
    seed: 'simple-rpg-executable-seeded',
    shape: { kind: 'rectangle', width: 4, height: 3 },
    mountainStacks: 1,
    forestTiles: 1,
    hillTiles: 1,
    settlements: 1,
    scatterProps: 1,
    layoutDensity: { harbors: { count: 0 } },
  });
  const blueprintOptions = {
    seed: 'simple-rpg-executable-blueprint',
    shape: { kind: 'rectangle', width: 5, height: 4 },
    towns: 1,
    harbors: 0,
    waterFill: 0.15,
  } as const;
  const blueprintPlan = createGameboardBlueprintPlan(blueprintOptions);
  const blueprintRecipe = createGameboardBlueprintRecipe(blueprintOptions);
  const showcaseRecipe = createMedievalShowcaseBlueprintRecipe();
  const blueprintInspection = inspectGameboardBlueprint(blueprintOptions);
  const compatibilityReport = analyzeExternalAssetCompatibility({
    id: 'simple-rpg-external-tower',
    sourcePack: 'SimpleRPG executable smoke',
    bounds: { min: [-0.4, 0, -0.4], max: [0.4, 1, 0.4], size: [0.8, 1, 0.8] },
    intendedRole: 'tile',
    modelForward: '+z',
    boardForwardEdge: 1,
  });
  const externalSpawn = externalAssetSpawnOptions({
    id: 'simple-rpg-external-tower',
    at: '0,0',
    assetId: 'simple-rpg-external-tower',
    report: compatibilityReport,
  });
  const externalFacing = recommendExternalAssetFacing({ modelForward: '+z', boardForwardEdge: 1 });

  return {
    directPublicApis: [...SIMPLE_RPG_EXECUTABLE_GUIDE_PUBLIC_APIS],
    directPublicApiCount: SIMPLE_RPG_EXECUTABLE_GUIDE_PUBLIC_APIS.length,
    publicTreatmentCount: publicTreatments.length,
    guideScenarioCount: guideScenarios.length,
    guideScenarioPages: guideScenarios.map((s) => s.page),
    manifestBundleAssetCount: manifestBundle.assets.length,
    selectedManifestAssetIds: selectedManifestAssets.map((asset) => asset.id),
    assetHelperIds: {
      coloredUnit: coloredUnitAssetId('sword', 'blue', 'full'),
      neutralUnit: neutralUnitAssetId('hammer'),
      factionBuilding: factionBuildingAssetId('market', 'blue'),
      flag: flagAssetId('blue'),
      textureFile: textureFileName('winter'),
    },
    guidePermutationCounts: {
      roads: roads.length,
      rivers: rivers.length,
      curvyRivers: curvyRivers.length,
      riverCrossings: riverCrossings.length,
      coasts: coasts.length,
    },
    selectorAssetIds,
    propClusterAssetIds,
    rawSpawnCoordinateCount: rawSpawns.length,
    hexagonGridCellCount,
    planFromTilesPlacementCount: planFromTiles.placements.length,
    recipePlanPlacementCount: recipePlan.placements.length,
    recipeValidationErrorCount: validateGameboardRecipe(recipe).filter(
      (violation) => violation.severity === 'error'
    ).length,
    recipeGenerationErrorCount: validateGameboardRecipeGeneration(recipe).filter(
      (violation) => violation.severity === 'error'
    ).length,
    registryTileCount: registryAnalysis.tileCount,
    declaredTileAssetId: declaredGrassTile.assetId,
    registryWarningCount: registryAnalysis.warnings.length,
    layoutArchetypeIds: Object.keys(archetypes).sort(),
    layoutFillRuleId: layoutFillRule.id ?? piece.id,
    seededPlanTileCount: seededPlan.tiles.length,
    blueprintPlanTileCount: blueprintPlan.tiles.length,
    blueprintRecipeStepCount: blueprintRecipe.steps.length,
    showcaseRecipeStepCount: showcaseRecipe.steps.length,
    blueprintInspectionFeatures: Object.keys(blueprintInspection.counts).sort(),
    externalSuggestedRole: compatibilityReport.suggestedRole,
    externalSpawnKind: externalSpawn.kind,
    externalFacingRotationSteps: externalFacing.rotationSteps,
  };
}
