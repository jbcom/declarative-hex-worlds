/**
 * API docs static contract — typedoc entry points exist on disk + each
 * carries a top-level `@module` JSDoc block.
 *
 * Replaces the static-check half of `scripts/audit-api-docs.ts` (deleted).
 * The dynamic half — spawning typedoc with `--validation.notDocumented`
 * to gate on un-documented exports — was removed entirely because the
 * `Docs Site Build` CI job already exercises typedoc end-to-end (the
 * docs-site build invokes `starlight-typedoc` which runs typedoc with
 * the project's own config). A duplicate per-PR typedoc spawn was 20+
 * seconds of wall time for zero additional signal.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..', '..');

interface TypeDocJson {
  entryPoints?: string[];
}

const typedocJson = JSON.parse(
  readFileSync(resolve(repoRoot, 'typedoc.json'), 'utf8')
) as TypeDocJson;
const entryPoints = typedocJson.entryPoints ?? [];

function hasTopLevelModuleDoc(source: string): boolean {
  const trimmed = source.trimStart();
  const match = /^\/\*\*[\s\S]*?\*\//.exec(trimmed);
  return Boolean(match?.[0].includes('@module'));
}

describe('API docs contract', () => {
  it('typedoc.json declares entry points', () => {
    expect(entryPoints.length).toBeGreaterThan(0);
  });

  describe.each(entryPoints.map((entry) => [entry] as const))('%s', (entry) => {
    const resolved = resolve(repoRoot, entry);

    it('entry file exists on disk', () => {
      expect(existsSync(resolved), `typedoc entry ${entry} missing`).toBe(true);
    });

    it('carries a top-level `@module` JSDoc block', () => {
      if (!existsSync(resolved)) return; // skip — already failed above
      const source = readFileSync(resolved, 'utf8');
      expect(
        hasTopLevelModuleDoc(source),
        `${entry} is a typedoc entry point — needs a top-level @module JSDoc block`
      ).toBe(true);
    });
  });
});
