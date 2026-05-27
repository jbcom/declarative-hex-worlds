import { describe, expect, it } from 'vitest';
import { freeManifest, loadFreeManifest } from '../../manifest/free';
import {
  createManifestBundle,
  getManifestAsset,
  hasManifestAsset,
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

  it('loadFreeManifest resolves to the identity-stable eager export (PRD B2b)', async () => {
    const loaded = await loadFreeManifest();
    expect(loaded).toBe(freeManifest);
    // Stable across calls — same reference every time.
    const second = await loadFreeManifest();
    expect(second).toBe(loaded);
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

  it('reports asset_field + asset_array_field for malformed asset (E0a)', () => {
    const manifest = manifestFixture('free', []);
    const malformed = {
      id: 'malformed',
      category: 'tiles',
      textureSet: 'default',
      edition: 'free',
      // Missing subcategory/family/modelPath/sourcePath (non-empty strings).
      // Missing bufferPaths/texturePaths/materialSlots (arrays).
      bounds: { min: [0, 0, 0], max: [1, 1, 1], size: [1, 1, 1] },
      fileSizeBytes: 0,
    };
    const codes = validateMedievalHexagonManifest({
      ...manifest,
      // biome-ignore lint/suspicious/noExplicitAny: deliberately-malformed asset
      assets: [malformed as any],
    }).map((i) => i.code);
    expect(codes).toContain('manifest.asset_field');
    expect(codes).toContain('manifest.asset_array_field');
  });

  it('reports invalid textureSet entries (E0a)', () => {
    const manifest = manifestFixture('free', [
      assetFixture({ id: 'hex_grass', edition: 'free', category: 'tiles', subcategory: 'base' }),
    ]);
    const codes = validateMedievalHexagonManifest({
      ...manifest,
      // biome-ignore lint/suspicious/noExplicitAny: deliberately-invalid textureSet
      textureSets: ['default', 'not-a-supported-texture-set' as any],
    }).map((i) => i.code);
    expect(codes).toContain('manifest.texture_set');
  });

  it('reports non-object asset entries + missing asset id (E0a)', () => {
    const manifest = manifestFixture('free', []);
    const codes = validateMedievalHexagonManifest({
      ...manifest,
      // biome-ignore lint/suspicious/noExplicitAny: deliberately-invalid asset entry
      assets: [42 as any, { /* no id */ } as any],
    }).map((i) => i.code);
    expect(codes).toContain('manifest.asset_object');
    expect(codes).toContain('manifest.asset_id');
  });

  it('warns on missing/malformed counts + assetsById (E0b)', () => {
    const manifest = manifestFixture('free', [
      assetFixture({ id: 'hex_grass', edition: 'free', category: 'tiles', subcategory: 'base' }),
    ]);
    // validateMedievalHexagonManifest accepts `unknown` — no cast needed.
    const missingCounts = validateMedievalHexagonManifest({
      ...manifest,
      counts: undefined,
    }).map((i) => i.code);
    expect(missingCounts).toContain('manifest.counts');

    const missingAssetsById = validateMedievalHexagonManifest({
      ...manifest,
      assetsById: 'not-an-object',
    }).map((i) => i.code);
    expect(missingAssetsById).toContain('manifest.assets_by_id');
  });

  it('inspectMedievalHexagonManifest rejects non-object input + missing assets array (PRD E0g)', () => {
    // Non-object → manifest.object error.
    const fromString = inspectMedievalHexagonManifest('not an object');
    expect(fromString.manifest).toBeUndefined();
    expect(fromString.issues.map((i) => i.code)).toContain('manifest.object');

    // Object without `assets` array → manifest.assets error.
    const missingAssets = inspectMedievalHexagonManifest({ schemaVersion: '1.0.0' });
    expect(missingAssets.issues.map((i) => i.code)).toContain('manifest.assets');

    // null + undefined → manifest.object.
    expect(inspectMedievalHexagonManifest(null).issues.map((i) => i.code)).toContain('manifest.object');
    expect(inspectMedievalHexagonManifest(undefined).issues.map((i) => i.code)).toContain('manifest.object');
  });
});

describe('selectManifestAssets filter branches (PRD E0h)', () => {
  it('filters by explicit ids', () => {
    const first = freeManifest.assets[0];
    if (!first) throw new Error('manifest empty');
    const result = selectManifestAssets(freeManifest, { ids: [first.id] });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(first.id);
  });

  it('returns empty when id filter matches nothing', () => {
    expect(selectManifestAssets(freeManifest, { ids: ['no-such-id'] })).toEqual([]);
  });

  it('filters by subcategories', () => {
    const some = freeManifest.assets.find((a) => a.subcategory !== undefined);
    if (!some?.subcategory) throw new Error('no subcategorized asset');
    const result = selectManifestAssets(freeManifest, { subcategories: [some.subcategory] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((a) => a.subcategory === some.subcategory)).toBe(true);
  });

  it('filters by families', () => {
    const some = freeManifest.assets.find((a) => a.family !== undefined);
    if (!some?.family) throw new Error('no family asset');
    const result = selectManifestAssets(freeManifest, { families: [some.family] });
    expect(result.length).toBeGreaterThan(0);
  });

  it('filters by textureSets', () => {
    const result = selectManifestAssets(freeManifest, { textureSets: ['default'] });
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((a) => a.textureSet === 'default')).toBe(true);
  });

  it('returns empty when textureSets filter excludes everything (E0b)', () => {
    // Forces the early-return false branch at schema.ts line 333.
    const result = selectManifestAssets(freeManifest, { textureSets: ['nonexistent-set'] });
    expect(result).toEqual([]);
  });

  it('rejects assets missing a faction when factions filter is set', () => {
    // Some FREE assets have faction undefined; the filter should exclude them.
    const result = selectManifestAssets(freeManifest, { factions: ['blue'] });
    expect(result.every((a) => a.faction === 'blue')).toBe(true);
  });

  it('rejects assets missing a unitStyle when unitStyles filter is set', () => {
    const result = selectManifestAssets(freeManifest, { unitStyles: ['accent'] });
    expect(result.every((a) => a.unitStyle === 'accent')).toBe(true);
  });
});

describe('createManifestBundle duplicatePreference variants (PRD E0a)', () => {
  it('prefers the first occurrence when duplicatePreference="first"', () => {
    const free = manifestFixture('free', [
      assetFixture({ id: 'shared', edition: 'free', category: 'tiles', subcategory: 'base' }),
    ]);
    const extra = manifestFixture('extra', [
      assetFixture({ id: 'shared', edition: 'extra', category: 'tiles', subcategory: 'base' }),
    ]);
    const bundle = createManifestBundle([free, extra], { duplicatePreference: 'first' });
    expect(getManifestAsset(bundle, 'shared')?.edition).toBe('free');
  });

  it('prefers the last occurrence when duplicatePreference="last"', () => {
    const free = manifestFixture('free', [
      assetFixture({ id: 'shared', edition: 'free', category: 'tiles', subcategory: 'base' }),
    ]);
    const extra = manifestFixture('extra', [
      assetFixture({ id: 'shared', edition: 'extra', category: 'tiles', subcategory: 'base' }),
    ]);
    const bundle = createManifestBundle([free, extra], { duplicatePreference: 'last' });
    expect(getManifestAsset(bundle, 'shared')?.edition).toBe('extra');
  });

  it('prefers the FREE edition when duplicatePreference="free" (E0a)', () => {
    const free = manifestFixture('free', [
      assetFixture({ id: 'shared', edition: 'free', category: 'tiles', subcategory: 'base' }),
    ]);
    const extra = manifestFixture('extra', [
      assetFixture({ id: 'shared', edition: 'extra', category: 'tiles', subcategory: 'base' }),
    ]);
    // Insert extra first so the duplicate-pref branch fires (existing.edition !== 'free' && next.edition === 'free').
    const bundle = createManifestBundle([extra, free], { duplicatePreference: 'free' });
    expect(getManifestAsset(bundle, 'shared')?.edition).toBe('free');
  });
});

describe('hasManifestAsset (PRD E0g)', () => {
  it('returns true for an asset id present in the FREE manifest', () => {
    // Pull any known asset id off the FREE manifest to avoid hardcoding.
    const firstAsset = freeManifest.assets[0];
    if (firstAsset === undefined) {
      throw new Error('FREE manifest is empty — fixture invariant broken');
    }
    expect(hasManifestAsset(freeManifest, firstAsset.id)).toBe(true);
  });

  it('returns false for an unknown asset id', () => {
    expect(hasManifestAsset(freeManifest, 'definitely-not-a-real-asset-id')).toBe(false);
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
