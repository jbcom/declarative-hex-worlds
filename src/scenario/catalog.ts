/**
 * KayKit Medieval Hexagon taxonomy constants and asset-id constructors for
 * tiles, faction buildings, props, nature pieces, texture sets, and units.
 *
 * @module
 */

import type { AssetCategory, Faction, PackEdition, TextureSet, UnitStyle } from '../types';
import { FACTIONS, TEXTURE_SETS, UNIT_STYLES } from '../types';
import { createKayKitGuideScenarios } from './catalog-guide-data';
import { createKayKitAssetPublicTreatmentsFromSource } from './catalog-treatments';

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
  placementKind:
    | 'terrain'
    | 'road'
    | 'river'
    | 'coast'
    | 'transition'
    | 'decoration'
    | 'structure'
    | 'unit'
    | 'prop';
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

/** Edition scope for an extracted KayKit guide-page scenario. */
export type KayKitGuideScenarioEdition = PackEdition | 'mixed' | 'reference';

/**
 * Decomposed scenario contract for one extracted KayKit guide page. Scenarios
 * connect the image page to assets, public APIs, visual artifacts, and docs.
 */
export interface KayKitGuideScenario {
  /** Stable scenario id derived from the guide page and use case. */
  id: string;
  /** One-based extracted guide page number. */
  page: number;
  /** Human-readable guide page title. */
  title: string;
  /** Extracted PNG page used as source material. */
  sourceImage: string;
  /** Edition scope for the use case shown by the page. */
  edition: KayKitGuideScenarioEdition;
  /** Concise implementation intent for humans, tests, and agents. */
  summary: string;
  /** Asset ids that must be exercised for this page/use case. */
  assetIds: readonly string[];
  /** Public helper surfaces that express this guide page. */
  publicApi: readonly string[];
  /** Public treatment roles represented by this page. */
  treatmentRoles: readonly KayKitAssetPublicRole[];
  /** Screenshot or docs artifacts that should be reviewed for this page. */
  visualArtifacts: readonly string[];
  /** Documentation pages that explain the public contract. */
  docs: readonly string[];
}

/** Coverage counts for KayKit guide assets by unique id and page occurrence. */
export interface KayKitGuideAssetCoverageCounts {
  /** Unique asset ids referenced by the guide scenario matrix. */
  unique: number;
  /** Unique FREE asset ids referenced by the guide scenario matrix. */
  free: number;
  /** Unique EXTRA asset ids referenced by the guide scenario matrix. */
  extra: number;
  /** Total scenario asset references, counting repeated page-level use. */
  occurrences: number;
  /** FREE scenario asset references, counting repeated page-level use. */
  freeOccurrences: number;
  /** EXTRA scenario asset references, counting repeated page-level use. */
  extraOccurrences: number;
}

/** Coverage record for one extracted KayKit guide page. */
export interface KayKitGuidePageCoverage {
  /** One-based extracted guide page number. */
  page: number;
  /** Stable scenario id for the page. */
  scenarioId: string;
  /** Edition scope represented by this page. */
  edition: KayKitGuideScenarioEdition;
  /** Asset references on this page, counting repeated use across pages. */
  assetOccurrences: number;
  /** Unique asset ids on this page. */
  uniqueAssets: number;
  /** FREE asset ids on this page. */
  freeAssets: number;
  /** EXTRA asset ids on this page. */
  extraAssets: number;
  /** Public helper/API entries attached to this page. */
  publicApis: number;
  /** Review artifacts attached to this page. */
  visualArtifacts: number;
  /** Documentation entries attached to this page. */
  docs: number;
}

/** Summary of the full extracted KayKit guide scenario matrix. */
export interface KayKitGuideCoverageSummary {
  /** Number of guide scenarios. */
  scenarioCount: number;
  /** Number of extracted guide pages. */
  pageCount: number;
  /** Number of distinct source images referenced by guide scenarios. */
  sourceImageCount: number;
  /** Number of distinct visual artifacts referenced by guide scenarios. */
  visualArtifactCount: number;
  /** Number of distinct docs referenced by guide scenarios. */
  docsCount: number;
  /** Unique and occurrence asset coverage counts. */
  assetCounts: KayKitGuideAssetCoverageCounts;
  /** Scenario counts by edition scope. */
  scenariosByEdition: Readonly<Record<KayKitGuideScenarioEdition, number>>;
  /** Unique asset counts by public treatment role. */
  uniqueAssetsByRole: Readonly<Partial<Record<KayKitAssetPublicRole, number>>>;
  /** Page-level coverage rows in guide order. */
  pages: readonly KayKitGuidePageCoverage[];
}

/** Public treatment join for one extracted KayKit guide scenario. */
export interface KayKitGuideScenarioCoverage {
  /** Decomposed guide scenario metadata. */
  scenario: KayKitGuideScenario;
  /** Page-level coverage counts for this scenario. */
  page: KayKitGuidePageCoverage;
  /** Unique and occurrence counts scoped to this scenario. */
  assetCounts: KayKitGuideAssetCoverageCounts;
  /** Public treatment records for the scenario assets. */
  treatments: readonly KayKitAssetPublicTreatment[];
  /** Scenario asset ids that do not have a known public treatment. */
  missingTreatmentAssetIds: readonly string[];
}

/** Coverage record that maps one public API surface back to guide pages and assets. */
export interface KayKitGuidePublicApiCoverage {
  /** Public builder, selector, CLI, manifest, docs, or runtime surface. */
  publicApi: string;
  /** Guide scenario ids that list or inherit this public API surface. */
  scenarioIds: readonly string[];
  /** One-based extracted guide pages that exercise this API surface. */
  pages: readonly number[];
  /** Edition scopes represented by the guide scenarios. */
  editions: readonly KayKitGuideScenarioEdition[];
  /** Asset ids whose treatment explicitly lists this API surface. */
  assetIds: readonly string[];
  /** Public treatment roles attached to those assets. */
  treatmentRoles: readonly KayKitAssetPublicRole[];
  /** Unique and repeated asset counts for this API surface across matching guide pages. */
  assetCounts: KayKitGuideAssetCoverageCounts;
  /** Documentation pages linked by the matching guide scenarios. */
  docs: readonly string[];
  /** Visual artifacts linked by the matching guide scenarios. */
  visualArtifacts: readonly string[];
}

/** Coverage record that maps one public asset role back to guide pages, APIs, and assets. */
export interface KayKitGuideRoleCoverage {
  /** Public treatment role assigned to the covered asset group. */
  role: KayKitAssetPublicRole;
  /** Guide scenario ids that list or inherit this public role. */
  scenarioIds: readonly string[];
  /** One-based extracted guide pages that exercise this role. */
  pages: readonly number[];
  /** Edition scopes represented by the guide scenarios. */
  editions: readonly KayKitGuideScenarioEdition[];
  /** Asset ids whose treatment uses this role. */
  assetIds: readonly string[];
  /** Public helper/API entries attached to assets with this role. */
  publicApi: readonly string[];
  /** Unique and repeated asset counts for this role across matching guide pages. */
  assetCounts: KayKitGuideAssetCoverageCounts;
  /** Documentation pages linked by the matching guide scenarios. */
  docs: readonly string[];
  /** Visual artifacts linked by the matching guide scenarios. */
  visualArtifacts: readonly string[];
}

/** Coverage record that maps one asset id back to guide pages, APIs, docs, and visuals. */
export interface KayKitGuideAssetCoverage {
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
  placementKind: KayKitAssetPublicTreatment['placementKind'];
  /** Placement layer produced by the public board/runtime APIs. */
  placementLayer: KayKitAssetPublicTreatment['placementLayer'];
  /** Full public treatment record for this asset id. */
  treatment: KayKitAssetPublicTreatment;
  /** Guide scenario ids that explicitly reference this asset id. */
  scenarioIds: readonly string[];
  /** One-based extracted guide pages that exercise this asset id. */
  pages: readonly number[];
  /** Edition scopes represented by the guide scenarios. */
  editions: readonly KayKitGuideScenarioEdition[];
  /** Extracted guide source PNGs that reference or motivate this asset id. */
  sourceImages: readonly string[];
  /** Public helper/API entries attached to this asset id. */
  publicApi: readonly string[];
  /** Documentation pages linked by the matching guide scenarios. */
  docs: readonly string[];
  /** Visual artifacts linked by the matching guide scenarios. */
  visualArtifacts: readonly string[];
  /** Number of page-level scenario references for this asset id. */
  occurrences: number;
}

/**
 * Page-level asset occurrence from the decomposed KayKit guide matrix. Unlike
 * asset coverage rows, this keeps repeated scenario uses so renderers,
 * screenshots, docs, and audits can reproduce the exact guide treatment set.
 */
export interface KayKitGuideScenarioAssetUsage {
  /** Stable scenario id that introduced this asset occurrence. */
  scenarioId: string;
  /** One-based extracted guide page number. */
  page: number;
  /** Human-readable guide page title. */
  title: string;
  /** Extracted PNG page used as source material. */
  sourceImage: string;
  /** Edition scope for the source guide scenario. */
  scenarioEdition: KayKitGuideScenarioEdition;
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
  placementKind: KayKitAssetPublicTreatment['placementKind'];
  /** Placement layer produced by the public board/runtime APIs. */
  placementLayer: KayKitAssetPublicTreatment['placementLayer'];
  /** Public helpers or selectors that intentionally exercise this asset. */
  publicApi: readonly string[];
  /** Documentation pages linked by the matching guide scenario. */
  docs: readonly string[];
  /** Screenshot or docs artifacts linked by the matching guide scenario. */
  visualArtifacts: readonly string[];
  /** Full public treatment record for this asset id. */
  treatment: KayKitAssetPublicTreatment;
  /** Whether this asset should be treated as local-only/EXTRA in apps. */
  requiresExtra: boolean;
  /** Stable short label for contact sheets and renderer previews. */
  label: string;
  /** Stable short caption for contact sheets and renderer previews. */
  caption: string;
}

/** Filters for page-level KayKit guide asset usages. */
export interface KayKitGuideScenarioAssetUsageOptions {
  /** Limit usages to exact scenario ids. */
  scenarioIds?: readonly string[];
  /** Limit usages to one-based guide pages. */
  pages?: readonly number[];
  /** Limit usages by the guide scenario edition scope. */
  editionScope?: KayKitGuideScenarioEdition | readonly KayKitGuideScenarioEdition[];
  /** Limit usages by the asset's lowest available edition; defaults to all. */
  minimumEdition?: PackEdition | 'all';
  /** Limit usages to exact asset ids. */
  assetIds?: readonly string[];
  /** Limit usages by public treatment roles. */
  roles?: readonly KayKitAssetPublicRole[];
  /** Limit usages by top-level manifest categories. */
  categories?: readonly AssetCategory[];
  /** Limit usages by public helper/API entries attached to the asset treatment. */
  publicApis?: readonly string[];
}

/** Resolves a guide usage row to an app, package, or local reference URL. */
export type KayKitGuideScenarioAssetUrlResolver = (
  usage: KayKitGuideScenarioAssetUsage
) => string | undefined;

/** Options for creating renderer-facing guide asset requests. */
export interface KayKitGuideScenarioAssetRenderRequestOptions
  extends KayKitGuideScenarioAssetUsageOptions {
  /** Base URL/path prepended to each source-relative GLTF path. */
  assetBaseUrl?: string;
  /** Custom URL resolver, used before `assetBaseUrl` when provided. */
  urlResolver?: KayKitGuideScenarioAssetUrlResolver;
}

/**
 * Renderer-facing row for one guide asset occurrence. It keeps the original
 * usage row attached while exposing the repeated fields renderers usually need.
 */
export interface KayKitGuideScenarioAssetRenderRequest {
  /** Stable scenario id that introduced this render request. */
  scenarioId: string;
  /** One-based extracted guide page number. */
  page: number;
  /** Human-readable guide page title. */
  title: string;
  /** Extracted PNG page used as source material. */
  sourceImage: string;
  /** Stable manifest asset id used by renderers and placement records. */
  assetId: string;
  /** Source-relative GLTF path for FREE packaging or local EXTRA ingest. */
  sourcePath: string;
  /** Optional resolved URL for loading the GLTF. */
  url?: string;
  /** Top-level manifest category. */
  category: AssetCategory;
  /** Manifest subcategory or source folder. */
  subcategory: string;
  /** Lowest edition that exposes this asset id. */
  minimumEdition: PackEdition;
  /** Whether this request requires local-only EXTRA assets. */
  requiresExtra: boolean;
  /** Intent-level role used by docs, selectors, and gameplay placement helpers. */
  role: KayKitAssetPublicRole;
  /** Stable short label for contact sheets and renderer previews. */
  label: string;
  /** Stable short caption for contact sheets and renderer previews. */
  caption: string;
  /** Original page-level usage row. */
  usage: KayKitGuideScenarioAssetUsage;
}

/** Render-request group for one extracted guide scenario. */
export interface KayKitGuideScenarioAssetRenderGroup {
  /** Stable scenario id. */
  scenarioId: string;
  /** One-based extracted guide page number. */
  page: number;
  /** Human-readable guide page title. */
  title: string;
  /** Extracted PNG page used as source material. */
  sourceImage: string;
  /** Scenario edition scope. */
  edition: KayKitGuideScenarioEdition;
  /** Renderer-ready asset requests for this page. */
  requests: readonly KayKitGuideScenarioAssetRenderRequest[];
  /** Number of repeated asset occurrences in this group. */
  count: number;
}

/** Options for rendering the extracted guide scenario matrix as Markdown. */
export interface KayKitGuideScenarioCoverageMarkdownOptions {
  /** Heading used for the generated document. */
  title?: string;
  /** Scenario subset to render; defaults to all extracted guide scenarios. */
  scenarios?: readonly KayKitGuideScenario[];
  /** Whether to append the public role coverage index. */
  includeRoleCoverage?: boolean;
  /** Whether to append the public API inverse-coverage usage section. */
  includePublicApiInversion?: boolean;
}

/** Builds a faction-colored building asset id. */
export function factionBuildingAssetId(kind: FactionBuildingKind, faction: Faction): string {
  return `building_${kind}_${faction}`;
}

/** Builds a faction-colored unit part asset id. */
export function coloredUnitAssetId(
  part: ColoredUnitPart,
  faction: Faction,
  style: ColoredUnitStyle
): string {
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

/** Lists the decomposed scenario contract for every extracted KayKit guide page. */
export function listKayKitGuideScenarios(): KayKitGuideScenario[] {
  return [...KAYKIT_GUIDE_SCENARIOS];
}

/** Returns the public treatment contract for one asset id, if the id is KayKit-owned. */
export function describeKayKitAssetTreatment(
  assetId: string
): KayKitAssetPublicTreatment | undefined {
  return KAYKIT_ASSET_PUBLIC_TREATMENT_BY_ID[assetId];
}

/** Returns the decomposed guide-page scenario contract for one scenario id. */
export function describeKayKitGuideScenario(id: string): KayKitGuideScenario | undefined {
  return KAYKIT_GUIDE_SCENARIO_BY_ID[id];
}

/** Returns public treatment records for the assets used by one guide scenario. */
export function listKayKitGuideScenarioTreatments(id: string): KayKitAssetPublicTreatment[] {
  const scenario = describeKayKitGuideScenario(id);
  if (!scenario) {
    return [];
  }
  return scenario.assetIds
    .map((assetId) => describeKayKitAssetTreatment(assetId))
    .filter((treatment): treatment is KayKitAssetPublicTreatment => treatment !== undefined);
}

/** Lists page-level guide asset occurrences as renderer-ready public treatment records. */
export function listKayKitGuideScenarioAssetUsages(
  options: KayKitGuideScenarioAssetUsageOptions = {}
): KayKitGuideScenarioAssetUsage[] {
  const scenarioIds = stringSet(options.scenarioIds);
  const pages = numberSet(options.pages);
  const editionScope = guideScenarioEditionSet(options.editionScope);
  const assetIds = stringSet(options.assetIds);
  const roles = roleSet(options.roles);
  const categories = assetCategorySet(options.categories);
  const publicApis = stringSet(options.publicApis);
  const minimumEdition = options.minimumEdition ?? 'all';
  const usages: KayKitGuideScenarioAssetUsage[] = [];

  for (const scenario of KAYKIT_GUIDE_SCENARIOS) {
    if (scenarioIds && !scenarioIds.has(scenario.id)) {
      continue;
    }
    if (pages && !pages.has(scenario.page)) {
      continue;
    }
    if (editionScope && !editionScope.has(scenario.edition)) {
      continue;
    }

    for (const rawAssetId of scenario.assetIds) {
      if (assetIds && !assetIds.has(rawAssetId)) {
        continue;
      }
      const treatment = KAYKIT_ASSET_PUBLIC_TREATMENT_BY_ID[rawAssetId];
      if (!treatment) {
        continue;
      }
      if (minimumEdition !== 'all' && treatment.minimumEdition !== minimumEdition) {
        continue;
      }
      if (roles && !roles.has(treatment.role)) {
        continue;
      }
      if (categories && !categories.has(treatment.category)) {
        continue;
      }
      if (publicApis && !treatment.publicApi.some((publicApi) => publicApis.has(publicApi))) {
        continue;
      }

      usages.push(guideScenarioAssetUsage(scenario, treatment));
    }
  }

  return usages;
}

/** Lists renderer-ready guide asset occurrences for one scenario id. */
export function listKayKitGuideScenarioAssetUsagesForScenario(
  id: string,
  options: Omit<KayKitGuideScenarioAssetUsageOptions, 'scenarioIds'> = {}
): KayKitGuideScenarioAssetUsage[] {
  return listKayKitGuideScenarioAssetUsages({ ...options, scenarioIds: [id] });
}

/** Lists renderer-ready guide asset requests with optional URL resolution. */
export function listKayKitGuideScenarioAssetRenderRequests(
  options: KayKitGuideScenarioAssetRenderRequestOptions = {}
): KayKitGuideScenarioAssetRenderRequest[] {
  const { assetBaseUrl, urlResolver, ...usageOptions } = options;
  return listKayKitGuideScenarioAssetUsages(usageOptions).map((usage) =>
    guideScenarioAssetRenderRequest(usage, { assetBaseUrl, urlResolver })
  );
}

/** Groups renderer-ready guide asset requests by extracted guide scenario. */
export function listKayKitGuideScenarioAssetRenderGroups(
  options: KayKitGuideScenarioAssetRenderRequestOptions = {}
): KayKitGuideScenarioAssetRenderGroup[] {
  const requests = listKayKitGuideScenarioAssetRenderRequests(options);
  const requestsByScenarioId = new Map<string, KayKitGuideScenarioAssetRenderRequest[]>();
  for (const request of requests) {
    const group = requestsByScenarioId.get(request.scenarioId) ?? [];
    group.push(request);
    requestsByScenarioId.set(request.scenarioId, group);
  }

  const groups: KayKitGuideScenarioAssetRenderGroup[] = [];
  for (const scenario of listKayKitGuideScenarios()) {
    const requestsForScenario = requestsByScenarioId.get(scenario.id) ?? [];
    if (requestsForScenario.length === 0) {
      continue;
    }
    groups.push({
      scenarioId: scenario.id,
      page: scenario.page,
      title: scenario.title,
      sourceImage: scenario.sourceImage,
      edition: scenario.edition,
      requests: requestsForScenario,
      count: requestsForScenario.length,
    });
  }
  return groups;
}

/** Returns the scenario, page counts, and public treatment join for one guide page scenario. */
export function describeKayKitGuideScenarioCoverage(
  id: string
): KayKitGuideScenarioCoverage | undefined {
  const scenario = describeKayKitGuideScenario(id);
  if (!scenario) {
    return undefined;
  }
  const treatmentByAssetId = new Map(
    listKayKitAssetPublicTreatments().map((treatment) => [treatment.assetId, treatment])
  );
  return guideScenarioCoverage(scenario, treatmentByAssetId);
}

/** Lists public API surfaces and the guide pages/assets that intentionally exercise them. */
export function listKayKitGuidePublicApiCoverages(): KayKitGuidePublicApiCoverage[] {
  const scenarios = listKayKitGuideScenarios();
  const treatments = listKayKitAssetPublicTreatments();
  const allPublicApis = uniqueSortedStrings([
    ...scenarios.flatMap((scenario) => scenario.publicApi),
    ...treatments.flatMap((treatment) => treatment.publicApi),
  ]);
  return allPublicApis.map((publicApi) => guidePublicApiCoverage(publicApi, scenarios, treatments));
}

/** Returns guide-page and asset coverage for one public API surface. */
export function describeKayKitGuidePublicApiCoverage(
  publicApi: string
): KayKitGuidePublicApiCoverage | undefined {
  return listKayKitGuidePublicApiCoverages().find((coverage) => coverage.publicApi === publicApi);
}

/** Lists public asset roles and the guide pages/assets/APIs that intentionally exercise them. */
export function listKayKitGuideRoleCoverages(): KayKitGuideRoleCoverage[] {
  const scenarios = listKayKitGuideScenarios();
  const treatments = listKayKitAssetPublicTreatments();
  const roles = uniqueSortedRoles([
    ...scenarios.flatMap((scenario) => scenario.treatmentRoles),
    ...treatments.map((treatment) => treatment.role),
  ]);
  return roles.map((role) => guideRoleCoverage(role, scenarios, treatments));
}

/** Returns guide-page, API, and asset coverage for one public asset role. */
export function describeKayKitGuideRoleCoverage(role: string): KayKitGuideRoleCoverage | undefined {
  return listKayKitGuideRoleCoverages().find((coverage) => coverage.role === role);
}

/** Lists every public asset id and the guide pages/APIs/docs/visuals that exercise it. */
export function listKayKitGuideAssetCoverages(): KayKitGuideAssetCoverage[] {
  const scenarios = listKayKitGuideScenarios();
  const coveragesByAssetId = new Map(
    listKayKitAssetPublicTreatments().map((treatment) => {
      const coverage = guideAssetCoverage(treatment, scenarios);
      return [coverage.assetId, coverage];
    })
  );
  return [...coveragesByAssetId.keys()]
    .sort()
    .map((assetId) => coveragesByAssetId.get(assetId) as KayKitGuideAssetCoverage);
}

/** Returns guide-page, API, docs, and visual coverage for one asset id. */
export function describeKayKitGuideAssetCoverage(
  assetId: string
): KayKitGuideAssetCoverage | undefined {
  const treatment = describeKayKitAssetTreatment(assetId);
  if (!treatment) {
    return undefined;
  }
  return guideAssetCoverage(treatment, listKayKitGuideScenarios());
}

/** Summarizes source images, docs, visual artifacts, assets, roles, and page coverage. */
export function summarizeKayKitGuideCoverage(): KayKitGuideCoverageSummary {
  const scenarios = listKayKitGuideScenarios();
  const treatments = listKayKitAssetPublicTreatments();
  const treatmentByAssetId = new Map(treatments.map((treatment) => [treatment.assetId, treatment]));
  const uniqueAssetIds = uniqueSortedStrings(scenarios.flatMap((scenario) => scenario.assetIds));
  const sourceImages = uniqueSortedStrings(scenarios.map((scenario) => scenario.sourceImage));
  const visualArtifacts = uniqueSortedStrings(
    scenarios.flatMap((scenario) => scenario.visualArtifacts)
  );
  const docs = uniqueSortedStrings(scenarios.flatMap((scenario) => scenario.docs));
  const occurrenceTreatments = scenarios
    .flatMap((scenario) => scenario.assetIds)
    .map((assetId) => treatmentByAssetId.get(assetId))
    .filter((treatment): treatment is KayKitAssetPublicTreatment => treatment !== undefined);

  return {
    scenarioCount: scenarios.length,
    pageCount: new Set(scenarios.map((scenario) => scenario.page)).size,
    sourceImageCount: sourceImages.length,
    visualArtifactCount: visualArtifacts.length,
    docsCount: docs.length,
    assetCounts: {
      unique: uniqueAssetIds.length,
      free: countUniqueAssetsByEdition(uniqueAssetIds, treatmentByAssetId, 'free'),
      extra: countUniqueAssetsByEdition(uniqueAssetIds, treatmentByAssetId, 'extra'),
      occurrences: occurrenceTreatments.length,
      freeOccurrences: occurrenceTreatments.filter(
        (treatment) => treatment.minimumEdition === 'free'
      ).length,
      extraOccurrences: occurrenceTreatments.filter(
        (treatment) => treatment.minimumEdition === 'extra'
      ).length,
    },
    scenariosByEdition: countScenariosByEdition(scenarios),
    uniqueAssetsByRole: countUniqueAssetsByRole(uniqueAssetIds, treatmentByAssetId),
    pages: scenarios.map((scenario) => guidePageCoverage(scenario, treatmentByAssetId)),
  };
}

/** Renders the guide scenario coverage matrix as reproducible Markdown docs. */
export function renderKayKitGuideScenarioCoverageMarkdown(
  options: KayKitGuideScenarioCoverageMarkdownOptions = {}
): string {
  const scenarios = options.scenarios ? [...options.scenarios] : listKayKitGuideScenarios();
  const includeRoleCoverage = options.includeRoleCoverage ?? options.scenarios === undefined;
  const includePublicApiInversion =
    options.includePublicApiInversion ?? options.scenarios === undefined;
  const lines = [
    `# ${options.title ?? 'Guide Scenario Coverage'}`,
    '',
    'The KayKit user guide is decomposed into 19 source-page scenarios. This page is',
    'the human-facing map for those scenarios; the machine-readable source remains',
    '`listKayKitGuideScenarios()`, `describeKayKitGuideScenarioCoverage()`,',
    '`listKayKitGuideScenarioAssetUsages()`, `listKayKitGuideScenarioAssetRenderRequests()`,',
    '`listKayKitGuideScenarioAssetRenderGroups()`, `listKayKitGuideAssetCoverages()`,',
    '`listKayKitGuideRoleCoverages()`, `listKayKitGuidePublicApiCoverages()`,',
    'and the `guide-scenarios` / `guide-usages` / `guide-render-requests` /',
    '`guide-assets` / `guide-roles` / `guide-apis` CLI commands.',
    '',
    'Use this page when deciding whether a guide image has public API treatment, docs,',
    'and visual review coverage. Use the catalog API or CLI when a tool needs exact',
    'asset ids or public treatment records.',
    '',
    '```sh',
    'node dist/cli.js guide-scenarios --markdown > docs/guides/guide-scenario-coverage.md',
    'node dist/cli.js guide-scenarios --page 15 --includeTreatments --json',
    'node dist/cli.js guide-usages --page 16,17,18 --json',
    'node dist/cli.js guide-render-requests --page 16,17,18 --assetBaseUrl /assets/extra --includeGroups --out /tmp/kaykit-guide-render-requests.json',
    'node dist/cli.js guide-assets --assetId hex_road_M --json',
    'node dist/cli.js guide-roles --role prop --json',
    'node dist/cli.js guide-apis --publicApi GameboardBuilder.addHarbor --json',
    '```',
    '',
    '## Coverage Contract',
    '',
    '- Every extracted guide page has exactly one `page-NN-*` scenario.',
    '- Every scenario lists its source PNG, edition scope, public API surfaces, docs,',
    '  and visual artifacts.',
    '- Every FREE and local EXTRA asset id appears in at least one scenario unless it',
    '  is a reference-only license/supporter page with no assets.',
    '- Every asset-bearing scenario can be expanded into public treatment records',
    '  with `listKayKitGuideScenarioTreatments(id)`.',
    '- Every page-level asset occurrence can be expanded into renderer-ready usage',
    '  records with `listKayKitGuideScenarioAssetUsages()`.',
    '- Every FREE and local EXTRA asset id can be inverted back to pages/APIs/docs',
    '  and screenshots with `listKayKitGuideAssetCoverages()`.',
    '- Every public treatment role can be inverted back to pages/assets/APIs with',
    '  `listKayKitGuideRoleCoverages()`.',
    '- Every public API string in a scenario can be inverted back to pages/assets with',
    '  `listKayKitGuidePublicApiCoverages()`.',
    '',
    '## Page Matrix',
  ];

  for (const scenario of scenarios) {
    const coverage = describeKayKitGuideScenarioCoverage(scenario.id) as KayKitGuideScenarioCoverage;
    const assetCounts = coverage.assetCounts;
    const occurrenceLabel = assetCounts.occurrences === 1 ? 'occurrence' : 'occurrences';
    lines.push(
      '',
      `### Page ${String(scenario.page).padStart(2, '0')} - ${markdownTitleCase(scenario.title)}`,
      '',
      `- Scenario: \`${scenario.id}\``,
      `- Edition: \`${scenario.edition}\``,
      `- Source image: \`${scenario.sourceImage}\``,
      `- Asset coverage: ${assetCounts.unique} unique, ${assetCounts.free} FREE, ${assetCounts.extra} EXTRA, ${assetCounts.occurrences} ${occurrenceLabel}`
    );
    pushMarkdownCodeList(lines, 'Roles', scenario.treatmentRoles, 'reference-only');
    pushMarkdownCodeList(lines, 'Public API treatment', scenario.publicApi);
    pushMarkdownCodeList(lines, 'Visual artifacts', scenario.visualArtifacts);
    pushMarkdownCodeList(lines, 'Docs', scenario.docs);
  }

  if (includeRoleCoverage) {
    lines.push(
      '',
      '## Asset Coverage Query',
      '',
      'The asset index starts from a manifest id and reports the exact role, public',
      'API surface, source images, docs, and screenshots that keep that GLTF from',
      'being a passive file reference:',
      '',
      '```ts',
      'import {',
      '  describeKayKitGuideAssetCoverage,',
      '  listKayKitGuideAssetCoverages,',
      "} from 'declarative-hex-worlds/catalog';",
      '',
      "const roadM = describeKayKitGuideAssetCoverage('hex_road_M');",
      'const allAssetCoverage = listKayKitGuideAssetCoverages();',
      '```',
      '',
      '## Page-Level Usage Query',
      '',
      'The usage index preserves repeated page-level asset occurrences for contact',
      'sheets, renderer tests, and audit tools that need the exact FREE/EXTRA guide',
      'scenario workload instead of only unique coverage rows:',
      '',
      '```ts',
      'import {',
      '  listKayKitGuideScenarioAssetRenderGroups,',
      '  listKayKitGuideScenarioAssetRenderRequests,',
      '  listKayKitGuideScenarioAssetUsages,',
      '  listKayKitGuideScenarioAssetUsagesForScenario,',
      "} from 'declarative-hex-worlds/catalog';",
      '',
      'const freeGuideAssets = listKayKitGuideScenarioAssetUsages({ minimumEdition: "free" });',
      'const stableWorkshopUnits = listKayKitGuideScenarioAssetUsages({ pages: [16, 17, 18] });',
      'const freeRenderQueue = listKayKitGuideScenarioAssetRenderRequests({',
      '  minimumEdition: "free",',
      '  assetBaseUrl: "/assets/free",',
      '});',
      'const groupedRenderQueue = listKayKitGuideScenarioAssetRenderGroups({ pages: [16, 17, 18] });',
      "const page14Units = listKayKitGuideScenarioAssetUsagesForScenario('page-14-units');",
      '```',
      '',
      '## Role Coverage Index',
      '',
      'The role index starts from a gameplay use case and reports every guide page,',
      'asset id, public API, doc, and screenshot that exercises that role:',
      '',
      '```ts',
      'import {',
      '  describeKayKitGuideRoleCoverage,',
      '  listKayKitGuideRoleCoverages,',
      "} from 'declarative-hex-worlds/catalog';",
      '',
      "const props = describeKayKitGuideRoleCoverage('prop');",
      'const allRoleCoverage = listKayKitGuideRoleCoverages();',
      '```'
    );

    for (const coverage of listKayKitGuideRoleCoverages()) {
      lines.push(
        '',
        `### Role - \`${coverage.role}\``,
        '',
        `- Pages: ${formatGuideScenarioPagesForMarkdown(coverage.pages)}`,
        `- Asset coverage: ${coverage.assetCounts.unique} unique, ${coverage.assetCounts.free} FREE, ${coverage.assetCounts.extra} EXTRA, ${coverage.assetCounts.occurrences} occurrences`
      );
      pushMarkdownCodeList(lines, 'Public API treatment', coverage.publicApi);
      pushMarkdownCodeList(lines, 'Scenarios', coverage.scenarioIds);
    }
  }

  if (includePublicApiInversion) {
    lines.push(
      '',
      '## Public API Inversion',
      '',
      'The page matrix flows from guide page to public API. The inverse query starts',
      'from an API surface and reports every guide page, asset id, role, doc, and',
      'screenshot that exercises it:',
      '',
      '```ts',
      'import {',
      '  describeKayKitGuidePublicApiCoverage,',
      '  listKayKitGuidePublicApiCoverages,',
      "} from 'declarative-hex-worlds/catalog';",
      '',
      "const harbor = describeKayKitGuidePublicApiCoverage('GameboardBuilder.addHarbor');",
      'const allApiCoverage = listKayKitGuidePublicApiCoverages();',
      '```',
      '',
      'For example, `GameboardBuilder.addHarbor` maps to pages 02, 05, 07, and 15,',
      'covering coast tiles, faction buildings, and props across FREE and EXTRA source',
      'material. `GameboardBuilder.addBridge` maps to pages 02, 07, and 09,',
      'covering the FREE bridge structures used by road and water crossings.',
      '`GameboardBuilder.addElevationRamp` maps to pages 08 and 10, covering',
      'the FREE sloped grass tiles used by vertical terrain transitions.',
      '`GameboardBuilder.addFortification`, `GameboardBuilder.addConstructionSite`,',
      'and `GameboardBuilder.addSiegeProjectile` cover the remaining FREE neutral',
      'wall, fence, construction, ruin, and projectile structures as authored',
      'gameplay intent instead of only raw neutral placements.',
      '`GameboardBuilder.addPropCluster` maps non-flag props to camps, resource',
      'caches, worksites, training yards, stable yards, and harbor support dressing',
      'with density, single-tile stacking, adjacent spread, and local EXTRA opt-in.',
      '`GameboardBuilder.addUnitPreset` maps to pages 14 through 18 and is',
      'EXTRA-only because the unit assembly pieces are local-ingest assets.'
    );
  }

  return `${lines.join('\n')}\n`;
}

/** Returns whether an asset id has an explicit public API treatment. */
export function hasKayKitAssetTreatment(assetId: string): boolean {
  return describeKayKitAssetTreatment(assetId) !== undefined;
}

const KNOWN_EXTRA_ASSET_IDS: Set<string> = (() => {
  const freeSet = new Set<string>([
    ...(FREE_PROP_ASSET_IDS as readonly string[]),
    ...(NEUTRAL_STRUCTURE_KINDS as readonly string[]),
    ...(NATURE_ASSET_IDS as readonly string[]),
  ]);
  const ids = new Set<string>([
    ...(EXTRA_PROP_ASSET_IDS as readonly string[]),
    'hex_transition',
    neutralUnitAssetId('projectile_catapult'),
    ...FACTIONS.flatMap((faction) => [
      ...EXTRA_FACTION_BUILDING_KINDS.map((kind) => factionBuildingAssetId(kind, faction)),
      ...COLORED_UNIT_PARTS.flatMap((part) =>
        EXTRA_UNIT_STYLES.map((style) => coloredUnitAssetId(part, faction, style))
      ),
    ]),
    ...(NEUTRAL_UNIT_PARTS as readonly string[]).filter((id) => !freeSet.has(id)),
  ]);
  return ids;
})();

/** Checks whether an asset id belongs to known local-only EXTRA content. */
export function isKnownExtraAssetId(assetId: string): boolean {
  return KNOWN_EXTRA_ASSET_IDS.has(assetId);
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

const KAYKIT_ASSET_PUBLIC_TREATMENTS = createKayKitAssetPublicTreatments();
const KAYKIT_ASSET_PUBLIC_TREATMENT_BY_ID: Readonly<Record<string, KayKitAssetPublicTreatment>> =
  Object.fromEntries(
    KAYKIT_ASSET_PUBLIC_TREATMENTS.map((treatment) => [treatment.assetId, treatment])
  );

function createKayKitAssetPublicTreatments(): KayKitAssetPublicTreatment[] {
  return createKayKitAssetPublicTreatmentsFromSource({
    baseTileAssetIds: BASE_TILE_ASSET_IDS,
    extraTransitionTileAssetIds: EXTRA_TRANSITION_TILE_ASSET_IDS,
    roadTileAssetIds: ROAD_TILE_ASSET_IDS,
    coastTileAssetIds: COAST_TILE_ASSET_IDS,
    riverTileAssetIds: RIVER_TILE_ASSET_IDS,
    freeFactionBuildingKinds: FREE_FACTION_BUILDING_KINDS,
    extraFactionBuildingKinds: EXTRA_FACTION_BUILDING_KINDS,
    neutralStructureKinds: NEUTRAL_STRUCTURE_KINDS,
    natureAssetIds: NATURE_ASSET_IDS,
    freePropAssetIds: FREE_PROP_ASSET_IDS,
    extraPropAssetIds: EXTRA_PROP_ASSET_IDS,
    coloredUnitParts: COLORED_UNIT_PARTS,
    neutralUnitParts: NEUTRAL_UNIT_PARTS,
    extraUnitStyles: EXTRA_UNIT_STYLES,
    factions: FACTIONS,
    factionBuildingAssetId,
    coloredUnitAssetId,
    neutralUnitAssetId,
  });
}

const KAYKIT_GUIDE_SCENARIOS = createKayKitGuideScenarios(KAYKIT_ASSET_PUBLIC_TREATMENTS);
const KAYKIT_GUIDE_SCENARIO_BY_ID: Readonly<Record<string, KayKitGuideScenario>> =
  Object.fromEntries(KAYKIT_GUIDE_SCENARIOS.map((scenario) => [scenario.id, scenario]));

function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueSortedRoles(values: readonly KayKitAssetPublicRole[]): KayKitAssetPublicRole[] {
  return [...new Set(values)].sort();
}

function stringSet(values: readonly string[] | undefined): ReadonlySet<string> | undefined {
  return values && values.length > 0 ? new Set(values) : undefined;
}

function numberSet(values: readonly number[] | undefined): ReadonlySet<number> | undefined {
  return values && values.length > 0 ? new Set(values) : undefined;
}

function guideScenarioEditionSet(
  values: KayKitGuideScenarioEdition | readonly KayKitGuideScenarioEdition[] | undefined
): ReadonlySet<KayKitGuideScenarioEdition> | undefined {
  if (!values) {
    return undefined;
  }
  const entries = Array.isArray(values) ? values : [values];
  return entries.length > 0 ? new Set(entries) : undefined;
}

function roleSet(
  values: readonly KayKitAssetPublicRole[] | undefined
): ReadonlySet<KayKitAssetPublicRole> | undefined {
  return values && values.length > 0 ? new Set(values) : undefined;
}

function assetCategorySet(
  values: readonly AssetCategory[] | undefined
): ReadonlySet<AssetCategory> | undefined {
  return values && values.length > 0 ? new Set(values) : undefined;
}

function pushMarkdownCodeList(
  lines: string[],
  label: string,
  values: readonly string[],
  fallback = 'none'
): void {
  if (values.length === 0) {
    lines.push(`- ${label}: ${fallback}`);
    return;
  }

  const formatted = values.map((value) => `\`${value}\``);
  const prefix = `- ${label}: `;
  if (formatted.length === 1) {
    lines.push(`${prefix}${formatted[0]}`);
    return;
  }
  if (`${prefix}${formatted.join(', ')}`.length <= 100) {
    lines.push(`${prefix}${formatted.join(', ')}`);
    return;
  }

  lines.push(`${prefix}${formatted[0]},`);
  for (const [index, value] of formatted.slice(1).entries()) {
    const isLast = index === formatted.length - 2;
    lines.push(`  ${value}${isLast ? '' : ','}`);
  }
}

function markdownTitleCase(value: string): string {
  return value
    .split(' ')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function formatGuideScenarioPagesForMarkdown(pages: readonly number[]): string {
  return pages.map((page) => String(page).padStart(2, '0')).join(', ');
}

function uniqueSortedScenarioEditions(
  values: readonly KayKitGuideScenarioEdition[]
): KayKitGuideScenarioEdition[] {
  return [...new Set(values)].sort();
}

function countUniqueAssetsByEdition(
  assetIds: readonly string[],
  treatmentByAssetId: ReadonlyMap<string, KayKitAssetPublicTreatment>,
  edition: PackEdition
): number {
  return assetIds.filter((assetId) => treatmentByAssetId.get(assetId)?.minimumEdition === edition)
    .length;
}

function countScenariosByEdition(
  scenarios: readonly KayKitGuideScenario[]
): Readonly<Record<KayKitGuideScenarioEdition, number>> {
  return {
    free: scenarios.filter((scenario) => scenario.edition === 'free').length,
    extra: scenarios.filter((scenario) => scenario.edition === 'extra').length,
    mixed: scenarios.filter((scenario) => scenario.edition === 'mixed').length,
    reference: scenarios.filter((scenario) => scenario.edition === 'reference').length,
  };
}

function countUniqueAssetsByRole(
  assetIds: readonly string[],
  treatmentByAssetId: ReadonlyMap<string, KayKitAssetPublicTreatment>
): Readonly<Partial<Record<KayKitAssetPublicRole, number>>> {
  const counts: Partial<Record<KayKitAssetPublicRole, number>> = {};
  for (const assetId of assetIds) {
    const role = treatmentByAssetId.get(assetId)?.role;
    if (!role) {
      continue;
    }
    counts[role] = (counts[role] ?? 0) + 1;
  }
  return counts;
}

function guidePublicApiCoverage(
  publicApi: string,
  scenarios: readonly KayKitGuideScenario[],
  treatments: readonly KayKitAssetPublicTreatment[]
): KayKitGuidePublicApiCoverage {
  const scenarioMatches = scenarios.filter((scenario) => scenario.publicApi.includes(publicApi));
  const treatmentMatches = treatments.filter((treatment) =>
    treatment.publicApi.includes(publicApi)
  );
  const treatmentByAssetId = new Map(treatments.map((treatment) => [treatment.assetId, treatment]));
  const assetIds = uniqueSortedStrings(treatmentMatches.map((treatment) => treatment.assetId));
  const assetIdSet = new Set(assetIds);
  const occurrenceTreatments = scenarioMatches
    .flatMap((scenario) => scenario.assetIds)
    .filter((assetId) => assetIdSet.has(assetId))
    .map((assetId) => treatmentByAssetId.get(assetId))
    .filter((treatment): treatment is KayKitAssetPublicTreatment => treatment !== undefined);

  return {
    publicApi,
    scenarioIds: scenarioMatches.map((scenario) => scenario.id),
    pages: [...new Set(scenarioMatches.map((scenario) => scenario.page))].sort((a, b) => a - b),
    editions: uniqueSortedScenarioEditions(scenarioMatches.map((scenario) => scenario.edition)),
    assetIds,
    treatmentRoles: uniqueSortedRoles(treatmentMatches.map((treatment) => treatment.role)),
    assetCounts: {
      unique: assetIds.length,
      free: countUniqueAssetsByEdition(assetIds, treatmentByAssetId, 'free'),
      extra: countUniqueAssetsByEdition(assetIds, treatmentByAssetId, 'extra'),
      occurrences: occurrenceTreatments.length,
      freeOccurrences: occurrenceTreatments.filter(
        (treatment) => treatment.minimumEdition === 'free'
      ).length,
      extraOccurrences: occurrenceTreatments.filter(
        (treatment) => treatment.minimumEdition === 'extra'
      ).length,
    },
    docs: uniqueSortedStrings(scenarioMatches.flatMap((scenario) => scenario.docs)),
    visualArtifacts: uniqueSortedStrings(
      scenarioMatches.flatMap((scenario) => scenario.visualArtifacts)
    ),
  };
}

function guideRoleCoverage(
  role: KayKitAssetPublicRole,
  scenarios: readonly KayKitGuideScenario[],
  treatments: readonly KayKitAssetPublicTreatment[]
): KayKitGuideRoleCoverage {
  const scenarioMatches = scenarios.filter((scenario) => scenario.treatmentRoles.includes(role));
  const treatmentMatches = treatments.filter((treatment) => treatment.role === role);
  const treatmentByAssetId = new Map(treatments.map((treatment) => [treatment.assetId, treatment]));
  const assetIds = uniqueSortedStrings(treatmentMatches.map((treatment) => treatment.assetId));
  const assetIdSet = new Set(assetIds);
  const occurrenceTreatments = scenarioMatches
    .flatMap((scenario) => scenario.assetIds)
    .filter((assetId) => assetIdSet.has(assetId))
    .map((assetId) => treatmentByAssetId.get(assetId))
    .filter((treatment): treatment is KayKitAssetPublicTreatment => treatment !== undefined);

  return {
    role,
    scenarioIds: scenarioMatches.map((scenario) => scenario.id),
    pages: [...new Set(scenarioMatches.map((scenario) => scenario.page))].sort((a, b) => a - b),
    editions: uniqueSortedScenarioEditions(scenarioMatches.map((scenario) => scenario.edition)),
    assetIds,
    publicApi: uniqueSortedStrings(treatmentMatches.flatMap((treatment) => treatment.publicApi)),
    assetCounts: {
      unique: assetIds.length,
      free: countUniqueAssetsByEdition(assetIds, treatmentByAssetId, 'free'),
      extra: countUniqueAssetsByEdition(assetIds, treatmentByAssetId, 'extra'),
      occurrences: occurrenceTreatments.length,
      freeOccurrences: occurrenceTreatments.filter(
        (treatment) => treatment.minimumEdition === 'free'
      ).length,
      extraOccurrences: occurrenceTreatments.filter(
        (treatment) => treatment.minimumEdition === 'extra'
      ).length,
    },
    docs: uniqueSortedStrings(scenarioMatches.flatMap((scenario) => scenario.docs)),
    visualArtifacts: uniqueSortedStrings(
      scenarioMatches.flatMap((scenario) => scenario.visualArtifacts)
    ),
  };
}

function guideAssetCoverage(
  treatment: KayKitAssetPublicTreatment,
  scenarios: readonly KayKitGuideScenario[]
): KayKitGuideAssetCoverage {
  const scenarioMatches = scenarios.filter((scenario) =>
    scenario.assetIds.includes(treatment.assetId)
  );
  return {
    assetId: treatment.assetId,
    minimumEdition: treatment.minimumEdition,
    category: treatment.category,
    subcategory: treatment.subcategory,
    sourcePath: treatment.sourcePath,
    role: treatment.role,
    placementKind: treatment.placementKind,
    placementLayer: treatment.placementLayer,
    treatment,
    scenarioIds: scenarioMatches.map((scenario) => scenario.id),
    pages: [...new Set(scenarioMatches.map((scenario) => scenario.page))].sort((a, b) => a - b),
    editions: uniqueSortedScenarioEditions(scenarioMatches.map((scenario) => scenario.edition)),
    sourceImages: uniqueSortedStrings([
      ...treatment.sourceImages,
      ...scenarioMatches.map((scenario) => scenario.sourceImage),
    ]),
    publicApi: uniqueSortedStrings(treatment.publicApi),
    docs: uniqueSortedStrings(scenarioMatches.flatMap((scenario) => scenario.docs)),
    visualArtifacts: uniqueSortedStrings(
      scenarioMatches.flatMap((scenario) => scenario.visualArtifacts)
    ),
    occurrences: scenarioMatches.reduce(
      (total, scenario) =>
        total + scenario.assetIds.filter((assetId) => assetId === treatment.assetId).length,
      0
    ),
  };
}

function guideScenarioAssetUsage(
  scenario: KayKitGuideScenario,
  treatment: KayKitAssetPublicTreatment
): KayKitGuideScenarioAssetUsage {
  return {
    scenarioId: scenario.id,
    page: scenario.page,
    title: scenario.title,
    sourceImage: scenario.sourceImage,
    scenarioEdition: scenario.edition,
    assetId: treatment.assetId,
    minimumEdition: treatment.minimumEdition,
    category: treatment.category,
    subcategory: treatment.subcategory,
    sourcePath: treatment.sourcePath,
    role: treatment.role,
    placementKind: treatment.placementKind,
    placementLayer: treatment.placementLayer,
    publicApi: treatment.publicApi,
    docs: scenario.docs,
    visualArtifacts: scenario.visualArtifacts,
    treatment,
    requiresExtra: treatment.requiresExtra,
    label: `p${String(scenario.page).padStart(2, '0')}:${treatment.assetId}`,
    caption: `${scenario.id} ${treatment.minimumEdition}`,
  };
}

function guideScenarioAssetRenderRequest(
  usage: KayKitGuideScenarioAssetUsage,
  options: Pick<KayKitGuideScenarioAssetRenderRequestOptions, 'assetBaseUrl' | 'urlResolver'>
): KayKitGuideScenarioAssetRenderRequest {
  const resolvedUrl =
    options.urlResolver?.(usage) ?? guideScenarioAssetUrlFromBase(usage, options.assetBaseUrl);
  return {
    scenarioId: usage.scenarioId,
    page: usage.page,
    title: usage.title,
    sourceImage: usage.sourceImage,
    assetId: usage.assetId,
    sourcePath: usage.sourcePath,
    ...(resolvedUrl ? { url: resolvedUrl } : {}),
    category: usage.category,
    subcategory: usage.subcategory,
    minimumEdition: usage.minimumEdition,
    requiresExtra: usage.requiresExtra,
    role: usage.role,
    label: usage.label,
    caption: usage.caption,
    usage,
  };
}

function guideScenarioAssetUrlFromBase(
  usage: KayKitGuideScenarioAssetUsage,
  assetBaseUrl: string | undefined
): string | undefined {
  if (!assetBaseUrl) {
    return undefined;
  }
  return `${assetBaseUrl.replace(/\/+$/, '')}/${usage.sourcePath.replace(/^\/+/, '')}`;
}

function guideScenarioCoverage(
  scenario: KayKitGuideScenario,
  treatmentByAssetId: ReadonlyMap<string, KayKitAssetPublicTreatment>
): KayKitGuideScenarioCoverage {
  const uniqueAssetIds = uniqueSortedStrings(scenario.assetIds);
  const occurrenceTreatments = scenario.assetIds
    .map((assetId) => treatmentByAssetId.get(assetId))
    .filter((treatment): treatment is KayKitAssetPublicTreatment => treatment !== undefined);
  const treatments = uniqueAssetIds
    .map((assetId) => treatmentByAssetId.get(assetId))
    .filter((treatment): treatment is KayKitAssetPublicTreatment => treatment !== undefined);

  return {
    scenario,
    page: guidePageCoverage(scenario, treatmentByAssetId),
    assetCounts: {
      unique: uniqueAssetIds.length,
      free: countUniqueAssetsByEdition(uniqueAssetIds, treatmentByAssetId, 'free'),
      extra: countUniqueAssetsByEdition(uniqueAssetIds, treatmentByAssetId, 'extra'),
      occurrences: occurrenceTreatments.length,
      freeOccurrences: occurrenceTreatments.filter(
        (treatment) => treatment.minimumEdition === 'free'
      ).length,
      extraOccurrences: occurrenceTreatments.filter(
        (treatment) => treatment.minimumEdition === 'extra'
      ).length,
    },
    treatments,
    missingTreatmentAssetIds: uniqueAssetIds.filter((assetId) => !treatmentByAssetId.has(assetId)),
  };
}

function guidePageCoverage(
  scenario: KayKitGuideScenario,
  treatmentByAssetId: ReadonlyMap<string, KayKitAssetPublicTreatment>
): KayKitGuidePageCoverage {
  const uniqueAssetIds = uniqueSortedStrings(scenario.assetIds);
  return {
    page: scenario.page,
    scenarioId: scenario.id,
    edition: scenario.edition,
    assetOccurrences: scenario.assetIds.length,
    uniqueAssets: uniqueAssetIds.length,
    freeAssets: countUniqueAssetsByEdition(uniqueAssetIds, treatmentByAssetId, 'free'),
    extraAssets: countUniqueAssetsByEdition(uniqueAssetIds, treatmentByAssetId, 'extra'),
    publicApis: scenario.publicApi.length,
    visualArtifacts: scenario.visualArtifacts.length,
    docs: scenario.docs.length,
  };
}
