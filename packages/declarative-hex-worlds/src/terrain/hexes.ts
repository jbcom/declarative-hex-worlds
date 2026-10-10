/**
 * `src/terrain/hexes.ts` — projecting continuous terrain onto hex tiles.
 *
 * A seamless board still plays on hexes: movement cost, cover and line of
 * sight are per tile. This module summarises the height and biome fields
 * under each hex (mean, min and max height, mean slope, biome shares and the
 * dominant biome) from a fixed pattern of samples across the hexagon, so
 * gameplay sees the same ground the renderer draws.
 *
 * @module
 */
// biome-ignore lint/style/noRestrictedImports: ./terrain is koota-free and must bypass the ../coordinates barrel (it re-exports layout-runtime).
import { axialToWorld, DEFAULT_HEX_GEOMETRY, type HexGeometry } from '../coordinates/grid';
import type { HexCoordinates } from '../types';
import { type BiomeField, sampleBiomeWeights } from './biomes';
import { type HeightField, sampleHeight, sampleSlope } from './field';
import type { GroundBounds, GroundPoint } from './geometry2d';

/** Terrain summary for one hex. */
export interface TerrainHex {
  readonly key: string;
  readonly coordinates: HexCoordinates;
  /** World position of the hex centre on the ground plane. */
  readonly center: GroundPoint;
  readonly meanHeight: number;
  readonly minHeight: number;
  readonly maxHeight: number;
  /** Mean rise over run across the hex. */
  readonly meanSlope: number;
  /** Share of each biome under the hex, summing to 1; absent without a biome field. */
  readonly biomeShares?: Readonly<Record<string, number>>;
  readonly dominantBiome?: string;
}

/** Options for {@link projectTerrainToHexes}. */
export interface ProjectTerrainToHexesOptions {
  readonly terrain: HeightField;
  readonly biomes?: BiomeField;
  readonly coordinates: readonly HexCoordinates[];
  readonly geometry?: HexGeometry;
}

/**
 * Sample offsets across a pointy-top hexagon of unit circumradius: the centre,
 * six points two-thirds of the way to the corners, and six at the edge
 * midpoints' half-way mark. Fixed so summaries are reproducible.
 */
const UNIT_SAMPLES: readonly GroundPoint[] = (() => {
  const points: GroundPoint[] = [{ x: 0, z: 0 }];
  const half = Math.sqrt(3) / 2;
  const corners: readonly GroundPoint[] = [
    { x: 0, z: -1 },
    { x: half, z: -0.5 },
    { x: half, z: 0.5 },
    { x: 0, z: 1 },
    { x: -half, z: 0.5 },
    { x: -half, z: -0.5 },
  ];
  corners.forEach((corner, i) => {
    const next = corners[(i + 1) % 6] as GroundPoint;
    points.push({ x: corner.x * (2 / 3), z: corner.z * (2 / 3) });
    points.push({ x: ((corner.x + next.x) / 2) * 0.5, z: ((corner.z + next.z) / 2) * 0.5 });
  });
  return points;
})();

/** Summarises terrain under each requested hex. */
export function projectTerrainToHexes(options: ProjectTerrainToHexesOptions): TerrainHex[] {
  const geometry = options.geometry ?? DEFAULT_HEX_GEOMETRY;
  const radius = geometry.depth / 2;
  const { terrain, biomes } = options;
  return options.coordinates.map((coordinates) => {
    const world = axialToWorld(coordinates, 0, geometry);
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let slope = 0;
    const tally = biomes ? { field: biomes, shares: new Float64Array(biomes.biomes.length) } : null;
    for (const offset of UNIT_SAMPLES) {
      const x = world.x + offset.x * radius;
      const z = world.z + offset.z * radius;
      const h = sampleHeight(terrain, x, z);
      sum += h;
      if (h < min) min = h;
      if (h > max) max = h;
      slope += sampleSlope(terrain, x, z);
      if (tally) {
        const weights = sampleBiomeWeights(tally.field, x, z);
        for (let k = 0; k < tally.shares.length; k += 1) {
          tally.shares[k] = (tally.shares[k] as number) + (weights[k] as number);
        }
      }
    }
    const count = UNIT_SAMPLES.length;
    const base = {
      key: `${coordinates.q},${coordinates.r}`,
      coordinates,
      center: { x: world.x, z: world.z },
      meanHeight: sum / count,
      minHeight: min,
      maxHeight: max,
      meanSlope: slope / count,
    };
    if (!tally) return base;
    const { field, shares } = tally;
    const biomeShares: Record<string, number> = {};
    let best = 0;
    field.biomes.forEach((id, k) => {
      biomeShares[id] = (shares[k] as number) / count;
      if ((shares[k] as number) > (shares[best] as number)) best = k;
    });
    return { ...base, biomeShares, dominantBiome: field.biomes[best] as string };
  });
}

/**
 * Axial coordinates of every hex whose centre lies inside `bounds`, in row
 * order (north to south, then west to east).
 */
export function hexesCoveringBounds(
  bounds: GroundBounds,
  geometry: HexGeometry = DEFAULT_HEX_GEOMETRY
): HexCoordinates[] {
  const rowSpacing = (geometry.depth / 2) * 1.5;
  const rMin = Math.ceil(bounds.minZ / rowSpacing);
  const rMax = Math.floor(bounds.maxZ / rowSpacing);
  const result: HexCoordinates[] = [];
  for (let r = rMin; r <= rMax; r += 1) {
    const qMin = Math.ceil(bounds.minX / geometry.width - r / 2);
    const qMax = Math.floor(bounds.maxX / geometry.width - r / 2);
    for (let q = qMin; q <= qMax; q += 1) result.push({ q, r });
  }
  return result;
}
