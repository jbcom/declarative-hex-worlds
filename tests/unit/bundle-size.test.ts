/**
 * Bundle size budget guard.
 *
 * Runs only when dist/ exists (i.e., after `pnpm build`). Skipped in pure
 * source-only environments (vitest without a prior build step).
 *
 * Ceilings are set at 2× the current measured sizes to give headroom while
 * still catching accidental bundling of large deps (e.g., a 380KB manifest
 * JSON being inlined via static import).
 *
 * @module
 */

import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../..');
const distRoot = resolve(repoRoot, 'dist');

function distSize(filename: string): number {
  try {
    return statSync(resolve(distRoot, filename)).size;
  } catch {
    return -1;
  }
}

const HAS_DIST = distSize('index.js') >= 0;

describe.skipIf(!HAS_DIST)('bundle size budget (requires pnpm build)', () => {
  it('dist/index.js stays under 60 KB (umbrella barrel re-export)', () => {
    const size = distSize('index.js');
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(60 * 1024);
  });

  it('dist/cli.js stays under 100 KB (citty shim + lazy loader)', () => {
    const size = distSize('cli.js');
    expect(size).toBeGreaterThan(0);
    expect(size).toBeLessThan(100 * 1024);
  });
});
