/**
 * KayKit Medieval Hexagon taxonomy constants and asset-id constructors for
 * tiles, faction buildings, props, nature pieces, texture sets, and units.
 *
 * @module
 */
import { FACTIONS, TEXTURE_SETS, UNIT_STYLES } from './types';
import type { AssetCategory, Faction, PackEdition, TextureSet, UnitStyle } from './types';

/** Base and support tile asset ids used by terrain helpers. */
export const BASE_TILE_ASSET_IDS = [
  'hex_grass_bottom',
  'hex_grass_sloped_high',
  'hex_grass_sloped_low',
  'hex_grass',
  'hex_water',
] as const;

/** EXTRA-only transition tile ids used for biome blends. */
export const EXTRA_TRANSITION_TILE_ASSET_IDS = ['hex_transition'] as const;

/** Road tile asset ids from the guide index. */
export const ROAD_TILE_ASSET_IDS = [
  'hex_road_A_sloped_high',
  'hex_road_A_sloped_low',
  'hex_road_A',
  'hex_road_B',
  'hex_road_C',
  'hex_road_D',
  'hex_road_E',
  'hex_road_F',
  'hex_road_G',
  'hex_road_H',
  'hex_road_I',
  'hex_road_J',
  'hex_road_K',
  'hex_road_L',
  'hex_road_M',
] as const;

/** Coast and waterless coast tile asset ids from the guide index. */
export const COAST_TILE_ASSET_IDS = ['A', 'B', 'C', 'D', 'E'].flatMap((label) => [
  `hex_coast_${label}`,
  `hex_coast_${label}_waterless`,
]) as readonly CoastTileAssetId[];

/** River, curvy river, crossing, and waterless river asset ids from the guide. */
export const RIVER_TILE_ASSET_IDS = [
  'hex_river_A_curvy',
  'hex_river_A',
  'hex_river_B',
  'hex_river_C',
  'hex_river_crossing_A',
  'hex_river_crossing_B',
  'hex_river_D',
  'hex_river_E',
  'hex_river_F',
  'hex_river_G',
  'hex_river_H',
  'hex_river_I',
  'hex_river_J',
  'hex_river_K',
  'hex_river_L',
  'hex_river_A_curvy_waterless',
  'hex_river_A_waterless',
  'hex_river_B_waterless',
  'hex_river_C_waterless',
  'hex_river_crossing_A_waterless',
  'hex_river_crossing_B_waterless',
  'hex_river_D_waterless',
  'hex_river_E_waterless',
  'hex_river_F_waterless',
  'hex_river_G_waterless',
  'hex_river_H_waterless',
  'hex_river_I_waterless',
  'hex_river_J_waterless',
  'hex_river_K_waterless',
  'hex_river_L_waterless',
] as const;

/** All faction-colored building ids supported across FREE and EXTRA editions. */
export const FACTION_BUILDING_KINDS = [
  'archeryrange',
  'barracks',
  'blacksmith',
  'castle',
  'church',
  'docks',
  'home_A',
  'home_B',
  'lumbermill',
  'market',
  'mine',
  'shipyard',
  'shrine',
  'stables',
  'tavern',
  'tent',
  'townhall',
  'tower_A',
  'tower_B',
  'tower_base',
  'tower_cannon',
  'tower_catapult',
  'watchtower',
  'watermill',
  'well',
  'windmill',
  'workshop',
] as const;

/** Faction-colored building kinds available in the FREE KayKit pack. */
export const FREE_FACTION_BUILDING_KINDS = [
  'archeryrange',
  'barracks',
  'blacksmith',
  'castle',
  'church',
  'home_A',
  'home_B',
  'lumbermill',
  'market',
  'mine',
  'tavern',
  'tower_A',
  'tower_B',
  'tower_base',
  'tower_catapult',
  'watermill',
  'well',
  'windmill',
] as const satisfies readonly FactionBuildingKind[];

/** Faction-colored building kinds expected from the local EXTRA ingest. */
export const EXTRA_FACTION_BUILDING_KINDS = [
  'docks',
  'shipyard',
  'shrine',
  'stables',
  'tent',
  'townhall',
  'tower_cannon',
  'watchtower',
  'workshop',
] as const satisfies readonly FactionBuildingKind[];

/** Neutral structure asset ids available to placement helpers. */
export const NEUTRAL_STRUCTURE_KINDS = [
  'building_bridge_A',
  'building_bridge_B',
  'building_destroyed',
  'building_dirt',
  'building_grain',
  'building_scaffolding',
  'building_stage_A',
  'building_stage_B',
  'building_stage_C',
  'fence_stone_straight',
  'fence_stone_straight_gate',
  'fence_wood_straight',
  'fence_wood_straight_gate',
  'projectile_catapult',
  'wall_corner_A_gate',
  'wall_corner_A_inside',
  'wall_corner_A_outside',
  'wall_corner_B_inside',
  'wall_corner_B_outside',
  'wall_straight',
  'wall_straight_gate',
] as const;

/** Nature and terrain-detail asset ids available to placement helpers. */
export const NATURE_ASSET_IDS = [
  'cloud_big',
  'cloud_small',
  'hill_single_A',
  'hill_single_B',
  'hill_single_C',
  'hills_A',
  'hills_A_trees',
  'hills_B',
  'hills_B_trees',
  'hills_C',
  'hills_C_trees',
  'mountain_A',
  'mountain_A_grass',
  'mountain_A_grass_trees',
  'mountain_B',
  'mountain_B_grass',
  'mountain_B_grass_trees',
  'mountain_C',
  'mountain_C_grass',
  'mountain_C_grass_trees',
  'rock_single_A',
  'rock_single_B',
  'rock_single_C',
  'rock_single_D',
  'rock_single_E',
  'tree_single_A',
  'tree_single_A_cut',
  'tree_single_B',
  'tree_single_B_cut',
  'trees_A_cut',
  'trees_A_large',
  'trees_A_medium',
  'trees_A_small',
  'trees_B_cut',
  'trees_B_large',
  'trees_B_medium',
  'trees_B_small',
  'waterlily_A',
  'waterlily_B',
  'waterplant_A',
  'waterplant_B',
  'waterplant_C',
] as const;

/** All prop asset ids supported across FREE and EXTRA editions. */
export const PROP_ASSET_IDS = [
  'anchor',
  'barrel',
  'boat',
  'boatrack',
  'bucket_arrows',
  'bucket_empty',
  'bucket_water',
  'cannonball_pallet',
  'crate_A_big',
  'crate_A_small',
  'crate_B_big',
  'crate_B_small',
  'crate_long_A',
  'crate_long_B',
  'crate_long_C',
  'crate_long_empty',
  'crate_open',
  'flag_blue',
  'flag_green',
  'flag_red',
  'flag_yellow',
  'haybale',
  'icon_combat',
  'icon_range',
  'ladder',
  'pallet',
  'resource_lumber',
  'resource_stone',
  'sack',
  'target',
  'tent',
  'trough',
  'trough_long',
  'weaponrack',
  'wheelbarrow',
] as const;

/** Prop asset ids available in the FREE KayKit pack. */
export const FREE_PROP_ASSET_IDS = [
  'barrel',
  'bucket_arrows',
  'bucket_empty',
  'bucket_water',
  'crate_A_big',
  'crate_A_small',
  'crate_B_big',
  'crate_B_small',
  'crate_long_A',
  'crate_long_B',
  'crate_long_C',
  'crate_long_empty',
  'crate_open',
  'flag_blue',
  'flag_green',
  'flag_red',
  'flag_yellow',
  'ladder',
  'pallet',
  'resource_lumber',
  'resource_stone',
  'sack',
  'target',
  'tent',
  'weaponrack',
  'wheelbarrow',
] as const satisfies readonly PropAssetId[];

/** Prop asset ids expected from the local EXTRA ingest. */
export const EXTRA_PROP_ASSET_IDS = [
  'anchor',
  'boat',
  'boatrack',
  'cannonball_pallet',
  'haybale',
  'icon_combat',
  'icon_range',
  'trough',
  'trough_long',
] as const satisfies readonly PropAssetId[];

/** Faction-colored unit part ids expected from the local EXTRA ingest. */
export const COLORED_UNIT_PARTS = [
  'banner',
  'bow',
  'cannon',
  'cart',
  'cart_merchant',
  'catapult',
  'helmet',
  'horse',
  'projectile_arrow',
  'shield',
  'ship',
  'spear',
  'sword',
  'unit',
] as const;

/** Neutral unit and equipment part ids expected from the local EXTRA ingest. */
export const NEUTRAL_UNIT_PARTS = [
  'banner',
  'bow',
  'cannon',
  'cart',
  'cart_merchant',
  'catapult',
  'hammer',
  'helmet',
  'horse_A',
  'horse_B',
  'horse_C',
  'horse_D',
  'horse_E',
  'horse_F',
  'horse_G',
  'horse_saddle',
  'projectile_arrow',
  'projectile_cannonball',
  'projectile_catapult',
  'shield',
  'ship',
  'shovel',
  'spear',
  'sword',
  'unit',
] as const;

/** Unit texture application styles available for colored unit parts. */
export const EXTRA_UNIT_STYLES = ['accent', 'full'] as const satisfies readonly UnitStyle[];

/** Any faction building kind supported by catalog helpers. */
export type FactionBuildingKind = (typeof FACTION_BUILDING_KINDS)[number];
/** FREE faction building kind. */
export type FreeFactionBuildingKind = (typeof FREE_FACTION_BUILDING_KINDS)[number];
/** EXTRA-only faction building kind. */
export type ExtraFactionBuildingKind = (typeof EXTRA_FACTION_BUILDING_KINDS)[number];
/** Neutral structure kind. */
export type NeutralStructureKind = (typeof NEUTRAL_STRUCTURE_KINDS)[number];
/** Nature asset id. */
export type NatureAssetId = (typeof NATURE_ASSET_IDS)[number];
/** Prop asset id. */
export type PropAssetId = (typeof PROP_ASSET_IDS)[number];
/** Faction-colored unit part id. */
export type ColoredUnitPart = (typeof COLORED_UNIT_PARTS)[number];
/** Neutral unit part id. */
export type NeutralUnitPart = (typeof NEUTRAL_UNIT_PARTS)[number];
/** Colored unit style id. */
export type ColoredUnitStyle = (typeof EXTRA_UNIT_STYLES)[number];
/** Any unit part id supported by catalog helpers. */
export type UnitPart = ColoredUnitPart | NeutralUnitPart;
/** Base or support tile asset id. */
export type BaseTileAssetId = (typeof BASE_TILE_ASSET_IDS)[number];
/** EXTRA-only transition tile asset id. */
export type ExtraTransitionTileAssetId = (typeof EXTRA_TRANSITION_TILE_ASSET_IDS)[number];
/** Road tile asset id. */
export type RoadTileAssetId = (typeof ROAD_TILE_ASSET_IDS)[number];
/** Coast or waterless coast tile asset id. */
export type CoastTileAssetId = `hex_coast_${'A' | 'B' | 'C' | 'D' | 'E'}${'' | '_waterless'}`;
/** River, crossing, curvy, or waterless river tile asset id. */
export type RiverTileAssetId = (typeof RIVER_TILE_ASSET_IDS)[number];
/** Tile asset id covered by guide-derived helpers. */
export type KayKitTileAssetId =
  | BaseTileAssetId
  | ExtraTransitionTileAssetId
  | RoadTileAssetId
  | CoastTileAssetId
  | RiverTileAssetId;

/**
 * Public treatment role assigned to every KayKit Medieval Hexagon asset.
 */
export type KayKitAssetPublicRole =
  | 'base-tile'
  | 'support-tile'
  | 'road-tile'
  | 'river-tile'
  | 'coast-tile'
  | 'transition-tile'
  | 'faction-building'
  | 'neutral-structure'
  | 'nature-decoration'
  | 'prop'
  | 'colored-unit-part'
  | 'neutral-unit-part';

/**
 * Public API treatment for one asset id. This is the contract that keeps assets
 * from becoming a passive catalog entry with no builder, selector, or layout path.
 */
export interface KayKitAssetPublicTreatment {
  /** Stable manifest asset id used by plans and placement records. */
  assetId: string;
  /** Lowest edition that exposes this asset id. */
  minimumEdition: PackEdition;
  /** Top-level manifest category. */
  category: AssetCategory;
  /** Manifest subcategory or source folder. */
  subcategory: string;
  /** Source-relative GLTF path for FREE packaging or local EXTRA ingest. */
  sourcePath: string;
  /** Intent-level role used by docs, selectors, and gameplay placement helpers. */
  role: KayKitAssetPublicRole;
  /** Placement kind produced by the public board/runtime APIs. */
  placementKind: 'terrain' | 'road' | 'river' | 'coast' | 'transition' | 'decoration' | 'structure' | 'unit' | 'prop';
  /** Placement layer produced by the public board/runtime APIs. */
  placementLayer: 'terrain' | 'surface' | 'feature' | 'structure' | 'unit';
  /** Public helpers or selectors that intentionally exercise this asset. */
  publicApi: readonly string[];
  /** Extracted guide images that motivate this treatment. */
  sourceImages: readonly string[];
  /** Human-readable scenario group for visual contact sheets and docs. */
  scenario: string;
  /** Whether this asset should be treated as local-only/EXTRA in apps. */
  requiresExtra: boolean;
}

/** Builds a faction-colored building asset id. */
export function factionBuildingAssetId(kind: FactionBuildingKind, faction: Faction): string {
  return `building_${kind}_${faction}`;
}

/** Builds a faction-colored unit part asset id. */
export function coloredUnitAssetId(part: ColoredUnitPart, faction: Faction, style: ColoredUnitStyle): string {
  return `${part}_${faction}_${style}`;
}

/** Returns the neutral unit/equipment asset id for a part. */
export function neutralUnitAssetId(part: NeutralUnitPart): string {
  if (part === 'projectile_catapult') {
    return 'units_neutral_projectile_catapult';
  }
  return part;
}

/** Lists the public treatment contract for every FREE and local EXTRA KayKit asset id. */
export function listKayKitAssetPublicTreatments(): KayKitAssetPublicTreatment[] {
  return [...KAYKIT_ASSET_PUBLIC_TREATMENTS];
}

/** Returns the public treatment contract for one asset id, if the id is KayKit-owned. */
export function describeKayKitAssetTreatment(assetId: string): KayKitAssetPublicTreatment | undefined {
  return KAYKIT_ASSET_PUBLIC_TREATMENT_BY_ID[assetId];
}

/** Returns whether an asset id has an explicit public API treatment. */
export function hasKayKitAssetTreatment(assetId: string): boolean {
  return describeKayKitAssetTreatment(assetId) !== undefined;
}

/** Checks whether an asset id belongs to known local-only EXTRA content. */
export function isKnownExtraAssetId(assetId: string): boolean {
  if ((EXTRA_PROP_ASSET_IDS as readonly string[]).includes(assetId)) {
    return true;
  }
  if (assetId === 'hex_transition') {
    return true;
  }
  for (const faction of FACTIONS) {
    for (const kind of EXTRA_FACTION_BUILDING_KINDS) {
      if (assetId === factionBuildingAssetId(kind, faction)) {
        return true;
      }
    }
    for (const part of COLORED_UNIT_PARTS) {
      for (const style of EXTRA_UNIT_STYLES) {
        if (assetId === coloredUnitAssetId(part, faction, style)) {
          return true;
        }
      }
    }
  }
  if (assetId === neutralUnitAssetId('projectile_catapult')) {
    return true;
  }
  if ((NEUTRAL_UNIT_PARTS as readonly string[]).includes(assetId)) {
    return !(
      (FREE_PROP_ASSET_IDS as readonly string[]).includes(assetId) ||
      (NEUTRAL_STRUCTURE_KINDS as readonly string[]).includes(assetId) ||
      (NATURE_ASSET_IDS as readonly string[]).includes(assetId)
    );
  }
  return false;
}

/** Builds a faction flag prop asset id. */
export function flagAssetId(faction: Faction): PropAssetId {
  return `flag_${faction}` as PropAssetId;
}

/** Returns the texture filename for a KayKit texture set. */
export function textureFileName(textureSet: TextureSet): string {
  switch (textureSet) {
    case 'fall':
      return 'hexagons_medieval_Fall.png';
    case 'summer':
      return 'hexagons_medieval_Summer.png';
    case 'winter':
      return 'hexagons_medieval_Winter.png';
    case 'default':
      return 'hexagons_medieval.png';
  }
}

/** Type guard for supported faction ids. */
export function isFaction(value: string): value is Faction {
  return (FACTIONS as readonly string[]).includes(value);
}

/** Type guard for supported KayKit texture set ids. */
export function isTextureSet(value: string): value is TextureSet {
  return (TEXTURE_SETS as readonly string[]).includes(value);
}

/** Type guard for supported colored unit styles. */
export function isUnitStyle(value: string): value is UnitStyle {
  return (UNIT_STYLES as readonly string[]).includes(value);
}

const GUIDE_IMAGE = {
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
} as const;

const KAYKIT_ASSET_PUBLIC_TREATMENTS = createKayKitAssetPublicTreatments();
const KAYKIT_ASSET_PUBLIC_TREATMENT_BY_ID: Readonly<Record<string, KayKitAssetPublicTreatment>> =
  Object.fromEntries(KAYKIT_ASSET_PUBLIC_TREATMENTS.map((treatment) => [treatment.assetId, treatment]));

function createKayKitAssetPublicTreatments(): KayKitAssetPublicTreatment[] {
  return [
    ...BASE_TILE_ASSET_IDS.map(baseTileTreatment),
    ...EXTRA_TRANSITION_TILE_ASSET_IDS.map(transitionTileTreatment),
    ...ROAD_TILE_ASSET_IDS.map(roadTileTreatment),
    ...COAST_TILE_ASSET_IDS.map(coastTileTreatment),
    ...RIVER_TILE_ASSET_IDS.map(riverTileTreatment),
    ...factionBuildingTreatments(FREE_FACTION_BUILDING_KINDS, 'free'),
    ...factionBuildingTreatments(EXTRA_FACTION_BUILDING_KINDS, 'extra'),
    ...NEUTRAL_STRUCTURE_KINDS.map(neutralStructureTreatment),
    ...NATURE_ASSET_IDS.map(natureTreatment),
    ...FREE_PROP_ASSET_IDS.map((assetId) => propTreatment(assetId, 'free')),
    ...EXTRA_PROP_ASSET_IDS.map((assetId) => propTreatment(assetId, 'extra')),
    ...coloredUnitTreatments(),
    ...NEUTRAL_UNIT_PARTS.map(neutralUnitTreatment),
  ].sort((left, right) => left.sourcePath.localeCompare(right.sourcePath) || left.assetId.localeCompare(right.assetId));
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
    publicApi: isSupport || isSloped
      ? ['GameboardBuilder.addMountainStack', 'GameboardBuilder.setTileAsset']
      : ['GameboardBuilder.setTerrain', 'GameboardBuilder.setTileAsset', 'createGameboardPlanFromTiles'],
    sourceImages: isSupport || isSloped
      ? [GUIDE_IMAGE.tallerTiles, GUIDE_IMAGE.floatingIslands]
      : [GUIDE_IMAGE.waterUsage, GUIDE_IMAGE.worldDesign],
    scenario: isSupport ? 'tall support tiles' : isSloped ? 'sloped terrain tiles' : 'base terrain tiles',
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
    publicApi: ['GameboardBuilder.addTransition', 'createGameboardPlanFromRecipe', 'validateGameboardRecipe'],
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
    publicApi: ['selectRoadVariant', 'selectRoadVariantByLabel', 'listRoadGuidePermutations', 'GameboardBuilder.addRoadPath'],
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
    sourcePath: assetId.endsWith('_waterless') ? `tiles/coast/waterless/${assetId}.gltf` : `tiles/coast/${assetId}.gltf`,
    role: 'coast-tile',
    placementKind: 'coast',
    placementLayer: 'surface',
    publicApi: ['selectCoastVariant', 'selectCoastVariantByLabel', 'listCoastGuidePermutations', 'GameboardBuilder.setCoastEdges', 'GameboardBuilder.addHarbor'],
    sourceImages: [GUIDE_IMAGE.waterUsage, GUIDE_IMAGE.shipyard],
    scenario: assetId.endsWith('_waterless') ? 'waterless coast permutations' : 'coast and water-edge permutations',
  });
}

function riverTileTreatment(assetId: RiverTileAssetId): KayKitAssetPublicTreatment {
  return treatment({
    assetId,
    minimumEdition: 'free',
    category: 'tiles',
    subcategory: 'rivers',
    sourcePath: assetId.endsWith('_waterless') ? `tiles/rivers/waterless/${assetId}.gltf` : `tiles/rivers/${assetId}.gltf`,
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
  minimumEdition: PackEdition
): KayKitAssetPublicTreatment[] {
  return FACTIONS.flatMap((faction) =>
    kinds.map((kind) => {
      const assetId = factionBuildingAssetId(kind, faction);
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
          ? ['factionBuildingAssetId', 'GameboardBuilder.addHarbor', 'GameboardBuilder.addFactionBuilding']
          : ['factionBuildingAssetId', 'GameboardBuilder.addFactionBuilding', 'GameboardBuilder.addSettlement'],
        sourceImages: [
          GUIDE_IMAGE.buildings,
          ...(isHarbor ? [GUIDE_IMAGE.shipyard] : []),
          ...(isStables ? [GUIDE_IMAGE.stables] : []),
          ...(isWorkshop ? [GUIDE_IMAGE.workshop] : []),
        ],
        scenario: isHarbor ? 'harbors and ports' : isStables ? 'stables and horses' : isWorkshop ? 'workshops and siege' : 'faction settlements',
      });
    })
  );
}

function neutralStructureTreatment(assetId: NeutralStructureKind): KayKitAssetPublicTreatment {
  return treatment({
    assetId,
    minimumEdition: 'free',
    category: 'buildings',
    subcategory: 'neutral',
    sourcePath: `buildings/neutral/${assetId}.gltf`,
    role: 'neutral-structure',
    placementKind: 'structure',
    placementLayer: 'structure',
    publicApi: ['GameboardBuilder.addNeutralStructure', 'createGameboardPlanFromRecipe'],
    sourceImages: [
      GUIDE_IMAGE.buildings,
      ...(assetId.startsWith('wall_') || assetId.startsWith('fence_') ? [GUIDE_IMAGE.stables, GUIDE_IMAGE.workshop] : []),
    ],
    scenario: assetId.startsWith('wall_') || assetId.startsWith('fence_') ? 'walls, fences, and enclosures' : 'neutral structures and construction',
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
      ...(isTree ? ['GameboardBuilder.addForest', 'GameboardBuilder.scatterDecorations'] : ['GameboardBuilder.scatterDecorations']),
      'createGameboardLayoutFillRuleFromPiece',
    ],
    sourceImages: [GUIDE_IMAGE.natureContents, GUIDE_IMAGE.natureUsage, GUIDE_IMAGE.worldDesign, GUIDE_IMAGE.floatingIslands],
    scenario: isMountain ? 'mountain stacks' : isHill ? 'hills and padding' : isTree ? 'forests and scatter' : 'nature decoration scatter',
  });
}

function propTreatment(assetId: PropAssetId, minimumEdition: PackEdition): KayKitAssetPublicTreatment {
  const isFlag = assetId.startsWith('flag_');
  const isHarborProp = ['anchor', 'boat', 'boatrack'].includes(assetId);
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
      'createGameboardLayoutFillRuleFromPiece',
    ],
    sourceImages: [
      GUIDE_IMAGE.buildings,
      GUIDE_IMAGE.natureContents,
      ...(isHarborProp ? [GUIDE_IMAGE.shipyard] : []),
      ...(assetId === 'haybale' || assetId.startsWith('trough') ? [GUIDE_IMAGE.stables] : []),
      ...(assetId.includes('combat') || assetId.includes('range') || assetId.includes('cannon') ? [GUIDE_IMAGE.workshop] : []),
    ],
    scenario: isHarborProp ? 'harbor support props' : isFlag ? 'faction markers' : 'props and resource dressing',
  });
}

function coloredUnitTreatments(): KayKitAssetPublicTreatment[] {
  return FACTIONS.flatMap((faction) =>
    COLORED_UNIT_PARTS.flatMap((part) =>
      EXTRA_UNIT_STYLES.map((style) => {
        const assetId = coloredUnitAssetId(part, faction, style);
        return treatment({
          assetId,
          minimumEdition: 'extra',
          category: 'units',
          subcategory: faction,
          sourcePath: `units/${faction}/${assetId}.gltf`,
          role: 'colored-unit-part',
          placementKind: 'unit',
          placementLayer: 'unit',
          publicApi: ['coloredUnitAssetId', 'GameboardBuilder.addUnit', 'GameboardBuilder.addUnitPreset', 'spawnGameboardActor'],
          sourceImages: [GUIDE_IMAGE.units, GUIDE_IMAGE.stables, GUIDE_IMAGE.workshop, GUIDE_IMAGE.unitCombinations],
          scenario: style === 'full' ? 'full-color unit parts' : 'accent-color unit parts',
        });
      })
    )
  );
}

function neutralUnitTreatment(part: NeutralUnitPart): KayKitAssetPublicTreatment {
  const assetId = neutralUnitAssetId(part);
  return treatment({
    assetId,
    minimumEdition: 'extra',
    category: 'units',
    subcategory: 'neutral',
    sourcePath: `units/neutral/${part}.gltf`,
    role: 'neutral-unit-part',
    placementKind: 'unit',
    placementLayer: 'unit',
    publicApi: ['neutralUnitAssetId', 'GameboardBuilder.addUnit', 'GameboardBuilder.addUnitPreset', 'spawnGameboardActor'],
    sourceImages: [GUIDE_IMAGE.units, GUIDE_IMAGE.stables, GUIDE_IMAGE.workshop, GUIDE_IMAGE.unitCombinations],
    scenario: part.startsWith('horse') ? 'neutral horses and mounts' : part.includes('projectile') || part === 'catapult' || part === 'cannon' ? 'siege and projectiles' : 'neutral unit accessories',
  });
}

function riverPublicApi(assetId: string): readonly string[] {
  if (assetId.includes('crossing')) {
    return ['selectRiverCrossingVariant', 'listRiverCrossingGuidePermutations', 'GameboardBuilder.addRiverPath'];
  }
  if (assetId.includes('curvy')) {
    return ['selectRiverVariant', 'listRiverCurvyGuidePermutations', 'GameboardBuilder.addRiverPath'];
  }
  return ['selectRiverVariant', 'selectRiverVariantByLabel', 'listRiverGuidePermutations', 'GameboardBuilder.addRiverPath'];
}

function treatment(input: Omit<KayKitAssetPublicTreatment, 'requiresExtra'>): KayKitAssetPublicTreatment {
  return {
    ...input,
    requiresExtra: input.minimumEdition === 'extra',
  };
}
