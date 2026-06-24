/**
 * Serializable board-plan contracts, derived plan indexes, and plan summaries.
 *
 * @module
 */
import type {
  ColoredUnitPart,
  ColoredUnitStyle,
  FactionBuildingKind,
  NatureAssetId,
  NeutralStructureKind,
  NeutralUnitPart,
  PropAssetId,
} from '../scenario';
import type {
  Faction,
  GameboardShape,
  HexCoordinates,
  HexEdgeInput,
  HexEdgeIndex,
  TextureSet,
  WorldPosition,
} from '../types';

// `GAMEBOARD_SCHEMA_VERSION` lives in `../types` so trait declarations can
// reference it without triggering the koota↔gameboard runtime cycle. The
// re-export keeps the original consumer surface.
export { GAMEBOARD_SCHEMA_VERSION } from '../types';
import type { GAMEBOARD_SCHEMA_VERSION } from '../types';

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
 * Memoized indexes derived from a {@link GameboardPlan} (PRD B4).
 *
 * Previously, hot-path callers in `coordinates/layout.ts` + `interop/interop.ts`
 * rebuilt these maps on every invocation — 4+ calls per render frame. The
 * indexes are now built once via {@link gameboardPlanIndex} and cached
 * per-plan in a module-local WeakMap, so the second-and-later callers pay
 * O(1) lookup instead of O(N) rebuild.
 */
export interface GameboardPlanIndex {
  /** Tile keyed by `q,r` hexKey. */
  readonly tilesByKey: ReadonlyMap<string, GameboardTileSpec>;
  /** Placement specs grouped by their tile's `q,r` hexKey. */
  readonly placementsByTile: ReadonlyMap<string, readonly GameboardPlacementSpec[]>;
}

const PLAN_INDEX_CACHE = new WeakMap<GameboardPlan, GameboardPlanIndex>();

/**
 * Return memoized indexes for a {@link GameboardPlan}, building them lazily
 * the first time and caching per-plan thereafter (PRD B4).
 *
 * Hot-path callers should prefer this over inlining
 * `new Map(plan.tiles.map(...))` — that rebuild cost shows up under
 * profiling on every render of large boards.
 */
export function gameboardPlanIndex(plan: GameboardPlan): GameboardPlanIndex {
  const cached = PLAN_INDEX_CACHE.get(plan);
  if (cached !== undefined) {
    return cached;
  }
  const tilesByKey = new Map<string, GameboardTileSpec>();
  for (const tile of plan.tiles) {
    tilesByKey.set(tile.key, tile);
  }
  const placementsByTile = new Map<string, GameboardPlacementSpec[]>();
  for (const placement of plan.placements) {
    const key = placement.tileKey;
    let bucket = placementsByTile.get(key);
    if (bucket === undefined) {
      bucket = [];
      placementsByTile.set(key, bucket);
    }
    bucket.push(placement);
  }
  const index: GameboardPlanIndex = { tilesByKey, placementsByTile };
  PLAN_INDEX_CACHE.set(plan, index);
  return index;
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
export interface HarborBoardOptions extends Partial<GameboardPlanOptions> {
  /** Faction color used by settlement and harbor pieces. */
  faction?: Faction;
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
