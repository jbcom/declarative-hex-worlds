import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MedievalHexagonManifest } from '../../src/types';
import {
  defaultPackageRoot,
  generatePackageAssets,
  parsePackageAssetsArgs,
  runGeneratePackageAssets,
} from '../generate-package-assets';

const manifest = {
  counts: { total: 7 },
} as MedievalHexagonManifest;

describe('scripts/generate-package-assets', () => {
  it('parses required args and defaults the package root', () => {
    expect(
      parsePackageAssetsArgs(['ignored', '--edition', 'free', '--source', 'references/free'])
    ).toEqual({
      edition: 'free',
      source: 'references/free',
      packageRoot: defaultPackageRoot(),
    });
  });

  it('rejects malformed arguments before generation', () => {
    expect(() => parsePackageAssetsArgs(['--edition', 'free'])).toThrow('--source is required');
    expect(() => parsePackageAssetsArgs(['--edition', 'paid', '--source', 'x'])).toThrow(
      '--edition must be free or extra'
    );
    expect(() => parsePackageAssetsArgs(['--edition'])).toThrow('Missing value for --edition');
  });

  it('generates and writes the packaged FREE manifest outputs', () => {
    const calls: unknown[] = [];
    const logs: string[] = [];
    const result = generatePackageAssets(
      { edition: 'free', source: '/packs/free', packageRoot: '/repo' },
      {
        validateSourceRootImpl: (sourceRoot, edition) => {
          calls.push({ kind: 'validate', sourceRoot, edition });
          return { ok: true, expectedCount: 7, gltfCount: 7 };
        },
        generateManifestFromSourceImpl: (options) => {
          calls.push({ kind: 'generate', options });
          return manifest;
        },
        writeManifestModuleImpl: (_manifest, outputPath) => {
          calls.push({ kind: 'module', outputPath });
        },
        writeManifestJsonImpl: (_manifest, outputPath) => {
          calls.push({ kind: 'json', outputPath });
        },
        log: (message) => logs.push(message),
      }
    );

    expect(result).toEqual({
      sourceRoot: '/packs/free',
      packageRoot: '/repo',
      manifest,
    });
    expect(calls).toEqual([
      { kind: 'validate', sourceRoot: '/packs/free', edition: 'free' },
      { kind: 'generate', options: { sourceRoot: '/packs/free', edition: 'free' } },
      { kind: 'module', outputPath: '/repo/src/manifest/free.ts' },
      { kind: 'json', outputPath: '/repo/assets/free/manifest.json' },
    ]);
    expect(logs).toEqual(['Generated manifest for 7 free assets']);
  });

  it('generates EXTRA manifests without writing packaged FREE outputs', () => {
    const calls: unknown[] = [];
    const result = runGeneratePackageAssets(
      ['--edition', 'extra', '--source', 'references/extra', '--package', '/repo'],
      {
        validateSourceRootImpl: () => ({ ok: true, expectedCount: 404, gltfCount: 404 }),
        generateManifestFromSourceImpl: (options) => {
          calls.push({ kind: 'generate', options });
          return manifest;
        },
        writeManifestModuleImpl: () => calls.push({ kind: 'module' }),
        writeManifestJsonImpl: () => calls.push({ kind: 'json' }),
        log: (message) => calls.push({ kind: 'log', message }),
      }
    );

    expect(result.sourceRoot).toBe(resolve('references/extra'));
    expect(calls).toEqual([
      { kind: 'generate', options: { sourceRoot: resolve('references/extra'), edition: 'extra' } },
      { kind: 'log', message: 'Generated manifest for 7 extra assets' },
    ]);
  });

  it('throws a source-count error before manifest generation', () => {
    expect(() =>
      generatePackageAssets(
        { edition: 'free', source: '/bad/free', packageRoot: '/repo' },
        {
          validateSourceRootImpl: () => ({ ok: false, expectedCount: 221, gltfCount: 1 }),
          generateManifestFromSourceImpl: () => {
            throw new Error('should not generate');
          },
        }
      )
    ).toThrow('Expected 221 free GLTF files, found 1.');
  });
});
