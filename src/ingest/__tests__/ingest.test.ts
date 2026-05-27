import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  copyGltfTree,
  defaultSourceRoot,
  generateManifestFromSource,
  validateSourceRoot,
  writeManifestModule,
} from '../../ingest/index';
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
      assetBasePath: 'assets/free',
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
        { typeImportPath: '@jbcom/medieval-hexagon-gameboard' }
      );

      expect(readFileSync(freeModulePath, 'utf8')).toContain('export const freeManifest: MedievalHexagonManifest');
      expect(readFileSync(extraModulePath, 'utf8')).toContain('export const extraManifest: MedievalHexagonManifest');
      expect(readFileSync(extraModulePath, 'utf8')).toContain("from '@jbcom/medieval-hexagon-gameboard'");
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
      assetBasePath: 'assets/extra',
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
});
