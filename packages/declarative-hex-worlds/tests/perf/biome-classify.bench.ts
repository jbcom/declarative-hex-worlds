/**
 * Biome painting throughput on a large board (640 × 790 samples at a 12 m grid,
 * two slope bands and twenty warped roads over a synthetic height field).
 *
 * Before spatial culling this took tens of seconds, because every paint,
 * warp noise included, was evaluated at every sample. Non-blocking trend bench.
 *
 * @module
 */

import { bench, describe } from 'vitest';
import { biomeBoardScenario } from '../../src/terrain/__tests__/biome-board-scenario';
import { classifyBiomes } from '../../src/terrain/biomes';

describe('biome painting', () => {
  const options = biomeBoardScenario();
  bench(
    'classifyBiomes: 640 × 790 grid, 2 slope bands + 20 warped roads',
    () => {
      classifyBiomes(options);
    },
    { iterations: 5, warmupIterations: 1, time: 1000, warmupTime: 200 }
  );
});
