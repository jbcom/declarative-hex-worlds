/**
 * KayKit public treatment construction for catalog asset ids.
 */
import type { Faction, PackEdition } from '../types';
import type {
  BaseTileAssetId,
  CoastTileAssetId,
  ColoredUnitPart,
  ColoredUnitStyle,
  ExtraTransitionTileAssetId,
  FactionBuildingKind,
  KayKitAssetPublicTreatment,
  NatureAssetId,
  NeutralStructureKind,
  NeutralUnitPart,
  PropAssetId,
  RiverTileAssetId,
  RoadTileAssetId,
} from './catalog';
import { GUIDE_IMAGE } from './catalog-guide-data';

interface KayKitAssetPublicTreatmentSource {
  baseTileAssetIds: readonly BaseTileAssetId[];
  extraTransitionTileAssetIds: readonly ExtraTransitionTileAssetId[];
  roadTileAssetIds: readonly RoadTileAssetId[];
  coastTileAssetIds: readonly CoastTileAssetId[];
  riverTileAssetIds: readonly RiverTileAssetId[];
  freeFactionBuildingKinds: readonly FactionBuildingKind[];
  extraFactionBuildingKinds: readonly FactionBuildingKind[];
  neutralStructureKinds: readonly NeutralStructureKind[];
  natureAssetIds: readonly NatureAssetId[];
  freePropAssetIds: readonly PropAssetId[];
  extraPropAssetIds: readonly PropAssetId[];
  coloredUnitParts: readonly ColoredUnitPart[];
  neutralUnitParts: readonly NeutralUnitPart[];
  extraUnitStyles: readonly ColoredUnitStyle[];
  factions: readonly Faction[];
  factionBuildingAssetId: (kind: FactionBuildingKind, faction: Faction) => string;
  coloredUnitAssetId: (part: ColoredUnitPart, faction: Faction, style: ColoredUnitStyle) => string;
  neutralUnitAssetId: (part: NeutralUnitPart) => string;
}

export function createKayKitAssetPublicTreatmentsFromSource(
  source: KayKitAssetPublicTreatmentSource
): KayKitAssetPublicTreatment[] {
  return [
    ...source.baseTileAssetIds.map(baseTileTreatment),
    ...source.extraTransitionTileAssetIds.map(transitionTileTreatment),
    ...source.roadTileAssetIds.map(roadTileTreatment),
    ...source.coastTileAssetIds.map(coastTileTreatment),
    ...source.riverTileAssetIds.map(riverTileTreatment),
    ...factionBuildingTreatments(source.freeFactionBuildingKinds, 'free', source),
    ...factionBuildingTreatments(source.extraFactionBuildingKinds, 'extra', source),
    ...source.neutralStructureKinds.map(neutralStructureTreatment),
    ...source.natureAssetIds.map(natureTreatment),
    ...source.freePropAssetIds.map((assetId) => propTreatment(assetId, 'free')),
    ...source.extraPropAssetIds.map((assetId) => propTreatment(assetId, 'extra')),
    ...coloredUnitTreatments(source),
    ...source.neutralUnitParts.map((part) => neutralUnitTreatment(part, source)),
  ].sort(
    (left, right) =>
      left.sourcePath.localeCompare(right.sourcePath) || left.assetId.localeCompare(right.assetId)
  );
}

function baseTileTreatment(assetId: BaseTileAssetId): KayKitAssetPublicTreatment {
  const isSupport = assetId === 'hex_grass_bottom';
  const isSloped = assetId.includes('_sloped_');
  return treatment({
    assetId,
    minimumEdition: 'free',
    category: 'tiles',
    subcategory: 'base',
    sourcePath: `tiles/base/${assetId}.gltf`,
    role: isSupport ? 'support-tile' : 'base-tile',
    placementKind: 'terrain',
    placementLayer: 'terrain',
    publicApi:
      isSupport || isSloped
        ? [
            'GameboardBuilder.addMountainStack',
            ...(isSloped ? ['GameboardBuilder.addElevationRamp'] : []),
            'GameboardBuilder.setTileAsset',
            'createGameboardPlanFromRecipe',
          ]
        : [
            'GameboardBuilder.setTerrain',
            'GameboardBuilder.setTileAsset',
            'createGameboardPlanFromTiles',
          ],
    sourceImages:
      isSupport || isSloped
        ? [GUIDE_IMAGE.tallerTiles, GUIDE_IMAGE.floatingIslands]
        : [GUIDE_IMAGE.waterUsage, GUIDE_IMAGE.worldDesign],
    scenario: isSupport
      ? 'tall support tiles'
      : isSloped
        ? 'sloped terrain tiles'
        : 'base terrain tiles',
  });
}

function transitionTileTreatment(assetId: ExtraTransitionTileAssetId): KayKitAssetPublicTreatment {
  return treatment({
    assetId,
    minimumEdition: 'extra',
    category: 'tiles',
    subcategory: 'base',
    sourcePath: `tiles/base/${assetId}.gltf`,
    role: 'transition-tile',
    placementKind: 'transition',
    placementLayer: 'surface',
    publicApi: [
      'GameboardBuilder.addTransition',
      'createGameboardPlanFromRecipe',
      'validateGameboardRecipe',
    ],
    sourceImages: [GUIDE_IMAGE.transition, GUIDE_IMAGE.biomes, GUIDE_IMAGE.alternateTextures],
    scenario: 'biome transition tiles',
  });
}

function roadTileTreatment(assetId: RoadTileAssetId): KayKitAssetPublicTreatment {
  return treatment({
    assetId,
    minimumEdition: 'free',
    category: 'tiles',
    subcategory: 'roads',
    sourcePath: `tiles/roads/${assetId}.gltf`,
    role: 'road-tile',
    placementKind: 'road',
    placementLayer: 'surface',
    publicApi: [
      'selectRoadVariant',
      'selectRoadVariantByLabel',
      'listRoadGuidePermutations',
      'GameboardBuilder.addRoadPath',
    ],
    sourceImages: [GUIDE_IMAGE.roads, GUIDE_IMAGE.worldDesign],
    scenario: assetId.includes('_sloped_') ? 'sloped road tiles' : 'road connectivity permutations',
  });
}

function coastTileTreatment(assetId: CoastTileAssetId): KayKitAssetPublicTreatment {
  return treatment({
    assetId,
    minimumEdition: 'free',
    category: 'tiles',
    subcategory: 'coast',
    sourcePath: assetId.endsWith('_waterless')
      ? `tiles/coast/waterless/${assetId}.gltf`
      : `tiles/coast/${assetId}.gltf`,
    role: 'coast-tile',
    placementKind: 'coast',
    placementLayer: 'surface',
    publicApi: [
      'selectCoastVariant',
      'selectCoastVariantByLabel',
      'listCoastGuidePermutations',
      'GameboardBuilder.setCoastEdges',
      'GameboardBuilder.addHarbor',
    ],
    sourceImages: [GUIDE_IMAGE.waterUsage, GUIDE_IMAGE.shipyard],
    scenario: assetId.endsWith('_waterless')
      ? 'waterless coast permutations'
      : 'coast and water-edge permutations',
  });
}

function riverTileTreatment(assetId: RiverTileAssetId): KayKitAssetPublicTreatment {
  return treatment({
    assetId,
    minimumEdition: 'free',
    category: 'tiles',
    subcategory: 'rivers',
    sourcePath: assetId.endsWith('_waterless')
      ? `tiles/rivers/waterless/${assetId}.gltf`
      : `tiles/rivers/${assetId}.gltf`,
    role: 'river-tile',
    placementKind: 'river',
    placementLayer: 'surface',
    publicApi: riverPublicApi(assetId),
    sourceImages: [GUIDE_IMAGE.rivers, GUIDE_IMAGE.waterUsage],
    scenario: assetId.includes('crossing')
      ? 'river crossing permutations'
      : assetId.includes('curvy')
        ? 'curvy river permutations'
        : assetId.endsWith('_waterless')
          ? 'waterless river permutations'
          : 'river connectivity permutations',
  });
}

function factionBuildingTreatments(
  kinds: readonly FactionBuildingKind[],
  minimumEdition: PackEdition,
  source: KayKitAssetPublicTreatmentSource
): KayKitAssetPublicTreatment[] {
  return source.factions.flatMap((faction) =>
    kinds.map((kind) => {
      const assetId = source.factionBuildingAssetId(kind, faction);
      const isHarbor = kind === 'docks' || kind === 'shipyard' || kind === 'watermill';
      const isStables = kind === 'stables';
      const isWorkshop = kind === 'workshop' || kind === 'tower_cannon';
      return treatment({
        assetId,
        minimumEdition,
        category: 'buildings',
        subcategory: faction,
        sourcePath: `buildings/${faction}/${assetId}.gltf`,
        role: 'faction-building',
        placementKind: 'structure',
        placementLayer: 'structure',
        publicApi: isHarbor
          ? [
              'factionBuildingAssetId',
              'GameboardBuilder.addHarbor',
              'GameboardBuilder.addFactionBuilding',
            ]
          : [
              'factionBuildingAssetId',
              'GameboardBuilder.addFactionBuilding',
              'GameboardBuilder.addSettlement',
            ],
        sourceImages: [
          GUIDE_IMAGE.buildings,
          ...(isHarbor ? [GUIDE_IMAGE.shipyard] : []),
          ...(isStables ? [GUIDE_IMAGE.stables] : []),
          ...(isWorkshop ? [GUIDE_IMAGE.workshop] : []),
        ],
        scenario: isHarbor
          ? 'harbors and ports'
          : isStables
            ? 'stables and horses'
            : isWorkshop
              ? 'workshops and siege'
              : 'faction settlements',
      });
    })
  );
}

function neutralStructureTreatment(assetId: NeutralStructureKind): KayKitAssetPublicTreatment {
  const isBridge = assetId.startsWith('building_bridge_');
  const isFortification = assetId.startsWith('wall_') || assetId.startsWith('fence_');
  const isConstruction = [
    'building_destroyed',
    'building_dirt',
    'building_grain',
    'building_scaffolding',
    'building_stage_A',
    'building_stage_B',
    'building_stage_C',
  ].includes(assetId);
  const isSiegeProjectile = assetId === 'projectile_catapult';
  return treatment({
    assetId,
    minimumEdition: 'free',
    category: 'buildings',
    subcategory: 'neutral',
    sourcePath: `buildings/neutral/${assetId}.gltf`,
    role: 'neutral-structure',
    placementKind: 'structure',
    placementLayer: 'structure',
    publicApi: [
      'GameboardBuilder.addNeutralStructure',
      ...(isBridge ? ['GameboardBuilder.addBridge'] : []),
      ...(isFortification ? ['GameboardBuilder.addFortification'] : []),
      ...(isConstruction ? ['GameboardBuilder.addConstructionSite'] : []),
      ...(isSiegeProjectile ? ['GameboardBuilder.addSiegeProjectile'] : []),
      'createGameboardPlanFromRecipe',
    ],
    sourceImages: [
      GUIDE_IMAGE.buildings,
      ...(isBridge ? [GUIDE_IMAGE.waterUsage, GUIDE_IMAGE.worldDesign] : []),
      ...(isFortification ? [GUIDE_IMAGE.stables, GUIDE_IMAGE.workshop] : []),
      ...(isConstruction || isSiegeProjectile ? [GUIDE_IMAGE.workshop] : []),
    ],
    scenario: isBridge
      ? 'bridge structures and road crossings'
      : isFortification
        ? 'walls, fences, and enclosures'
        : isConstruction
          ? 'construction sites, worksites, and ruins'
          : isSiegeProjectile
            ? 'siege projectile structures'
            : 'neutral structures and construction',
  });
}

function natureTreatment(assetId: NatureAssetId): KayKitAssetPublicTreatment {
  const isMountain = assetId.startsWith('mountain_');
  const isHill = assetId.startsWith('hill');
  const isTree = assetId.startsWith('tree');
  return treatment({
    assetId,
    minimumEdition: 'free',
    category: 'decoration',
    subcategory: 'nature',
    sourcePath: `decoration/nature/${assetId}.gltf`,
    role: 'nature-decoration',
    placementKind: 'decoration',
    placementLayer: 'feature',
    publicApi: [
      'GameboardBuilder.addNature',
      ...(isMountain ? ['GameboardBuilder.addMountainStack'] : []),
      ...(isHill ? ['GameboardBuilder.addHill'] : []),
      ...(isTree
        ? ['GameboardBuilder.addForest', 'GameboardBuilder.scatterDecorations']
        : ['GameboardBuilder.scatterDecorations']),
      'createGameboardLayoutFillRuleFromPiece',
    ],
    sourceImages: [
      GUIDE_IMAGE.natureContents,
      GUIDE_IMAGE.natureUsage,
      GUIDE_IMAGE.worldDesign,
      GUIDE_IMAGE.floatingIslands,
    ],
    scenario: isMountain
      ? 'mountain stacks'
      : isHill
        ? 'hills and padding'
        : isTree
          ? 'forests and scatter'
          : 'nature decoration scatter',
  });
}

function propTreatment(
  assetId: PropAssetId,
  minimumEdition: PackEdition
): KayKitAssetPublicTreatment {
  const isFlag = assetId.startsWith('flag_');
  const isHarborProp = ['anchor', 'boat', 'boatrack'].includes(assetId);
  const isStableProp = assetId === 'haybale' || assetId.startsWith('trough');
  const isTrainingProp = [
    'target',
    'weaponrack',
    'bucket_arrows',
    'cannonball_pallet',
    'icon_combat',
    'icon_range',
  ].includes(assetId);
  const isWorksiteProp = [
    'ladder',
    'pallet',
    'wheelbarrow',
    'bucket_empty',
    'bucket_water',
    'crate_long_empty',
  ].includes(assetId);
  const isCampProp = assetId === 'tent';
  const isResourceProp =
    assetId.startsWith('resource_') ||
    assetId.startsWith('crate_') ||
    assetId === 'barrel' ||
    assetId === 'sack';
  return treatment({
    assetId,
    minimumEdition,
    category: 'decoration',
    subcategory: 'props',
    sourcePath: `decoration/props/${assetId}.gltf`,
    role: 'prop',
    placementKind: 'prop',
    placementLayer: 'feature',
    publicApi: [
      'GameboardBuilder.addProp',
      ...(isFlag ? ['GameboardBuilder.addFlag', 'flagAssetId'] : []),
      ...(isHarborProp ? ['GameboardBuilder.addHarbor'] : []),
      ...(!isFlag ? ['GameboardBuilder.addPropCluster', 'listPropClusterAssets'] : []),
      'createGameboardLayoutFillRuleFromPiece',
    ],
    sourceImages: [
      GUIDE_IMAGE.buildings,
      GUIDE_IMAGE.natureContents,
      ...(isHarborProp ? [GUIDE_IMAGE.shipyard] : []),
      ...(isStableProp ? [GUIDE_IMAGE.stables] : []),
      ...(isTrainingProp ? [GUIDE_IMAGE.workshop] : []),
    ],
    scenario: isHarborProp
      ? 'harbor support prop clusters'
      : isFlag
        ? 'faction markers'
        : isStableProp
          ? 'stable yard prop clusters'
          : isTrainingProp
            ? 'training yard prop clusters'
            : isWorksiteProp
              ? 'worksite prop clusters'
              : isCampProp
                ? 'camp prop clusters'
                : isResourceProp
                  ? 'resource cache prop clusters'
                  : 'props and resource dressing',
  });
}

function coloredUnitTreatments(
  source: KayKitAssetPublicTreatmentSource
): KayKitAssetPublicTreatment[] {
  return source.factions.flatMap((faction) =>
    source.coloredUnitParts.flatMap((part) =>
      source.extraUnitStyles.map((style) => {
        const assetId = source.coloredUnitAssetId(part, faction, style);
        return treatment({
          assetId,
          minimumEdition: 'extra',
          category: 'units',
          subcategory: faction,
          sourcePath: `units/${faction}/${assetId}.gltf`,
          role: 'colored-unit-part',
          placementKind: 'unit',
          placementLayer: 'unit',
          publicApi: [
            'coloredUnitAssetId',
            'GameboardBuilder.addUnit',
            'GameboardBuilder.addUnitPreset',
            'spawnGameboardActor',
          ],
          sourceImages: [
            GUIDE_IMAGE.units,
            GUIDE_IMAGE.stables,
            GUIDE_IMAGE.workshop,
            GUIDE_IMAGE.unitCombinations,
          ],
          scenario: style === 'full' ? 'full-color unit parts' : 'accent-color unit parts',
        });
      })
    )
  );
}

function neutralUnitTreatment(
  part: NeutralUnitPart,
  source: KayKitAssetPublicTreatmentSource
): KayKitAssetPublicTreatment {
  const assetId = source.neutralUnitAssetId(part);
  return treatment({
    assetId,
    minimumEdition: 'extra',
    category: 'units',
    subcategory: 'neutral',
    sourcePath: `units/neutral/${part}.gltf`,
    role: 'neutral-unit-part',
    placementKind: 'unit',
    placementLayer: 'unit',
    publicApi: [
      'neutralUnitAssetId',
      'GameboardBuilder.addUnit',
      'GameboardBuilder.addUnitPreset',
      'spawnGameboardActor',
    ],
    sourceImages: [
      GUIDE_IMAGE.units,
      GUIDE_IMAGE.stables,
      GUIDE_IMAGE.workshop,
      GUIDE_IMAGE.unitCombinations,
    ],
    scenario: part.startsWith('horse')
      ? 'neutral horses and mounts'
      : part.includes('projectile') || part === 'catapult' || part === 'cannon'
        ? 'siege and projectiles'
        : 'neutral unit accessories',
  });
}

function riverPublicApi(assetId: string): readonly string[] {
  if (assetId.includes('crossing')) {
    return [
      'selectRiverCrossingVariant',
      'listRiverCrossingGuidePermutations',
      'GameboardBuilder.addRiverPath',
    ];
  }
  if (assetId.includes('curvy')) {
    return [
      'selectRiverVariant',
      'listRiverCurvyGuidePermutations',
      'GameboardBuilder.addRiverPath',
    ];
  }
  return [
    'selectRiverVariant',
    'selectRiverVariantByLabel',
    'listRiverGuidePermutations',
    'GameboardBuilder.addRiverPath',
  ];
}

function treatment(
  input: Omit<KayKitAssetPublicTreatment, 'requiresExtra'>
): KayKitAssetPublicTreatment {
  return {
    ...input,
    requiresExtra: input.minimumEdition === 'extra',
  };
}
