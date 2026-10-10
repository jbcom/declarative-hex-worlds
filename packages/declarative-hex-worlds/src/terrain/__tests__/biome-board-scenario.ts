/**
 * A large-board painting workload shared by the biome benchmark and the
 * timed regression test: a 7.7 × 9.5 km board on a 12 m grid with two slope
 * bands and twenty warped roads, over a synthetic height field. It is the
 * shape of a real strategy-game board (a battlefield and its road net), where
 * every paint is spatially bounded yet the grid has half a million samples.
 */
import type { BiomePaint, ClassifyBiomesOptions } from '../biomes';
import { composeHeightField } from '../compose';
import type { GroundPoint } from '../geometry2d';

export const BOARD_BIOMES = ['pasture', 'rock', 'cliff', 'road'] as const;

/** Grid samples across and down: 640 × 790 at a 12 m spacing. */
export const BOARD_COLUMNS = 640;
export const BOARD_ROWS = 790;
const SPACING = 12;

/** A deterministic winding road: a straight run bent by a sine, so it is neither axis-aligned nor straight. */
function road(index: number, width: number, depth: number): GroundPoint[] {
  const points: GroundPoint[] = [];
  const steps = 8;
  const horizontal = index % 2 === 0;
  const offset = ((index + 1) / 21) * (horizontal ? depth : width);
  for (let step = 0; step <= steps; step += 1) {
    const along = (step / steps) * (horizontal ? width : depth);
    // Triangle-wave sway: only + - * / (determinism), different phase per road.
    const phase = (step * 3 + index * 5) % 8;
    const sway = (phase < 4 ? phase : 8 - phase) * 150 - 300;
    points.push(horizontal ? { x: along, z: offset + sway } : { x: offset + sway, z: along });
  }
  return points;
}

/** Options for the 640 × 790 board with two slope bands and twenty warped roads. */
export function biomeBoardScenario(): ClassifyBiomesOptions {
  const bounds = {
    minX: 0,
    minZ: 0,
    maxX: (BOARD_COLUMNS - 1) * SPACING,
    maxZ: (BOARD_ROWS - 1) * SPACING,
  };
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const terrain = composeHeightField({
    bounds,
    spacing: SPACING,
    seed: 'board',
    base: 150,
    layers: [
      { kind: 'noise', amplitude: 90, wavelength: 2400, octaves: 5 },
      { kind: 'noise', amplitude: 25, wavelength: 300, octaves: 3, seed: 'detail' },
    ],
  });
  const roads: BiomePaint[] = Array.from({ length: 20 }, (_, index) => ({
    biome: 'road',
    where: [{ kind: 'line', line: road(index, width, depth), halfWidth: 4, feather: 3 }],
    warp: { amplitude: 30, wavelength: 140 },
  }));
  return {
    terrain,
    seed: 'board',
    biomes: BOARD_BIOMES,
    base: 'pasture',
    paints: [
      { biome: 'rock', where: [{ kind: 'slope', min: 0.08, feather: 0.04 }] },
      { biome: 'cliff', where: [{ kind: 'slope', min: 0.2, feather: 0.05 }] },
      ...roads,
    ],
  };
}
