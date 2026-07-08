/**
 * `docs/pillars/*.md` contract — the internal-team architecture docs
 * referenced from `src/scenario/catalog.ts` (load-bearing) and from
 * docs-site content. Each pillar carries structured frontmatter that
 * the audit pins:
 *
 *   - `status`: draft | implemented | verified
 *   - `last_verified`: YYYY-MM-DD
 *   - `source_images`: list of SimpleRPG showcase PNGs under
 *     `docs/showcases/` or `docs/assets/showcases/` (the vendor guide is retired)
 *   - `source_pack`: an edition token (`free` | `extra` | `simple-rpg`), never a
 *     gitignored `references/` path
 *   - `implementation_links`: list of repo-relative source/docs/scripts paths
 *   - `test_links`: list of repo-relative tests/scripts paths
 *
 * Implemented/verified pillars additionally must link to actual source
 * and actual tests. Path lists must be non-empty, unique, repo-relative,
 * reference existing files, and not point at the gitignored `references/`
 * tree.
 *
 * The audit also pins SimpleRPG cross-reference counts in two coverage
 * docs against the actual code/data counts (so the docs stay in sync
 * with the implementation as features land).
 *
 * Replaces the bespoke `scripts/audit-docs-contract.ts` (deleted).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  listKayKitAssetPublicTreatments,
  listKayKitGuideScenarios,
} from '../../src/scenario';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const pillarsDir = resolve(repoRoot, 'docs/pillars');
const simpleRpgExamplePath = resolve(repoRoot, 'tests/integration/simple-rpg/simple-rpg.ts');

const REQUIRED_KEYS = [
  'status',
  'last_verified',
  'source_images',
  'source_pack',
  'implementation_links',
  'test_links',
] as const;

type PillarStatus = 'draft' | 'implemented' | 'verified';
const ALLOWED_STATUSES = new Set<PillarStatus>(['draft', 'implemented', 'verified']);
// RFC0-6: pillars source their evidence from SimpleRPG SHOWCASE renders, not the
// retired vendor guide. `source_pack` is now an EDITION token (which pack edition
// the pillar's board content comes from), never a gitignored `references/` path.
const ALLOWED_SOURCE_PACKS = new Set(['free', 'extra', 'simple-rpg']);

interface PillarFrontmatter {
  status?: string;
  last_verified?: string;
  source_images?: string[];
  source_pack?: string;
  implementation_links?: string[];
  test_links?: string[];
}

function parseFrontmatter(source: string, label: string): { data: PillarFrontmatter; errors: string[] } {
  const errors: string[] = [];
  if (!source.startsWith('---\n')) {
    return { data: {}, errors: [`${label} missing YAML frontmatter`] };
  }
  const end = source.indexOf('\n---', 4);
  if (end === -1) {
    return { data: {}, errors: [`${label} frontmatter is not closed`] };
  }

  const data: PillarFrontmatter = {};
  let currentListKey: keyof PillarFrontmatter | undefined;
  const lines = source.slice(4, end).split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (line.length === 0) continue;

    const listItem = /^ {2}- (.+)$/.exec(line);
    if (listItem) {
      if (!currentListKey) {
        errors.push(`list item without preceding key: ${line}`);
        continue;
      }
      const value = listItem[1] ?? '';
      const list = data[currentListKey];
      if (Array.isArray(list)) list.push(value);
      else errors.push(`key ${currentListKey} is not a list`);
      continue;
    }

    const scalar = /^([a-z_]+):(.*)$/.exec(line);
    if (!scalar) {
      errors.push(`unsupported frontmatter line: ${line}`);
      currentListKey = undefined;
      continue;
    }
    const key = scalar[1] as keyof PillarFrontmatter;
    const value = (scalar[2] ?? '').trim();
    if (!REQUIRED_KEYS.includes(key as (typeof REQUIRED_KEYS)[number])) {
      errors.push(`unknown key ${key}`);
      currentListKey = undefined;
      continue;
    }
    if (value.length === 0) {
      (data as Record<string, unknown>)[key] = [];
      currentListKey = key;
      continue;
    }
    (data as Record<string, unknown>)[key] = value;
    currentListKey = undefined;
  }
  return { data, errors };
}

const pillarPaths = existsSync(pillarsDir)
  ? readdirSync(pillarsDir)
      .filter((entry) => entry.endsWith('.md'))
      .map((entry) => resolve(pillarsDir, entry))
      .sort()
  : [];

describe('docs/pillars contract', () => {
  it('docs/pillars dir exists', () => {
    expect(existsSync(pillarsDir), `${pillarsDir} missing`).toBe(true);
  });

  it('contains at least one pillar markdown file', () => {
    expect(pillarPaths.length).toBeGreaterThan(0);
  });

  describe.each(pillarPaths.map((p) => [basename(p), p] as const))(
    '%s',
    (label, pillarPath) => {
      let data: PillarFrontmatter = {};
      let errors: string[] = [];
      beforeAll(() => {
        const source = readFileSync(pillarPath, 'utf8');
        ({ data, errors } = parseFrontmatter(source, label));
      });

      it('parses frontmatter without errors', () => {
        expect(errors, errors.join('\n')).toEqual([]);
      });

      it.each(REQUIRED_KEYS.map((k) => [k] as const))('declares %s', (key) => {
        expect(
          (data as Record<string, unknown>)[key],
          `${label} missing frontmatter key ${key}`
        ).toBeDefined();
      });

      it('status is allowed value', () => {
        if (data.status === undefined) return;
        expect(ALLOWED_STATUSES.has(data.status as PillarStatus)).toBe(true);
      });

      it('last_verified is YYYY-MM-DD', () => {
        if (!data.last_verified) return;
        expect(/^\d{4}-\d{2}-\d{2}$/.test(data.last_verified)).toBe(true);
      });

      it('source_pack is a known KayKit pack', () => {
        if (!data.source_pack) return;
        expect(ALLOWED_SOURCE_PACKS.has(data.source_pack)).toBe(true);
      });

      it('source_images all match the showcase PNG pattern (RFC0-6: no retired guide pages)', () => {
        for (const path of data.source_images ?? []) {
          expect(
            /^docs\/(?:assets\/)?showcases\/[a-z0-9-]+\.png$/.test(path),
            `${path} is not a docs/(assets/)?showcases/*.png showcase (the KayKit guide is retired)`
          ).toBe(true);
        }
      });

      describe.each(
        (['source_images', 'implementation_links', 'test_links'] as const).map(
          (key) => [key] as const
        )
      )('%s path list', (key) => {
        it('is a non-empty list', () => {
          const paths = data[key];
          expect(paths).toBeDefined();
          expect(paths?.length, `${key} must list at least one path`).toBeGreaterThan(0);
        });

        it('has no duplicate entries', () => {
          const paths = data[key];
          if (!paths) return;
          const seen = new Set<string>();
          const dups: string[] = [];
          for (const p of paths) {
            if (seen.has(p)) dups.push(p);
            seen.add(p);
          }
          expect(dups, `duplicates: ${dups.join(', ')}`).toEqual([]);
        });

        it('every path is repo-relative + exists + is a file + not in references/', () => {
          const paths = data[key];
          if (!paths) return;
          const violations: string[] = [];
          for (const path of paths) {
            if (path.startsWith('/') || path.includes('..')) {
              violations.push(`${path}: non-repo-relative`);
              continue;
            }
            if (path.startsWith('references/')) {
              violations.push(`${path}: in gitignored references/`);
              continue;
            }
            const resolved = resolve(repoRoot, path);
            if (!existsSync(resolved)) {
              violations.push(`${path}: missing`);
              continue;
            }
            if (!statSync(resolved).isFile()) {
              violations.push(`${path}: not a file`);
            }
          }
          expect(violations, violations.join('\n')).toEqual([]);
        });
      });

      describe('when status is implemented/verified', () => {
        it('implementation_links references at least one source/docs/script path', () => {
          const isImplemented = data.status === 'implemented' || data.status === 'verified';
          if (!isImplemented) return;
          const hit = (data.implementation_links ?? []).some(
            (p) => p.startsWith('src/') || p.startsWith('docs/') || p.startsWith('scripts/')
          );
          expect(hit).toBe(true);
        });

        it('test_links references at least one tests/ or scripts/ path', () => {
          const isImplemented = data.status === 'implemented' || data.status === 'verified';
          if (!isImplemented) return;
          const hit = (data.test_links ?? []).some(
            (p) => p.startsWith('tests/') || p.startsWith('scripts/')
          );
          expect(hit).toBe(true);
        });
      });
    }
  );
});

describe('SimpleRPG coverage doc cross-references', () => {
  const docPaths = [
    'docs/pillars/05-koota-runtime-rules.md',
    'docs/guides/recipes-scenarios-and-simulation.md',
  ] as const;

  let expectedSnippets: string[] = [];
  beforeAll(() => {
    // Extract const SIMPLE_RPG_EXECUTABLE_GUIDE_PUBLIC_APIS from the SimpleRPG fixture
    const fixtureSource = readFileSync(simpleRpgExamplePath, 'utf8');
    const arrayMatch = /const SIMPLE_RPG_EXECUTABLE_GUIDE_PUBLIC_APIS = \[([\s\S]*?)\] as const;/.exec(
      fixtureSource
    );
    const simpleRpgExecutableApiCount = [...(arrayMatch?.[1] ?? '').matchAll(/'[^']+'/g)].length;
    const kayKitPublicTreatmentCount = listKayKitAssetPublicTreatments().length;
    const kayKitGuideScenarioCount = listKayKitGuideScenarios().length;
    expectedSnippets = [
      `${simpleRpgExecutableApiCount} guide-facing helper APIs`,
      `${kayKitPublicTreatmentCount} KayKit public treatment`,
      `${kayKitGuideScenarioCount} decomposed guide pages`,
    ];
  });

  describe.each(docPaths.map((d) => [d] as const))('%s', (docPath) => {
    it.each(['guide-facing helper APIs', 'KayKit public treatment', 'decomposed guide pages'])(
      'mentions the expected "%s" count',
      (snippetSuffix) => {
        const source = readFileSync(resolve(repoRoot, docPath), 'utf8').replace(/\s+/g, ' ');
        const match = expectedSnippets.find((s) => s.endsWith(snippetSuffix));
        if (!match) throw new Error(`expectedSnippets not populated for "${snippetSuffix}"`);
        expect(source).toContain(match);
      }
    );
  });
});
