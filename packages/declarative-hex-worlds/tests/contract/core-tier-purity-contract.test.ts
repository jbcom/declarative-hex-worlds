/**
 * `./core` tier purity contract (RFC 0001 RFC0-CORE).
 *
 * The `declarative-hex-worlds/core` entrypoint MUST be koota-free AND three-free:
 * a `./core`-only consumer installs just `honeycomb-grid` + `zod`, brings their
 * own runtime (mount via interop) and/or renderer. This spec walks the SOURCE
 * import graph reachable from `src/core/index.ts` and asserts no module in it has
 * a runtime (non-type-only) import of `koota`, `three`, `@react-three/fiber`, or
 * `react`. Source-level purity is the real guarantee — a `./core` import never
 * executes ECS/renderer code. (The bundled `dist/core.js` may still SHARE tsup
 * chunks with runtime modules; that's a chunk-splitting concern tracked
 * separately, not a correctness leak — the code paths reached from `./core` never
 * touch those deps.)
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(import.meta.dirname, '..', '..');
const coreEntry = join(packageRoot, 'src/core/index.ts');

const FORBIDDEN_RUNTIME_DEPS = ['koota', 'three', '@react-three/fiber', 'react', 'react-dom'];

/** Resolve a relative import specifier from a file to a source path. */
function resolveImport(fromFile: string, specifier: string): string | undefined {
  const base = join(dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, `${base}/index.ts`, `${base}.tsx`]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

interface Leak {
  file: string;
  dep: string;
  chain: string;
}

/** Walk the import graph from `entry`, collecting runtime imports of forbidden deps. */
function findRuntimeLeaks(entry: string): Leak[] {
  const seen = new Set<string>();
  const leaks: Leak[] = [];
  const walk = (file: string, chain: string): void => {
    if (seen.has(file)) {
      return;
    }
    seen.add(file);
    const source = readFileSync(file, 'utf8');
    const importRe = /^import(\s+type)?\s+[^;]*?from\s+['"]([^'"]+)['"]/gm;
    for (const match of source.matchAll(importRe)) {
      const isTypeOnly = Boolean(match[1]);
      const specifier = match[2] as string;
      const rel = file.replace(`${packageRoot}/`, '');
      if (FORBIDDEN_RUNTIME_DEPS.includes(specifier)) {
        if (!isTypeOnly) {
          leaks.push({ file: rel, dep: specifier, chain: `${chain} → ${rel}` });
        }
        continue;
      }
      if (specifier.startsWith('.')) {
        const resolved = resolveImport(file, specifier);
        if (resolved) {
          walk(resolved, `${chain} → ${specifier}`);
        }
      }
    }
  };
  walk(entry, 'core');
  return leaks;
}

describe('./core tier purity contract', () => {
  it('src/core/index.ts exists', () => {
    expect(existsSync(coreEntry)).toBe(true);
  });

  it('the ./core source import graph has ZERO runtime imports of koota/three/react/R3F', () => {
    const leaks = findRuntimeLeaks(coreEntry);
    expect(
      leaks,
      leaks.map((l) => `${l.dep} imported at runtime by ${l.chain}`).join('\n')
    ).toEqual([]);
  });

  it('walks a non-trivial graph (guards against the walk silently finding nothing)', () => {
    // If the resolver breaks and visits ~0 files, the purity check passes
    // vacuously — assert we actually traversed the tree.
    const seen = new Set<string>();
    const walk = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const match of readFileSync(file, 'utf8').matchAll(
        /from\s+['"](\.[^'"]+)['"]/g
      )) {
        const resolved = resolveImport(file, match[1] as string);
        if (resolved) walk(resolved);
      }
    };
    walk(coreEntry);
    expect(seen.size).toBeGreaterThan(10);
  });
});
