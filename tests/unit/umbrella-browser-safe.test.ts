/**
 * Browser-safety guard for the library umbrella (Epic LF / E-MergedGate).
 *
 * Walks the static-import graph reachable from `src/index.ts` and asserts ZERO
 * `node:*` imports anywhere in that transitive closure. This catches any
 * future regression where a CLI/server-only module (bootstrap, ingest, cli,
 * upstream-layout helpers) gets accidentally re-exported from the umbrella —
 * which would re-poison the browser bundle and re-block the merged
 * unit+browser-free coverage gate (E-MergedGate link 3).
 *
 * Dynamic `import()` expressions in `src/cli/cli.ts` are deliberately walked
 * too: the umbrella never reaches `cli.ts`, so any leak there would not be
 * counted (cli is server-only, lazy-loaded only by `bin/`).
 *
 * @module
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..', '..', 'src');
const UMBRELLA = join(SRC, 'index.ts');

interface Resolved {
  kind: 'node' | 'src' | 'json' | 'external' | 'unresolved';
  spec: string;
  file?: string;
}

const IMPORT_RE =
  /(?:^|\s)(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]/gm;

function readImports(filePath: string): Set<string> {
  const content = readFileSync(filePath, 'utf8');
  const out = new Set<string>();
  IMPORT_RE.lastIndex = 0;
  let m: RegExpExecArray | null = IMPORT_RE.exec(content);
  while (m !== null) {
    out.add((m[1] ?? m[2]) as string);
    m = IMPORT_RE.exec(content);
  }
  return out;
}

function resolveImport(fromFile: string, spec: string): Resolved {
  if (spec.startsWith('node:')) return { kind: 'node', spec };
  if (!spec.startsWith('.')) return { kind: 'external', spec };
  const baseDir = dirname(fromFile);
  const base = resolve(baseDir, spec);
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return { kind: 'src', spec, file: cand };
  }
  if (existsSync(`${base}.json`)) return { kind: 'json', spec, file: `${base}.json` };
  return { kind: 'unresolved', spec };
}

function collectNodeLeaks(entry: string): ReadonlyArray<{ readonly file: string; readonly spec: string }> {
  const visited = new Set<string>();
  const leaks: Array<{ file: string; spec: string }> = [];
  const stack: string[] = [entry];
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (visited.has(file)) continue;
    visited.add(file);
    let imports: Set<string>;
    try {
      imports = readImports(file);
    } catch {
      continue;
    }
    for (const spec of imports) {
      const r = resolveImport(file, spec);
      if (r.kind === 'node') {
        leaks.push({ file, spec });
      } else if ((r.kind === 'src' || r.kind === 'json') && r.file && !r.file.includes('/__tests__/')) {
        stack.push(r.file);
      }
    }
  }
  return leaks;
}

describe('umbrella browser-safety (Epic LF / E-MergedGate)', () => {
  it('src/index.ts transitive graph has zero node:* imports', () => {
    const leaks = collectNodeLeaks(UMBRELLA);
    expect(leaks).toEqual([]);
  });
});
