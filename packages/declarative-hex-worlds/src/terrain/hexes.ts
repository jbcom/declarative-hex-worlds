/**
 * `src/terrain/hexes.ts` — projecting continuous terrain onto hex tiles.
 *
 * A seamless board still plays on hexes: movement cost, cover and line of
 * sight are per tile. This module summarises the height and biome fields
 * under each hex (mean, sampled minimum and maximum height, mean slope, biome
 * shares and the dominant biome) from a fixed pattern of samples that reaches
 * the hexagon's rim, so gameplay sees the same ground the renderer draws.
 *
 * @module
 */
// biome-ignore lint/style/noRestrictedImports: ./terrain is koota-free and must bypass the ../coordinates barrel (it re-exports layout-runtime).
import { hexKey } from '../coordinates/coordinates';
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
  /** Mean of the sample pattern (centre-weighted toward the hex interior). */
  readonly meanHeight: number;
  /** Lowest and highest height among the samples, which reach the rim. */
  readonly minHeight: number;
  readonly maxHeight: number;
  /** Mean rise over run across the samples. */
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
 * Sample offsets across a pointy-top hexagon in half-extent units (x scaled
 * by half the width, z by half the depth): the centre; six points half-way to
 * the corners; six at 95 % of the corners; six at 95 % of the edge midpoints.
 * 19 points, fixed so summaries are reproducible.
 */
const UNIT_SAMPLES: readonly GroundPoint[] = (() => {
  const points: GroundPoint[] = [{ x: 0, z: 0 }];
  // Corners of a pointy-top hexagon in half-extent units.
  const corners: readonly GroundPoint[] = [
    { x: 0, z: -1 },
    { x: 1, z: -0.5 },
    { x: 1, z: 0.5 },
    { x: 0, z: 1 },
    { x: -1, z: 0.5 },
    { x: -1, z: -0.5 },
  ];
  corners.forEach((corner, i) => {
    const next = corners[(i + 1) % 6] as GroundPoint;
    points.push({ x: corner.x * 0.5, z: corner.z * 0.5 });
    points.push({ x: corner.x * 0.95, z: corner.z * 0.95 });
    points.push({ x: ((corner.x + next.x) / 2) * 0.95, z: ((corner.z + next.z) / 2) * 0.95 });
  });
  return points;
})();

/** Summarises terrain under each requested hex. */
export function projectTerrainToHexes(options: ProjectTerrainToHexesOptions): TerrainHex[] {
  const geometry = options.geometry ?? DEFAULT_HEX_GEOMETRY;
  const halfWidth = geometry.width / 2;
  const halfDepth = geometry.depth / 2;
  const { terrain, biomes } = options;
  const weights = biomes ? new Float32Array(biomes.biomes.length) : null;
  return options.coordinates.map((coordinates) => {
    const world = axialToWorld(coordinates, 0, geometry);
    let sum = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let slope = 0;
    const tally =
      biomes && weights
        ? { field: biomes, weights, shares: new Float64Array(biomes.biomes.length) }
        : null;
    for (const offset of UNIT_SAMPLES) {
      const x = world.x + offset.x * halfWidth;
      const z = world.z + offset.z * halfDepth;
      const h = sampleHeight(terrain, x, z);
      sum += h;
      if (h < min) min = h;
      if (h > max) max = h;
      slope += sampleSlope(terrain, x, z);
      if (tally) {
        sampleBiomeWeights(tally.field, x, z, tally.weights);
        for (let k = 0; k < tally.shares.length; k += 1) {
          tally.shares[k] = (tally.shares[k] as number) + (tally.weights[k] as number);
        }
      }
    }
    const count = UNIT_SAMPLES.length;
    const base = {
      key: hexKey(coordinates),
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
 * Axial coordinates of every hex whose centre lies inside `bounds` grown by
 * `margin` world units (default 0; pass a negative margin to keep only hexes
 * wholly inside), in row order (north to south, then west to east).
 */
export function hexesCoveringBounds(
  bounds: GroundBounds,
  geometry: HexGeometry = DEFAULT_HEX_GEOMETRY,
  margin = 0
): HexCoordinates[] {
  const rowSpacing = (geometry.depth / 2) * 1.5;
  const minX = bounds.minX - margin;
  const maxX = bounds.maxX + margin;
  const rMin = Math.ceil((bounds.minZ - margin) / rowSpacing);
  const rMax = Math.floor((bounds.maxZ + margin) / rowSpacing);
  const result: HexCoordinates[] = [];
  for (let r = rMin; r <= rMax; r += 1) {
    const qMin = Math.ceil(minX / geometry.width - r / 2);
    const qMax = Math.floor(maxX / geometry.width - r / 2);
    for (let q = qMin; q <= qMax; q += 1) result.push({ q, r });
  }
  return result;
}
