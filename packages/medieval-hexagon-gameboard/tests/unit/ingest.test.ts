import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { generateManifestFromSource, validateSourceRoot, writeManifestModule } from '../../src/ingest';

const freeSourceRoot = resolve('../../references/KayKit_Medieval_Hexagon_Pack_1.0_FREE');
const extraSourceRoot = resolve('../../references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA');

describe('source ingestion', () => {
  it('validates the local FREE source count', () => {
    const result = validateSourceRoot(freeSourceRoot, 'free');
    expect(result).toMatchObject({
      edition: 'free',
      gltfCount: 221,
      expectedCount: 221,
      ok: true,
    });
  });

  it('generates a manifest from the FREE source', () => {
    const manifest = generateManifestFromSource({
      sourceRoot: freeSourceRoot,
      edition: 'free',
      assetBasePath: 'assets/free',
    });
    expect(manifest.counts.total).toBe(221);
    expect(manifest.assetsById.hex_water.category).toBe('tiles');
  });

  it('writes manifest modules with edition-specific export names', () => {
    const manifest = generateManifestFromSource({
      sourceRoot: freeSourceRoot,
      edition: 'free',
      assetBasePath: 'assets/free',
    });
    const tempRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-ingest-'));
    try {
      const freeModulePath = join(tempRoot, 'free.ts');
      const extraModulePath = join(tempRoot, 'extra.ts');
      writeManifestModule(manifest, freeModulePath);
      writeManifestModule(
        {
          ...manifest,
          edition: 'extra',
          sourcePack: { ...manifest.sourcePack, edition: 'extra' },
        },
        extraModulePath,
        { typeImportPath: '@jbcom/medieval-hexagon-gameboard' }
      );

      expect(readFileSync(freeModulePath, 'utf8')).toContain('export const freeManifest: MedievalHexagonManifest');
      expect(readFileSync(extraModulePath, 'utf8')).toContain('export const extraManifest: MedievalHexagonManifest');
      expect(readFileSync(extraModulePath, 'utf8')).toContain("from \"@jbcom/medieval-hexagon-gameboard\"");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('rejects invalid manifest module export names', () => {
    const manifest = generateManifestFromSource({
      sourceRoot: freeSourceRoot,
      edition: 'free',
      assetBasePath: 'assets/free',
    });
    expect(() => writeManifestModule(manifest, join(tmpdir(), 'bad.ts'), { exportName: 'bad-name' })).toThrow(
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
    expect(manifest.assetsById.hex_transition.category).toBe('tiles');
    expect(manifest.assetsById.unit_blue_full.unitStyle).toBe('full');
    expect(manifest.assetsById.unit_blue_accent.unitStyle).toBe('accent');
  });
});
