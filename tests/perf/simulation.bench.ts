/**
 * Simulation throughput bench (PRD E6).
 *
 * Reuses the SimpleRPG integration driver's full path (scenario load →
 * koota world creation → simulation script execution → snapshot) as the
 * benchmark workload. The driver exercises every public API a real game
 * would touch, so the bench is a faithful proxy for end-to-end consumer
 * cost.
 *
 * Non-blocking trend bench. Add a regression alarm at >10 % once Phase B
 * perf criticals (B1, B3) land and a stable baseline is established.
 *
 * @module
 */

import { bench, describe } from 'vitest';
import { runSimpleRpgUsageExample } from '../integration/simple-rpg/simple-rpg';

describe('simulation throughput', () => {
  bench(
    'SimpleRPG scenario → world → simulation script → snapshot',
    () => {
      runSimpleRpgUsageExample();
    },
    {
      iterations: 5,
      warmupIterations: 1,
      time: 3000,
      warmupTime: 500,
    }
  );
});
