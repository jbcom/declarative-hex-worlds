import { describe, expect, it } from 'vitest';
import { freeManifest } from '../../manifest/free';
import {
  createManifestBundle,
  getManifestAsset,
  inspectMedievalHexagonManifest,
  manifestAssetRequiresExtra,
  normalizeMedievalHexagonManifest,
  resolveManifestAssetUrl,
  selectManifestAssets,
  validateMedievalHexagonManifest,
} from '../../manifest/schema';
import type { MedievalHexagonAsset, MedievalHexagonManifest, PackEdition } from '../../types/index';

describe('free manifest', () => {
  it('contains the full FREE GLTF catalog', () => {
    expect(freeManifest.edition).toBe('free');
    expect(freeManifest.counts.total).toBe(221);
    expect(freeManifest.assets).toHaveLength(221);
    expect(freeManifest.textureSets).toEqual(['default']);
  });

  it('indexes assets by id', () => {
    expect(freeManifest.assetsById.hex_grass?.category).toBe('tiles');
    expect(freeManifest.assetsById.hex_road_A?.subcategory).toBe('roads');
    expect(freeManifest.assetsById.building_home_A_blue?.faction).toBe('blue');
    expect(freeManifest.assetsById.crate_A_big?.category).toBe('decoration');
  });

  it('records browser-loadable paths and bounds for every asset', () => {
    for (const asset of freeManifest.assets) {
      expect(asset.modelPath).toMatch(/^assets\/free\//);
      expect(asset.modelPath.endsWith('.gltf')).toBe(true);
      expect(asset.bufferPaths.length).toBeGreaterThan(0);
      expect(asset.texturePaths.length).toBeGreaterThan(0);
      expect(Math.max(...asset.bounds.size)).toBeGreaterThan(0);
    }
  });

  it('preserves KayKit license metadata', () => {
    expect(freeManifest.sourcePack.creator).toBe('Kay Lousberg');
    expect(freeManifest.sourcePack.license).toBe('CC0-1.0');
  });

  it('validates loaded manifest JSON and returns normalized indexes', () => {
    const inspection = inspectMedievalHexagonManifest(freeManifest);

    expect(inspection.errorCount).toBe(0);
    expect(inspection.warningCount).toBe(0);
    expect(inspection.manifest?.counts.total).toBe(221);
    expect(validateMedievalHexagonManifest(freeManifest)).toEqual([]);
  });

  it('normalizes manifest indexes and counts for loaded JSON manifests', () => {
    const manifest = manifestFixture('free', [
      assetFixture({ id: 'hex_grass', edition: 'free', category: 'tiles', subcategory: 'base' }),
      assetFixture({ id: 'building_home_A_blue', edition: 'free', category: 'buildings', subcategory: 'blue' }),
    ]);

    const normalized = normalizeMedievalHexagonManifest({
      ...manifest,
      assetsById: {},
      counts: { total: 0, byCategory: {}, bySubcategory: {} },
    });

    expect(normalized.counts.total).toBe(2);
    expect(normalized.counts.byCategory).toEqual({ tiles: 1, buildings: 1 });
    expect(normalized.counts.bySubcategory).toEqual({ 'tiles/base': 1, 'buildings/blue': 1 });
    expect(normalized.assetsById.hex_grass?.id).toBe('hex_grass');
  });

  it('combines FREE and local EXTRA manifests for app-side asset lookup', () => {
    const free = manifestFixture('free', [
      assetFixture({ id: 'hex_grass', edition: 'free', category: 'tiles', subcategory: 'base' }),
      assetFixture({ id: 'unit_blue_full', edition: 'free', category: 'units', subcategory: 'blue', unitStyle: 'full' }),
    ]);
    const extra = manifestFixture('extra', [
      assetFixture({ id: 'unit_blue_full', edition: 'extra', category: 'units', subcategory: 'blue', unitStyle: 'full' }),
      assetFixture({ id: 'hex_transition', edition: 'extra', category: 'tiles', subcategory: 'transitions' }),
    ]);

    const bundle = createManifestBundle([free, extra], { duplicatePreference: 'extra' });

    expect(bundle.editions).toEqual(['free', 'extra']);
    expect(bundle.counts.total).toBe(3);
    expect(bundle.duplicateAssetIds).toEqual(['unit_blue_full']);
    expect(getManifestAsset(bundle, 'unit_blue_full')?.edition).toBe('extra');
    expect(manifestAssetRequiresExtra(bundle, 'unit_blue_full')).toBe(true);
    expect(manifestAssetRequiresExtra(bundle, 'hex_grass')).toBe(false);
    expect(selectManifestAssets(bundle, { editions: ['extra'], categories: ['tiles'] }).map((asset) => asset.id)).toEqual([
      'hex_transition',
    ]);
  });

  it('resolves manifest asset URLs for package and local-ingest roots', () => {
    const freeAsset = assetFixture({
      id: 'hex_grass',
      edition: 'free',
      category: 'tiles',
      subcategory: 'base',
      modelPath: 'assets/free/tiles/base/hex_grass.gltf',
    });
    const extraAsset = assetFixture({
      id: 'hex_transition',
      edition: 'extra',
      category: 'tiles',
      subcategory: 'transitions',
      modelPath: 'assets/extra/tiles/transitions/hex_transition.gltf',
    });

    expect(resolveManifestAssetUrl(freeAsset)).toBe('assets/free/tiles/base/hex_grass.gltf');
    expect(resolveManifestAssetUrl(freeAsset, { baseUrl: '/vendor/kaykit' })).toBe(
      '/vendor/kaykit/assets/free/tiles/base/hex_grass.gltf'
    );
    expect(
      resolveManifestAssetUrl(extraAsset, {
        editionBaseUrls: {
          extra: '/local/kaykit-extra',
        },
      })
    ).toBe('/local/kaykit-extra/assets/extra/tiles/transitions/hex_transition.gltf');
  });

  it('reports manifest errors and stale generated indexes for app-local ingest', () => {
    const staleManifest = {
      ...manifestFixture('extra', [
        assetFixture({ id: 'hex_transition', edition: 'extra', category: 'tiles', subcategory: 'transitions' }),
      ]),
      assetsById: {},
      counts: { total: 0, byCategory: {}, bySubcategory: {} },
    };
    const invalidManifest = {
      ...staleManifest,
      assets: [
        staleManifest.assets[0],
        {
          ...staleManifest.assets[0],
          id: 'hex_transition',
          edition: 'free',
          category: 'bad-category',
          bounds: { min: [0, 0], max: [1, 1, 1], size: [0, 0, 0] },
        },
      ],
    };

    expect(validateMedievalHexagonManifest(staleManifest).map((issue) => issue.code)).toEqual([
      'manifest.counts_stale',
      'manifest.assets_by_id_stale',
    ]);
    expect(validateMedievalHexagonManifest(invalidManifest).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'manifest.asset_duplicate',
        'manifest.asset_edition_mismatch',
        'manifest.asset_category',
        'manifest.asset_bounds_vector',
      ])
    );
    expect(inspectMedievalHexagonManifest(invalidManifest).manifest).toBeUndefined();
  });

  it('enforces source-pack edition separation for local manifests', () => {
    const manifest = manifestFixture('extra', [
      assetFixture({ id: 'hex_transition', edition: 'extra', category: 'tiles', subcategory: 'transitions' }),
    ]);

    expect(
      validateMedievalHexagonManifest({
        ...manifest,
        sourcePack: { ...manifest.sourcePack, edition: 'free' },
      }).map((issue) => issue.code)
    ).toContain('manifest.source_pack_edition_mismatch');
  });
});

function manifestFixture(
  edition: PackEdition,
  assets: readonly MedievalHexagonAsset[]
): MedievalHexagonManifest {
  return {
    schemaVersion: '1.0.0',
    generatedAt: '2026-05-22T00:00:00.000Z',
    edition,
    sourcePack: {
      name: 'KayKit: Medieval Hexagon Pack',
      version: '1.0',
      edition,
      creator: 'Kay Lousberg',
      license: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceRootName: `fixture-${edition}`,
    },
    textureSets: ['default'],
    assets,
    assetsById: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    counts: {
      total: assets.length,
      byCategory: {},
      bySubcategory: {},
    },
  };
}

function assetFixture(
  overrides: Partial<MedievalHexagonAsset> & Pick<MedievalHexagonAsset, 'id' | 'edition' | 'category' | 'subcategory'>
): MedievalHexagonAsset {
  return {
    family: overrides.id,
    faction: undefined,
    unitStyle: undefined,
    textureSet: 'default',
    modelPath: `assets/${overrides.edition}/${overrides.category}/${overrides.subcategory}/${overrides.id}.gltf`,
    sourcePath: `${overrides.category}/${overrides.subcategory}/${overrides.id}.gltf`,
    bufferPaths: [],
    texturePaths: [],
    materialSlots: [],
    bounds: { min: [0, 0, 0], max: [1, 1, 1], size: [1, 1, 1] },
    fileSizeBytes: 1,
    ...overrides,
  };
}
