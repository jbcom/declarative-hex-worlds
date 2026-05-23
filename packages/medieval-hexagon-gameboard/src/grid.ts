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

export const KAYKIT_HEX_WIDTH = 2;
export const KAYKIT_HEX_DEPTH = 2.3094;
export const KAYKIT_HEX_SIDE = KAYKIT_HEX_DEPTH / 2;
export const KAYKIT_HEX_ROW_SPACING = 1.5 * KAYKIT_HEX_SIDE;
export const KAYKIT_ELEVATION_STEP = 1;

export interface HexGeometry {
  width: number;
  depth: number;
  elevationStep: number;
}

export interface GameboardCoordinateSystemOptions {
  geometry?: Partial<HexGeometry>;
}

export interface SpawnLocationOptions {
  shape: GameboardShape;
  count: number;
  seed?: string | number;
  candidates?: readonly HexCoordinates[];
  passable?: (coordinates: HexCoordinates) => boolean;
  minDistance?: number;
  edgePadding?: number;
  elevation?: number;
  idPrefix?: string;
}

export interface SpawnLocation {
  id: string;
  key: string;
  coordinates: HexCoordinates;
  position: WorldPosition;
}

export interface GameboardCoordinateSystem {
  geometry: HexGeometry;
  rowSpacing: number;
  toWorld: (coordinates: HexCoordinates, elevation?: number) => WorldPosition;
  fromWorld: (position: Pick<WorldPosition, 'x' | 'z'>) => HexCoordinates;
  neighbors: (coordinates: HexCoordinates) => HexCoordinates[];
  distance: (left: HexCoordinates, right: HexCoordinates) => number;
  findPath: (start: HexCoordinates, goal: HexCoordinates, options?: HexPathOptions) => HexPathResult;
  spawnLocations: (options: SpawnLocationOptions) => SpawnLocation[];
}

export const KAYKIT_HEX_GEOMETRY = {
  width: KAYKIT_HEX_WIDTH,
  depth: KAYKIT_HEX_DEPTH,
  elevationStep: KAYKIT_ELEVATION_STEP,
} as const satisfies HexGeometry;

export const KayKitHex = defineHex({
  dimensions: {
    xRadius: KAYKIT_HEX_WIDTH / 2,
    yRadius: KAYKIT_HEX_DEPTH / 2,
  },
  orientation: Orientation.POINTY,
});

export interface RectangleGridOptions {
  width: number;
  height: number;
}

export interface HexagonGridOptions {
  radius: number;
}

export type GameboardGridOptions = GameboardShape;

export type KayKitGameboardGrid = Grid<InstanceType<typeof KayKitHex>>;

export function createRectangleGameboardGrid(options: RectangleGridOptions): Grid<InstanceType<typeof KayKitHex>> {
  return new Grid(KayKitHex, rectangle({ width: options.width, height: options.height }));
}

export function createHexagonGameboardGrid(options: HexagonGridOptions): KayKitGameboardGrid {
  return new Grid(KayKitHex, spiral({ radius: options.radius }));
}

export function createGameboardGrid(shape: GameboardGridOptions): KayKitGameboardGrid {
  return shape.kind === 'rectangle'
    ? createRectangleGameboardGrid(shape)
    : createHexagonGameboardGrid(shape);
}

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

export function worldToAxial(
  position: Pick<WorldPosition, 'x' | 'z'>,
  geometry: HexGeometry = KAYKIT_HEX_GEOMETRY
): HexCoordinates {
  const r = position.z / rowSpacingForGeometry(geometry);
  const q = position.x / geometry.width - r / 2;
  return axialRound(q, r);
}

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
