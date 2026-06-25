/**
 * Terrain tile bookkeeping plus derived terrain/connectivity placements for
 * immutable gameboard plans.
 *
 * @module
 */
import { axialToWorld } from '../coordinates';
import {
  selectCoastVariant,
  selectRiverCrossingVariant,
  selectRiverVariant,
  selectRoadVariant,
} from '../selectors';
import { GAMEBOARD_SCHEMA_VERSION, type HexCoordinates, type HexEdgeIndex, type TextureSet } from '../types';
import { requiresExtraAsset } from './assets';
import type {
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardPlacementSpec,
  GameboardPlan,
  GameboardPlanFromTilesOptions,
  GameboardTerrain,
  GameboardTileSpec,
} from './plan';

export const GAMEBOARD_TERRAIN_ASSETS: Record<Extract<GameboardTerrain, 'grass' | 'water'>, string> = {
  grass: 'hex_grass',
  water: 'hex_water',
};

export type MutableGameboardTileSpec = {
  -readonly [K in keyof GameboardTileSpec]: GameboardTileSpec[K] extends readonly string[]
    ? string[]
    : GameboardTileSpec[K];
};

export function createGameboardTile(
  coordinates: HexCoordinates,
  terrain: Extract<GameboardTerrain, 'grass' | 'water'>,
  textureSet: TextureSet
): MutableGameboardTileSpec {
  const tile: MutableGameboardTileSpec = {
    key: `${coordinates.q},${coordinates.r}`,
    coordinates,
    terrain,
    textureSet,
    elevation: 0,
    baseAssetId: GAMEBOARD_TERRAIN_ASSETS[terrain],
    supportAssetId: 'hex_grass_bottom',
    roadEdges: 0,
    riverEdges: 0,
    coastEdges: 0,
    riverWaterless: false,
    riverCurvy: false,
    coastWaterless: false,
    tags: [],
  };
  updateGameboardTileTags(tile);
  return tile;
}

export function updateGameboardTileTags(
  tile: MutableGameboardTileSpec,
  extraTags: readonly string[] = []
): void {
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

export function freezeGameboardTile(tile: MutableGameboardTileSpec): GameboardTileSpec {
  return {
    ...tile,
    coordinates: { ...tile.coordinates },
    tags: [...tile.tags],
  };
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
    kind: Extract<GameboardPlacementKind, 'coast' | 'river' | 'road'>;
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

function surfaceElevationOffset(kind: Extract<GameboardPlacementKind, 'coast' | 'river' | 'road'>): number {
  switch (kind) {
    case 'coast':
      return 0.01;
    case 'river':
      return 0.02;
    case 'road':
      return 0.03;
  }
}

function riverVisualMask(mask: number): number {
  const edge = edgeFromSingleBit(mask);
  if (edge === undefined) {
    return mask;
  }
  return (mask | (1 << oppositeEdge(edge))) & 0b111111;
}

function oppositeEdge(edge: HexEdgeIndex): HexEdgeIndex {
  return ((edge + 3) % 6) as HexEdgeIndex;
}

function edgeFromSingleBit(mask: number): HexEdgeIndex | undefined {
  let singleEdge: HexEdgeIndex | undefined;
  for (let edge = 0; edge < 6; edge += 1) {
    if ((mask & (1 << edge)) !== 0) {
      if (singleEdge !== undefined) {
        return undefined;
      }
      singleEdge = edge as HexEdgeIndex;
    }
  }
  return singleEdge;
}

function normalizeRotationSteps(steps: number): number {
  return ((Math.floor(steps) % 6) + 6) % 6;
}
