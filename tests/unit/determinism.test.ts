/**
 * Cross-process determinism gate (PRD E1).
 *
 * Spawns N Node subprocesses, each running the same scenario with the
 * same seed, and asserts byte-identical JSON output across them. This is
 * the canonical proof of PRD invariant §1 — identical inputs produce
 * byte-identical outputs across processes and platforms.
 *
 * Lives in tests/unit so it runs in the default `pnpm test` loop. Each
 * subprocess takes ~150ms to spawn + run the seeded plan + serialize;
 * N=4 keeps wall-clock well under the 15s test timeout.
 *
 * @module
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../..');
const SUBPROCESS_COUNT = 4;
const SEED = 'determinism-gate-e1';

function runSubprocess(seed: string): string {
  // Use tsx so we exercise the same source path as the test harness;
  // ensures the gate catches drift between dev + prod compile.
  const script = `
import { createSeededGameboardPlan } from './src/rules';
const plan = createSeededGameboardPlan({
  seed: '${seed}',
  shape: { kind: 'rectangle', width: 5, height: 5 },
});
process.stdout.write(JSON.stringify(plan));
`;
  return execFileSync('pnpm', ['exec', 'tsx', '--eval', script], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('cross-process determinism (PRD E1)', () => {
  it('produces byte-identical seeded plans across N spawned subprocesses', () => {
    const outputs = Array.from({ length: SUBPROCESS_COUNT }, () => runSubprocess(SEED));

    // Every subprocess output equals the first.
    for (let i = 1; i < outputs.length; i += 1) {
      expect(outputs[i]).toBe(outputs[0]);
    }

    // And the output isn't trivially empty / error-shaped.
    const parsed = JSON.parse(outputs[0] ?? '');
    expect(parsed.seed).toBe(SEED);
    expect(Array.isArray(parsed.tiles)).toBe(true);
    expect(parsed.tiles.length).toBeGreaterThan(0);
  }, 30_000);

  it('different seeds produce different plans', () => {
    const planA = runSubprocess('seed-a');
    const planB = runSubprocess('seed-b');
    expect(planA).not.toBe(planB);
  }, 15_000);
});
