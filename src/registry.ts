/**
 * Hex tile declaration registry helpers for custom tile packs, adjacency and
 * stacking rules, KayKit geometry analysis, and plan application.
 *
 * @module
 */
import type {
  GameboardBuilder,
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardTerrain,
  HexRotationSteps,
} from './gameboard';
import {
  KAYKIT_HEX_GEOMETRY,
  type HexGeometry,
  rowSpacingForGeometry,
} from './grid';
import { COAST_VARIANTS, RIVER_VARIANTS, ROAD_VARIANTS, edgeMask, rotateMask } from './selectors';
import type {
  AssetBounds,
  HexCoordinates,
  HexEdgeInput,
  MedievalHexagonAsset,
  MedievalHexagonManifest,
  TextureSet,
} from './types';

/** Describes how a registered tile-like declaration participates in board construction. */
export type TileDeclarationRole =
  | 'base'
  | 'support'
  | 'surface'
  | 'road'
  | 'river'
  | 'coast'
  | 'decoration'
  | 'structure'
  | 'unit'
  | 'custom';

/** Normalized edge mask for a connection channel on a registered tile. */
export interface TileEdgeDeclaration {
  /** Connection channel, such as `road`, `river`, or `coast`. */
  channel: string;
  /** Six-bit clockwise edge mask after canonicalization. */
  mask: number;
  /** Whether neighboring tiles are expected to expose a matching edge. */
  reciprocal: boolean;
}

/** Adjacency rule attached to a tile declaration for validation and generation. */
export interface TileAdjacencyRule {
  /** Connection channel that the rule applies to. */
  channel: string;
  /** Six-bit clockwise edge mask the rule constrains. */
  mask: number;
  /** Whether neighbors should satisfy the same channel in the opposite direction. */
  reciprocal?: boolean;
  /** Neighbor terrain values that are allowed for the masked edges. */
  requiresNeighborTerrain?: readonly string[];
  /** Neighbor terrain values that are rejected for the masked edges. */
  forbidsNeighborTerrain?: readonly string[];
  /** Allows masked edges to face outside the board instead of another tile. */
  allowOffBoard?: boolean;
}

/** Stacking behavior for a registered tile declaration. */
export interface TileStackRule {
  /** Whether this declaration may be used as a vertical stack/support piece. */
  canStack: boolean;
  /** Maximum supported elevation for repeated stack placement. */
  maxElevation?: number;
  /** Asset to use as the support piece when this declaration is a visible top. */
  supportAssetId?: string;
  /** World-space Y increment for each stacked elevation step. */
  heightStep?: number;
}

/** Author input for registering KayKit-compatible or custom hex pieces. */
export interface HexTileDeclarationInput {
  /** Stable declaration id used by recipes and registry lookups. */
  id: string;
  /** Manifest asset id to place when this declaration is applied. */
  assetId?: string;
  /** Human-readable source label, commonly `manifest`, `extra`, or a pack id. */
  source?: string;
  /** Board construction role for the declaration. */
  role?: TileDeclarationRole;
  /** Default terrain assigned when the declaration becomes the base tile. */
  terrain?: GameboardTerrain;
  /** Texture set associated with the declaration when it came from a pack variant. */
  textureSet?: TextureSet;
  /** Asset bounds used by geometry analysis and compatibility warnings. */
  bounds?: AssetBounds;
  /** Hex footprint geometry for placement and scaling calculations. */
  geometry?: Partial<HexGeometry>;
  /** Default placement scale for feature/unit declarations. */
  scale?: number;
  /** Edge connection masks keyed by channel. */
  edges?: Partial<Record<'road' | 'river' | 'coast' | string, HexEdgeInput>>;
  /** Adjacency rules consumed by validation and generators. */
  adjacency?: readonly TileAdjacencyRule[];
  /** Stacking behavior overrides. */
  stack?: Partial<TileStackRule>;
  /** Search and selection tags attached to the declaration. */
  tags?: readonly string[];
  /** Additional serializable metadata to copy onto placements. */
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

/** Normalized tile declaration stored in a registry. */
export interface HexTileDeclaration {
  /** Stable declaration id used by recipes and registry lookups. */
  id: string;
  /** Manifest asset id to place when this declaration is applied. */
  assetId: string;
  /** Human-readable source label, commonly `manifest`, `extra`, or a pack id. */
  source: string;
  /** Board construction role for the declaration. */
  role: TileDeclarationRole;
  /** Default terrain assigned when the declaration becomes the base tile. */
  terrain?: GameboardTerrain;
  /** Texture set associated with the declaration when it came from a pack variant. */
  textureSet?: TextureSet;
  /** Asset bounds used by geometry analysis and compatibility warnings. */
  bounds?: AssetBounds;
  /** Complete hex footprint geometry for placement and scaling calculations. */
  geometry: HexGeometry;
  /** Default placement scale for feature/unit declarations. */
  scale: number;
  /** Normalized edge connection masks. */
  edges: readonly TileEdgeDeclaration[];
  /** Adjacency rules consumed by validation and generators. */
  adjacency: readonly TileAdjacencyRule[];
  /** Stacking behavior for elevation/support placement. */
  stack: TileStackRule;
  /** Search and selection tags attached to the declaration. */
  tags: readonly string[];
  /** Additional serializable metadata to copy onto placements. */
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

/** Lookup structure for registered tile declarations plus normalization warnings. */
export interface HexTileRegistry {
  /** All normalized declarations in insertion order. */
  declarations: readonly HexTileDeclaration[];
  /** Declarations indexed by declaration id. */
  byId: Readonly<Record<string, HexTileDeclaration>>;
  /** Declarations indexed by manifest asset id. */
  byAssetId: Readonly<Record<string, HexTileDeclaration>>;
  /** Non-fatal duplicate or compatibility warnings emitted while creating the registry. */
  warnings: readonly string[];
}

/** Per-tile footprint and scaling analysis for compatibility diagnostics. */
export interface TileGeometryAnalysis {
  /** Declaration id that was analyzed. */
  id: string;
  /** Manifest asset id that was analyzed. */
  assetId: string;
  /** Bounds width in source asset units. */
  width: number;
  /** Bounds depth in source asset units. */
  depth: number;
  /** Bounds height in source asset units. */
  height: number;
  /** Bounds center in source asset coordinates. */
  center: readonly [number, number, number];
  /** Width divided by depth for footprint compatibility checks. */
  aspectRatio: number;
  /** Scale required to match the KayKit canonical width. */
  scaleToKayKitWidth: number;
  /** Scale required to match the KayKit canonical depth. */
  scaleToKayKitDepth: number;
  /** Median of width and depth scale recommendations. */
  recommendedScale: number;
  /** Row spacing implied by the analyzed depth and recommended scale. */
  rowSpacing: number;
  /** Non-fatal warnings for this declaration. */
  warnings: readonly string[];
}

/** Aggregate footprint and scaling analysis for an entire registry. */
export interface TileRegistryAnalysis {
  /** Number of declarations in the registry. */
  tileCount: number;
  /** Number of declarations with usable bounds. */
  analyzedCount: number;
  /** Median scale recommendation for base/support tile footprints. */
  recommendedScale: number;
  /** Median source width for base/support tile footprints. */
  medianWidth: number;
  /** Median source depth for base/support tile footprints. */
  medianDepth: number;
  /** Median source height for base/support tile footprints. */
  medianHeight: number;
  /** Row spacing implied by the median depth and recommended scale. */
  rowSpacing: number;
  /** Registry and per-tile warnings flattened for display. */
  warnings: readonly string[];
  /** Per-tile analysis entries. */
  tiles: readonly TileGeometryAnalysis[];
}

/** Options for placing a registered declaration into a gameboard builder. */
export interface ApplyTileDeclarationOptions {
  /** Target hex coordinate. */
  at: HexCoordinates;
  /** Declaration object, declaration id, or manifest asset id. */
  declaration: string | HexTileDeclaration;
  /** Clockwise 60-degree rotation steps to apply to placement and edge masks. */
  rotationSteps?: HexRotationSteps | number;
  /** Terrain override for base/support declarations. */
  terrain?: GameboardTerrain;
  /** Elevation override for base/support declarations. */
  elevation?: number;
  /** Scale override for non-base placements. */
  scale?: number;
  /** Placement kind override for non-base declarations. */
  kind?: GameboardPlacementKind;
  /** Placement layer override for non-base declarations. */
  layer?: GameboardPlacementLayer;
  /** Additional serializable metadata merged into non-base placements. */
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

/** Normalizes a tile declaration input using KayKit defaults and inferred roles. */
export function declareHexTile(input: HexTileDeclarationInput): HexTileDeclaration {
  const geometry = { ...KAYKIT_HEX_GEOMETRY, ...input.geometry };
  const edges = Object.entries(input.edges ?? {})
    .filter((entry): entry is [string, HexEdgeInput] => entry[1] !== undefined)
    .map(([channel, mask]) => ({
      channel,
      mask: edgeMask(mask),
      reciprocal: channel === 'road' || channel === 'river',
    }));
  const role = input.role ?? inferRole(input.id);
  return {
    id: input.id,
    assetId: input.assetId ?? input.id,
    source: input.source ?? 'custom',
    role,
    terrain: input.terrain,
    textureSet: input.textureSet,
    bounds: input.bounds,
    geometry,
    scale: input.scale ?? 1,
    edges,
    adjacency: [...(input.adjacency ?? [])],
    stack: {
      canStack: input.stack?.canStack ?? (role === 'base' || role === 'support'),
      maxElevation: input.stack?.maxElevation,
      supportAssetId: input.stack?.supportAssetId,
      heightStep: input.stack?.heightStep ?? geometry.elevationStep,
    },
    tags: [...(input.tags ?? [])],
    metadata: { ...(input.metadata ?? {}) },
  };
}

/** Creates a lookup registry and reports duplicate id or asset-id warnings. */
export function createHexTileRegistry(declarations: readonly HexTileDeclarationInput[]): HexTileRegistry {
  const normalized = declarations.map(declareHexTile);
  const byId: Record<string, HexTileDeclaration> = {};
  const byAssetId: Record<string, HexTileDeclaration> = {};
  const warnings: string[] = [];

  for (const declaration of normalized) {
    if (byId[declaration.id]) {
      warnings.push(`Duplicate tile declaration id: ${declaration.id}`);
    }
    if (byAssetId[declaration.assetId]) {
      warnings.push(`Duplicate tile declaration assetId: ${declaration.assetId}`);
    }
    byId[declaration.id] = declaration;
    byAssetId[declaration.assetId] = declaration;
  }

  return {
    declarations: normalized,
    byId,
    byAssetId,
    warnings,
  };
}

/** Creates a tile registry from all tile assets in a medieval hexagon manifest. */
export function createHexTileRegistryFromManifest(manifest: MedievalHexagonManifest): HexTileRegistry {
  return createHexTileRegistry(
    manifest.assets
      .filter((asset) => asset.category === 'tiles')
      .map((asset) => declarationInputFromAsset(asset))
  );
}

/** Analyzes one declaration footprint against the canonical KayKit hex footprint. */
export function analyzeTileGeometry(
  declaration: Pick<HexTileDeclaration, 'id' | 'assetId' | 'bounds' | 'geometry'> &
    Partial<Pick<HexTileDeclaration, 'role'>>
): TileGeometryAnalysis {
  const bounds = declaration.bounds;
  const warnings: string[] = [];
  if (!bounds) {
    return emptyGeometryAnalysis(declaration.id, declaration.assetId, warnings.concat('Missing bounds metadata'));
  }

  const [width, height, depth] = bounds.size;
  const center = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ] as const;

  if (width <= 0 || depth <= 0) {
    warnings.push('Bounds have non-positive width or depth');
  }

  const scaleToKayKitWidth = width > 0 ? KAYKIT_HEX_GEOMETRY.width / width : 1;
  const scaleToKayKitDepth = depth > 0 ? KAYKIT_HEX_GEOMETRY.depth / depth : 1;
  const recommendedScale = median([scaleToKayKitWidth, scaleToKayKitDepth]);
  const aspectRatio = depth > 0 ? width / depth : 0;
  const kayKitRatio = KAYKIT_HEX_GEOMETRY.width / KAYKIT_HEX_GEOMETRY.depth;
  const expectsFullFootprint =
    !declaration.role || declaration.role === 'base' || declaration.role === 'support' || declaration.role === 'custom';
  if (expectsFullFootprint && aspectRatio > 0 && Math.abs(aspectRatio - kayKitRatio) > 0.08) {
    warnings.push(
      `Hex footprint ratio ${round(aspectRatio)} differs from KayKit ratio ${round(kayKitRatio)}; check orientation or scale`
    );
  }
  if (expectsFullFootprint && Math.abs(scaleToKayKitWidth - scaleToKayKitDepth) > 0.08) {
    warnings.push(
      `Width/depth scale mismatch (${round(scaleToKayKitWidth)} vs ${round(scaleToKayKitDepth)}); asset may not sit on the grid`
    );
  }
  if (expectsFullFootprint && width > 0 && Math.abs(center[0]) > width * 0.1) {
    warnings.push(`X origin is offset by ${round(center[0])}; placement may appear off-center`);
  }
  if (expectsFullFootprint && depth > 0 && Math.abs(center[2]) > depth * 0.1) {
    warnings.push(`Z origin is offset by ${round(center[2])}; placement may appear off-center`);
  }

  return {
    id: declaration.id,
    assetId: declaration.assetId,
    width,
    depth,
    height,
    center,
    aspectRatio,
    scaleToKayKitWidth,
    scaleToKayKitDepth,
    recommendedScale,
    rowSpacing: rowSpacingForGeometry({ depth: depth * recommendedScale }),
    warnings,
  };
}

/** Analyzes registry-wide tile sizing, scale recommendations, and compatibility warnings. */
export function analyzeHexTileRegistry(registry: HexTileRegistry): TileRegistryAnalysis {
  const tiles = registry.declarations
    .map(analyzeTileGeometry)
    .filter((analysis) => analysis.width > 0 && analysis.depth > 0);
  const scaleTiles = registry.declarations
    .filter((declaration) => declaration.role === 'base' || declaration.role === 'support')
    .map(analyzeTileGeometry)
    .filter((analysis) => analysis.width > 0 && analysis.depth > 0);
  const recommendedScale = median(scaleTiles.map((tile) => tile.recommendedScale));
  const medianWidth = median(scaleTiles.map((tile) => tile.width));
  const medianDepth = median(scaleTiles.map((tile) => tile.depth));
  const medianHeight = median(scaleTiles.map((tile) => tile.height));
  const warnings = [
    ...registry.warnings,
    ...tiles.flatMap((tile) => tile.warnings.map((warning) => `${tile.id}: ${warning}`)),
  ];

  if (scaleTiles.length === 0) {
    warnings.push('No tile-sized declarations with bounds were available for geometry analysis');
  }

  const widthVariance = varianceRatio(scaleTiles.map((tile) => tile.width));
  const depthVariance = varianceRatio(scaleTiles.map((tile) => tile.depth));
  if (widthVariance > 0.08) {
    warnings.push(`Tile width variance is ${round(widthVariance * 100)}%; mixed tile sets may need per-asset scale`);
  }
  if (depthVariance > 0.08) {
    warnings.push(`Tile depth variance is ${round(depthVariance * 100)}%; mixed tile sets may need per-asset scale`);
  }

  return {
    tileCount: registry.declarations.length,
    analyzedCount: tiles.length,
    recommendedScale,
    medianWidth,
    medianDepth,
    medianHeight,
    rowSpacing: rowSpacingForGeometry({ depth: medianDepth * recommendedScale }),
    warnings,
    tiles,
  };
}

/** Applies a registered declaration to a builder as either a base tile or feature placement. */
export function applyTileDeclaration(
  builder: GameboardBuilder,
  registry: HexTileRegistry,
  options: ApplyTileDeclarationOptions
): GameboardBuilder {
  const declaration =
    typeof options.declaration === 'string'
      ? registry.byId[options.declaration] ?? registry.byAssetId[options.declaration]
      : options.declaration;
  if (!declaration) {
    throw new Error(`Unknown tile declaration: ${String(options.declaration)}`);
  }

  const roadEdges = rotatedChannelMask(declaration, 'road', options.rotationSteps);
  const riverEdges = rotatedChannelMask(declaration, 'river', options.rotationSteps);
  const coastEdges = rotatedChannelMask(declaration, 'coast', options.rotationSteps);

  if (declaration.role === 'base' || declaration.role === 'support') {
    builder.setTileAsset({
      at: options.at,
      assetId: declaration.assetId,
      terrain: options.terrain ?? declaration.terrain,
      supportAssetId: declaration.stack.supportAssetId,
      elevation: options.elevation,
      roadEdges,
      riverEdges,
      coastEdges,
      tags: declaration.tags,
    });
    return builder;
  }

  builder.addPlacement({
    at: options.at,
    assetId: declaration.assetId,
    kind: options.kind ?? kindForDeclaration(declaration),
    layer: options.layer ?? layerForDeclaration(declaration),
    rotationSteps: options.rotationSteps,
    scale: options.scale ?? declaration.scale,
    metadata: {
      feature: 'registered-tile',
      declarationId: declaration.id,
      ...declaration.metadata,
      ...(options.metadata ?? {}),
    },
  });
  return builder;
}

function rotatedChannelMask(
  declaration: HexTileDeclaration,
  channel: string,
  rotationSteps: HexRotationSteps | number | undefined
): number | undefined {
  const mask = declaration.edges.find((edge) => edge.channel === channel)?.mask;
  return mask === undefined ? undefined : rotateMask(mask, rotationSteps ?? 0);
}

function declarationInputFromAsset(asset: MedievalHexagonAsset): HexTileDeclarationInput {
  const edges = inferEdges(asset.id);
  return {
    id: asset.id,
    assetId: asset.id,
    source: 'manifest',
    role: inferRole(asset.id, asset.subcategory),
    terrain: inferTerrain(asset.id, asset.subcategory),
    textureSet: asset.textureSet,
    bounds: asset.bounds,
    edges,
    stack: {
      canStack: asset.id.endsWith('_bottom') || asset.id === 'hex_grass' || asset.id === 'hex_water',
      supportAssetId: asset.id.endsWith('_bottom') ? asset.id : undefined,
    },
    tags: [asset.subcategory, asset.family],
    metadata: {
      category: asset.category,
      subcategory: asset.subcategory,
      family: asset.family,
      edition: asset.edition,
    },
  };
}

function inferRole(id: string, subcategory = ''): TileDeclarationRole {
  if (subcategory === 'roads' || id.includes('_road_')) {
    return 'road';
  }
  if (subcategory === 'rivers' || id.includes('_river_')) {
    return 'river';
  }
  if (subcategory === 'coast' || id.includes('_coast_')) {
    return 'coast';
  }
  if (subcategory === 'base' || id.startsWith('hex_')) {
    return id.endsWith('_bottom') ? 'support' : 'base';
  }
  return 'custom';
}

function inferTerrain(id: string, subcategory: string): GameboardTerrain | undefined {
  if (id.includes('water')) {
    return 'water';
  }
  if (subcategory === 'roads' || id.includes('_road_')) {
    return 'road';
  }
  if (subcategory === 'rivers' || id.includes('_river_')) {
    return 'river';
  }
  if (subcategory === 'coast' || id.includes('_coast_')) {
    return 'coast';
  }
  if (id.includes('grass')) {
    return 'grass';
  }
  return undefined;
}

function inferEdges(id: string): HexTileDeclarationInput['edges'] {
  const normalized = id
    .replace('_waterless', '')
    .replace('_curvy', '')
    .replace('_sloped_high', '')
    .replace('_sloped_low', '');
  const road = ROAD_VARIANTS.find((variant) => variant.assetId === normalized);
  if (road) {
    return { road: road.canonicalMask };
  }
  const river = RIVER_VARIANTS.find((variant) => variant.assetId === normalized);
  if (river) {
    return { river: river.canonicalMask };
  }
  const coast = COAST_VARIANTS.find((variant) => variant.assetId === normalized);
  if (coast) {
    return { coast: coast.canonicalMask };
  }
  if (normalized.includes('river_crossing')) {
    return { river: 0b111111 };
  }
  return {};
}

function kindForDeclaration(declaration: HexTileDeclaration): GameboardPlacementKind {
  switch (declaration.role) {
    case 'road':
      return 'road';
    case 'river':
      return 'river';
    case 'coast':
      return 'coast';
    case 'structure':
      return 'structure';
    case 'unit':
      return 'unit';
    case 'decoration':
      return 'decoration';
    default:
      return 'terrain';
  }
}

function layerForDeclaration(declaration: HexTileDeclaration): GameboardPlacementLayer {
  switch (declaration.role) {
    case 'base':
    case 'support':
      return 'terrain';
    case 'road':
    case 'river':
    case 'coast':
      return 'surface';
    case 'structure':
      return 'structure';
    case 'unit':
      return 'unit';
    default:
      return 'feature';
  }
}

function emptyGeometryAnalysis(id: string, assetId: string, warnings: readonly string[]): TileGeometryAnalysis {
  return {
    id,
    assetId,
    width: 0,
    depth: 0,
    height: 0,
    center: [0, 0, 0],
    aspectRatio: 0,
    scaleToKayKitWidth: 1,
    scaleToKayKitDepth: 1,
    recommendedScale: 1,
    rowSpacing: rowSpacingForGeometry(KAYKIT_HEX_GEOMETRY),
    warnings,
  };
}

function median(values: readonly number[]): number {
  const finite = values.filter((value) => Number.isFinite(value)).sort((left, right) => left - right);
  if (finite.length === 0) {
    return 1;
  }
  const middle = Math.floor(finite.length / 2);
  return finite.length % 2 === 0 ? (finite[middle - 1] + finite[middle]) / 2 : finite[middle];
}

function varianceRatio(values: readonly number[]): number {
  const finite = values.filter((value) => Number.isFinite(value) && value > 0);
  if (finite.length < 2) {
    return 0;
  }
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  return (max - min) / max;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
