/**
 * Koota-to-plan projection helpers that serialize live world state back into
 * portable gameboard plans for validation, rendering, saves, and interop.
 *
 * @module
 */

import type { World } from 'koota';
import { GameboardRuntimeError } from '../errors';
import type {
  GameboardPlacementKind,
  GameboardPlacementLayer,
  GameboardPlacementSpec,
  GameboardPlan,
  GameboardTileSpec,
} from '../gameboard';
import {
  DecomposedGameboardTileQuery,
  GameboardState,
  type PlacementStateValue,
  readGameboardPlacements,
} from '../koota';
import { isKnownExtraAssetId } from '../scenario';
import {
  selectCoastVariant,
  selectRiverCrossingVariant,
  selectRiverVariant,
  selectRoadVariant,
} from '../selectors';
import { normalizeHexRotationSteps, oppositeEdge } from './coordinates';
import { axialToWorld, DEFAULT_HEX_GEOMETRY, type HexGeometry } from './grid';

type ProjectedSurfaceKind = Extract<GameboardPlacementKind, 'coast' | 'river' | 'road'>;

/** Options for projecting a world into a plan. */
export interface ProjectWorldOptions {
  /**
   * Hex world geometry used to place tiles (their `position`). Defaults to
   * `DEFAULT_HEX_GEOMETRY`. Override for a board whose row spacing differs from a
   * regular hex — e.g. a TILESET board whose cells bake a vertically-foreshortened
   * (isometric) hex: its rows must be packed at `height/2`, i.e. `depth =
   * (4/3)·(width·cellHeight/cellWidth)/2`, so full-cell quads interlock seamlessly
   * instead of spreading ~3× too far apart in Z.
   */
  geometry?: HexGeometry;
}

/** Projects a Koota gameboard world into a serializable gameboard plan with render placements. */
export function projectWorldToGameboardPlan(
  world: World,
  options?: ProjectWorldOptions
): GameboardPlan {
  const board = world.get(GameboardState);
  if (!board) {
    throw new GameboardRuntimeError('World does not contain GameboardState');
  }

  const tiles = readDecomposedTileSpecs(world);
  const customPlacements = readGameboardPlacements(world).filter(
    (placement) => placement.order >= 200_000
  ) as readonly PlacementStateValue[];
  return createProjectedPlanFromTiles({
    seed: board.seed,
    shape: board.shape,
    textureSet: board.textureSet,
    tiles,
    placements: customPlacements,
    ...(options?.geometry === undefined ? {} : { geometry: options.geometry }),
  });
}

/** Reads decomposed tile components from a Koota world as plan tile specs. */
export function readDecomposedTileSpecs(world: World): GameboardTileSpec[] {
  const tiles: GameboardTileSpec[] = [];
  world
    .query(DecomposedGameboardTileQuery)
    .readEach(([coordinates, terrain, elevation, connectivity, renderState, tagList]) => {
      tiles.push({
        key: coordinates.key,
        coordinates: { q: coordinates.q, r: coordinates.r },
        terrain: terrain.terrain,
        textureSet: renderState.textureSet,
        elevation: elevation.elevation,
        baseAssetId: elevation.baseAssetId,
        supportAssetId: elevation.supportAssetId,
        roadEdges: connectivity.roadEdges,
        riverEdges: connectivity.riverEdges,
        coastEdges: connectivity.coastEdges,
        roadSlope: connectivity.roadSlope,
        riverWaterless: connectivity.riverWaterless,
        riverCurvy: connectivity.riverCurvy,
        riverCrossing: connectivity.riverCrossing,
        coastWaterless: connectivity.coastWaterless,
        tags: [...tagList],
      });
    });
  return tiles.sort(
    (left, right) =>
      left.coordinates.r - right.coordinates.r || left.coordinates.q - right.coordinates.q
  );
}

/** Reads a lightweight validation plan from a Koota world without rebuilding render overlays. */
export function readValidationGameboardPlanFromWorld(world: World): GameboardPlan {
  const board = world.get(GameboardState);
  if (!board) {
    throw new GameboardRuntimeError('World does not contain GameboardState');
  }
  return {
    schemaVersion: board.schemaVersion as GameboardPlan['schemaVersion'],
    seed: board.seed,
    shape: board.shape,
    textureSet: board.textureSet,
    tiles: readDecomposedTileSpecs(world),
    placements: readGameboardPlacements(world),
    warnings: [],
  };
}

function createProjectedPlanFromTiles(options: {
  seed: string;
  shape: GameboardPlan['shape'];
  textureSet: GameboardPlan['textureSet'];
  tiles: readonly GameboardTileSpec[];
  placements: readonly GameboardPlacementSpec[];
  geometry?: HexGeometry;
}): GameboardPlan {
  const geometry = options.geometry ?? DEFAULT_HEX_GEOMETRY;
  const terrainPlacements = options.tiles.flatMap((tile, index) =>
    terrainPlacementsForTile(tile, index, geometry)
  );
  const connectivityPlacements = options.tiles.flatMap((tile, index) =>
    connectivityPlacementsForTile(tile, index, geometry)
  );
  const placements = [...terrainPlacements, ...connectivityPlacements, ...options.placements].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id)
  );

  return {
    schemaVersion: '1.0.0',
    seed: options.seed,
    shape: options.shape,
    textureSet: options.textureSet,
    tiles: [...options.tiles],
    placements,
    warnings: [],
  };
}

function terrainPlacementsForTile(
  tile: GameboardTileSpec,
  tileIndex: number,
  geometry: HexGeometry
): GameboardPlacementSpec[] {
  const placements: GameboardPlacementSpec[] = [];
  for (let level = 0; level < tile.elevation; level += 1) {
    placements.push(
      basePlacement(tile, {
        id: `terrain:${tile.key}:support:${level}`,
        assetId: tile.supportAssetId,
        order: tileIndex * 10 + level,
        elevation: level,
        stackIndex: level,
        geometry,
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
      geometry,
    })
  );
  return placements;
}

function connectivityPlacementsForTile(
  tile: GameboardTileSpec,
  tileIndex: number,
  geometry: HexGeometry
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
        geometry,
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
        geometry,
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
        geometry,
      })
    );
  }

  return placements;
}

function riverVisualMask(mask: number): number {
  const edge = edgeFromSingleBit(mask);
  if (edge === undefined) {
    return mask;
  }
  return (mask | (1 << oppositeEdge(edge))) & 0b111111;
}

function edgeFromSingleBit(mask: number): 0 | 1 | 2 | 3 | 4 | 5 | undefined {
  let singleEdge: 0 | 1 | 2 | 3 | 4 | 5 | undefined;
  for (let edge = 0; edge < 6; edge += 1) {
    if ((mask & (1 << edge)) !== 0) {
      if (singleEdge !== undefined) {
        return undefined;
      }
      singleEdge = edge as 0 | 1 | 2 | 3 | 4 | 5;
    }
  }
  return singleEdge;
}

function basePlacement(
  tile: GameboardTileSpec,
  options: {
    id: string;
    assetId: string;
    order: number;
    elevation: number;
    stackIndex?: number;
    geometry: HexGeometry;
  }
): GameboardPlacementSpec {
  return {
    id: options.id,
    tileKey: tile.key,
    coordinates: tile.coordinates,
    position: axialToWorld(tile.coordinates, options.elevation, options.geometry),
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
    requiresExtra: isKnownExtraAssetId(options.assetId),
    metadata: {},
  };
}

function overlayPlacement(
  tile: GameboardTileSpec,
  options: {
    id: string;
    assetId: string;
    kind: ProjectedSurfaceKind;
    layer: GameboardPlacementLayer;
    order: number;
    rotationSteps: number;
    metadata: Readonly<Record<string, string | number | boolean | null>>;
    geometry: HexGeometry;
  }
): GameboardPlacementSpec {
  const rotationSteps = normalizeHexRotationSteps(options.rotationSteps);
  const elevationOffset = surfaceElevationOffset(options.kind);
  return {
    id: options.id,
    tileKey: tile.key,
    coordinates: tile.coordinates,
    position: axialToWorld(tile.coordinates, tile.elevation + elevationOffset, options.geometry),
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
    requiresExtra: isKnownExtraAssetId(options.assetId),
    metadata: options.metadata,
  };
}

function surfaceElevationOffset(kind: ProjectedSurfaceKind): number {
  switch (kind) {
    case 'coast':
      return 0.01;
    case 'river':
      return 0.02;
    case 'road':
      return 0.03;
  }
}
