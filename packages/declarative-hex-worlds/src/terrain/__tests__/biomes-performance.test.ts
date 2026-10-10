/**
 * A large board (640 × 790 samples, two slope bands, twenty warped roads) must
 * paint in seconds. Before spatial culling every road was evaluated, warp
 * noise and all, at every one of the half-million samples: tens of seconds.
 *
 * The wall-clock bound is generous (a loaded CI machine still passes). The
 * deterministic guard is the count of warp-noise evaluations, which does not
 * depend on the machine at all.
 */
import { describe, expect, it, vi } from 'vitest';
import { classifyBiomes } from '../biomes';
import { BOARD_COLUMNS, BOARD_ROWS, biomeBoardScenario } from './biome-board-scenario';

const noiseCalls = vi.hoisted(() => ({ fractal: 0 }));

vi.mock('../noise', async (importOriginal) => {
  const original = await importOriginal<typeof import('../noise')>();
  return {
    ...original,
    fractalNoise: (...args: Parameters<typeof original.fractalNoise>) => {
      noiseCalls.fractal += 1;
      return original.fractalNoise(...args);
    },
  };
});

describe('classifyBiomes on a large board', () => {
  it('evaluates warped roads only near the roads, and finishes in seconds', () => {
    const options = biomeBoardScenario();
    expect([options.terrain.width, options.terrain.height]).toEqual([BOARD_COLUMNS, BOARD_ROWS]);
    noiseCalls.fractal = 0;
    const started = performance.now();
    const field = classifyBiomes(options);
    const elapsed = performance.now() - started;

    expect(field.weights.length).toBe(BOARD_COLUMNS * BOARD_ROWS * options.biomes.length);
    // Brute force: 20 roads × 2 warp axes × 505,600 samples = 20 million calls.
    // Culling keeps each road to a thin corridor, a few percent of the board.
    const bruteForce = 20 * 2 * BOARD_COLUMNS * BOARD_ROWS;
    expect(noiseCalls.fractal).toBeGreaterThan(0);
    expect(noiseCalls.fractal).toBeLessThan(bruteForce * 0.1);
    expect(elapsed).toBeLessThan(20_000);
  });
});
