/** Project authoritative hex biome values into seamless material weights. @module */
// biome-ignore lint/style/noRestrictedImports: continuous terrain must stay Koota-free.
import { hexKey, neighbors } from '../coordinates/coordinates';
// biome-ignore lint/style/noRestrictedImports: continuous terrain must stay Koota-free.
import { axialToWorld, DEFAULT_HEX_GEOMETRY, worldToAxial } from '../coordinates/grid';
// biome-ignore lint/style/noRestrictedImports: this type is part of the pure coordinate tier.
import type { HexGeometry } from '../coordinates/grid';
import { GameboardValidationError } from '../errors';
import { assertGameboardTileBiome } from '../gameboard/tile-values';
import type { HexCoordinates } from '../types';
import type { BiomeField } from './biomes';
import { type GroundGrid, validateGroundGrid } from './field';
import { type GroundPoint, smoothstep } from './geometry2d';

/** Structural input shared by plan tiles and snapshots read from live Koota tiles. */
export interface HexBiomeTile {
  readonly coordinates: HexCoordinates;
  readonly biome?: string;
}

/** Channel order and coordinate frame for a derived ground-material field. */
export interface ProjectHexBiomesToFieldOptions {
  readonly tiles: readonly HexBiomeTile[];
  readonly grid: GroundGrid;
  readonly biomes: readonly string[];
  /** Channel used outside the tile map and for tiles without an assigned biome. */
  readonly base: string;
  readonly geometry?: HexGeometry;
  /** World-space translation of the hex grid; default is the world origin. */
  readonly origin?: GroundPoint;
  /** Blend distance inside each hex, in world units. Default 0 gives hard edges. */
  readonly feather?: number;
}

interface EdgePlane {
  readonly x: number;
  readonly z: number;
  readonly reach: number;
  readonly normal: number;
}

interface Cell {
  readonly center: GroundPoint;
  readonly biome: number;
  readonly adjacent: readonly number[];
}

function planesFor(geometry: HexGeometry): EdgePlane[] {
  const { width, depth } = geometry;
  const diagonal = Math.hypot(1 / width, 2 / depth);
  // Clockwise, in the same order as the axial neighbours. These planes use
  // the actual stretched hex footprint, rather than Euclidean Voronoi cells.
  return [
    { x: 1, z: 0, reach: width / 2, normal: 1 },
    { x: 1 / width, z: 2 / depth, reach: 1, normal: diagonal },
    { x: -1 / width, z: 2 / depth, reach: 1, normal: diagonal },
    { x: -1, z: 0, reach: width / 2, normal: 1 },
    { x: -1 / width, z: -2 / depth, reach: 1, normal: diagonal },
    { x: 1 / width, z: -2 / depth, reach: 1, normal: diagonal },
  ];
}

function channelIndex(biomes: readonly string[], base: string): Map<string, number> {
  if (biomes.length === 0)
    throw new GameboardValidationError('Hex biome projection needs channels');
  const channels = new Map<string, number>();
  for (const [index, biome] of biomes.entries()) {
    assertGameboardTileBiome(biome);
    if (channels.has(biome)) throw new GameboardValidationError(`Duplicate biome channel ${biome}`);
    channels.set(biome, index);
  }
  if (!channels.has(base)) throw new GameboardValidationError(`No base biome channel ${base}`);
  return channels;
}

function tileIndex(
  tiles: readonly HexBiomeTile[],
  channels: Map<string, number>,
  base: number
): Map<string, number> {
  const index = new Map<string, number>();
  for (const tile of tiles) {
    if (!Number.isInteger(tile.coordinates.q) || !Number.isInteger(tile.coordinates.r)) {
      throw new GameboardValidationError('Hex biome coordinates must be integers');
    }
    const key = hexKey(tile.coordinates);
    if (index.has(key)) throw new GameboardValidationError(`Duplicate biome tile ${key}`);
    const biome = tile.biome === undefined ? base : channels.get(tile.biome);
    if (biome === undefined)
      throw new GameboardValidationError(`Unknown biome ${tile.biome} at ${key}`);
    index.set(key, biome);
  }
  return index;
}

function validateGeometry(geometry: HexGeometry, origin: GroundPoint, feather: number): void {
  for (const dimension of [geometry.width, geometry.depth]) {
    if (!Number.isFinite(dimension) || dimension <= 0)
      throw new GameboardValidationError('Hex dimensions must be positive and finite');
  }
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.z))
    throw new GameboardValidationError('Hex origin must be finite');
  const inradius = Math.min(
    geometry.width / 2,
    1 / Math.hypot(1 / geometry.width, 2 / geometry.depth)
  );
  if (!Number.isFinite(feather) || feather < 0 || feather > inradius) {
    throw new GameboardValidationError(
      'Hex feather must lie between zero and the footprint inradius'
    );
  }
}

/**
 * Rasterize existing tile biomes without classifying any pixels by terrain,
 * noise or game rules. At hex centres the weight is one-hot. With feathering,
 * shared edges blend equally and three-way vertices blend into thirds;
 * repeated biome names aggregate into the same channel. Every sample sums to
 * one, including missing tiles. Works with anisotropic footprints and translated
 * grids. Input order does not affect the result; no input objects are mutated.
 * The requested channel list must contain every assigned biome and the base.
 */
export function projectHexBiomesToField(options: ProjectHexBiomesToFieldOptions): BiomeField {
  const { tiles, grid, biomes, base } = options;
  validateGroundGrid(grid, 'hex biome field');
  const geometry = options.geometry ?? DEFAULT_HEX_GEOMETRY;
  const origin = options.origin ?? { x: 0, z: 0 };
  const feather = options.feather ?? 0;
  validateGeometry(geometry, origin, feather);
  const channels = channelIndex(biomes, base);
  const baseIndex = channels.get(base) as number;
  const index = tileIndex(tiles, channels, baseIndex);
  const planes = planesFor(geometry);
  const cells = new Map<string, Cell>();
  const cellAt = (coordinates: HexCoordinates): Cell => {
    const key = hexKey(coordinates);
    const cached = cells.get(key);
    if (cached) return cached;
    const position = axialToWorld(coordinates, 0, geometry);
    const cell = {
      center: { x: position.x, z: position.z },
      biome: index.get(key) ?? baseIndex,
      adjacent: neighbors(coordinates).map((at) => index.get(hexKey(at)) ?? baseIndex),
    };
    cells.set(key, cell);
    return cell;
  };
  const weights = new Float32Array(grid.width * grid.height * biomes.length);
  const sample = new Float64Array(biomes.length);
  const stepX = (grid.bounds.maxX - grid.bounds.minX) / (grid.width - 1);
  const stepZ = (grid.bounds.maxZ - grid.bounds.minZ) / (grid.height - 1);
  for (let row = 0; row < grid.height; row += 1) {
    const z = grid.bounds.minZ + row * stepZ - origin.z;
    for (let column = 0; column < grid.width; column += 1) {
      const x = grid.bounds.minX + column * stepX - origin.x;
      const cell = cellAt(worldToAxial({ x, z }, geometry));
      const offset = (row * grid.width + column) * biomes.length;
      weights[offset + cell.biome] = 1;
      if (feather === 0) continue;
      sample.fill(0);
      sample[cell.biome] = 1;
      blendEdges(sample, cell, planes, x, z, feather);
      weights.set(sample, offset);
    }
  }
  return {
    bounds: { ...grid.bounds },
    width: grid.width,
    height: grid.height,
    biomes: [...biomes],
    weights,
  };
}

function blendEdges(
  weights: Float64Array,
  cell: Cell,
  planes: readonly EdgePlane[],
  x: number,
  z: number,
  feather: number
): void {
  let total = 1;
  const dx = x - cell.center.x;
  const dz = z - cell.center.z;
  for (const [edge, plane] of planes.entries()) {
    const distance = (plane.reach - plane.x * dx - plane.z * dz) / plane.normal;
    const weight = 1 - smoothstep(0, feather, distance);
    const at = cell.adjacent[edge] as number;
    weights[at] = (weights[at] as number) + weight;
    total += weight;
  }
  for (let channel = 0; channel < weights.length; channel += 1) {
    weights[channel] = (weights[channel] as number) / total;
  }
}
