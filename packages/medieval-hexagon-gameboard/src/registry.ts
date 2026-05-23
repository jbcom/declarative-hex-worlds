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

export interface TileEdgeDeclaration {
  channel: string;
  mask: number;
  reciprocal: boolean;
}

export interface TileAdjacencyRule {
  channel: string;
  mask: number;
  reciprocal?: boolean;
  requiresNeighborTerrain?: readonly string[];
  forbidsNeighborTerrain?: readonly string[];
  allowOffBoard?: boolean;
}

export interface TileStackRule {
  canStack: boolean;
  maxElevation?: number;
  supportAssetId?: string;
  heightStep?: number;
}

export interface HexTileDeclarationInput {
  id: string;
  assetId?: string;
  source?: string;
  role?: TileDeclarationRole;
  terrain?: GameboardTerrain;
  textureSet?: TextureSet;
  bounds?: AssetBounds;
  geometry?: Partial<HexGeometry>;
  scale?: number;
  edges?: Partial<Record<'road' | 'river' | 'coast' | string, HexEdgeInput>>;
  adjacency?: readonly TileAdjacencyRule[];
  stack?: Partial<TileStackRule>;
  tags?: readonly string[];
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface HexTileDeclaration {
  id: string;
  assetId: string;
  source: string;
  role: TileDeclarationRole;
  terrain?: GameboardTerrain;
  textureSet?: TextureSet;
  bounds?: AssetBounds;
  geometry: HexGeometry;
  scale: number;
  edges: readonly TileEdgeDeclaration[];
  adjacency: readonly TileAdjacencyRule[];
  stack: TileStackRule;
  tags: readonly string[];
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}

export interface HexTileRegistry {
  declarations: readonly HexTileDeclaration[];
  byId: Readonly<Record<string, HexTileDeclaration>>;
  byAssetId: Readonly<Record<string, HexTileDeclaration>>;
  warnings: readonly string[];
}

export interface TileGeometryAnalysis {
  id: string;
  assetId: string;
  width: number;
  depth: number;
  height: number;
  center: readonly [number, number, number];
  aspectRatio: number;
  scaleToKayKitWidth: number;
  scaleToKayKitDepth: number;
  recommendedScale: number;
  rowSpacing: number;
  warnings: readonly string[];
}

export interface TileRegistryAnalysis {
  tileCount: number;
  analyzedCount: number;
  recommendedScale: number;
  medianWidth: number;
  medianDepth: number;
  medianHeight: number;
  rowSpacing: number;
  warnings: readonly string[];
  tiles: readonly TileGeometryAnalysis[];
}

export interface ApplyTileDeclarationOptions {
  at: HexCoordinates;
  declaration: string | HexTileDeclaration;
  rotationSteps?: HexRotationSteps | number;
  terrain?: GameboardTerrain;
  elevation?: number;
  scale?: number;
  kind?: GameboardPlacementKind;
  layer?: GameboardPlacementLayer;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

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

export function createHexTileRegistryFromManifest(manifest: MedievalHexagonManifest): HexTileRegistry {
  return createHexTileRegistry(
    manifest.assets
      .filter((asset) => asset.category === 'tiles')
      .map((asset) => declarationInputFromAsset(asset))
  );
}

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
