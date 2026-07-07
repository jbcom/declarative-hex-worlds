/**
 * Renderer-optionality contract (RFC 0001 RFC0-RENDER, signals+bindings).
 *
 * The signals+bindings architecture (koota-native): the engine core emits reactive
 * SIGNALS (koota traits) and renderer BINDINGS subscribe. For three / pixi /
 * @react-three/fiber to be genuinely OPTIONAL peer dependencies, NO core entrypoint
 * may statically import a renderer — a consumer importing `declarative-hex-worlds`
 * (or `/core`, `/scenario`, `/runtime`, …) must never transitively pull in three.
 * Renderers are reachable ONLY via the dedicated binding subpaths (`/three`,
 * `/react-elements`, and future `/pixi`).
 *
 * koota is NOT forbidden here — it IS the signal layer (the main tier is koota-based;
 * only `/core` is koota-free, which its own purity contract enforces). This spec
 * guards the RENDERER boundary specifically. It walks the SOURCE import graph from
 * each core entrypoint and asserts zero runtime import of a renderer, then asserts
 * the binding subpaths DO reach their renderer (so the bindings actually bind).
 *
 * @module
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(import.meta.dirname, '..', '..');

/** Renderers that must never be reachable from a core entrypoint at runtime. */
const FORBIDDEN_RENDERERS = ['three', '@react-three/fiber', 'pixi.js'];

/**
 * Core entrypoints that MUST stay renderer-free. These map to the renderer-free
 * public subpaths — a consumer of any of them installs no renderer. React is
 * allowed in the main tier's element wiring but NOT a renderer; the renderer
 * boundary is what this contract guards.
 */
const CORE_ENTRYPOINTS = [
  'src/index.ts',
  'src/core/index.ts',
  'src/scenario/index.ts',
  'src/runtime/index.ts',
  'src/gameboard/index.ts',
  'src/coordinates/index.ts',
  'src/interop/index.ts',
  'src/asset-source/index.ts',
  // The canvas-2D binding is itself renderer-free (a 2D context is a web standard,
  // not a renderer LIBRARY) — it must never pull in three/pixi.
  'src/canvas2d/index.ts',
];

/** Binding subpaths that SHOULD reach their renderer (positive check). */
const BINDING_ENTRYPOINTS: Array<{ entry: string; renderer: string }> = [
  { entry: 'src/three/index.ts', renderer: 'three' },
];

function resolveImport(fromFile: string, specifier: string): string | undefined {
  const base = join(dirname(fromFile), specifier);
  for (const candidate of [`${base}.ts`, `${base}/index.ts`, `${base}.tsx`]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

interface Edge {
  specifier: string;
  isTypeOnly: boolean;
}

/**
 * Extract every module edge from a source file: `import … from`, `export … from`
 * (re-exports, including `export *`), and dynamic `import('…')`. Matches multi-line
 * import/export clauses (the specifier is what follows the final `from`). This is
 * what makes the graph walk sound — a renderer reached via `export * from` a
 * renderer-importing module is a real runtime dependency and must be caught.
 */
function extractEdges(source: string): Edge[] {
  const edges: Edge[] = [];
  // import/export (with optional `type`) … from '…'  — [^;]*? spans multi-line clauses.
  const staticRe = /\b(import|export)(\s+type)?\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/gs;
  for (const match of source.matchAll(staticRe)) {
    edges.push({ specifier: match[3] as string, isTypeOnly: Boolean(match[2]) });
  }
  // dynamic import('…') — always a runtime edge.
  for (const match of source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    edges.push({ specifier: match[1] as string, isTypeOnly: false });
  }
  return edges;
}

interface RendererLeak {
  file: string;
  renderer: string;
  chain: string;
}

/**
 * Walk the source import graph from `entry`, collecting RUNTIME (non-type-only)
 * imports of a forbidden renderer. Type-only imports are allowed — they erase at
 * compile time and don't make the peer non-optional.
 */
function findRendererLeaks(entry: string): RendererLeak[] {
  const seen = new Set<string>();
  const leaks: RendererLeak[] = [];
  const walk = (file: string, chain: string): void => {
    if (seen.has(file)) {
      return;
    }
    seen.add(file);
    const rel = file.replace(`${packageRoot}/`, '');
    for (const { specifier, isTypeOnly } of extractEdges(readFileSync(file, 'utf8'))) {
      const renderer = FORBIDDEN_RENDERERS.find(
        (dep) => specifier === dep || specifier.startsWith(`${dep}/`)
      );
      if (renderer) {
        if (!isTypeOnly) {
          leaks.push({ file: rel, renderer, chain: `${chain} → ${rel}` });
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
  walk(entry, entry.replace(`${packageRoot}/`, ''));
  return leaks;
}

/** True if the source graph from `entry` reaches a runtime import of `renderer`. */
function graphReachesRenderer(entry: string, renderer: string): boolean {
  const seen = new Set<string>();
  const walk = (file: string): boolean => {
    if (seen.has(file)) {
      return false;
    }
    seen.add(file);
    for (const { specifier, isTypeOnly } of extractEdges(readFileSync(file, 'utf8'))) {
      if (!isTypeOnly && (specifier === renderer || specifier.startsWith(`${renderer}/`))) {
        return true;
      }
      if (specifier.startsWith('.')) {
        const resolved = resolveImport(file, specifier);
        if (resolved && walk(resolved)) {
          return true;
        }
      }
    }
    return false;
  };
  return walk(entry);
}

describe('renderer-optionality contract', () => {
  for (const entry of CORE_ENTRYPOINTS) {
    const abs = join(packageRoot, entry);

    it(`${entry} exists`, () => {
      expect(existsSync(abs)).toBe(true);
    });

    it(`${entry} source graph has ZERO runtime import of a renderer (three/pixi/R3F)`, () => {
      const leaks = findRendererLeaks(abs);
      expect(
        leaks,
        leaks.map((l) => `${l.renderer} imported at runtime by ${l.chain}`).join('\n')
      ).toEqual([]);
    });
  }

  for (const { entry, renderer } of BINDING_ENTRYPOINTS) {
    it(`binding subpath ${entry} DOES reach ${renderer} (it must actually bind)`, () => {
      expect(graphReachesRenderer(join(packageRoot, entry), renderer)).toBe(true);
    });
  }
});
