/**
 * KayKit guide-page source images, scenario table, and scenario normalization.
 */
import type {
  KayKitAssetPublicRole,
  KayKitAssetPublicTreatment,
  KayKitGuideScenario,
} from './catalog';

export const GUIDE_IMAGE = {
  cover: 'docs/assets/kaykit-guide/pages/page-01.png',
  buildings: 'docs/assets/kaykit-guide/pages/page-02.png',
  roads: 'docs/assets/kaykit-guide/pages/page-03.png',
  rivers: 'docs/assets/kaykit-guide/pages/page-04.png',
  natureContents: 'docs/assets/kaykit-guide/pages/page-05.png',
  natureUsage: 'docs/assets/kaykit-guide/pages/page-06.png',
  waterUsage: 'docs/assets/kaykit-guide/pages/page-07.png',
  tallerTiles: 'docs/assets/kaykit-guide/pages/page-08.png',
  worldDesign: 'docs/assets/kaykit-guide/pages/page-09.png',
  floatingIslands: 'docs/assets/kaykit-guide/pages/page-10.png',
  biomes: 'docs/assets/kaykit-guide/pages/page-11.png',
  alternateTextures: 'docs/assets/kaykit-guide/pages/page-12.png',
  transition: 'docs/assets/kaykit-guide/pages/page-13.png',
  units: 'docs/assets/kaykit-guide/pages/page-14.png',
  shipyard: 'docs/assets/kaykit-guide/pages/page-15.png',
  stables: 'docs/assets/kaykit-guide/pages/page-16.png',
  workshop: 'docs/assets/kaykit-guide/pages/page-17.png',
  unitCombinations: 'docs/assets/kaykit-guide/pages/page-18.png',
  attribution: 'docs/assets/kaykit-guide/pages/page-19.png',
} as const;

const KAYKIT_GUIDE_SCENARIO_TABLE: readonly KayKitGuideScenarioInput[] = [
  {
    id: 'page-01-overview-and-license',
    page: 1,
    title: 'Overview and license contract',
    sourceImage: GUIDE_IMAGE.cover,
    edition: 'reference',
    summary:
      'Defines the KayKit pack identity, library scope, package attribution, and source-of-truth guide extraction.',
    assetIds: [],
    publicApi: ['freeManifest', 'listKayKitGuideScenarios', 'listKayKitAssetPublicTreatments'],
    treatmentRoles: [],
    visualArtifacts: ['docs/assets/kaykit-guide/montage.png', GUIDE_IMAGE.cover],
    docs: ['README.md', 'NOTICE.md', 'docs/pillars/00-library-charter.md'],
  },
  {
    id: 'page-02-buildings-props-and-factions',
    page: 2,
    title: 'Buildings, props, and factions',
    sourceImage: GUIDE_IMAGE.buildings,
    edition: 'mixed',
    summary:
      'Covers faction building ids, neutral structures, props, flags, settlement composition, and source path naming.',
    publicApi: [
      'factionBuildingAssetId',
      'flagAssetId',
      'GameboardBuilder.addFactionBuilding',
      'GameboardBuilder.addNeutralStructure',
      'GameboardBuilder.addProp',
      'GameboardBuilder.addSettlement',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png',
    ],
    docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/guides/public-api.md'],
  },
  {
    id: 'page-03-road-variations',
    page: 3,
    title: 'Road variations',
    sourceImage: GUIDE_IMAGE.roads,
    edition: 'free',
    summary:
      'Maps road labels A-M and sloped variants to canonical edge masks, rotations, and path builder output.',
    publicApi: [
      'selectRoadVariant',
      'selectRoadVariantByLabel',
      'listRoadGuidePermutations',
      'GameboardBuilder.addRoadPath',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-guide-roads-all-labels-rotations.png',
    ],
    docs: ['docs/pillars/01-tiles-connectivity.md', 'docs/pillars/04-visual-verification.md'],
  },
  {
    id: 'page-04-river-variations',
    page: 4,
    title: 'River variations',
    sourceImage: GUIDE_IMAGE.rivers,
    edition: 'free',
    summary:
      'Maps river labels A-L, curvy rivers, crossings, and waterless variants to edge masks and rotation selectors.',
    publicApi: [
      'selectRiverVariant',
      'selectRiverVariantByLabel',
      'selectRiverCrossingVariant',
      'listRiverGuidePermutations',
      'listRiverCurvyGuidePermutations',
      'listRiverCrossingGuidePermutations',
      'GameboardBuilder.addRiverPath',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-guide-river-curvy-crossings-all-modes.png',
    ],
    docs: ['docs/pillars/01-tiles-connectivity.md', 'docs/pillars/04-visual-verification.md'],
  },
  {
    id: 'page-05-nature-contents',
    page: 5,
    title: 'Nature and decoration contents',
    sourceImage: GUIDE_IMAGE.natureContents,
    edition: 'free',
    summary:
      'Covers mountains, hills, trees, rocks, water plants, clouds, props, resources, flags, and scatterable pieces.',
    publicApi: [
      'GameboardBuilder.addNature',
      'GameboardBuilder.addHill',
      'GameboardBuilder.addMountainStack',
      'GameboardBuilder.scatterDecorations',
      'createGameboardBlueprintRecipe',
      'createGameboardLayoutFillRuleFromPiece',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png',
    ],
    docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/pillars/05-koota-runtime-rules.md'],
  },
  {
    id: 'page-06-nature-usage',
    page: 6,
    title: 'Nature usage guide',
    sourceImage: GUIDE_IMAGE.natureUsage,
    edition: 'free',
    summary:
      'Expresses stacking, scatter, forest, hill, mountain, and visual-slot placement rules for terrain dressing.',
    publicApi: [
      'GameboardBuilder.addForest',
      'GameboardBuilder.addHill',
      'GameboardBuilder.addMountainStack',
      'GameboardBuilder.scatterDecorations',
      'createGameboardBlueprintPlan',
      'inspectGameboardBlueprint',
      'createGameboardLayoutArchetypeRegistry',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-generated-piece-recipe.png',
    ],
    docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/pillars/05-koota-runtime-rules.md'],
  },
  {
    id: 'page-07-water-usage',
    page: 7,
    title: 'Water usage guide',
    sourceImage: GUIDE_IMAGE.waterUsage,
    edition: 'free',
    summary:
      'Covers water terrain, coasts, rivers, waterless overlays, harbor-compatible edges, and water decoration placement.',
    publicApi: [
      'selectCoastVariant',
      'selectRiverVariant',
      'GameboardBuilder.setTerrain',
      'GameboardBuilder.setCoastEdges',
      'GameboardBuilder.addRiverPath',
      'GameboardBuilder.addHarbor',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-guide-coasts-all-labels-rotations-water-waterless.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-harbor-gameboard.png',
    ],
    docs: ['docs/pillars/01-tiles-connectivity.md', 'docs/pillars/04-visual-verification.md'],
  },
  {
    id: 'page-08-taller-hex-tiles',
    page: 8,
    title: 'Taller hex tiles',
    sourceImage: GUIDE_IMAGE.tallerTiles,
    edition: 'free',
    summary:
      'Covers bottom, sloped, elevated, and stacked terrain compositions for mountains and cliff-like boards.',
    publicApi: [
      'GameboardBuilder.addMountainStack',
      'GameboardBuilder.setElevation',
      'GameboardBuilder.setTileAsset',
      'createGameboardBlueprintRecipe',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-gameboard-recipe.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-blueprint-builder-showcase.png',
    ],
    docs: ['docs/pillars/01-tiles-connectivity.md', 'docs/pillars/05-koota-runtime-rules.md'],
  },
  {
    id: 'page-09-world-design-example',
    page: 9,
    title: 'World design example',
    sourceImage: GUIDE_IMAGE.worldDesign,
    edition: 'free',
    summary:
      'Combines base tiles, roads, rivers, buildings, nature, scatter, spawn locations, and pathable board layout.',
    publicApi: [
      'createGameboardBuilder',
      'createGameboardPlanFromRecipe',
      'createSeededGameboardPlan',
      'createMedievalShowcaseBlueprintRecipe',
      'createGameboardRuntimeFromScenario',
      'selectSpawnCoordinates',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-gameboard-recipe.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-blueprint-builder-showcase.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-seeded-gameboard.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/simple-rpg-fixed-completed.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-blueprint-biome-transition-showcase.png',
    ],
    docs: [
      'docs/guides/recipes-scenarios-and-simulation.md',
      'docs/pillars/05-koota-runtime-rules.md',
    ],
  },
  {
    id: 'page-10-floating-islands',
    page: 10,
    title: 'Floating islands',
    sourceImage: GUIDE_IMAGE.floatingIslands,
    edition: 'free',
    summary:
      'Covers elevated support tiles, sloped terrain, mountain stacks, forests, and non-rectangular Honeycomb boards.',
    publicApi: [
      'createHexagonGameboardGrid',
      'GameboardBuilder.addMountainStack',
      'GameboardBuilder.setElevation',
      'GameboardBuilder.addForest',
      'createGameboardBlueprintPlan',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-seeded-hex-gameboard.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
    ],
    docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/pillars/05-koota-runtime-rules.md'],
  },
  {
    id: 'page-11-biomes',
    page: 11,
    title: 'Biomes',
    sourceImage: GUIDE_IMAGE.biomes,
    edition: 'extra',
    summary:
      'Covers local EXTRA transition tiles and texture-set selection for biome blends without publishing EXTRA binaries.',
    publicApi: [
      'textureFileName',
      'GameboardBuilder.addTransition',
      'createGameboardBlueprintRecipe',
      'inspectGameboardBlueprint',
      'createGameboardPlanFromRecipe',
      'validateGameboardRecipe',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-seasonal-textures.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-blueprint-biome-transition-showcase.png',
    ],
    docs: [
      'docs/pillars/03-editions-and-ingest.md',
      'docs/guides/rendering-assets-and-external-packs.md',
    ],
  },
  {
    id: 'page-12-alternate-textures',
    page: 12,
    title: 'Alternate textures',
    sourceImage: GUIDE_IMAGE.alternateTextures,
    edition: 'extra',
    summary:
      'Covers default, fall, summer, and winter texture sets generated through local EXTRA ingestion.',
    publicApi: [
      'textureFileName',
      'createManifestBundle',
      'selectManifestAssets',
      'declarative-hex-worlds manifest',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-seasonal-textures.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png',
    ],
    docs: [
      'docs/pillars/03-editions-and-ingest.md',
      'docs/guides/rendering-assets-and-external-packs.md',
    ],
  },
  {
    id: 'page-13-transition-tiles',
    page: 13,
    title: 'Transition tiles',
    sourceImage: GUIDE_IMAGE.transition,
    edition: 'extra',
    summary:
      'Covers EXTRA transition tile declarations, biome adjacency, and recipe/build-time validation for blends.',
    publicApi: [
      'GameboardBuilder.addTransition',
      'createGameboardBlueprintRecipe',
      'createMedievalShowcaseBlueprintRecipe',
      'declareHexTile',
      'analyzeHexTileRegistry',
      'createGameboardPlanFromRecipe',
      'validateGameboardRecipeGeneration',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-seasonal-textures.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-blueprint-biome-transition-showcase.png',
    ],
    docs: ['docs/pillars/01-tiles-connectivity.md', 'docs/pillars/03-editions-and-ingest.md'],
  },
  {
    id: 'page-14-units',
    page: 14,
    title: 'Units',
    sourceImage: GUIDE_IMAGE.units,
    edition: 'extra',
    summary:
      'Covers local EXTRA unit bodies, weapons, mounts, vehicles, ships, accent/full styles, and actor spawning.',
    publicApi: [
      'coloredUnitAssetId',
      'neutralUnitAssetId',
      'GameboardBuilder.addUnit',
      'GameboardBuilder.addUnitPreset',
      'spawnGameboardActor',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/simple-rpg-local-third-party-assets.png',
    ],
    docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/guides/runtime-integration.md'],
  },
  {
    id: 'page-15-shipyard-harbors',
    page: 15,
    title: 'Shipyard, harbors, and ports',
    sourceImage: GUIDE_IMAGE.shipyard,
    edition: 'mixed',
    summary:
      'Covers harbor buildings, ships, boats, anchors, coast tiles, water tiles, and port placement constraints.',
    publicApi: [
      'GameboardBuilder.addHarbor',
      'GameboardBuilder.setCoastEdges',
      'GameboardBuilder.addUnitPreset',
      'externalAssetSpawnOptions',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-harbor-gameboard.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png',
    ],
    docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/pillars/03-editions-and-ingest.md'],
  },
  {
    id: 'page-16-stables-and-horses',
    page: 16,
    title: 'Stables and horses',
    sourceImage: GUIDE_IMAGE.stables,
    edition: 'extra',
    summary:
      'Covers stables, fenced paddocks, hay/trough props, horse parts, mount presets, and movement-facing metadata.',
    publicApi: [
      'GameboardBuilder.addFactionBuilding',
      'GameboardBuilder.addNeutralStructure',
      'GameboardBuilder.addProp',
      'GameboardBuilder.addUnitPreset',
      'recommendExternalAssetFacing',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png',
    ],
    docs: [
      'docs/pillars/02-asset-taxonomy.md',
      'docs/guides/rendering-assets-and-external-packs.md',
    ],
  },
  {
    id: 'page-17-workshop-and-siege',
    page: 17,
    title: 'Workshop and siege units',
    sourceImage: GUIDE_IMAGE.workshop,
    edition: 'extra',
    summary:
      'Covers workshops, tower cannons, siege equipment, projectiles, wall/fence contexts, and combat markers.',
    publicApi: [
      'GameboardBuilder.addFactionBuilding',
      'GameboardBuilder.addUnitPreset',
      'GameboardBuilder.addProp',
      'planGameboardInteractionCommand',
      'executeGameboardInteractionCommand',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png',
    ],
    docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/guides/runtime-integration.md'],
  },
  {
    id: 'page-18-unit-combinations',
    page: 18,
    title: 'Unit combinations',
    sourceImage: GUIDE_IMAGE.unitCombinations,
    edition: 'extra',
    summary:
      'Covers composed unit presets, colored/neutral part layering, equipment combinations, and actor registration.',
    publicApi: [
      'coloredUnitAssetId',
      'neutralUnitAssetId',
      'GameboardBuilder.addUnitPreset',
      'spawnGameboardActor',
      'createGameboardRuntimeFromScenario',
    ],
    visualArtifacts: [
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png',
      'packages/declarative-hex-worlds/tests/browser/__screenshots__/simple-rpg-seeded-completed.png',
    ],
    docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/guides/recipes-scenarios-and-simulation.md'],
  },
  {
    id: 'page-19-supporters-and-attribution',
    page: 19,
    title: 'Supporters and attribution',
    sourceImage: GUIDE_IMAGE.attribution,
    edition: 'reference',
    summary:
      'Keeps KayKit credit, CC0 asset attribution, MIT code licensing, and publishable package notices visible.',
    assetIds: [],
    publicApi: ['NOTICE.md', 'package.json files', 'listKayKitGuideScenarios'],
    treatmentRoles: [],
    visualArtifacts: [GUIDE_IMAGE.attribution, 'NOTICE.md'],
    docs: ['NOTICE.md', 'docs/pillars/00-library-charter.md', 'README.md'],
  },
];

export function createKayKitGuideScenarios(
  treatments: readonly KayKitAssetPublicTreatment[]
): KayKitGuideScenario[] {
  const treatmentByAssetId = Object.fromEntries(
    treatments.map((treatment) => [treatment.assetId, treatment])
  ) as Readonly<Record<string, KayKitAssetPublicTreatment>>;
  return KAYKIT_GUIDE_SCENARIO_TABLE.map((input) =>
    guideScenario(input, treatments, treatmentByAssetId)
  );
}

type KayKitGuideScenarioInput = Omit<
  KayKitGuideScenario,
  'assetIds' | 'publicApi' | 'treatmentRoles'
> & {
  assetIds?: readonly string[];
  publicApi?: readonly string[];
  treatmentRoles?: readonly KayKitAssetPublicRole[];
};

function guideScenario(
  input: KayKitGuideScenarioInput,
  treatments: readonly KayKitAssetPublicTreatment[],
  treatmentByAssetId: Readonly<Record<string, KayKitAssetPublicTreatment>>
): KayKitGuideScenario {
  const assetIds = uniqueSortedStrings(
    input.assetIds ?? assetIdsForGuideImage(input.sourceImage, treatments)
  );
  const matchingTreatments = assetIds
    .map((assetId) => treatmentByAssetId[assetId])
    .filter((treatment): treatment is KayKitAssetPublicTreatment => treatment !== undefined);
  return {
    ...input,
    assetIds,
    publicApi: uniqueSortedStrings([
      ...(input.publicApi ?? []),
      ...matchingTreatments.flatMap((treatment) => treatment.publicApi),
    ]),
    treatmentRoles: uniqueSortedRoles([
      ...(input.treatmentRoles ?? []),
      ...matchingTreatments.map((treatment) => treatment.role),
    ]),
  };
}

function assetIdsForGuideImage(
  sourceImage: string,
  treatments: readonly KayKitAssetPublicTreatment[]
): string[] {
  return uniqueSortedStrings(
    treatments
      .filter((treatment) => treatment.sourceImages.includes(sourceImage))
      .map((treatment) => treatment.assetId)
  );
}

function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueSortedRoles(values: readonly KayKitAssetPublicRole[]): KayKitAssetPublicRole[] {
  return [...new Set(values)].sort();
}
