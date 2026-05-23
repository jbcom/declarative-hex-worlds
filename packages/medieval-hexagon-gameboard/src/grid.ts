import { Grid, Orientation, defineHex, rectangle, spiral } from 'honeycomb-grid';
import {
  findHexPath,
  hexDistance,
  hexKey,
  neighbors,
  selectSpawnCoordinates,
  type HexPathOptions,
  type HexPathResult,
} from './coordinates';
import type { GameboardShape, HexCoordinates, WorldPosition } from './types';

/** Canonical KayKit hex tile width in world units. */
export const KAYKIT_HEX_WIDTH = 2;
/** Canonical KayKit hex tile depth in world units. */
export const KAYKIT_HEX_DEPTH = 2.3094;
/** Canonical KayKit hex side radius in world units. */
export const KAYKIT_HEX_SIDE = KAYKIT_HEX_DEPTH / 2;
/** Canonical row spacing for adjacent KayKit hex rows. */
export const KAYKIT_HEX_ROW_SPACING = 1.5 * KAYKIT_HEX_SIDE;
/** Default vertical step between stacked KayKit elevation levels. */
export const KAYKIT_ELEVATION_STEP = 1;

/** World-space dimensions for a hex footprint. */
export interface HexGeometry {
  /** Tile width along the world X axis. */
  width: number;
  /** Tile depth along the world Z axis. */
  depth: number;
  /** Vertical world-unit step for one elevation level. */
  elevationStep: number;
}

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
  findPath: (start: HexCoordinates, goal: HexCoordinates, options?: HexPathOptions) => HexPathResult;
  /** Selects deterministic spawn locations and projects them into world space. */
  spawnLocations: (options: SpawnLocationOptions) => SpawnLocation[];
}

/** Canonical KayKit hex geometry used by all default placement helpers. */
export const KAYKIT_HEX_GEOMETRY: HexGeometry = {
  width: KAYKIT_HEX_WIDTH,
  depth: KAYKIT_HEX_DEPTH,
  elevationStep: KAYKIT_ELEVATION_STEP,
} as const;

/** Honeycomb hex class configured for KayKit's pointy axial footprint. */
export const KayKitHex = defineHex({
  dimensions: {
    xRadius: KAYKIT_HEX_WIDTH / 2,
    yRadius: KAYKIT_HEX_DEPTH / 2,
  },
  orientation: Orientation.POINTY,
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
export function createRectangleGameboardGrid(options: RectangleGridOptions): Grid<InstanceType<typeof KayKitHex>> {
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
  geometry: HexGeometry = KAYKIT_HEX_GEOMETRY
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
  geometry: HexGeometry = KAYKIT_HEX_GEOMETRY
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
    ...KAYKIT_HEX_GEOMETRY,
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
  const geometry = options.geometry ?? KAYKIT_HEX_GEOMETRY;
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
