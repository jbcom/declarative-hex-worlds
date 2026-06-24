/**
 * Branded ID documentation contract.
 *
 * The branded aliases are exported from `./types`, but the runtime still uses
 * plain strings in domain APIs. Keep the public API guide explicit until each
 * domain actually migrates to enforced nominal IDs.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..', '..');

const GUIDE_PATHS = [
  'docs-site/src/content/docs/guides/public-api.md',
  'docs/guides/public-api.md',
] as const;

const BRAND_NAMES = [
  'HexKey',
  'ActorId',
  'TileId',
  'PieceId',
  'PlacementId',
  'ScenarioId',
  'QuestId',
  'ObjectiveId',
  'PatrolRouteId',
  'AssetId',
] as const;

const DOMAIN_ROWS = [
  './types',
  './coordinates',
  './grid',
  './layout',
  './gameboard',
  './scenario',
  './recipe',
  './blueprint',
  './simulation',
  './pieces',
  './actors',
  './movement',
  './patrol',
  './quests',
  './manifest/schema',
  './manifest/free',
  './ingest',
  './runtime',
  './react',
  './three',
  './cli',
  './interop',
  './compatibility',
  './coverage',
] as const;

function walkSource(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const child = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'types') continue;
      out.push(...walkSource(child));
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(child);
    }
  }
  return out;
}

describe('branded type public API docs', () => {
  describe.each(GUIDE_PATHS.map((path) => [path, resolve(repoRoot, path)] as const))(
    '%s',
    (label, path) => {
      let source = '';

      beforeAll(() => {
        source = readFileSync(path, 'utf8');
      });

      it('keeps the not-yet-enforced caveat visible', () => {
        expect(source).toContain('## Branded ID migration status');
        expect(source).toContain('branded IDs are **NOT yet enforced** across the runtime');
      });

      it.each(BRAND_NAMES.map((brand) => [brand] as const))('tracks %s', (brand) => {
        expect(source, `${label} must mention ${brand}`).toContain(`\`${brand}\``);
      });

      it.each(DOMAIN_ROWS.map((domain) => [domain] as const))('tracks %s status', (domain) => {
        expect(source, `${label} must include ${domain} in the branded migration table`).toContain(
          `\`${domain}\``
        );
      });
    }
  );

  it('matches the current implementation boundary: only src/types uses branded aliases', () => {
    const brandPattern = new RegExp(`\\b(?:${BRAND_NAMES.join('|')})\\b`);
    const violations = walkSource(resolve(repoRoot, 'src'))
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8');
        return brandPattern.test(source) ? [relative(repoRoot, file)] : [];
      })
      .sort();

    expect(violations).toEqual([]);
  });
});
