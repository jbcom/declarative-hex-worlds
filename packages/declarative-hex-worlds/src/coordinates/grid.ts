/**
 * Honeycomb-grid integration and KayKit flat-top hex geometry helpers for
 * board grids, world/axial conversion, and spawn location generation.
 *
 * @module
 */
import { defineHex, Grid, Orientation, rectangle, spiral } from 'honeycomb-grid';
import type { GameboardShape, HexCoordinates, WorldPosition } from '../types';
import {
  findHexPath,
  type HexPathOptions,
  type HexPathResult,
  hexDistance,
  hexKey,
  neighbors,
  selectSpawnCoordinates,
} from './coordinates';
import defaultHexGeometry from './hex-geometry.default.json';

/** Hex vertex orientation: `'pointy'` (vertex up) or `'flat'` (edge up). */
export type HexOrientation = 'pointy' | 'flat';

/** World-space dimensions for a hex footprint. */
export interface HexGeometry {
  /** Tile width along the world X axis. */
  width: number;
  /** Tile depth along the world Z axis. */
  depth: number;
  /** Vertical world-unit step for one elevation level. */
  elevationStep: number;
}

/**
 * The DEFAULT hex-grid world geometry, loaded from `hex-geometry.default.json` —
 * DATA, not an engine constant. The agnostic core hardcodes NO pack's numbers; a
 * board/pack overrides these via `createGameboardCoordinateSystem({ geometry })` or
 * a tileset source's `hex`. The shipped defaults match the KayKit Medieval Hexagon
 * reference pack, but that's just the default data, not a baked-in assumption.
 */
export const DEFAULT_HEX_GEOMETRY: HexGeometry = {
  width: defaultHexGeometry.width,
  depth: defaultHexGeometry.depth,
  elevationStep: defaultHexGeometry.elevationStep,
} as const;

/** Default hex orientation (from the geometry defaults data). */
export const DEFAULT_HEX_ORIENTATION: HexOrientation =
  defaultHexGeometry.orientation === 'flat' ? 'flat' : 'pointy';

/**
 * Back-compat aliases for the default geometry, now SOURCED FROM the JSON defaults
 * (not hardcoded). Prefer `DEFAULT_HEX_GEOMETRY` in new code; these remain so
 * existing consumers keep working.
 * @deprecated Use `DEFAULT_HEX_GEOMETRY` (data-driven) instead of the KayKit-named constants.
 */
export const KAYKIT_HEX_WIDTH = DEFAULT_HEX_GEOMETRY.width;
/** @deprecated Use `DEFAULT_HEX_GEOMETRY.depth`. */
export const KAYKIT_HEX_DEPTH = DEFAULT_HEX_GEOMETRY.depth;
/** @deprecated Use `DEFAULT_HEX_GEOMETRY.depth / 2`. */
export const KAYKIT_HEX_SIDE = DEFAULT_HEX_GEOMETRY.depth / 2;
/** @deprecated Row spacing derives from geometry; use `rowSpacingForGeometry(DEFAULT_HEX_GEOMETRY)`. */
export const KAYKIT_HEX_ROW_SPACING = 1.5 * (DEFAULT_HEX_GEOMETRY.depth / 2);
/** @deprecated Use `DEFAULT_HEX_GEOMETRY.elevationStep`. */
export const KAYKIT_ELEVATION_STEP = DEFAULT_HEX_GEOMETRY.elevationStep;

/** Options for creating a reusable coordinate conversion system. */
export interface GameboardCoordinateSystemOptions {
  /** Geometry override for non-KayKit or rescaled boards. */
  geometry?: Partial<HexGeometry>;
}

/** Options for deterministic spawn coordinate selection and projection. */
export interface SpawnLocationOptions {
  /** Board shape to select candidate spawn coordinates from. */
  shape: GameboardShape;
  /** Number of spawn locations to return. */
  count: number;
  /** Seed used when candidate order must be randomized. */
  seed?: string | number;
  /** Explicit candidate coordinates to choose from instead of the whole shape. */
  candidates?: readonly HexCoordinates[];
  /** Predicate used to reject blocked or otherwise unsuitable coordinates. */
  passable?: (coordinates: HexCoordinates) => boolean;
  /** Minimum axial distance between returned spawn coordinates. */
  minDistance?: number;
  /** Number of outer rings/rows to avoid when selecting automatic candidates. */
  edgePadding?: number;
  /** Elevation used when projecting spawn locations to world positions. */
  elevation?: number;
  /** Prefix used for generated spawn ids. */
  idPrefix?: string;
}

/** Spawn point with both hex-grid and world-space coordinates. */
export interface SpawnLocation {
  /** Stable generated spawn id. */
  id: string;
  /** Hex coordinate key for map/set lookups. */
  key: string;
  /** Selected axial coordinate. */
  coordinates: HexCoordinates;
  /** World-space position for placing a unit or marker. */
  position: WorldPosition;
}

/** Convenience surface for KayKit-compatible coordinate math. */
export interface GameboardCoordinateSystem {
  /** Geometry used by all conversions in this coordinate system. */
  geometry: HexGeometry;
  /** Z-axis spacing between adjacent hex rows. */
  rowSpacing: number;
  /** Converts an axial coordinate and optional elevation into world space. */
  toWorld: (coordinates: HexCoordinates, elevation?: number) => WorldPosition;
  /** Converts a world X/Z position to the nearest axial coordinate. */
  fromWorld: (position: Pick<WorldPosition, 'x' | 'z'>) => HexCoordinates;
  /** Returns the six axial neighbors around a coordinate. */
  neighbors: (coordinates: HexCoordinates) => HexCoordinates[];
  /** Computes axial hex distance between two coordinates. */
  distance: (left: HexCoordinates, right: HexCoordinates) => number;
  /** Finds a path between two coordinates using the shared pathfinding helper. */
  findPath: (
    start: HexCoordinates,
    goal: HexCoordinates,
    options?: HexPathOptions
  ) => HexPathResult;
  /** Selects deterministic spawn locations and projects them into world space. */
  spawnLocations: (options: SpawnLocationOptions) => SpawnLocation[];
}

/**
 * @deprecated Alias of `DEFAULT_HEX_GEOMETRY` (data-driven). Use that instead of
 * the KayKit-named export — the engine holds no pack-specific geometry.
 */
export const KAYKIT_HEX_GEOMETRY: HexGeometry = DEFAULT_HEX_GEOMETRY;

/** Honeycomb hex class configured for the default axial footprint. */
export const KayKitHex = defineHex({
  dimensions: {
    xRadius: DEFAULT_HEX_GEOMETRY.width / 2,
    yRadius: DEFAULT_HEX_GEOMETRY.depth / 2,
  },
  orientation: DEFAULT_HEX_ORIENTATION === 'flat' ? Orientation.FLAT : Orientation.POINTY,
});

/** Rectangle grid dimensions in hex cells. */
export interface RectangleGridOptions {
  /** Number of columns in the rectangle. */
  width: number;
  /** Number of rows in the rectangle. */
  height: number;
}

/** Hexagon grid dimensions in rings around the origin. */
export interface HexagonGridOptions {
  /** Honeycomb spiral radius. */
  radius: number;
}

/** Supported board shapes for Honeycomb grid creation. */
export type GameboardGridOptions = GameboardShape;

/** Honeycomb grid instance configured with the KayKit hex class. */
export type KayKitGameboardGrid = Grid<InstanceType<typeof KayKitHex>>;

/** Creates a rectangular Honeycomb grid using KayKit hex dimensions. */
export function createRectangleGameboardGrid(
  options: RectangleGridOptions
): Grid<InstanceType<typeof KayKitHex>> {
  return new Grid(KayKitHex, rectangle({ width: options.width, height: options.height }));
}

/** Creates a hexagonal Honeycomb spiral grid using KayKit hex dimensions. */
export function createHexagonGameboardGrid(options: HexagonGridOptions): KayKitGameboardGrid {
  return new Grid(KayKitHex, spiral({ radius: options.radius }));
}

/** Creates a Honeycomb grid for any supported gameboard shape. */
export function createGameboardGrid(shape: GameboardGridOptions): KayKitGameboardGrid {
  return shape.kind === 'rectangle'
    ? createRectangleGameboardGrid(shape)
    : createHexagonGameboardGrid(shape);
}

/** Converts axial hex coordinates to KayKit world-space coordinates. */
export function axialToWorld(
  coordinates: HexCoordinates,
  elevation = 0,
  geometry: HexGeometry = DEFAULT_HEX_GEOMETRY
): WorldPosition {
  const rowSpacing = rowSpacingForGeometry(geometry);
  return {
    x: geometry.width * (coordinates.q + coordinates.r / 2),
    y: elevation * geometry.elevationStep,
    z: rowSpacing * coordinates.r,
  };
}

/** Converts world X/Z coordinates to the nearest axial hex coordinate. */
export function worldToAxial(
  position: Pick<WorldPosition, 'x' | 'z'>,
  geometry: HexGeometry = DEFAULT_HEX_GEOMETRY
): HexCoordinates {
  const r = position.z / rowSpacingForGeometry(geometry);
  const q = position.x / geometry.width - r / 2;
  return axialRound(q, r);
}

/** Creates a reusable coordinate-system facade for grid math, paths, and spawns. */
export function createGameboardCoordinateSystem(
  options: GameboardCoordinateSystemOptions = {}
): GameboardCoordinateSystem {
  const geometry = {
    ...DEFAULT_HEX_GEOMETRY,
    ...options.geometry,
  };

  return {
    geometry,
    rowSpacing: rowSpacingForGeometry(geometry),
    toWorld: (coordinates, elevation = 0) => axialToWorld(coordinates, elevation, geometry),
    fromWorld: (position) => worldToAxial(position, geometry),
    neighbors,
    distance: hexDistance,
    findPath: (start, goal, pathOptions = {}) => findHexPath(start, goal, pathOptions),
    spawnLocations: (spawnOptions) =>
      createSpawnLocations({
        ...spawnOptions,
        geometry,
      }),
  };
}

/** Selects deterministic spawn coordinates and projects them to world positions. */
export function createSpawnLocations(
  options: SpawnLocationOptions & { geometry?: HexGeometry } = {
    shape: { kind: 'rectangle', width: 1, height: 1 },
    count: 1,
  }
): SpawnLocation[] {
  const geometry = options.geometry ?? DEFAULT_HEX_GEOMETRY;
  return selectSpawnCoordinates(options).map((coordinates, index) => ({
    id: `${options.idPrefix ?? 'spawn'}:${index}`,
    key: hexKey(coordinates),
    coordinates,
    position: axialToWorld(coordinates, options.elevation ?? 0, geometry),
  }));
}

/** Computes row spacing from hex depth for pointy hex placement. */
export function rowSpacingForGeometry(geometry: Pick<HexGeometry, 'depth'>): number {
  return 1.5 * (geometry.depth / 2);
}

function axialRound(q: number, r: number): HexCoordinates {
  const cubeQ = q;
  const cubeR = r;
  const cubeS = -q - r;
  let roundedQ = Math.round(cubeQ);
  let roundedR = Math.round(cubeR);
  let roundedS = Math.round(cubeS);

  const qDiff = Math.abs(roundedQ - cubeQ);
  const rDiff = Math.abs(roundedR - cubeR);
  const sDiff = Math.abs(roundedS - cubeS);

  if (qDiff > rDiff && qDiff > sDiff) {
    roundedQ = -roundedR - roundedS;
  } else if (rDiff > sDiff) {
    roundedR = -roundedQ - roundedS;
  } else {
    roundedS = -roundedQ - roundedR;
  }

  return { q: roundedQ, r: roundedR };
}
