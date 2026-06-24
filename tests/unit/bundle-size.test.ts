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

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
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

function readDistFile(filename: string): string {
  return readFileSync(resolve(distRoot, filename), 'utf8');
}

const STATIC_ESM_SPECIFIER_RE = /\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function reachableStaticDistFiles(entryFilename: string): string[] {
  const entryPath = resolve(distRoot, entryFilename);
  const visited = new Set<string>();
  const pending = [entryPath];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current) || !existsSync(current)) {
      continue;
    }
    visited.add(current);

    const currentSource = readFileSync(current, 'utf8');
    for (const match of currentSource.matchAll(STATIC_ESM_SPECIFIER_RE)) {
      const specifier = match[1];
      if (!specifier?.startsWith('.')) {
        continue;
      }
      pending.push(resolve(dirname(current), specifier));
    }
  }

  return [...visited].map((filePath) => filePath.slice(distRoot.length + 1)).sort();
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

  it('dist/gameboard.js does not statically reach packaged FREE manifest records', () => {
    const reachableFiles = reachableStaticDistFiles('gameboard.js');
    const reachableSource = reachableFiles.map((filename) => readDistFile(filename)).join('\n');

    expect(reachableFiles).not.toContain('manifest/free.js');
    expect(reachableSource).not.toContain('buildings/blue/building_archeryrange_blue.gltf');
  });
});
