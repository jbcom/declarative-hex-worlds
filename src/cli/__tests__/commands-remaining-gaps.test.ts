import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run as runCompatibility } from '../commands/compatibility';
import { run as runDeclarations } from '../commands/declarations';
import { run as runDoctor } from '../commands/doctor';
import { run as runExtract } from '../commands/extract';
import { run as runGuideApis } from '../commands/guide-apis';
import { run as runGuideRoles } from '../commands/guide-roles';
import { run as runGuideUsages } from '../commands/guide-usages';
import { run as runValidateManifest } from '../commands/validate-manifest';
import { run as runValidatePlan } from '../commands/validate-plan';
import { run as runValidateRecipe } from '../commands/validate-recipe';

describe('remaining CLI branch gaps (PRD E0a/E0h)', () => {
  let root: string;
  let previousOutRoot: string | undefined;
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hex-worlds-cli-gaps-'));
    previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = root;
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    if (previousOutRoot === undefined) {
      delete process.env.HEX_WORLDS_OUT_ROOT;
    } else {
      process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
    }
    rmSync(root, { recursive: true, force: true });
  });

  it('prints readable guide summaries and exits on missing catalog assets', async () => {
    await runGuideApis({ command: 'guide-apis', flags: {} }, '/missing-source', 'free');
    await runGuideRoles({ command: 'guide-roles', flags: {} }, '/missing-source', 'free');
    await runGuideUsages({ command: 'guide-usages', flags: {} }, '/missing-source', 'free');
    await runGuideUsages({ command: 'guide-usages', flags: { editionScope: 'free', json: true } }, '/missing-source', 'free');
    await runGuideUsages({ command: 'guide-usages', flags: { assetId: 'barrel' } }, '/missing-source', 'free');
    await expect(
      runGuideUsages({ command: 'guide-usages', flags: { page: '9999' } }, '/missing-source', 'free')
    ).rejects.toThrow(/guide-usages selection did not match/);

    const manifestPath = writeJson('empty-manifest.json', emptyManifest());
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    try {
      await expect(
        runGuideUsages(
          { command: 'guide-usages', flags: { manifest: manifestPath, role: 'prop' } },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }

    const joined = logs.join('\n');
    expect(joined).toContain('guide public APIs:');
    expect(joined).toContain('guide public roles:');
    expect(joined).toContain('guide usage rows:');
    expect(joined).toMatch(/\.\.\.[0-9]+ more/);
    expect(joined).toContain('missing assets:');
    expect(joined).toContain('  - ');
  });

  it('covers source-root success and validation exit paths', async () => {
    const sourceRoot = writeSyntheticSourceRoot('source-root');
    await runDoctor({ command: 'doctor', flags: {} }, sourceRoot, 'free');
    await runExtract({ command: 'extract', flags: { out: 'extract-out', force: true } }, sourceRoot, 'free');
    await runDeclarations({ command: 'declarations', flags: {} }, sourceRoot, 'free');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    try {
      await expect(
        runCompatibility(
          {
            command: 'compatibility',
            flags: { asset: writeGltf('flat.gltf', [0, 0, 0], [0, 0.5, 0]), id: 'flat' },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      await expect(
        runValidatePlan(
          {
            command: 'validate-plan',
            flags: { plan: writeJson('invalid-plan.json', invalidPlan()), allowUnknownAssets: true },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      await expect(
        runValidateRecipe(
          {
            command: 'validate-recipe',
            flags: { recipe: writeJson('invalid-recipe.json', invalidRecipe()) },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      await expect(
        runValidateManifest(
          { command: 'validate-manifest', flags: { manifest: writeJson('invalid-manifest.json', []) } },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }

    expect(logs.join('\n')).toContain('Extracted 1 free assets to');
  });

  function writeSyntheticSourceRoot(name: string): string {
    writeGltf(`${name}/Assets/gltf/tiles/hex_fixture.gltf`, [-0.5, 0, -0.5], [0.5, 0.25, 0.5]);
    return resolve(root, name);
  }

  function writeGltf(
    relativePath: string,
    min: [number, number, number],
    max: [number, number, number]
  ): string {
    return writeJson(relativePath, { asset: { version: '2.0' }, accessors: [{ min, max }], buffers: [{ uri: 'fixture.bin', byteLength: 0 }], materials: [{ name: 'fixture_material' }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }] });
  }

  function writeJson(name: string, payload: unknown): string {
    const path = resolve(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return path;
  }

  function emptyManifest(): unknown {
    return {
      schemaVersion: '1.0.0',
      edition: 'free',
      sourcePack: { name: 'Fixture', version: '1.0.0', creator: 'Fixture', license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceRootName: 'fixture', edition: 'free' },
      textureSets: [],
      assets: [],
      assetsById: {},
      counts: { total: 0, byCategory: {}, bySubcategory: {} },
    };
  }

  function invalidPlan(): unknown {
    return {
      schemaVersion: '1.0.0',
      seed: 'invalid-plan',
      shape: { kind: 'rectangle', width: 1, height: 1 },
      textureSet: 'default',
      tiles: [{
        key: '0,0',
        coordinates: { q: 0, r: 0 },
        terrain: 'grass',
        textureSet: 'default',
        elevation: 5,
        baseAssetId: 'hex_grass',
        supportAssetId: 'hex_grass',
        roadEdges: 0,
        riverEdges: 0,
        coastEdges: 0,
        riverWaterless: false,
        riverCurvy: false,
        coastWaterless: false,
        tags: [],
      }],
      placements: [],
      warnings: [],
    };
  }

  function invalidRecipe(): unknown {
    return {
      schemaVersion: '1.0.0',
      options: { seed: 'bad-recipe', shape: { kind: 'rectangle', width: 1, height: 1 } },
      steps: [{ action: 'setTerrain', at: { q: 3, r: 0 }, terrain: 'water' }],
    };
  }
});
