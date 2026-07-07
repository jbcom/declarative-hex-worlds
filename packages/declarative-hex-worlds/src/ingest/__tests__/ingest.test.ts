import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  copyGltfTree,
  defaultSourceRoot,
  generateManifestFromSource,
  validateSourceRoot,
  writeManifestJson,
  writeManifestModule,
} from '../../ingest';
import { freeManifest } from '../../manifest/free';
import { validateMedievalHexagonManifest } from '../../manifest/schema';

const freeSourceRoot = resolve('../../references/KayKit_Medieval_Hexagon_Pack_1.0_FREE');
const extraSourceRoot = resolve('../../references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA');
const hasFreeSource = existsSync(join(freeSourceRoot, 'Assets', 'gltf'));

describe('source ingestion', () => {
  it('reports missing source roots without throwing', () => {
    const result = validateSourceRoot(join(tmpdir(), 'missing-kaykit-source'), 'free');
    expect(result).toMatchObject({
      edition: 'free',
      gltfCount: 0,
      expectedCount: 221,
      ok: false,
    });
  });

  it('throws a typed ingest error when manifest generation has no GLTF root', () => {
    expect(() =>
      generateManifestFromSource({ sourceRoot: join(tmpdir(), 'missing-kaykit-manifest-source'), edition: 'free' })
    ).toThrow(/Missing GLTF source directory/);
  });

  it.skipIf(!hasFreeSource)('validates the local FREE source count', () => {
    const result = validateSourceRoot(freeSourceRoot, 'free');
    expect(result).toMatchObject({
      edition: 'free',
      gltfCount: 221,
      expectedCount: 221,
      ok: true,
    });
  });

  it.skipIf(!hasFreeSource)('generates a manifest from the FREE source', () => {
    const manifest = generateManifestFromSource({
      sourceRoot: freeSourceRoot,
      edition: 'free',
    });
    expect(manifest.counts.total).toBe(221);
    expect(manifest.assetsById.hex_water?.category).toBe('tiles');
  });

  it('writes manifest modules with edition-specific export names', () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-ingest-'));
    try {
      const freeModulePath = join(tempRoot, 'free.ts');
      const extraModulePath = join(tempRoot, 'extra.ts');
      writeManifestModule(freeManifest, freeModulePath);
      writeManifestModule(
        {
          ...freeManifest,
          edition: 'extra',
          sourcePack: { ...freeManifest.sourcePack, edition: 'extra' },
        },
        extraModulePath,
        { typeImportPath: 'declarative-hex-worlds' }
      );

      expect(readFileSync(freeModulePath, 'utf8')).toContain('export const freeManifest: MedievalHexagonManifest');
      expect(readFileSync(extraModulePath, 'utf8')).toContain('export const extraManifest: MedievalHexagonManifest');
      expect(readFileSync(extraModulePath, 'utf8')).toContain("from 'declarative-hex-worlds'");

      const manifestJsonPath = join(tempRoot, 'manifest.json');
      writeManifestJson(freeManifest, manifestJsonPath);
      expect(readFileSync(manifestJsonPath, 'utf8')).toMatch(/^\{\n[\s\S]*\}\n$/);
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects invalid manifest module export names', () => {
    expect(() => writeManifestModule(freeManifest, join(tmpdir(), 'bad.ts'), { exportName: 'bad-name' })).toThrow(
      /Invalid manifest module export name/
    );
  });

  it.skipIf(!existsSync(extraSourceRoot))('validates the local EXTRA source count and textures', () => {
    const result = validateSourceRoot(extraSourceRoot, 'extra');
    expect(result).toMatchObject({
      edition: 'extra',
      gltfCount: 404,
      expectedCount: 404,
      ok: true,
    });

    const manifest = generateManifestFromSource({
      sourceRoot: extraSourceRoot,
      edition: 'extra',
    });
    expect(manifest.textureSets).toEqual(['default', 'fall', 'summer', 'winter']);
    expect(manifest.assets).toHaveLength(404);
    expect(Object.keys(manifest.assetsById)).toHaveLength(404);
    expect(manifest.assetsById.hex_transition?.category).toBe('tiles');
    expect(manifest.assetsById.unit_blue_full?.unitStyle).toBe('full');
    expect(manifest.assetsById.unit_blue_accent?.unitStyle).toBe('accent');
    expect(manifest.assetsById.projectile_catapult?.sourcePath).toBe('buildings/neutral/projectile_catapult.gltf');
    expect(manifest.assetsById.units_neutral_projectile_catapult).toMatchObject({
      family: 'projectile_catapult',
      sourcePath: 'units/neutral/projectile_catapult.gltf',
      unitStyle: 'neutral',
    });
    expect(validateMedievalHexagonManifest(manifest).map((issue) => issue.code)).not.toContain(
      'manifest.asset_duplicate'
    );
  });

  it('defaultSourceRoot resolves both edition suffixes (PRD E0h)', () => {
    const cwd = '/some/repo/root';
    expect(defaultSourceRoot('free', cwd)).toBe(
      resolve(cwd, 'references/KayKit_Medieval_Hexagon_Pack_1.0_FREE')
    );
    expect(defaultSourceRoot('extra', cwd)).toBe(
      resolve(cwd, 'references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA')
    );
  });

  it('copyGltfTree throws GameboardIoError when source missing (PRD E0h)', () => {
    const missingRoot = join(tmpdir(), 'medieval-hexagon-missing-source-root');
    const destRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-copy-dest-'));
    try {
      expect(() => copyGltfTree(missingRoot, destRoot)).toThrow(/Missing GLTF source directory/);
    } finally {
      rmSync(destRoot, { recursive: true, force: true });
    }
  });

  it('copyGltfTree mirrors a synthetic source GLTF tree into the destination (E0h)', () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-copy-source-'));
    const destRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-copy-dest2-'));
    try {
      const gltfRoot = join(sourceRoot, 'Assets', 'gltf');
      mkdirSync(join(gltfRoot, 'tiles/base'), { recursive: true });
      writeFileSync(join(gltfRoot, 'tiles/base/hex_grass.gltf'), '{"asset":{"version":"2.0"}}');
      writeFileSync(join(gltfRoot, 'tiles/base/hex_grass.bin'), Buffer.from([1, 2]));
      copyGltfTree(sourceRoot, destRoot);
      expect(existsSync(join(destRoot, 'tiles/base/hex_grass.gltf'))).toBe(true);
      expect(existsSync(join(destRoot, 'tiles/base/hex_grass.bin'))).toBe(true);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(destRoot, { recursive: true, force: true });
    }
  });

  it('generates synthetic manifests with duplicate suffixes and sparse GLTF metadata', () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-ingest-source-'));
    try {
      writeSyntheticGltf(sourceRoot, 'tiles/base/hex_duplicate.gltf');
      writeSyntheticGltf(sourceRoot, 'tiles/base/nested/hex_duplicate.gltf');
      writeSyntheticGltf(sourceRoot, 'tiles/base/other/hex_duplicate.gltf');
      writeSyntheticGltf(sourceRoot, 'tiles/base/z/hex_duplicate.gltf');
      writeSyntheticGltf(sourceRoot, 'tiles/hex_root.gltf');
      writeFileSync(join(sourceRoot, 'Assets/gltf/tiles/base/hex_bounds.bin'), '');
      writeSyntheticGltf(sourceRoot, 'tiles/base/hex_bounds.gltf', {
        buffers: [{ uri: 'hex_bounds.bin' }, {}],
        images: [{ uri: 'hex_bounds.png' }, {}],
        materials: [{ name: 'stone' }, {}],
        accessors: [{}, { min: [-1], max: [1] }, { min: [-2, 0.25, -3], max: [2, 1.5, 4] }],
        meshes: [
          {},
          {
            primitives: [
              {},
              { attributes: { POSITION: 0 } },
              { attributes: { POSITION: 1 } },
              { attributes: { POSITION: 2 } },
            ],
          },
        ],
      });
      writeSyntheticGltf(sourceRoot, 'units/blue/unit_knight_blue_accent.gltf');
      writeSyntheticGltf(sourceRoot, 'units/neutral/unit_monk.gltf');
      writeSyntheticGltf(sourceRoot, 'units/neutral/unit_monk_full.gltf');

      const manifest = generateManifestFromSource({
        sourceRoot,
        edition: 'extra',
        generatedAt: '2026-06-26T00:00:00.000Z',
      });

      expect(manifest.textureSets).toEqual(['default']);
      expect(manifest.assetsById.hex_duplicate?.sourcePath).toBe('tiles/base/hex_duplicate.gltf');
      expect(manifest.assetsById.tiles_base_hex_duplicate?.sourcePath).toBe(
        'tiles/base/nested/hex_duplicate.gltf'
      );
      expect(manifest.assetsById.tiles_base_hex_duplicate_2?.sourcePath).toBe(
        'tiles/base/other/hex_duplicate.gltf'
      );
      expect(manifest.assetsById.tiles_base_hex_duplicate_3?.sourcePath).toBe(
        'tiles/base/z/hex_duplicate.gltf'
      );
      expect(manifest.assetsById.hex_bounds).toMatchObject({
        bufferPaths: ['tiles/base/hex_bounds.bin'],
        texturePaths: ['tiles/base/hex_bounds.png'],
        materialSlots: ['stone', 'material_1'],
        bounds: { min: [-2, 0.25, -3], max: [2, 1.5, 4], size: [4, 1.25, 7] },
      });
      expect(manifest.assetsById.hex_root?.subcategory).toBe('hex_root.gltf');
      expect(manifest.assetsById.unit_knight_blue_accent).toMatchObject({
        faction: 'blue',
        family: 'unit_knight',
        unitStyle: 'accent',
      });
      expect(manifest.assetsById.unit_monk).toMatchObject({
        family: 'unit_monk',
        unitStyle: 'neutral',
      });
      expect(manifest.assetsById.unit_monk_full).toMatchObject({
        family: 'unit_monk',
        unitStyle: 'full',
      });
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });

  it('detects optional texture sets from a partial texture directory', () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-texture-source-'));
    try {
      mkdirSync(join(sourceRoot, 'Textures'), { recursive: true });
      writeFileSync(join(sourceRoot, 'Textures/hexagons_medieval_Fall.png'), '');
      writeFileSync(join(sourceRoot, 'Textures/hexagons_medieval_Summer.png'), '');
      writeFileSync(join(sourceRoot, 'Textures/hexagons_medieval_Winter.png'), '');
      writeFileSync(join(sourceRoot, 'Textures/ignored.png'), '');
      writeSyntheticGltf(sourceRoot, 'tiles/base/hex_grass.gltf');

      expect(generateManifestFromSource({ sourceRoot, edition: 'extra' }).textureSets).toEqual([
        'default',
        'fall',
        'summer',
        'winter',
      ]);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });

  it('rejects unsupported source categories before manifest emission', () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-bad-category-'));
    try {
      writeSyntheticGltf(sourceRoot, 'misc/root/unknown.gltf');

      expect(() => generateManifestFromSource({ sourceRoot, edition: 'extra' })).toThrow(
        /Unsupported asset category: misc/
      );
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
    }
  });

  it('skips symlinked files while validating and copying source trees', () => {
    const sourceRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-symlink-source-'));
    const destRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-symlink-dest-'));
    try {
      writeSyntheticGltf(sourceRoot, 'tiles/base/hex_safe.gltf');
      const outsideTarget = join(sourceRoot, '..', 'outside-root-target.gltf');
      writeFileSync(outsideTarget, '{}');
      symlinkSync(outsideTarget, join(sourceRoot, 'Assets/gltf/tiles/base/hex_leak.gltf'));

      expect(validateSourceRoot(sourceRoot, 'free')).toMatchObject({ gltfCount: 1, ok: false });
      copyGltfTree(sourceRoot, destRoot);
      expect(existsSync(join(destRoot, 'tiles/base/hex_safe.gltf'))).toBe(true);
      expect(existsSync(join(destRoot, 'tiles/base/hex_leak.gltf'))).toBe(false);
    } finally {
      rmSync(sourceRoot, { recursive: true, force: true });
      rmSync(destRoot, { recursive: true, force: true });
    }
  });
});

function writeSyntheticGltf(
  sourceRoot: string,
  relativePath: string,
  document: Record<string, unknown> = {}
): void {
  const filePath = join(sourceRoot, 'Assets/gltf', relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(document), 'utf8');
}
