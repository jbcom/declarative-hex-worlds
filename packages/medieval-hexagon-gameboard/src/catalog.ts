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

/** Options for rendering the extracted guide scenario matrix as Markdown. */
export interface KayKitGuideScenarioCoverageMarkdownOptions {
  /** Heading used for the generated document. */
  title?: string;
  /** Scenario subset to render; defaults to all extracted guide scenarios. */
  scenarios?: readonly KayKitGuideScenario[];
  /** Whether to append the public API inverse-coverage usage section. */
  includePublicApiInversion?: boolean;
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

/** Lists the decomposed scenario contract for every extracted KayKit guide page. */
export function listKayKitGuideScenarios(): KayKitGuideScenario[] {
  return [...KAYKIT_GUIDE_SCENARIOS];
}

/** Returns the public treatment contract for one asset id, if the id is KayKit-owned. */
export function describeKayKitAssetTreatment(assetId: string): KayKitAssetPublicTreatment | undefined {
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

/** Returns the scenario, page counts, and public treatment join for one guide page scenario. */
export function describeKayKitGuideScenarioCoverage(id: string): KayKitGuideScenarioCoverage | undefined {
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

/** Summarizes source images, docs, visual artifacts, assets, roles, and page coverage. */
export function summarizeKayKitGuideCoverage(): KayKitGuideCoverageSummary {
  const scenarios = listKayKitGuideScenarios();
  const treatments = listKayKitAssetPublicTreatments();
  const treatmentByAssetId = new Map(treatments.map((treatment) => [treatment.assetId, treatment]));
  const uniqueAssetIds = uniqueSortedStrings(scenarios.flatMap((scenario) => scenario.assetIds));
  const sourceImages = uniqueSortedStrings(scenarios.map((scenario) => scenario.sourceImage));
  const visualArtifacts = uniqueSortedStrings(scenarios.flatMap((scenario) => scenario.visualArtifacts));
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
      freeOccurrences: occurrenceTreatments.filter((treatment) => treatment.minimumEdition === 'free').length,
      extraOccurrences: occurrenceTreatments.filter((treatment) => treatment.minimumEdition === 'extra').length,
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
  const includePublicApiInversion = options.includePublicApiInversion ?? options.scenarios === undefined;
  const lines = [
    `# ${options.title ?? 'Guide Scenario Coverage'}`,
    '',
    'The KayKit user guide is decomposed into 19 source-page scenarios. This page is',
    'the human-facing map for those scenarios; the machine-readable source remains',
    '`listKayKitGuideScenarios()`, `describeKayKitGuideScenarioCoverage()`,',
    '`listKayKitGuidePublicApiCoverages()`, and the `guide-scenarios` / `guide-apis`',
    'CLI commands.',
    '',
    'Use this page when deciding whether a guide image has public API treatment, docs,',
    'and visual review coverage. Use the catalog API or CLI when a tool needs exact',
    'asset ids or public treatment records.',
    '',
    '```sh',
    'pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-scenarios --markdown > docs/guides/guide-scenario-coverage.md',
    'pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-scenarios --page 15 --includeTreatments --json',
    'pnpm exec packages/medieval-hexagon-gameboard/dist/cli.js guide-apis --publicApi GameboardBuilder.addHarbor --json',
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
    '- Every public API string in a scenario can be inverted back to pages/assets with',
    '  `listKayKitGuidePublicApiCoverages()`.',
    '',
    '## Page Matrix',
  ];

  for (const scenario of scenarios) {
    const coverage = describeKayKitGuideScenarioCoverage(scenario.id);
    const assetCounts = coverage?.assetCounts ?? {
      unique: 0,
      free: 0,
      extra: 0,
      occurrences: 0,
      freeOccurrences: 0,
      extraOccurrences: 0,
    };
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
      "} from '@jbcom/medieval-hexagon-gameboard/catalog';",
      '',
      "const harbor = describeKayKitGuidePublicApiCoverage('GameboardBuilder.addHarbor');",
      'const allApiCoverage = listKayKitGuidePublicApiCoverages();',
      '```',
      '',
      'For example, `GameboardBuilder.addHarbor` maps to pages 02, 05, 07, and 15,',
      'covering coast tiles, faction buildings, and props across FREE and EXTRA source',
      'material. `GameboardBuilder.addUnitPreset` maps to pages 14 through 18 and is',
      'EXTRA-only because the unit assembly pieces are local-ingest assets.'
    );
  }

  return `${lines.join('\n')}\n`;
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

const KAYKIT_ASSET_PUBLIC_TREATMENTS = createKayKitAssetPublicTreatments();
const KAYKIT_ASSET_PUBLIC_TREATMENT_BY_ID: Readonly<Record<string, KayKitAssetPublicTreatment>> =
  Object.fromEntries(KAYKIT_ASSET_PUBLIC_TREATMENTS.map((treatment) => [treatment.assetId, treatment]));
const KAYKIT_GUIDE_SCENARIOS = createKayKitGuideScenarios();
const KAYKIT_GUIDE_SCENARIO_BY_ID: Readonly<Record<string, KayKitGuideScenario>> = Object.fromEntries(
  KAYKIT_GUIDE_SCENARIOS.map((scenario) => [scenario.id, scenario])
);

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

function createKayKitGuideScenarios(): KayKitGuideScenario[] {
  return [
    guideScenario({
      id: 'page-01-overview-and-license',
      page: 1,
      title: 'Overview and license contract',
      sourceImage: GUIDE_IMAGE.cover,
      edition: 'reference',
      summary: 'Defines the KayKit pack identity, library scope, package attribution, and source-of-truth guide extraction.',
      assetIds: [],
      publicApi: ['freeManifest', 'listKayKitGuideScenarios', 'listKayKitAssetPublicTreatments'],
      treatmentRoles: [],
      visualArtifacts: ['docs/assets/kaykit-guide/montage.png', GUIDE_IMAGE.cover],
      docs: ['README.md', 'NOTICE.md', 'docs/pillars/00-library-charter.md'],
    }),
    guideScenario({
      id: 'page-02-buildings-props-and-factions',
      page: 2,
      title: 'Buildings, props, and factions',
      sourceImage: GUIDE_IMAGE.buildings,
      edition: 'mixed',
      summary: 'Covers faction building ids, neutral structures, props, flags, settlement composition, and source path naming.',
      publicApi: [
        'factionBuildingAssetId',
        'flagAssetId',
        'GameboardBuilder.addFactionBuilding',
        'GameboardBuilder.addNeutralStructure',
        'GameboardBuilder.addProp',
        'GameboardBuilder.addSettlement',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png',
      ],
      docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/guides/public-api.md'],
    }),
    guideScenario({
      id: 'page-03-road-variations',
      page: 3,
      title: 'Road variations',
      sourceImage: GUIDE_IMAGE.roads,
      edition: 'free',
      summary: 'Maps road labels A-M and sloped variants to canonical edge masks, rotations, and path builder output.',
      publicApi: [
        'selectRoadVariant',
        'selectRoadVariantByLabel',
        'listRoadGuidePermutations',
        'GameboardBuilder.addRoadPath',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-roads-all-labels-rotations.png',
      ],
      docs: ['docs/pillars/01-tiles-connectivity.md', 'docs/pillars/04-visual-verification.md'],
    }),
    guideScenario({
      id: 'page-04-river-variations',
      page: 4,
      title: 'River variations',
      sourceImage: GUIDE_IMAGE.rivers,
      edition: 'free',
      summary: 'Maps river labels A-L, curvy rivers, crossings, and waterless variants to edge masks and rotation selectors.',
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
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-river-curvy-crossings-all-modes.png',
      ],
      docs: ['docs/pillars/01-tiles-connectivity.md', 'docs/pillars/04-visual-verification.md'],
    }),
    guideScenario({
      id: 'page-05-nature-contents',
      page: 5,
      title: 'Nature and decoration contents',
      sourceImage: GUIDE_IMAGE.natureContents,
      edition: 'free',
      summary: 'Covers mountains, hills, trees, rocks, water plants, clouds, props, resources, flags, and scatterable pieces.',
      publicApi: [
        'GameboardBuilder.addNature',
        'GameboardBuilder.addHill',
        'GameboardBuilder.addMountainStack',
        'GameboardBuilder.scatterDecorations',
        'createGameboardLayoutFillRuleFromPiece',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png',
      ],
      docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/pillars/05-koota-runtime-rules.md'],
    }),
    guideScenario({
      id: 'page-06-nature-usage',
      page: 6,
      title: 'Nature usage guide',
      sourceImage: GUIDE_IMAGE.natureUsage,
      edition: 'free',
      summary: 'Expresses stacking, scatter, forest, hill, mountain, and visual-slot placement rules for terrain dressing.',
      publicApi: [
        'GameboardBuilder.addForest',
        'GameboardBuilder.addHill',
        'GameboardBuilder.addMountainStack',
        'GameboardBuilder.scatterDecorations',
        'createGameboardLayoutArchetypeRegistry',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-generated-piece-recipe.png',
      ],
      docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/pillars/05-koota-runtime-rules.md'],
    }),
    guideScenario({
      id: 'page-07-water-usage',
      page: 7,
      title: 'Water usage guide',
      sourceImage: GUIDE_IMAGE.waterUsage,
      edition: 'free',
      summary: 'Covers water terrain, coasts, rivers, waterless overlays, harbor-compatible edges, and water decoration placement.',
      publicApi: [
        'selectCoastVariant',
        'selectRiverVariant',
        'GameboardBuilder.setTerrain',
        'GameboardBuilder.setCoastEdges',
        'GameboardBuilder.addRiverPath',
        'GameboardBuilder.addHarbor',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-coasts-all-labels-rotations-water-waterless.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-harbor-gameboard.png',
      ],
      docs: ['docs/pillars/01-tiles-connectivity.md', 'docs/pillars/04-visual-verification.md'],
    }),
    guideScenario({
      id: 'page-08-taller-hex-tiles',
      page: 8,
      title: 'Taller hex tiles',
      sourceImage: GUIDE_IMAGE.tallerTiles,
      edition: 'free',
      summary: 'Covers bottom, sloped, elevated, and stacked terrain compositions for mountains and cliff-like boards.',
      publicApi: ['GameboardBuilder.addMountainStack', 'GameboardBuilder.setElevation', 'GameboardBuilder.setTileAsset'],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-gameboard-recipe.png',
      ],
      docs: ['docs/pillars/01-tiles-connectivity.md', 'docs/pillars/05-koota-runtime-rules.md'],
    }),
    guideScenario({
      id: 'page-09-world-design-example',
      page: 9,
      title: 'World design example',
      sourceImage: GUIDE_IMAGE.worldDesign,
      edition: 'free',
      summary: 'Combines base tiles, roads, rivers, buildings, nature, scatter, spawn locations, and pathable board layout.',
      publicApi: [
        'createGameboardBuilder',
        'createGameboardPlanFromRecipe',
        'createSeededGameboardPlan',
        'createGameboardRuntimeFromScenario',
        'selectSpawnCoordinates',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-gameboard-recipe.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-gameboard.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-fixed-completed.png',
      ],
      docs: ['docs/guides/recipes-scenarios-and-simulation.md', 'docs/pillars/05-koota-runtime-rules.md'],
    }),
    guideScenario({
      id: 'page-10-floating-islands',
      page: 10,
      title: 'Floating islands',
      sourceImage: GUIDE_IMAGE.floatingIslands,
      edition: 'free',
      summary: 'Covers elevated support tiles, sloped terrain, mountain stacks, forests, and non-rectangular Honeycomb boards.',
      publicApi: [
        'createHexagonGameboardGrid',
        'GameboardBuilder.addMountainStack',
        'GameboardBuilder.setElevation',
        'GameboardBuilder.addForest',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-hex-gameboard.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
      ],
      docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/pillars/05-koota-runtime-rules.md'],
    }),
    guideScenario({
      id: 'page-11-biomes',
      page: 11,
      title: 'Biomes',
      sourceImage: GUIDE_IMAGE.biomes,
      edition: 'extra',
      summary: 'Covers local EXTRA transition tiles and texture-set selection for biome blends without publishing EXTRA binaries.',
      publicApi: [
        'textureFileName',
        'GameboardBuilder.addTransition',
        'createGameboardPlanFromRecipe',
        'validateGameboardRecipe',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png',
      ],
      docs: ['docs/pillars/03-editions-and-ingest.md', 'docs/guides/rendering-assets-and-external-packs.md'],
    }),
    guideScenario({
      id: 'page-12-alternate-textures',
      page: 12,
      title: 'Alternate textures',
      sourceImage: GUIDE_IMAGE.alternateTextures,
      edition: 'extra',
      summary: 'Covers default, fall, summer, and winter texture sets generated through local EXTRA ingestion.',
      publicApi: ['textureFileName', 'createManifestBundle', 'selectManifestAssets', 'medieval-hexagon-gameboard manifest'],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png',
      ],
      docs: ['docs/pillars/03-editions-and-ingest.md', 'docs/guides/rendering-assets-and-external-packs.md'],
    }),
    guideScenario({
      id: 'page-13-transition-tiles',
      page: 13,
      title: 'Transition tiles',
      sourceImage: GUIDE_IMAGE.transition,
      edition: 'extra',
      summary: 'Covers EXTRA transition tile declarations, biome adjacency, and recipe/build-time validation for blends.',
      publicApi: [
        'GameboardBuilder.addTransition',
        'declareHexTile',
        'analyzeHexTileRegistry',
        'createGameboardPlanFromRecipe',
        'validateGameboardRecipeGeneration',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png',
      ],
      docs: ['docs/pillars/01-tiles-connectivity.md', 'docs/pillars/03-editions-and-ingest.md'],
    }),
    guideScenario({
      id: 'page-14-units',
      page: 14,
      title: 'Units',
      sourceImage: GUIDE_IMAGE.units,
      edition: 'extra',
      summary: 'Covers local EXTRA unit bodies, weapons, mounts, vehicles, ships, accent/full styles, and actor spawning.',
      publicApi: [
        'coloredUnitAssetId',
        'neutralUnitAssetId',
        'GameboardBuilder.addUnit',
        'GameboardBuilder.addUnitPreset',
        'spawnGameboardActor',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-local-third-party-assets.png',
      ],
      docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/guides/runtime-integration.md'],
    }),
    guideScenario({
      id: 'page-15-shipyard-harbors',
      page: 15,
      title: 'Shipyard, harbors, and ports',
      sourceImage: GUIDE_IMAGE.shipyard,
      edition: 'mixed',
      summary: 'Covers harbor buildings, ships, boats, anchors, coast tiles, water tiles, and port placement constraints.',
      publicApi: [
        'GameboardBuilder.addHarbor',
        'GameboardBuilder.setCoastEdges',
        'GameboardBuilder.addUnitPreset',
        'externalAssetSpawnOptions',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-harbor-gameboard.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png',
      ],
      docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/pillars/03-editions-and-ingest.md'],
    }),
    guideScenario({
      id: 'page-16-stables-and-horses',
      page: 16,
      title: 'Stables and horses',
      sourceImage: GUIDE_IMAGE.stables,
      edition: 'extra',
      summary: 'Covers stables, fenced paddocks, hay/trough props, horse parts, mount presets, and movement-facing metadata.',
      publicApi: [
        'GameboardBuilder.addFactionBuilding',
        'GameboardBuilder.addNeutralStructure',
        'GameboardBuilder.addProp',
        'GameboardBuilder.addUnitPreset',
        'recommendExternalAssetFacing',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png',
      ],
      docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/guides/rendering-assets-and-external-packs.md'],
    }),
    guideScenario({
      id: 'page-17-workshop-and-siege',
      page: 17,
      title: 'Workshop and siege units',
      sourceImage: GUIDE_IMAGE.workshop,
      edition: 'extra',
      summary: 'Covers workshops, tower cannons, siege equipment, projectiles, wall/fence contexts, and combat markers.',
      publicApi: [
        'GameboardBuilder.addFactionBuilding',
        'GameboardBuilder.addUnitPreset',
        'GameboardBuilder.addProp',
        'planGameboardInteractionCommand',
        'executeGameboardInteractionCommand',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png',
      ],
      docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/guides/runtime-integration.md'],
    }),
    guideScenario({
      id: 'page-18-unit-combinations',
      page: 18,
      title: 'Unit combinations',
      sourceImage: GUIDE_IMAGE.unitCombinations,
      edition: 'extra',
      summary: 'Covers composed unit presets, colored/neutral part layering, equipment combinations, and actor registration.',
      publicApi: [
        'coloredUnitAssetId',
        'neutralUnitAssetId',
        'GameboardBuilder.addUnitPreset',
        'spawnGameboardActor',
        'createGameboardRuntimeFromScenario',
      ],
      visualArtifacts: [
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png',
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-seeded-completed.png',
      ],
      docs: ['docs/pillars/02-asset-taxonomy.md', 'docs/guides/recipes-scenarios-and-simulation.md'],
    }),
    guideScenario({
      id: 'page-19-supporters-and-attribution',
      page: 19,
      title: 'Supporters and attribution',
      sourceImage: GUIDE_IMAGE.attribution,
      edition: 'reference',
      summary: 'Keeps KayKit credit, CC0 asset attribution, MIT code licensing, and publishable package notices visible.',
      assetIds: [],
      publicApi: ['NOTICE.md', 'package.json files', 'listKayKitGuideScenarios'],
      treatmentRoles: [],
      visualArtifacts: [GUIDE_IMAGE.attribution, 'NOTICE.md'],
      docs: ['NOTICE.md', 'docs/pillars/00-library-charter.md', 'README.md'],
    }),
  ];
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

type KayKitGuideScenarioInput = Omit<KayKitGuideScenario, 'assetIds' | 'publicApi' | 'treatmentRoles'> & {
  assetIds?: readonly string[];
  publicApi?: readonly string[];
  treatmentRoles?: readonly KayKitAssetPublicRole[];
};

function guideScenario(input: KayKitGuideScenarioInput): KayKitGuideScenario {
  const assetIds = uniqueSortedStrings(input.assetIds ?? assetIdsForGuideImage(input.sourceImage));
  const treatments = assetIds
    .map((assetId) => KAYKIT_ASSET_PUBLIC_TREATMENT_BY_ID[assetId])
    .filter((treatment): treatment is KayKitAssetPublicTreatment => treatment !== undefined);
  return {
    ...input,
    assetIds,
    publicApi: uniqueSortedStrings([
      ...(input.publicApi ?? []),
      ...treatments.flatMap((treatment) => treatment.publicApi),
    ]),
    treatmentRoles: uniqueSortedRoles([
      ...(input.treatmentRoles ?? []),
      ...treatments.map((treatment) => treatment.role),
    ]),
  };
}

function assetIdsForGuideImage(sourceImage: string): string[] {
  return uniqueSortedStrings(
    KAYKIT_ASSET_PUBLIC_TREATMENTS.filter((treatment) => treatment.sourceImages.includes(sourceImage)).map(
      (treatment) => treatment.assetId
    )
  );
}

function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function uniqueSortedRoles(values: readonly KayKitAssetPublicRole[]): KayKitAssetPublicRole[] {
  return [...new Set(values)].sort();
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
    .map((word) => (word.length === 0 ? word : `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`))
    .join(' ');
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
  return assetIds.filter((assetId) => treatmentByAssetId.get(assetId)?.minimumEdition === edition).length;
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
  const treatmentMatches = treatments.filter((treatment) => treatment.publicApi.includes(publicApi));
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
      freeOccurrences: occurrenceTreatments.filter((treatment) => treatment.minimumEdition === 'free').length,
      extraOccurrences: occurrenceTreatments.filter((treatment) => treatment.minimumEdition === 'extra').length,
    },
    docs: uniqueSortedStrings(scenarioMatches.flatMap((scenario) => scenario.docs)),
    visualArtifacts: uniqueSortedStrings(scenarioMatches.flatMap((scenario) => scenario.visualArtifacts)),
  };
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
      freeOccurrences: occurrenceTreatments.filter((treatment) => treatment.minimumEdition === 'free').length,
      extraOccurrences: occurrenceTreatments.filter((treatment) => treatment.minimumEdition === 'extra').length,
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
