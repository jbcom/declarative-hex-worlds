/**
 * CLI cold-start bench (PRD E5).
 *
 * Measures `node dist/cli.js --help` wall-clock. The PRD's eventual
 * budget for headless paths (validate / coverage / doctor / --help) is
 * 80 ms cold-start. Lazy-loading per-subcommand imports (PRD B3) is
 * the path to that budget; until B3 lands the number floats higher.
 *
 * Non-blocking — this is a trend bench, not a CI gate (E5 is "Initially
 * non-blocking"; the gate flips on once B3 + the warm-start bench A3b
 * establish a stable ratio).
 *
 * @module
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { bench, describe } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../..');
const cliPath = resolve(repoRoot, 'dist/cli.js');

describe('CLI cold-start', () => {
  bench(
    'node dist/cli.js --help',
    () => {
      execFileSync('node', [cliPath, '--help'], {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    },
    {
      iterations: 10,
      warmupIterations: 2,
      time: 2000,
      warmupTime: 500,
    }
  );
});
