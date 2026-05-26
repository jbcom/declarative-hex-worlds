/**
 * Serializable board-plan primitives for tiles, terrain stacks, roads, rivers,
 * coasts, placements, deterministic builders, and validation-ready snapshots.
 *
 * @module
 */
import seedrandom from 'seedrandom';
import {
  coloredUnitAssetId,
  factionBuildingAssetId,
  flagAssetId,
  neutralUnitAssetId,
  type ColoredUnitPart,
  type ColoredUnitStyle,
  type FactionBuildingKind,
  type NatureAssetId,
  type NeutralStructureKind,
  type NeutralUnitPart,
  type PropAssetId,
} from './catalog';
import {
  HEX_DIRECTIONS,
  coordinatesForShape,
  edgeBetween,
  hexLine,
  hexKey,
  neighbor,
  oppositeEdge,
  parseHexKey,
} from './coordinates';
import { axialToWorld } from './coordinates';
import { freeManifest } from './manifest';
import {
  edgeMask,
  selectCoastVariant,
  selectRiverCrossingVariant,
  selectRiverVariant,
  selectRoadVariant,
} from './selectors';
import type {
  Faction,
  GameboardShape,
  HexCoordinates,
  HexEdgeInput,
  HexEdgeIndex,
  MedievalHexagonAsset,
  TextureSet,
  WorldPosition,
} from './types';

/**
 * Schema version written to generated gameboard plans.
 */
export const GAMEBOARD_SCHEMA_VERSION = '1.0.0';

/**
 * Built-in terrain categories understood by the guide-derived helpers.
 */
export type BuiltInGameboardTerrain = 'grass' | 'water' | 'coast' | 'road' | 'river' | 'mountain' | 'hill' | 'forest';
/**
 * Terrain category for a tile. Custom strings are allowed for external packs.
 */
export type GameboardTerrain = BuiltInGameboardTerrain | (string & {});

/** Road slope variant used by elevated road pieces. */
export type RoadSlope = 'high' | 'low';
/** River crossing guide variant. */
export type RiverCrossing = 'A' | 'B';
/** Clockwise flat-top rotation in 60-degree steps. */
export type HexRotationSteps = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Placement category used by manifests, Koota traits, layout rules, and renderers.
 */
export type GameboardPlacementKind =
  | 'terrain'
  | 'road'
  | 'river'
  | 'coast'
  | 'transition'
  | 'decoration'
  | 'structure'
  | 'unit'
  | 'prop';

/**
 * Render and gameplay layer for a placement.
 */
export type GameboardPlacementLayer = 'terrain' | 'surface' | 'feature' | 'structure' | 'unit';

/** Mountain stack visual variant. */
export type MountainVariant = 'A' | 'B' | 'C';
/** Hill visual variant. */
export type HillVariant = 'A' | 'B' | 'C';
/** Harbor structure variant. */
export type HarborKind = 'docks' | 'shipyard' | 'watermill';
/** Neutral bridge visual variant. */
export type BridgeVariant = 'A' | 'B';
/** Sloped elevation ramp direction. */
export type ElevationRampDirection = 'up' | 'down';
/** Fortification material exposed by the neutral wall and fence assets. */
export type FortificationMaterial = 'wall' | 'wood-fence' | 'stone-fence';
/** Wall segment shape from the neutral wall asset set. */
export type WallFortificationSegment =
  | 'straight'
  | 'straight-gate'
  | 'corner-A-gate'
  | 'corner-A-inside'
  | 'corner-A-outside'
  | 'corner-B-inside'
  | 'corner-B-outside';
/** Fence segment shape from the neutral fence asset set. */
export type FenceFortificationSegment = 'straight' | 'gate';
/** Segment shape accepted by fortification helpers. */
export type FortificationSegment = WallFortificationSegment | FenceFortificationSegment;
/** Construction and ruin state exposed by the neutral construction assets. */
export type ConstructionSiteKind = 'destroyed' | 'dirt' | 'grain' | 'scaffolding' | 'stage-A' | 'stage-B' | 'stage-C';
/** Siege projectile visual exposed by the neutral building asset set. */
export type SiegeProjectileKind = 'catapult';
/** Semantic prop cluster kinds for authored and generated dressing. */
export type PropClusterKind =
  | 'camp'
  | 'harbor-support'
  | 'resource-cache'
  | 'stable-yard'
  | 'training-yard'
  | 'worksite';
/** How a prop cluster is distributed around its anchor tile. */
export type PropClusterPlacement = 'single' | 'adjacent';
/** Faction building kind accepted by settlement helpers. */
export type SettlementBuilding = FactionBuildingKind;

/**
 * Options for creating a generated gameboard plan.
 */
export interface GameboardPlanOptions {
  /** Deterministic seed for generation. */
  seed?: string | number;
  /** Board shape to populate. */
  shape: GameboardShape;
  /** Texture set applied to generated terrain. */
  textureSet?: TextureSet;
  /** Initial terrain used for every generated tile. */
  defaultTerrain?: Extract<GameboardTerrain, 'grass' | 'water'>;
}

/**
 * Serializable tile state in a generated gameboard plan.
 */
export interface GameboardTileSpec {
  /** Stable axial tile key in `q,r` form. */
  key: string;
  /** Axial tile coordinates. */
  coordinates: HexCoordinates;
  /** Primary terrain category. */
  terrain: GameboardTerrain;
  /** KayKit texture set applied to this tile. */
  textureSet: TextureSet;
  /** Stacked elevation level. */
  elevation: number;
  /** Asset id for the visible tile top. */
  baseAssetId: string;
  /** Asset id for the support/bottom under elevated tiles. */
  supportAssetId: string;
  /** Six-edge bitmask for road connectivity. */
  roadEdges: number;
  /** Six-edge bitmask for river connectivity. */
  riverEdges: number;
  /** Six-edge bitmask for coast/water connectivity. */
  coastEdges: number;
  /** Road slope variant when the tile uses sloped roads. */
  roadSlope?: 'high' | 'low';
  /** Whether this river tile uses a waterless variant. */
  riverWaterless: boolean;
  /** Whether this river tile uses a curvy variant. */
  riverCurvy: boolean;
  /** River crossing variant, when any. */
  riverCrossing?: 'A' | 'B';
  /** Whether this coast tile uses a waterless variant. */
  coastWaterless: boolean;
  /** Generated taxonomy tags. */
  tags: readonly string[];
}

/**
 * Serializable placement state in a generated gameboard plan.
 */
export interface GameboardPlacementSpec {
  /** Stable placement id. */
  id: string;
  /** Origin tile key in `q,r` form. */
  tileKey: string;
  /** Origin tile coordinates. */
  coordinates: HexCoordinates;
  /** World position after tile elevation and placement offset. */
  position: WorldPosition;
  /** Manifest or external registry asset id. */
  assetId: string;
  /** Placement category. */
  kind: GameboardPlacementKind;
  /** Render and gameplay layer. */
  layer: GameboardPlacementLayer;
  /** KayKit texture set applied to this placement. */
  textureSet: TextureSet;
  /** Origin tile elevation. */
  elevation: number;
  /** Vertical offset above the origin tile. */
  elevationOffset: number;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps: number;
  /** Rotation in radians derived from `rotationSteps`. */
  rotationRadians: number;
  /** Uniform render scale. */
  scale: number;
  /** Stable render and snapshot sort order. */
  order: number;
  /** Optional stack index for vertical or layered pieces. */
  stackIndex?: number;
  /** Whether this placement requires local-only EXTRA assets. */
  requiresExtra: boolean;
  /** Serializable metadata for gameplay, layout, and renderer hints. */
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

/**
 * Complete serializable gameboard plan.
 */
export interface GameboardPlan {
  /** Schema version used to interpret this plan. */
  schemaVersion: typeof GAMEBOARD_SCHEMA_VERSION;
  /** Seed used to create this plan. */
  seed: string;
  /** Board shape. */
  shape: GameboardShape;
  /** Active texture set. */
  textureSet: TextureSet;
  /** Tile specs in the board. */
  tiles: readonly GameboardTileSpec[];
  /** Generated and custom placement specs. */
  placements: readonly GameboardPlacementSpec[];
  /** Non-fatal generation warnings. */
  warnings: readonly string[];
}

/**
 * Options for summarizing a generated or projected gameboard plan.
 */
export interface SummarizeGameboardPlanOptions {
  /**
   * Maximum number of high-frequency assets to include in `topAssets`.
   *
   * Defaults to 20. Use `0` when only aggregate counts are needed.
   */
  topAssetLimit?: number;
}

/**
 * Asset-level count and semantic treatment in a summarized gameboard plan.
 */
export interface GameboardPlanAssetSummary {
  /** Manifest or external registry asset id. */
  assetId: string;
  /** Number of placements that use the asset. */
  count: number;
  /** Whether any placement using this asset requires local-only assets. */
  requiresExtra: boolean;
  /** Placement kinds where the asset appears. */
  kinds: readonly GameboardPlacementKind[];
  /** Render/gameplay layers where the asset appears. */
  layers: readonly GameboardPlacementLayer[];
  /** Semantic features inferred from placement metadata or placement kind. */
  features: readonly string[];
}

/**
 * Aggregate inspection result for a generated or projected gameboard plan.
 *
 * This is designed for editor panels, CI diagnostics, screenshot manifests,
 * external ECS bridges, and tests that need to prove which terrain, texture,
 * elevation, placement, guide-feature, and local-only asset cases are present
 * without reverse-engineering the raw tile and placement arrays.
 */
export interface GameboardPlanSummary {
  /** Schema version used to interpret this plan. */
  schemaVersion: typeof GAMEBOARD_SCHEMA_VERSION;
  /** Seed used to create this plan. */
  seed: string;
  /** Board shape. */
  shape: GameboardShape;
  /** Active texture set. */
  textureSet: TextureSet;
  /** Number of tile specs. */
  tileCount: number;
  /** Number of generated and custom placement specs. */
  placementCount: number;
  /** Number of non-fatal generation warnings. */
  warningCount: number;
  /** Number of placements marked as requiring local-only assets. */
  requiresExtraPlacementCount: number;
  /** Tile count by terrain category. */
  tileTerrainCounts: Readonly<Record<string, number>>;
  /** Tile count by texture set. */
  tileTextureSetCounts: Readonly<Record<string, number>>;
  /** Tile count by stacked elevation level. */
  tileElevationCounts: Readonly<Record<string, number>>;
  /** Tile tag counts derived from builder/connectivity metadata. */
  tileTagCounts: Readonly<Record<string, number>>;
  /** Placement count by semantic kind. */
  placementKindCounts: Readonly<Record<string, number>>;
  /** Placement count by render/gameplay layer. */
  placementLayerCounts: Readonly<Record<string, number>>;
  /** Placement count by metadata feature, falling back to placement kind. */
  placementFeatureCounts: Readonly<Record<string, number>>;
  /** Placement count by asset id. */
  assetCounts: Readonly<Record<string, number>>;
  /** Unique asset ids used by placements marked as requiring local-only assets. */
  extraAssetIds: readonly string[];
  /** Highest-frequency asset summaries, sorted by count then asset id. */
  topAssets: readonly GameboardPlanAssetSummary[];
}

/**
 * Options for creating a plan from already assembled tile and placement specs.
 */
export interface GameboardPlanFromTilesOptions {
  /** Seed to write into the plan. */
  seed: string;
  /** Shape to write into the plan. */
  shape: GameboardShape;
  /** Texture set to write into the plan. */
  textureSet?: TextureSet;
  /** Tile specs used by the plan. */
  tiles: readonly GameboardTileSpec[];
  /** Optional custom placements appended after derived terrain/connectivity placements. */
  placements?: readonly GameboardPlacementSpec[];
  /** Optional non-fatal warnings. */
  warnings?: readonly string[];
}

/**
 * Options for adding a stacked mountain feature.
 */
export interface MountainStackOptions {
  /** Tile where the mountain stack is anchored. */
  at: HexCoordinates;
  /** Elevation height for the stack. */
  height: number;
  /** Mountain visual variant. */
  variant?: MountainVariant;
  /** Include grass on the mountain asset. */
  withGrass?: boolean;
  /** Include trees on the mountain asset. */
  withTrees?: boolean;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: number;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding a harbor structure and optional water props.
 */
export interface HarborOptions {
  /** Coast tile where the harbor is anchored. */
  at: HexCoordinates;
  /** Edge facing adjacent water. */
  facing: HexEdgeIndex;
  /** Faction color for the harbor. */
  faction: Faction;
  /** Harbor structure variant. */
  kind?: HarborKind;
  /** Whether to add adjacent boat/anchor props. */
  includeProps?: boolean;
  /** Clockwise 60-degree rotation steps. Defaults to `facing`. */
  rotationSteps?: number;
}

/**
 * Options for adding a faction settlement building.
 */
export interface SettlementOptions {
  /** Tile where the settlement is anchored. */
  at: HexCoordinates;
  /** Faction color for the building. */
  faction: Faction;
  /** Settlement building kind. */
  building: SettlementBuilding;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: number;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding a faction building.
 */
export interface FactionBuildingOptions {
  /** Tile where the building is anchored. */
  at: HexCoordinates;
  /** Faction color for the building. */
  faction: Faction;
  /** Faction building kind. */
  building: FactionBuildingKind;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: number;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding a neutral structure.
 */
export interface NeutralStructureOptions {
  /** Tile where the structure is anchored. */
  at: HexCoordinates;
  /** Neutral structure asset id. */
  structure: NeutralStructureKind;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: number;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding a neutral bridge structure.
 */
export interface BridgeOptions {
  /** Tile where the bridge is anchored, usually a road crossing over water or river terrain. */
  at: HexCoordinates;
  /** KayKit bridge visual variant. Defaults to `A`. */
  variant?: BridgeVariant;
  /** Edge the bridge points toward; also used as the default rotation. */
  facing?: HexEdgeIndex;
  /** Clockwise 60-degree rotation steps. Overrides `facing` when provided. */
  rotationSteps?: number;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding a sloped grass ramp between adjacent elevation levels.
 */
export interface ElevationRampOptions {
  /** Lower tile where the visible ramp is anchored. */
  at: HexCoordinates;
  /** Visual ramp direction. Defaults to `up`. */
  direction?: ElevationRampDirection;
  /** Edge the ramp points toward; also used as the default rotation. */
  facing?: HexEdgeIndex;
  /** Clockwise 60-degree rotation steps. Overrides `facing` when provided. */
  rotationSteps?: number;
  /** Elevation on the anchor tile. Defaults to the tile elevation. */
  fromElevation?: number;
  /** Elevation reached by the ramp. Defaults to one level above or below `fromElevation`. */
  toElevation?: number;
  /** Texture set to apply to the anchor tile before placing the ramp. */
  textureSet?: TextureSet;
  /** Fractional elevation offset above the tile surface. */
  elevationOffset?: number;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding a wall or fence segment with fortification metadata.
 */
export interface FortificationOptions {
  /** Tile where the segment is anchored. */
  at: HexCoordinates;
  /** Material family. Defaults to `wall`. */
  material?: FortificationMaterial;
  /** Segment visual shape. Defaults to `straight`. */
  segment?: FortificationSegment;
  /** Edge the segment faces; also used as the default rotation. */
  facing?: HexEdgeIndex;
  /** Clockwise 60-degree rotation steps. Overrides `facing` when provided. */
  rotationSteps?: number;
  /** Optional stable id for a multi-segment enclosure. */
  enclosureId?: string;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding construction, ruin, and worksite neutral structures.
 */
export interface ConstructionSiteOptions {
  /** Tile where the construction asset is anchored. */
  at: HexCoordinates;
  /** Construction state to place. Defaults to `stage-A`. */
  kind?: ConstructionSiteKind;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: number;
  /** Optional stable id for a multi-step construction chain. */
  constructionId?: string;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding neutral siege projectile assets with gameplay metadata.
 */
export interface SiegeProjectileOptions {
  /** Tile where the projectile is anchored. */
  at: HexCoordinates;
  /** Projectile visual kind. Defaults to `catapult`. */
  kind?: SiegeProjectileKind;
  /** Edge the projectile travels or points toward; also used as the default rotation. */
  facing?: HexEdgeIndex;
  /** Clockwise 60-degree rotation steps. Overrides `facing` when provided. */
  rotationSteps?: number;
  /** Optional source actor, structure, or attack id. */
  sourceId?: string;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding a nature decoration.
 */
export interface NaturePlacementOptions {
  /** Tile where the nature asset is anchored. */
  at: HexCoordinates;
  /** Nature asset id. */
  assetId: NatureAssetId;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: number;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding a prop placement.
 */
export interface PropPlacementOptions {
  /** Tile where the prop is anchored. */
  at: HexCoordinates;
  /** Prop asset id. */
  assetId: PropAssetId;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: number;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding a semantic cluster of props.
 */
export interface PropClusterOptions {
  /** Anchor tile for the cluster. */
  at: HexCoordinates;
  /** Cluster purpose. Determines the default asset list. */
  kind: PropClusterKind;
  /** Edge used to orient adjacent spread patterns. */
  facing?: HexEdgeIndex;
  /** Whether assets stack on one tile or spread to neighboring tiles. Defaults to `adjacent`. */
  placement?: PropClusterPlacement;
  /** Percentage of the cluster's available asset list to place, from 0 to 1. Defaults to 1. */
  density?: number;
  /** Include local-only EXTRA prop assets when the cluster kind has them. Defaults to false. */
  includeExtra?: boolean;
  /** Optional stable id shared by all placements in the cluster. */
  clusterId?: string;
  /** Base clockwise 60-degree rotation steps. Defaults to `facing`. */
  rotationSteps?: number;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding an EXTRA texture transition placement.
 */
export interface TransitionPlacementOptions {
  /** Tile where the transition is anchored. */
  at: HexCoordinates;
  /** Source texture set. */
  from: TextureSet;
  /** Destination texture set. */
  to: TextureSet;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: number;
}

/**
 * Options for adding one EXTRA unit part.
 */
export interface UnitPlacementOptions {
  /** Tile where the unit part is anchored. */
  at: HexCoordinates;
  /** Unit part asset id. */
  part: ColoredUnitPart | NeutralUnitPart;
  /** Faction used by colored unit parts. */
  faction?: Faction;
  /** Colored unit style. */
  style?: ColoredUnitStyle;
  /** Force neutral unit asset selection. */
  neutral?: boolean;
  /** Shared composite id for multi-part units. */
  compositeId?: string;
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: number;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for adding a predefined multi-part unit composition.
 */
export interface UnitPresetOptions {
  /** Tile where the unit preset is anchored. */
  at: HexCoordinates;
  /** Faction used by colored unit parts. */
  faction: Faction;
  /** Colored unit style. */
  style?: ColoredUnitStyle;
  /** Unit role composition to create. */
  role: 'worker' | 'soldier' | 'archer' | 'cavalry' | 'merchant' | 'siege' | 'ship';
  /** Clockwise 60-degree rotation steps. */
  rotationSteps?: number;
}

/**
 * Options for overriding the base tile asset and guide connectivity state.
 */
export interface TileAssetOptions {
  /** Tile whose asset state should be replaced. */
  at: HexCoordinates;
  /** Base tile asset id. */
  assetId: string;
  /** Replacement terrain category. */
  terrain?: GameboardTerrain;
  /** Replacement support/bottom asset id. */
  supportAssetId?: string;
  /** Replacement elevation. */
  elevation?: number;
  /** Replacement road edge input. */
  roadEdges?: HexEdgeInput;
  /** Replacement river edge input. */
  riverEdges?: HexEdgeInput;
  /** Replacement coast edge input. */
  coastEdges?: HexEdgeInput;
  /** Road slope variant. */
  roadSlope?: RoadSlope;
  /** Whether the river uses a waterless variant. */
  riverWaterless?: boolean;
  /** Whether the river uses a curvy variant. */
  riverCurvy?: boolean;
  /** River crossing variant. */
  riverCrossing?: RiverCrossing;
  /** Whether the coast uses a waterless variant. */
  coastWaterless?: boolean;
  /** Replacement texture set for this tile. */
  textureSet?: TextureSet;
  /** Additional tile tags. */
  tags?: readonly string[];
}

/**
 * Options for seeded random decoration scatter.
 */
export interface ScatterDecorationOptions {
  /** Number of decorations to place. */
  count: number;
  /** Candidate asset ids for each decoration. */
  assets: readonly string[];
  /** Allowed terrain for decoration sites. */
  terrain?: GameboardTerrain | readonly GameboardTerrain[];
  /** Avoid tiles with existing custom placements. */
  avoidOccupied?: boolean;
  /** Uniform render scale. */
  scale?: number;
}

/**
 * Options for the built-in medieval harbor demo board.
 */
export interface MedievalHarborBoardOptions extends Partial<GameboardPlanOptions> {
  /** Faction color used by settlement and harbor pieces. */
  faction?: Faction;
}

const DEFAULT_SEED = 'medieval-hexagon-gameboard';
const EDGE_INDEXES = [0, 1, 2, 3, 4, 5] as const satisfies readonly HexEdgeIndex[];
const TERRAIN_ASSETS: Record<Extract<GameboardTerrain, 'grass' | 'water'>, string> = {
  grass: 'hex_grass',
  water: 'hex_water',
};
const EXTRA_HARBOR_ASSETS: Record<Exclude<HarborKind, 'watermill'>, string> = {
  docks: 'building_docks',
  shipyard: 'building_shipyard',
};
const PROP_CLUSTER_ASSETS = {
  camp: ['tent', 'barrel', 'sack', 'bucket_empty', 'crate_A_small', 'crate_B_small'],
  'harbor-support': ['anchor', 'boat', 'boatrack', 'barrel', 'crate_long_A', 'crate_long_B', 'crate_open'],
  'resource-cache': [
    'resource_lumber',
    'resource_stone',
    'crate_A_big',
    'crate_B_big',
    'crate_long_A',
    'crate_long_B',
    'crate_long_C',
    'crate_open',
    'sack',
    'barrel',
    'pallet',
    'wheelbarrow',
  ],
  'stable-yard': ['haybale', 'trough', 'trough_long', 'bucket_water', 'barrel'],
  'training-yard': ['target', 'weaponrack', 'bucket_arrows', 'icon_combat', 'icon_range', 'cannonball_pallet'],
  worksite: [
    'ladder',
    'pallet',
    'wheelbarrow',
    'bucket_empty',
    'bucket_water',
    'crate_long_empty',
    'resource_lumber',
    'resource_stone',
    'barrel',
  ],
} as const satisfies Record<PropClusterKind, readonly PropAssetId[]>;

/**
 * Fluent builder for deterministic gameboard plans using KayKit guide variants,
 * stacked terrain, roads, rivers, harbors, settlements, props, and EXTRA units.
 */
export class GameboardBuilder {
  /** Seed used by deterministic builder helpers. */
  readonly seed: string;
  /** Shape populated by this builder. */
  readonly shape: GameboardShape;
  /** Texture set applied to generated terrain. */
  readonly textureSet: TextureSet;
  private readonly rng: seedrandom.PRNG;
  private readonly tiles = new Map<string, MutableGameboardTileSpec>();
  private readonly customPlacements: GameboardPlacementSpec[] = [];
  private readonly warnings: string[] = [];
  private placementCursor = 0;

  /**
   * Create a builder and initialize all tiles in the requested shape.
   */
  constructor(options: GameboardPlanOptions) {
    this.seed = String(options.seed ?? DEFAULT_SEED);
    this.shape = options.shape;
    this.textureSet = options.textureSet ?? 'default';
    this.rng = seedrandom(this.seed);

    const defaultTerrain = options.defaultTerrain ?? 'grass';
    for (const coordinates of coordinatesForShape(options.shape)) {
      this.tiles.set(hexKey(coordinates), createTile(coordinates, defaultTerrain, this.textureSet));
    }
  }

  /**
   * Set a base grass or water terrain tile.
   */
  setTerrain(
    coordinates: HexCoordinates,
    terrain: Extract<GameboardTerrain, 'grass' | 'water'>,
    options: { elevation?: number; baseAssetId?: string; textureSet?: TextureSet } = {}
  ): this {
    const tile = this.requireTile(coordinates);
    tile.terrain = terrain;
    tile.baseAssetId = options.baseAssetId ?? TERRAIN_ASSETS[terrain];
    tile.elevation = normalizeElevation(options.elevation ?? tile.elevation);
    tile.textureSet = options.textureSet ?? tile.textureSet;
    updateTags(tile);
    return this;
  }

  /**
   * Override a tile's base asset, terrain, elevation, connectivity, and tags.
   */
  setTileAsset(options: TileAssetOptions): this {
    const tile = this.requireTile(options.at);
    tile.baseAssetId = options.assetId;
    tile.terrain = options.terrain ?? tile.terrain;
    tile.supportAssetId = options.supportAssetId ?? tile.supportAssetId;
    tile.elevation = normalizeElevation(options.elevation ?? tile.elevation);
    tile.roadEdges = options.roadEdges === undefined ? tile.roadEdges : edgeMask(options.roadEdges);
    tile.riverEdges = options.riverEdges === undefined ? tile.riverEdges : edgeMask(options.riverEdges);
    tile.coastEdges = options.coastEdges === undefined ? tile.coastEdges : edgeMask(options.coastEdges);
    tile.roadSlope = options.roadSlope ?? tile.roadSlope;
    tile.riverWaterless = options.riverWaterless ?? tile.riverWaterless;
    tile.riverCurvy = options.riverCurvy ?? tile.riverCurvy;
    tile.riverCrossing = options.riverCrossing ?? tile.riverCrossing;
    tile.coastWaterless = options.coastWaterless ?? tile.coastWaterless;
    tile.textureSet = options.textureSet ?? tile.textureSet;
    updateTags(tile, options.tags);
    return this;
  }

  /**
   * Set the texture set for an existing tile without changing its terrain.
   */
  setTextureSet(coordinates: HexCoordinates, textureSet: TextureSet): this {
    const tile = this.requireTile(coordinates);
    tile.textureSet = textureSet;
    return this;
  }

  /**
   * Set the elevation for an existing tile.
   */
  setElevation(coordinates: HexCoordinates, elevation: number): this {
    const tile = this.requireTile(coordinates);
    tile.elevation = normalizeElevation(elevation);
    updateTags(tile);
    return this;
  }

  /**
   * Mark a tile as coast and set the edges that face water.
   */
  setCoastEdges(
    coordinates: HexCoordinates,
    waterEdges: readonly HexEdgeIndex[] | number,
    options: { waterless?: boolean } = {}
  ): this {
    const tile = this.requireTile(coordinates);
    tile.terrain = 'coast';
    tile.coastEdges = edgeMask(waterEdges);
    tile.coastWaterless = options.waterless ?? false;
    updateTags(tile);
    return this;
  }

  /**
   * Add road connectivity along a coordinate path.
   */
  addRoadPath(
    path: readonly HexCoordinates[],
    options: { slope?: 'high' | 'low' } = {}
  ): this {
    const masks = pathMasks(path);
    for (const [key, mask] of masks) {
      const tile = this.requireTile(parseHexKey(key));
      tile.terrain = tile.terrain === 'water' || tile.terrain === 'coast' ? 'coast' : 'road';
      tile.roadEdges = mergeMask(tile.roadEdges, mask);
      tile.roadSlope = options.slope ?? tile.roadSlope;
      updateTags(tile);
    }
    return this;
  }

  /**
   * Add river connectivity along a coordinate path.
   */
  addRiverPath(
    path: readonly HexCoordinates[],
    options: { waterless?: boolean; curvy?: boolean; crossing?: 'A' | 'B' } = {}
  ): this {
    const masks = pathMasks(path);
    for (const [key, mask] of masks) {
      const tile = this.requireTile(parseHexKey(key));
      tile.terrain = tile.terrain === 'water' ? 'water' : 'river';
      tile.riverEdges = mergeMask(tile.riverEdges, mask);
      tile.riverWaterless = options.waterless ?? tile.riverWaterless;
      tile.riverCurvy = options.curvy ?? tile.riverCurvy;
      tile.riverCrossing = options.crossing ?? tile.riverCrossing;
      updateTags(tile);
    }
    return this;
  }

  /**
   * Add an elevated mountain tile plus a visible mountain-stack placement.
   */
  addMountainStack(options: MountainStackOptions): this {
    const tile = this.requireTile(options.at);
    const height = normalizeElevation(options.height);
    const variant = options.variant ?? 'A';
    tile.terrain = 'mountain';
    tile.elevation = height;
    tile.baseAssetId = 'hex_grass';
    updateTags(tile);

    this.addPlacement({
      at: options.at,
      assetId: mountainAssetId(variant, {
        withGrass: options.withGrass ?? true,
        withTrees: options.withTrees ?? false,
      }),
      kind: 'decoration',
      layer: 'feature',
      rotationSteps: options.rotationSteps,
      scale: options.scale,
      stackIndex: height,
      metadata: { feature: 'mountain-stack', height, variant },
    });
    return this;
  }

  /**
   * Add a hill decoration and mark the tile as hill terrain.
   */
  addHill(
    coordinates: HexCoordinates,
    options: { variant?: HillVariant; withTrees?: boolean; single?: boolean; rotationSteps?: number } = {}
  ): this {
    const tile = this.requireTile(coordinates);
    tile.terrain = 'hill';
    updateTags(tile);
    const variant = options.variant ?? 'A';
    const assetId = options.single
      ? `hill_single_${variant}`
      : `hills_${variant}${options.withTrees ? '_trees' : ''}`;
    this.addPlacement({
      at: coordinates,
      assetId,
      kind: 'decoration',
      layer: 'feature',
      rotationSteps: options.rotationSteps,
      metadata: { feature: 'hill', variant, single: options.single ?? false },
    });
    return this;
  }

  /**
   * Add a forest decoration and mark the tile as forest terrain.
   */
  addForest(
    coordinates: HexCoordinates,
    options: { species?: 'A' | 'B'; size?: 'small' | 'medium' | 'large'; cut?: boolean } = {}
  ): this {
    const tile = this.requireTile(coordinates);
    tile.terrain = 'forest';
    updateTags(tile);
    const species = options.species ?? 'A';
    const size = options.size ?? 'medium';
    const assetId = options.cut ? `trees_${species}_cut` : `trees_${species}_${size}`;
    this.addPlacement({
      at: coordinates,
      assetId,
      kind: 'decoration',
      layer: 'feature',
      rotationSteps: this.randomRotationSteps(),
      metadata: { feature: 'forest', species, size, cut: options.cut ?? false },
    });
    return this;
  }

  /**
   * Add a settlement building. Alias for `addFactionBuilding`.
   */
  addSettlement(options: SettlementOptions): this {
    return this.addFactionBuilding(options);
  }

  /**
   * Add a faction building structure placement.
   */
  addFactionBuilding(options: FactionBuildingOptions): this {
    const assetId = factionBuildingAssetId(options.building, options.faction);
    this.addPlacement({
      at: options.at,
      assetId,
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps,
      scale: options.scale,
      metadata: { feature: 'settlement', faction: options.faction, building: options.building },
    });
    return this;
  }

  /**
   * Add a neutral structure placement.
   */
  addNeutralStructure(options: NeutralStructureOptions): this {
    this.addPlacement({
      at: options.at,
      assetId: options.structure,
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps,
      scale: options.scale,
      metadata: { feature: 'neutral-structure', structure: options.structure },
    });
    return this;
  }

  /**
   * Add a bridge structure with bridge-specific metadata instead of requiring
   * callers to know the raw neutral-structure asset ids.
   */
  addBridge(options: BridgeOptions): this {
    const variant = options.variant ?? 'A';
    this.addPlacement({
      at: options.at,
      assetId: `building_bridge_${variant}`,
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps ?? options.facing,
      scale: options.scale,
      metadata: {
        feature: 'bridge',
        bridgeVariant: variant,
        facing: options.facing ?? null,
      },
    });
    return this;
  }

  /**
   * Add a wall or fence segment with fortification metadata.
   */
  addFortification(options: FortificationOptions): this {
    const material = options.material ?? 'wall';
    const segment = options.segment ?? 'straight';
    const assetId = fortificationAssetId(material, segment);
    this.addPlacement({
      at: options.at,
      assetId,
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps ?? options.facing,
      scale: options.scale,
      metadata: {
        feature: 'fortification',
        material,
        segment,
        facing: options.facing ?? null,
        enclosureId: options.enclosureId ?? null,
      },
    });
    return this;
  }

  /**
   * Add a construction, ruin, or worksite structure with construction metadata.
   */
  addConstructionSite(options: ConstructionSiteOptions): this {
    const kind = options.kind ?? 'stage-A';
    this.addPlacement({
      at: options.at,
      assetId: constructionSiteAssetId(kind),
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps,
      scale: options.scale,
      metadata: {
        feature: 'construction-site',
        constructionKind: kind,
        constructionId: options.constructionId ?? null,
      },
    });
    return this;
  }

  /**
   * Add a neutral siege projectile with projectile-specific metadata.
   */
  addSiegeProjectile(options: SiegeProjectileOptions): this {
    const kind = options.kind ?? 'catapult';
    this.addPlacement({
      at: options.at,
      assetId: siegeProjectileAssetId(kind),
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps ?? options.facing,
      scale: options.scale,
      metadata: {
        feature: 'siege-projectile',
        projectileKind: kind,
        facing: options.facing ?? null,
        sourceId: options.sourceId ?? null,
      },
    });
    return this;
  }

  /**
   * Add a sloped grass ramp with ramp-specific metadata instead of requiring
   * callers to place `hex_grass_sloped_high` or `hex_grass_sloped_low` directly.
   */
  addElevationRamp(options: ElevationRampOptions): this {
    const tile = this.requireTile(options.at);
    if (options.textureSet) {
      tile.textureSet = options.textureSet;
    }
    const direction = options.direction ?? 'up';
    const fromElevation = options.fromElevation ?? tile.elevation;
    const toElevation = options.toElevation ?? (direction === 'up' ? fromElevation + 1 : Math.max(0, fromElevation - 1));
    this.addPlacement({
      at: options.at,
      assetId: direction === 'up' ? 'hex_grass_sloped_high' : 'hex_grass_sloped_low',
      kind: 'transition',
      layer: 'surface',
      rotationSteps: options.rotationSteps ?? options.facing,
      elevationOffset: options.elevationOffset ?? 0.035,
      scale: options.scale,
      metadata: {
        feature: 'elevation-ramp',
        direction,
        facing: options.facing ?? null,
        fromElevation,
        toElevation,
        textureSet: tile.textureSet,
      },
    });
    return this;
  }

  /**
   * Add a nature decoration placement.
   */
  addNature(options: NaturePlacementOptions): this {
    this.addPlacement({
      at: options.at,
      assetId: options.assetId,
      kind: 'decoration',
      layer: 'feature',
      rotationSteps: options.rotationSteps,
      scale: options.scale,
      metadata: { feature: 'nature', assetId: options.assetId },
    });
    return this;
  }

  /**
   * Add a prop placement.
   */
  addProp(options: PropPlacementOptions): this {
    this.addPlacement({
      at: options.at,
      assetId: options.assetId,
      kind: 'prop',
      layer: 'feature',
      rotationSteps: options.rotationSteps,
      scale: options.scale,
      metadata: { feature: 'prop', assetId: options.assetId },
    });
    return this;
  }

  /**
   * Add a faction flag prop placement.
   */
  addFlag(at: HexCoordinates, faction: Faction, options: { rotationSteps?: number; scale?: number } = {}): this {
    return this.addProp({
      at,
      assetId: flagAssetId(faction),
      rotationSteps: options.rotationSteps,
      scale: options.scale,
    });
  }

  /**
   * Add a semantic prop cluster such as a camp, worksite, stable yard, or cache.
   */
  addPropCluster(options: PropClusterOptions): this {
    const density = clampPercentage(options.density ?? 1);
    if (density <= 0) {
      return this;
    }
    const assets = listPropClusterAssets(options.kind, { includeExtra: options.includeExtra });
    const count = Math.max(1, Math.ceil(assets.length * density));
    const sites = propClusterSites(options.at, options.facing ?? 0, options.placement ?? 'adjacent');
    const baseRotation = options.rotationSteps ?? options.facing ?? 0;
    const clusterId = options.clusterId ?? `prop-cluster:${options.kind}:${hexKey(options.at)}:${this.customPlacements.length}`;

    for (let index = 0; index < count; index += 1) {
      const assetId = assets[index];
      const site = sites[index % sites.length];
      if (!assetId || !site) {
        continue;
      }
      if (!this.tiles.has(hexKey(site))) {
        this.warnings.push(`Skipped ${assetId}; prop cluster tile ${hexKey(site)} is outside the board`);
        continue;
      }
      this.addPlacement({
        at: site,
        assetId,
        kind: 'prop',
        layer: 'feature',
        rotationSteps: baseRotation + index,
        scale: options.scale,
        metadata: {
          feature: 'prop-cluster',
          propClusterKind: options.kind,
          clusterId,
          anchor: hexKey(options.at),
          placement: options.placement ?? 'adjacent',
          includeExtra: options.includeExtra ?? false,
          density,
          propIndex: index,
        },
      });
    }
    return this;
  }

  /**
   * Add an EXTRA texture transition placement.
   */
  addTransition(options: TransitionPlacementOptions): this {
    this.addPlacement({
      at: options.at,
      assetId: 'hex_transition',
      kind: 'transition',
      layer: 'surface',
      rotationSteps: options.rotationSteps,
      elevationOffset: 0.04,
      requiresExtra: true,
      metadata: { feature: 'transition', from: options.from, to: options.to },
    });
    return this;
  }

  /**
   * Add one unit part placement from the EXTRA unit library.
   */
  addUnit(options: UnitPlacementOptions): this {
    const assetId =
      options.neutral || !options.faction
        ? neutralUnitAssetId(options.part as NeutralUnitPart)
        : coloredUnitAssetId(options.part as ColoredUnitPart, options.faction, options.style ?? 'full');
    this.addPlacement({
      at: options.at,
      assetId,
      kind: 'unit',
      layer: 'unit',
      rotationSteps: options.rotationSteps,
      elevationOffset: 0.08,
      scale: options.scale,
      requiresExtra: true,
      metadata: {
        feature: 'unit',
        part: options.part,
        faction: options.faction ?? null,
        style: options.neutral ? 'neutral' : (options.style ?? 'full'),
        unitCompositeId: options.compositeId ?? null,
      },
    });
    return this;
  }

  /**
   * Add a predefined multi-part unit composition.
   */
  addUnitPreset(options: UnitPresetOptions): this {
    const style = options.style ?? 'full';
    const compositeId = `unit:${hexKey(options.at)}:${options.faction}:${options.role}:${style}:${this.customPlacements.length}`;
    const add = (part: ColoredUnitPart | NeutralUnitPart, offset: number, neutral = false) => {
      this.addUnit({
        at: options.at,
        part,
        faction: options.faction,
        style,
        neutral,
        compositeId,
        rotationSteps: (options.rotationSteps ?? 0) + offset,
        scale: 1,
      });
    };

    add('unit', 0);
    switch (options.role) {
      case 'worker':
        add('shovel', 0, true);
        break;
      case 'soldier':
        add('sword', 0);
        add('shield', 0);
        add('helmet', 0);
        break;
      case 'archer':
        add('bow', 0);
        add('projectile_arrow', 0);
        break;
      case 'cavalry':
        add('horse', 0);
        add('spear', 0);
        break;
      case 'merchant':
        add('cart_merchant', 0);
        break;
      case 'siege':
        add('catapult', 0);
        break;
      case 'ship':
        add('ship', 0);
        break;
    }
    return this;
  }

  /**
   * Add a harbor structure, mark the coast/water relationship, and optionally
   * place adjacent water props.
   */
  addHarbor(options: HarborOptions): this {
    const tile = this.requireTile(options.at);
    const water = neighbor(options.at, options.facing);
    tile.terrain = 'coast';
    tile.coastEdges = mergeMask(tile.coastEdges, 1 << options.facing);
    updateTags(tile);

    if (this.tiles.has(hexKey(water))) {
      this.setTerrain(water, 'water');
    }

    const kind = options.kind ?? 'docks';
    const assetId =
      kind === 'watermill'
        ? `building_watermill_${options.faction}`
        : `${EXTRA_HARBOR_ASSETS[kind]}_${options.faction}`;
    this.addPlacement({
      at: options.at,
      assetId,
      kind: 'structure',
      layer: 'structure',
      rotationSteps: options.rotationSteps ?? options.facing,
      metadata: { feature: 'harbor', harborKind: kind, faction: options.faction, facing: options.facing },
    });

    if (options.includeProps ?? true) {
      this.addWaterProp(water, 'boat', options.facing);
      this.addWaterProp(water, 'anchor', options.facing + 1);
    }
    return this;
  }

  /**
   * Scatter random decoration placements across matching terrain.
   */
  scatterDecorations(options: ScatterDecorationOptions): this {
    const terrains = new Set(
      Array.isArray(options.terrain)
        ? options.terrain
        : [options.terrain ?? ('grass' satisfies GameboardTerrain)]
    );
    const occupied = new Set(this.customPlacements.map((placement) => placement.tileKey));
    const candidates = [...this.tiles.values()].filter((tile) => {
      if (!terrains.has(tile.terrain)) {
        return false;
      }
      return !(options.avoidOccupied ?? true) || !occupied.has(tile.key);
    });

    const count = Math.min(options.count, candidates.length);
    for (let index = 0; index < count; index += 1) {
      const candidateIndex = Math.floor(this.rng() * candidates.length);
      const [tile] = candidates.splice(candidateIndex, 1);
      const assetId = options.assets[Math.floor(this.rng() * options.assets.length)];
      if (!tile || !assetId) {
        break;
      }
      this.addPlacement({
        at: tile.coordinates,
        assetId,
        kind: 'decoration',
        layer: 'feature',
        rotationSteps: this.randomRotationSteps(),
        scale: options.scale,
        metadata: { feature: 'scatter' },
      });
    }
    return this;
  }

  /**
   * Add a custom placement to the plan.
   */
  addPlacement(options: {
    at: HexCoordinates;
    assetId: string;
    kind: GameboardPlacementKind;
    layer: GameboardPlacementLayer;
    rotationSteps?: number;
    elevationOffset?: number;
    scale?: number;
    stackIndex?: number;
    requiresExtra?: boolean;
    metadata?: Readonly<Record<string, string | number | boolean | null>>;
  }): this {
    const tile = this.requireTile(options.at);
    const rotationSteps = normalizeRotationSteps(options.rotationSteps ?? 0);
    const elevationOffset = options.elevationOffset ?? 0;
    this.customPlacements.push({
      id: `${options.kind}:${tile.key}:${options.assetId}:${this.placementCursor}`,
      tileKey: tile.key,
      coordinates: tile.coordinates,
      position: axialToWorld(tile.coordinates, tile.elevation + elevationOffset),
      assetId: options.assetId,
      kind: options.kind,
      layer: options.layer,
      textureSet: tile.textureSet,
      elevation: tile.elevation,
      elevationOffset,
      rotationSteps,
      rotationRadians: rotationSteps * (Math.PI / 3),
      scale: options.scale ?? 1,
      order: 200_000 + this.placementCursor,
      stackIndex: options.stackIndex,
      requiresExtra: options.requiresExtra ?? requiresExtraAsset(options.assetId),
      metadata: options.metadata ?? {},
    });
    this.placementCursor += 1;
    return this;
  }

  /**
   * Build an immutable gameboard plan from current builder state.
   */
  build(): GameboardPlan {
    const tiles = [...this.tiles.values()].map(freezeTile);
    return createGameboardPlanFromTiles({
      seed: this.seed,
      shape: this.shape,
      textureSet: this.textureSet,
      tiles,
      warnings: [...this.warnings],
      placements: this.customPlacements,
    });
  }

  private requireTile(coordinates: HexCoordinates): MutableGameboardTileSpec {
    const key = hexKey(coordinates);
    const tile = this.tiles.get(key);
    if (!tile) {
      throw new Error(`No tile exists at ${key} for ${this.shape.kind} gameboard`);
    }
    return tile;
  }

  private addWaterProp(coordinates: HexCoordinates, assetId: string, rotationSteps: number): void {
    if (!this.tiles.has(hexKey(coordinates))) {
      this.warnings.push(`Skipped ${assetId}; adjacent water tile ${hexKey(coordinates)} is outside the board`);
      return;
    }
    this.addPlacement({
      at: coordinates,
      assetId,
      kind: 'prop',
      layer: 'feature',
      rotationSteps,
      metadata: { feature: 'harbor-prop' },
    });
  }

  private randomRotationSteps(): number {
    return Math.floor(this.rng() * 6);
  }
}

type MutableGameboardTileSpec = {
  -readonly [K in keyof GameboardTileSpec]: GameboardTileSpec[K] extends readonly string[]
    ? string[]
    : GameboardTileSpec[K];
};

/**
 * Create a fluent gameboard builder.
 */
export function createGameboardBuilder(options: GameboardPlanOptions): GameboardBuilder {
  return new GameboardBuilder(options);
}

/**
 * Create a complete gameboard plan, optionally configuring it through a builder
 * callback before build.
 */
export function createGameboardPlan(
  options: GameboardPlanOptions,
  configure?: (builder: GameboardBuilder) => void
): GameboardPlan {
  const builder = createGameboardBuilder(options);
  configure?.(builder);
  return builder.build();
}

/**
 * Create a complete plan from explicit tiles and custom placements, adding the
 * derived terrain and connectivity placements used by renderers.
 */
export function createGameboardPlanFromTiles(options: GameboardPlanFromTilesOptions): GameboardPlan {
  const terrainPlacements = options.tiles.flatMap((tile, index) => terrainPlacementsForTile(tile, index));
  const connectivityPlacements = options.tiles.flatMap((tile, index) => connectivityPlacementsForTile(tile, index));
  const placements = [...terrainPlacements, ...connectivityPlacements, ...(options.placements ?? [])].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  );

  return {
    schemaVersion: GAMEBOARD_SCHEMA_VERSION,
    seed: options.seed,
    shape: options.shape,
    textureSet: options.textureSet ?? 'default',
    tiles: [...options.tiles],
    placements,
    warnings: [...(options.warnings ?? [])],
  };
}

/**
 * Summarize terrain, elevation, placement, feature, and local-only asset usage
 * in a generated or live-projected gameboard plan.
 */
export function summarizeGameboardPlan(
  plan: GameboardPlan,
  options: SummarizeGameboardPlanOptions = {}
): GameboardPlanSummary {
  const tileTerrainCounts: Record<string, number> = {};
  const tileTextureSetCounts: Record<string, number> = {};
  const tileElevationCounts: Record<string, number> = {};
  const tileTagCounts: Record<string, number> = {};
  const placementKindCounts: Record<string, number> = {};
  const placementLayerCounts: Record<string, number> = {};
  const placementFeatureCounts: Record<string, number> = {};
  const assetCounts: Record<string, number> = {};
  const extraAssetIds = new Set<string>();
  const assetSummaries = new Map<
    string,
    {
      assetId: string;
      count: number;
      requiresExtra: boolean;
      kinds: Set<GameboardPlacementKind>;
      layers: Set<GameboardPlacementLayer>;
      features: Set<string>;
    }
  >();

  for (const tile of plan.tiles) {
    incrementCount(tileTerrainCounts, tile.terrain);
    incrementCount(tileTextureSetCounts, tile.textureSet);
    incrementCount(tileElevationCounts, tile.elevation);
    for (const tag of tile.tags) {
      incrementCount(tileTagCounts, tag);
    }
  }

  let requiresExtraPlacementCount = 0;
  for (const placement of plan.placements) {
    const feature = placementFeature(placement);
    incrementCount(placementKindCounts, placement.kind);
    incrementCount(placementLayerCounts, placement.layer);
    incrementCount(placementFeatureCounts, feature);
    incrementCount(assetCounts, placement.assetId);

    if (placement.requiresExtra) {
      requiresExtraPlacementCount += 1;
      extraAssetIds.add(placement.assetId);
    }

    const assetSummary = assetSummaries.get(placement.assetId) ?? {
      assetId: placement.assetId,
      count: 0,
      requiresExtra: false,
      kinds: new Set<GameboardPlacementKind>(),
      layers: new Set<GameboardPlacementLayer>(),
      features: new Set<string>(),
    };
    assetSummary.count += 1;
    assetSummary.requiresExtra = assetSummary.requiresExtra || placement.requiresExtra;
    assetSummary.kinds.add(placement.kind);
    assetSummary.layers.add(placement.layer);
    assetSummary.features.add(feature);
    assetSummaries.set(placement.assetId, assetSummary);
  }

  const topAssetLimit = Math.max(0, Math.floor(options.topAssetLimit ?? 20));
  const topAssets = [...assetSummaries.values()]
    .sort((left, right) => right.count - left.count || left.assetId.localeCompare(right.assetId))
    .slice(0, topAssetLimit)
    .map<GameboardPlanAssetSummary>((summary) => ({
      assetId: summary.assetId,
      count: summary.count,
      requiresExtra: summary.requiresExtra,
      kinds: sortedStrings(summary.kinds) as readonly GameboardPlacementKind[],
      layers: sortedStrings(summary.layers) as readonly GameboardPlacementLayer[],
      features: sortedStrings(summary.features),
    }));

  return {
    schemaVersion: plan.schemaVersion,
    seed: plan.seed,
    shape: plan.shape,
    textureSet: plan.textureSet,
    tileCount: plan.tiles.length,
    placementCount: plan.placements.length,
    warningCount: plan.warnings.length,
    requiresExtraPlacementCount,
    tileTerrainCounts: sortedCountRecord(tileTerrainCounts),
    tileTextureSetCounts: sortedCountRecord(tileTextureSetCounts),
    tileElevationCounts: sortedCountRecord(tileElevationCounts),
    tileTagCounts: sortedCountRecord(tileTagCounts),
    placementKindCounts: sortedCountRecord(placementKindCounts),
    placementLayerCounts: sortedCountRecord(placementLayerCounts),
    placementFeatureCounts: sortedCountRecord(placementFeatureCounts),
    assetCounts: sortedCountRecord(assetCounts),
    extraAssetIds: [...extraAssetIds].sort((left, right) => left.localeCompare(right)),
    topAssets,
  };
}

/**
 * Create the built-in medieval harbor sample board used by examples and tests.
 */
export function createMedievalHarborBoard(options: MedievalHarborBoardOptions = {}): GameboardPlan {
  const shape = options.shape ?? { kind: 'rectangle', width: 8, height: 6 };
  const faction = options.faction ?? 'blue';
  const builder = createGameboardBuilder({
    seed: options.seed ?? 'medieval-harbor-board',
    shape,
    textureSet: options.textureSet,
    defaultTerrain: options.defaultTerrain,
  });

  if (shape.kind === 'hexagon') {
    return buildHexagonMedievalHarborBoard(builder, shape, faction);
  }

  const harbor = { q: Math.floor(shape.width / 2), r: shape.height - 2 };
  const town = { q: harbor.q, r: Math.max(1, harbor.r - 2) };

  for (let q = 0; q < shape.width; q += 1) {
    builder.setTerrain({ q, r: shape.height - 1 }, 'water');
    builder.setCoastEdges({ q, r: shape.height - 2 }, [1]);
  }

  builder
    .addHarbor({ at: harbor, facing: 1, faction, kind: 'shipyard', includeProps: true })
    .addSettlement({ at: town, faction, building: 'townhall' })
    .addSettlement({ at: { q: town.q - 1, r: town.r }, faction, building: 'market', rotationSteps: 5 })
    .addSettlement({ at: { q: town.q + 1, r: town.r }, faction, building: 'home_A', rotationSteps: 1 })
    .addRoadPath([town, { q: town.q, r: town.r + 1 }, harbor])
    .addRiverPath(
      [
        { q: 1, r: 0 },
        { q: 1, r: 1 },
        { q: 2, r: 1 },
        { q: 2, r: 2 },
        { q: 2, r: 3 },
        { q: 3, r: 3 },
        { q: 3, r: 4 },
      ],
      { curvy: true }
    )
    .addMountainStack({ at: { q: 0, r: 0 }, height: 2, variant: 'A', withTrees: true })
    .addMountainStack({ at: { q: 1, r: 0 }, height: 1, variant: 'B', withGrass: true })
    .addHill({ q: shape.width - 2, r: 1 }, { variant: 'C', withTrees: true })
    .addForest({ q: shape.width - 1, r: 0 }, { species: 'B', size: 'large' })
    .addPropCluster({
      at: { q: Math.max(0, town.q - 2), r: Math.min(shape.height - 2, town.r + 1) },
      kind: 'resource-cache',
      density: 0.6,
      facing: 1,
    })
    .scatterDecorations({
      count: 8,
      terrain: ['grass', 'forest', 'hill'],
      assets: ['tree_single_A', 'tree_single_B', 'rock_single_A', 'rock_single_C', 'crate_A_small'],
    });

  return builder.build();
}

function buildHexagonMedievalHarborBoard(
  builder: GameboardBuilder,
  shape: Extract<GameboardShape, { kind: 'hexagon' }>,
  faction: Faction
): GameboardPlan {
  const coordinates = coordinatesForShape(shape);
  const keys = new Set(coordinates.map(hexKey));
  const maxR = Math.max(...coordinates.map((coordinate) => coordinate.r));
  const waterTiles = coordinates.filter((coordinate) => coordinate.r === maxR);
  const waterKeys = new Set(waterTiles.map(hexKey));

  for (const water of waterTiles) {
    builder.setTerrain(water, 'water');
  }

  const coastTiles = coordinates
    .filter((coordinate) => !waterKeys.has(hexKey(coordinate)))
    .map((coordinate) => ({ coordinate, waterEdges: waterEdgesFor(coordinate, waterKeys) }))
    .filter((coast) => coast.waterEdges.length > 0)
    .sort((left, right) => Math.abs(left.coordinate.q) - Math.abs(right.coordinate.q) || left.coordinate.q - right.coordinate.q);

  for (const coast of coastTiles) {
    builder.setCoastEdges(coast.coordinate, coast.waterEdges);
  }

  const harborSite = coastTiles[0];
  const harbor = harborSite?.coordinate ?? { q: 0, r: Math.max(0, shape.radius - 1) };
  const harborFacing = harborSite?.waterEdges[0] ?? 1;
  const inlandEdge = oppositeEdge(harborFacing);
  const town = firstExistingCoordinate(
    keys,
    [neighbor(neighbor(harbor, inlandEdge), inlandEdge), neighbor(harbor, inlandEdge), { q: 0, r: 0 }],
    waterKeys
  );
  const market = firstExistingCoordinate(keys, [neighbor(town, 3), neighbor(town, 4), neighbor(town, 2)], waterKeys);
  const home = firstExistingCoordinate(keys, [neighbor(town, 0), neighbor(town, 5), neighbor(town, 1)], waterKeys);
  const top = [...coordinates]
    .filter((coordinate) => !waterKeys.has(hexKey(coordinate)))
    .sort((left, right) => left.r - right.r || left.q - right.q)[0] ?? { q: 0, r: -shape.radius };
  const topRight = [...coordinates]
    .filter((coordinate) => !waterKeys.has(hexKey(coordinate)))
    .sort((left, right) => right.q - left.q || left.r - right.r)[0] ?? top;
  const topLeft = [...coordinates]
    .filter((coordinate) => !waterKeys.has(hexKey(coordinate)))
    .sort((left, right) => left.q - right.q || left.r - right.r)[0] ?? top;

  builder
    .addHarbor({ at: harbor, facing: harborFacing, faction, kind: 'shipyard', includeProps: true })
    .addSettlement({ at: town, faction, building: 'townhall' })
    .addSettlement({ at: market, faction, building: 'market', rotationSteps: 5 })
    .addSettlement({ at: home, faction, building: 'home_A', rotationSteps: 1 })
    .addRoadPath(hexLine(town, harbor))
    .addRiverPath(hexLine(top, neighbor(town, 3)).filter((coordinate) => keys.has(hexKey(coordinate))), { curvy: true })
    .addMountainStack({ at: topLeft, height: 2, variant: 'A', withTrees: true })
    .addMountainStack({ at: top, height: 1, variant: 'B', withGrass: true })
    .addHill(topRight, { variant: 'C', withTrees: true })
    .addForest(firstExistingCoordinate(keys, [neighbor(topLeft, 1), neighbor(topLeft, 0), neighbor(town, 4)], waterKeys), {
      species: 'B',
      size: 'large',
    })
    .addPropCluster({
      at: firstExistingCoordinate(keys, [neighbor(town, 2), neighbor(town, 3), market], waterKeys),
      kind: 'resource-cache',
      density: 0.5,
      facing: 2,
    })
    .scatterDecorations({
      count: Math.max(6, Math.floor(coordinates.length / 6)),
      terrain: ['grass', 'forest', 'hill'],
      assets: ['tree_single_A', 'tree_single_B', 'rock_single_A', 'rock_single_C', 'crate_A_small'],
    });

  return builder.build();
}

/**
 * Re-export frequently used coordinate helpers from the gameboard module.
 */
export { HEX_DIRECTIONS, coordinatesForShape, edgeBetween, hexKey, neighbor, oppositeEdge, parseHexKey };
/**
 * Board shape descriptor accepted by generated gameboard plans.
 */
export type { GameboardShape, HexagonGameboardShape, RectangleGameboardShape } from './types';

/**
 * Resolve a placement's asset from a manifest.
 */
export function getPlacementAsset(
  placement: Pick<GameboardPlacementSpec, 'assetId'>,
  manifest = freeManifest
): MedievalHexagonAsset | undefined {
  return manifest.assetsById[placement.assetId];
}

/**
 * Return whether an asset id is absent from the packaged FREE manifest.
 */
export function requiresExtraAsset(assetId: string): boolean {
  return !freeManifest.assetsById[assetId];
}

/**
 * List the default prop assets used by a semantic cluster kind.
 */
export function listPropClusterAssets(
  kind: PropClusterKind,
  options: { includeExtra?: boolean } = {}
): readonly PropAssetId[] {
  const assets = PROP_CLUSTER_ASSETS[kind];
  if (options.includeExtra) {
    return assets;
  }
  return assets.filter((assetId) => !requiresExtraAsset(assetId));
}

function incrementCount(counts: Record<string, number>, key: string | number): void {
  const normalized = String(key);
  counts[normalized] = (counts[normalized] ?? 0) + 1;
}

function sortedCountRecord(counts: Record<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function sortedStrings<T extends string>(values: Iterable<T>): readonly T[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function placementFeature(placement: GameboardPlacementSpec): string {
  const feature = placement.metadata.feature;
  return typeof feature === 'string' && feature.length > 0 ? feature : placement.kind;
}

function createTile(
  coordinates: HexCoordinates,
  terrain: Extract<GameboardTerrain, 'grass' | 'water'>,
  textureSet: TextureSet
): MutableGameboardTileSpec {
  const tile: MutableGameboardTileSpec = {
    key: hexKey(coordinates),
    coordinates,
    terrain,
    textureSet,
    elevation: 0,
    baseAssetId: TERRAIN_ASSETS[terrain],
    supportAssetId: 'hex_grass_bottom',
    roadEdges: 0,
    riverEdges: 0,
    coastEdges: 0,
    riverWaterless: false,
    riverCurvy: false,
    coastWaterless: false,
    tags: [],
  };
  updateTags(tile);
  return tile;
}

function updateTags(tile: MutableGameboardTileSpec, extraTags: readonly string[] = []): void {
  const tags = new Set<string>([tile.terrain]);
  for (const tag of extraTags) {
    tags.add(tag);
  }
  if (tile.elevation > 0) {
    tags.add('elevated');
  }
  if (tile.roadEdges !== 0) {
    tags.add('road');
  }
  if (tile.riverEdges !== 0 || tile.riverCrossing) {
    tags.add('river');
  }
  if (tile.coastEdges !== 0) {
    tags.add('coast');
  }
  tile.tags = [...tags].sort();
}

function freezeTile(tile: MutableGameboardTileSpec): GameboardTileSpec {
  return {
    ...tile,
    coordinates: { ...tile.coordinates },
    tags: [...tile.tags],
  };
}

function terrainPlacementsForTile(tile: GameboardTileSpec, tileIndex: number): GameboardPlacementSpec[] {
  const placements: GameboardPlacementSpec[] = [];
  for (let level = 0; level < tile.elevation; level += 1) {
    placements.push(
      basePlacement(tile, {
        id: `terrain:${tile.key}:support:${level}`,
        assetId: tile.supportAssetId,
        order: tileIndex * 10 + level,
        elevation: level,
        stackIndex: level,
      })
    );
  }
  placements.push(
    basePlacement(tile, {
      id: `terrain:${tile.key}:top`,
      assetId: tile.baseAssetId,
      order: tileIndex * 10 + tile.elevation,
      elevation: tile.elevation,
      stackIndex: tile.elevation,
    })
  );
  return placements;
}

function connectivityPlacementsForTile(
  tile: GameboardTileSpec,
  tileIndex: number
): GameboardPlacementSpec[] {
  const placements: GameboardPlacementSpec[] = [];
  const baseOrder = 100_000 + tileIndex * 10;

  if (tile.coastEdges !== 0) {
    const selection = selectCoastVariant(tile.coastEdges, { waterless: tile.coastWaterless });
    placements.push(
      overlayPlacement(tile, {
        id: `coast:${tile.key}`,
        assetId: selection.assetId,
        kind: 'coast',
        layer: 'surface',
        order: baseOrder,
        rotationSteps: selection.rotationSteps,
        metadata: { edgeMask: tile.coastEdges },
      })
    );
  }

  if (tile.riverEdges !== 0 || tile.riverCrossing) {
    const selection = tile.riverCrossing
      ? selectRiverCrossingVariant(tile.riverCrossing, { waterless: tile.riverWaterless })
      : selectRiverVariant(riverVisualMask(tile.riverEdges), {
          waterless: tile.riverWaterless,
          curvy: tile.riverCurvy,
        });
    placements.push(
      overlayPlacement(tile, {
        id: `river:${tile.key}`,
        assetId: selection.assetId,
        kind: 'river',
        layer: 'surface',
        order: baseOrder + 1,
        rotationSteps: selection.rotationSteps,
        metadata: { edgeMask: tile.riverEdges },
      })
    );
  }

  if (tile.roadEdges !== 0) {
    const selection = selectRoadVariant(tile.roadEdges);
    const assetId =
      selection.label === 'A' && tile.roadSlope
        ? `hex_road_A_sloped_${tile.roadSlope}`
        : selection.assetId;
    placements.push(
      overlayPlacement(tile, {
        id: `road:${tile.key}`,
        assetId,
        kind: 'road',
        layer: 'surface',
        order: baseOrder + 2,
        rotationSteps: selection.rotationSteps,
        metadata: { edgeMask: tile.roadEdges, slope: tile.roadSlope ?? null },
      })
    );
  }

  return placements;
}

function basePlacement(
  tile: GameboardTileSpec,
  options: {
    id: string;
    assetId: string;
    order: number;
    elevation: number;
    stackIndex?: number;
  }
): GameboardPlacementSpec {
  return {
    id: options.id,
    tileKey: tile.key,
    coordinates: tile.coordinates,
    position: axialToWorld(tile.coordinates, options.elevation),
    assetId: options.assetId,
    kind: 'terrain',
    layer: 'terrain',
    textureSet: tile.textureSet,
    elevation: options.elevation,
    elevationOffset: 0,
    rotationSteps: 0,
    rotationRadians: 0,
    scale: 1,
    order: options.order,
    stackIndex: options.stackIndex,
    requiresExtra: requiresExtraAsset(options.assetId),
    metadata: {},
  };
}

function overlayPlacement(
  tile: GameboardTileSpec,
  options: {
    id: string;
    assetId: string;
    kind: GameboardPlacementKind;
    layer: GameboardPlacementLayer;
    order: number;
    rotationSteps: number;
    metadata: Readonly<Record<string, string | number | boolean | null>>;
  }
): GameboardPlacementSpec {
  const rotationSteps = normalizeRotationSteps(options.rotationSteps);
  const elevationOffset = surfaceElevationOffset(options.kind);
  return {
    id: options.id,
    tileKey: tile.key,
    coordinates: tile.coordinates,
    position: axialToWorld(tile.coordinates, tile.elevation + elevationOffset),
    assetId: options.assetId,
    kind: options.kind,
    layer: options.layer,
    textureSet: tile.textureSet,
    elevation: tile.elevation,
    elevationOffset,
    rotationSteps,
    rotationRadians: rotationSteps * (Math.PI / 3),
    scale: 1,
    order: options.order,
    requiresExtra: requiresExtraAsset(options.assetId),
    metadata: options.metadata,
  };
}

function surfaceElevationOffset(kind: GameboardPlacementKind): number {
  switch (kind) {
    case 'coast':
      return 0.01;
    case 'river':
      return 0.02;
    case 'road':
      return 0.03;
    default:
      return 0;
  }
}

function pathMasks(path: readonly HexCoordinates[]): Map<string, number> {
  const masks = new Map<string, number>();
  for (let index = 0; index < path.length - 1; index += 1) {
    const current = path[index];
    const next = path[index + 1];
    const edge = edgeBetween(current, next);
    if (edge === undefined) {
      throw new Error(`Path step ${hexKey(current)} -> ${hexKey(next)} is not adjacent`);
    }
    masks.set(hexKey(current), mergeMask(masks.get(hexKey(current)) ?? 0, 1 << edge));
    masks.set(hexKey(next), mergeMask(masks.get(hexKey(next)) ?? 0, 1 << oppositeEdge(edge)));
  }
  return masks;
}

function mergeMask(current: number, next: number): number {
  return (current | next) & 0b111111;
}

function riverVisualMask(mask: number): number {
  if (bitCount(mask) !== 1) {
    return mask;
  }
  const edge = edgeFromSingleBit(mask);
  return mergeMask(mask, 1 << oppositeEdge(edge));
}

function bitCount(mask: number): number {
  let count = 0;
  for (let edge = 0; edge < 6; edge += 1) {
    if ((mask & (1 << edge)) !== 0) {
      count += 1;
    }
  }
  return count;
}

function edgeFromSingleBit(mask: number): HexEdgeIndex {
  for (let edge = 0; edge < 6; edge += 1) {
    if ((mask & (1 << edge)) !== 0) {
      return edge as HexEdgeIndex;
    }
  }
  throw new Error('Expected a single-edge mask');
}

function waterEdgesFor(coordinates: HexCoordinates, waterKeys: ReadonlySet<string>): HexEdgeIndex[] {
  return EDGE_INDEXES.filter((edge) => waterKeys.has(hexKey(neighbor(coordinates, edge))));
}

function firstExistingCoordinate(
  keys: ReadonlySet<string>,
  candidates: readonly HexCoordinates[],
  excludedKeys: ReadonlySet<string> = new Set()
): HexCoordinates {
  const coordinate = candidates.find((candidate) => keys.has(hexKey(candidate)) && !excludedKeys.has(hexKey(candidate)));
  if (!coordinate) {
    throw new Error('No available coordinate exists for the requested board feature');
  }
  return coordinate;
}

function mountainAssetId(
  variant: MountainVariant,
  options: { withGrass: boolean; withTrees: boolean }
): string {
  if (options.withTrees) {
    return `mountain_${variant}_grass_trees`;
  }
  if (options.withGrass) {
    return `mountain_${variant}_grass`;
  }
  return `mountain_${variant}`;
}

function fortificationAssetId(material: FortificationMaterial, segment: FortificationSegment): NeutralStructureKind {
  if (material === 'wall') {
    switch (segment) {
      case 'straight':
        return 'wall_straight';
      case 'straight-gate':
        return 'wall_straight_gate';
      case 'corner-A-gate':
        return 'wall_corner_A_gate';
      case 'corner-A-inside':
        return 'wall_corner_A_inside';
      case 'corner-A-outside':
        return 'wall_corner_A_outside';
      case 'corner-B-inside':
        return 'wall_corner_B_inside';
      case 'corner-B-outside':
        return 'wall_corner_B_outside';
      case 'gate':
        return 'wall_straight_gate';
    }
  }
  if (segment !== 'straight' && segment !== 'gate' && segment !== 'straight-gate') {
    throw new Error(`Fortification material ${material} does not support segment ${segment}`);
  }
  const fenceSegment = segment === 'straight' ? 'straight' : 'straight_gate';
  return `fence_${material === 'wood-fence' ? 'wood' : 'stone'}_${fenceSegment}` as NeutralStructureKind;
}

function constructionSiteAssetId(kind: ConstructionSiteKind): NeutralStructureKind {
  switch (kind) {
    case 'destroyed':
      return 'building_destroyed';
    case 'dirt':
      return 'building_dirt';
    case 'grain':
      return 'building_grain';
    case 'scaffolding':
      return 'building_scaffolding';
    case 'stage-A':
      return 'building_stage_A';
    case 'stage-B':
      return 'building_stage_B';
    case 'stage-C':
      return 'building_stage_C';
  }
}

function siegeProjectileAssetId(kind: SiegeProjectileKind): NeutralStructureKind {
  switch (kind) {
    case 'catapult':
      return 'projectile_catapult';
  }
}

function propClusterSites(
  at: HexCoordinates,
  facing: HexEdgeIndex,
  placement: PropClusterPlacement
): readonly HexCoordinates[] {
  if (placement === 'single') {
    return [at];
  }
  const edgeOrder = [0, 1, 5, 2, 4, 3] as const;
  return [
    at,
    ...edgeOrder.map((offset) => neighbor(at, normalizeRotationSteps(facing + offset) as HexEdgeIndex)),
  ];
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeElevation(elevation: number): number {
  return Math.max(0, Math.floor(elevation));
}

function normalizeRotationSteps(steps: number): number {
  return ((Math.floor(steps) % 6) + 6) % 6;
}
