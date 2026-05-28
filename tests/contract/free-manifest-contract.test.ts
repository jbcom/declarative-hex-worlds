/**
 * FREE manifest contract — asserts the shape, metadata, asset counts,
 * per-asset shape, and NOTICE attribution for the bundled FREE manifest
 * (`assets/free/manifest.json`).
 *
 * Post-PRD-RB: the only file shipped under `assets/free/` is
 * `manifest.json` itself — the GLTF/BIN/PNG tree is fetched at install
 * time by the CLI `bootstrap` subcommand. This spec validates the
 * manifest bytes; the bootstrap step verifies the fetched bytes
 * against the per-asset integrity sidecar.
 *
 * Replaces the bespoke `scripts/audit-free-assets.ts` (deleted).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '..', '..');

interface AssetBounds {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
}

interface ManifestAsset {
  id: string;
  edition: string;
  category: string;
  subcategory: string;
  family: string;
  faction?: string;
  unitStyle?: string;
  textureSet: string;
  modelPath: string;
  sourcePath: string;
  bufferPaths: string[];
  texturePaths: string[];
  materialSlots: string[];
  bounds: AssetBounds;
  fileSizeBytes: number;
}

interface FreeManifest {
  schemaVersion: string;
  generatedAt: string;
  edition: string;
  sourcePack: {
    name: string;
    version: string;
    edition: string;
    creator: string;
    license: string;
    licenseUrl: string;
    sourceRootName: string;
  };
  textureSets: string[];
  assets: ManifestAsset[];
  assetsById: Record<string, ManifestAsset>;
  counts: {
    total: number;
    byCategory: Record<string, number>;
    bySubcategory: Record<string, number>;
  };
}

const manifest = JSON.parse(
  readFileSync(resolve(repoRoot, 'assets/free/manifest.json'), 'utf8')
) as FreeManifest;

const EXPECTED_CATEGORY_COUNTS = { buildings: 93, decoration: 68, tiles: 60 };
const EXPECTED_SUBCATEGORY_COUNTS: Record<string, number> = {
  'buildings/blue': 18,
  'buildings/green': 18,
  'buildings/neutral': 21,
  'buildings/red': 18,
  'buildings/yellow': 18,
  'decoration/nature': 42,
  'decoration/props': 26,
  'tiles/base': 5,
  'tiles/coast': 10,
  'tiles/rivers': 30,
  'tiles/roads': 15,
};
const BOUNDS_TOLERANCE = 0.0001;
const FACTIONS = ['blue', 'green', 'red', 'yellow'] as const;

describe('FREE manifest contract', () => {
  describe('manifest metadata', () => {
    it('schemaVersion is 1.0.0', () => expect(manifest.schemaVersion).toBe('1.0.0'));
    it('edition is free', () => expect(manifest.edition).toBe('free'));
    it('sourcePack name is "KayKit: Medieval Hexagon Pack"', () =>
      expect(manifest.sourcePack.name).toBe('KayKit: Medieval Hexagon Pack'));
    it('sourcePack version is 1.0', () => expect(manifest.sourcePack.version).toBe('1.0'));
    it('sourcePack edition is free', () => expect(manifest.sourcePack.edition).toBe('free'));
    it('sourcePack creator credits Kay Lousberg', () =>
      expect(manifest.sourcePack.creator).toBe('Kay Lousberg'));
    it('asset license is CC0-1.0', () => expect(manifest.sourcePack.license).toBe('CC0-1.0'));
    it('licenseUrl points at CC0-1.0', () =>
      expect(manifest.sourcePack.licenseUrl).toBe(
        'https://creativecommons.org/publicdomain/zero/1.0/'
      ));

    it('total asset count is 221', () => expect(manifest.counts.total).toBe(221));
    it('assets array length matches counts.total', () =>
      expect(manifest.assets.length).toBe(manifest.counts.total));

    it.each(Object.entries(EXPECTED_CATEGORY_COUNTS))(
      'byCategory[%s] === %d',
      (key, expected) => expect(manifest.counts.byCategory[key]).toBe(expected)
    );
    it.each(Object.entries(EXPECTED_SUBCATEGORY_COUNTS))(
      'bySubcategory[%s] === %d',
      (key, expected) => expect(manifest.counts.bySubcategory[key]).toBe(expected)
    );

    it('byCategory keys exactly match expected set', () =>
      expect(Object.keys(manifest.counts.byCategory).sort()).toEqual(
        Object.keys(EXPECTED_CATEGORY_COUNTS).sort()
      ));
    it('bySubcategory keys exactly match expected set', () =>
      expect(Object.keys(manifest.counts.bySubcategory).sort()).toEqual(
        Object.keys(EXPECTED_SUBCATEGORY_COUNTS).sort()
      ));

    it('textureSets is exactly ["default"]', () =>
      expect(manifest.textureSets).toEqual(['default']));

    it('does not contain local references, NAS paths, or EXTRA source names', () =>
      expect(
        /references|\/Volumes\/home|KayKit_Medieval_Hexagon_Pack_1\.0_EXTRA/.test(
          JSON.stringify(manifest)
        )
      ).toBe(false));
  });

  describe('per-asset shape', () => {
    it('asset ids are unique', () => {
      const ids = new Set<string>();
      const dups: string[] = [];
      for (const a of manifest.assets) {
        if (ids.has(a.id)) dups.push(a.id);
        ids.add(a.id);
      }
      expect(dups, `duplicate ids: ${dups.join(', ')}`).toEqual([]);
      expect(ids.size).toBe(manifest.counts.total);
    });

    it('assetsById keys exactly match the asset id set', () => {
      const ids = new Set(manifest.assets.map((a) => a.id));
      expect(Object.keys(manifest.assetsById).sort()).toEqual([...ids].sort());
    });

    it.each(manifest.assets.map((a) => [a.id, a] as const))('%s', (id, asset) => {
      expect(manifest.assetsById[id]?.modelPath, `assetsById out of sync for ${id}`).toBe(
        asset.modelPath
      );
      expect(asset.edition).toBe('free');
      expect(asset.textureSet).toBe('default');
      expect(asset.modelPath.startsWith('assets/free/'), `${id} modelPath wrong root`).toBe(true);
      expect(asset.modelPath.endsWith('.gltf'), `${id} modelPath wrong suffix`).toBe(true);
      expect(asset.modelPath.includes('..'), `${id} modelPath traverses`).toBe(false);
      expect(asset.sourcePath.includes('..'), `${id} sourcePath traverses`).toBe(false);
      expect(asset.sourcePath.startsWith('/'), `${id} sourcePath absolute`).toBe(false);
      expect(asset.bufferPaths.length, `${id} needs at least one buffer`).toBeGreaterThan(0);
      expect(asset.texturePaths.length, `${id} needs at least one texture`).toBeGreaterThan(0);
      expect(asset.materialSlots.length, `${id} needs material slots`).toBeGreaterThan(0);

      for (const path of [asset.modelPath, ...asset.bufferPaths, ...asset.texturePaths]) {
        expect(path.startsWith('assets/free/'), `${id}: ${path} outside assets/free`).toBe(true);
        expect(path.includes('..'), `${id}: ${path} traverses`).toBe(false);
      }

      expect(asset.fileSizeBytes, `${id} fileSizeBytes must be positive`).toBeGreaterThan(0);

      // Bounds
      for (const key of ['min', 'max', 'size'] as const) {
        expect(asset.bounds[key].length, `${id} bounds.${key} length`).toBe(3);
        for (const value of asset.bounds[key]) {
          expect(Number.isFinite(value), `${id} bounds.${key} not finite: ${value}`).toBe(true);
        }
      }
      for (const index of [0, 1, 2] as const) {
        const expectedSize = asset.bounds.max[index] - asset.bounds.min[index];
        expect(
          Math.abs(asset.bounds.size[index] - expectedSize) <= BOUNDS_TOLERANCE,
          `${id} bounds.size[${index}] vs min/max delta`
        ).toBe(true);
        expect(asset.bounds.size[index], `${id} bounds.size[${index}] negative`).toBeGreaterThanOrEqual(
          0
        );
      }
      expect(Math.max(...asset.bounds.size), `${id} bounds collapsed`).toBeGreaterThan(0);

      // Faction
      if (asset.category === 'buildings') {
        if ((FACTIONS as readonly string[]).includes(asset.subcategory)) {
          expect(asset.faction, `${id} building faction must match subcategory`).toBe(
            asset.subcategory
          );
        } else {
          expect(asset.faction, `${id} neutral building must not have faction`).toBeUndefined();
        }
      } else if (
        asset.category === 'decoration' &&
        asset.subcategory === 'props' &&
        /^flag_(blue|green|red|yellow)$/.test(asset.id)
      ) {
        expect(asset.faction).toBe(asset.id.slice('flag_'.length));
      } else {
        expect(asset.faction, `${id} non-building asset must not have faction`).toBeUndefined();
      }
    });
  });

  describe('NOTICE.md attribution', () => {
    const notice = readFileSync(resolve(repoRoot, 'NOTICE.md'), 'utf8');

    it.each([
      ['MIT'],
      ['Kay Lousberg'],
      ['KayKit'],
      ['CC0-1.0'],
      ['https://creativecommons.org/publicdomain/zero/1.0/'],
    ])('mentions %s', (snippet) => {
      expect(notice).toContain(snippet);
    });
  });
});
