/**
 * Warm-start bench (PRD A3b).
 *
 * Tracks the cost of loading a real blueprint scenario, generating a board,
 * creating the koota runtime, and producing the facade snapshot. The bench
 * itself is non-blocking — it produces signal so consumers and contributors
 * can watch the trend, and so future B/C/D-series perf work has a ledger to
 * cite when claiming a win.
 *
 * Run with `pnpm bench` (does NOT block CI). The benchmarks workflow uploads
 * trend artifacts on main pushes, nightly schedules, and manual dispatches.
 */

import { bench, describe } from 'vitest';
import { runBlueprintBoardUsageExample } from '../../examples/blueprint-board-usage';

describe('warm-start', () => {
  bench(
    'blueprint scenario → board → runtime → snapshot',
    () => {
      runBlueprintBoardUsageExample();
    },
    {
      iterations: 25,
      time: 1500,
      warmupIterations: 3,
      warmupTime: 300,
    }
  );
});
