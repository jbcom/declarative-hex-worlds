/**
 * Bootstrap end-to-end integration test (PRD RB6).
 *
 * Builds a synthetic zip from the locally extracted FREE reference pack at
 * `references/KayKit_Medieval_Hexagon_Pack_1.0_FREE/`, runs
 * `bootstrapKayKitAssets({ kind: 'zip' })` against it, then asserts that every
 * asset in the bundled FREE manifest resolves to a real file under the
 * bootstrap target.
 *
 * The test is skipif on the local reference pack — CI without the upstream
 * tree skips silently; the scheduled `bootstrap-nightly` workflow covers the
 * GitHub-source path against the live upstream (RB7).
 */
import { createWriteStream, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import yazl from 'yazl';
import { afterAll, describe, expect, it } from 'vitest';
import {
  KAYKIT_MEDIEVAL_FREE_LAYOUT,
  bootstrapKayKitAssets,
  resolveBootstrapGltfRoot,
  resolveBootstrapTargetRoot,
  verifyBootstrap,
} from '../../../src/cli/commands/bootstrap';
import {
  freeManifest,
  gameboardAssetUrl,
  rewriteToBootstrapPath,
  setGameboardAssetRoot,
} from '../../../src';

const FREE_REFERENCE_ROOT = join(
  process.cwd(),
  'references',
  KAYKIT_MEDIEVAL_FREE_LAYOUT.packFolderName
);
const REFERENCE_PRESENT = existsSync(
  join(FREE_REFERENCE_ROOT, KAYKIT_MEDIEVAL_FREE_LAYOUT.relativeGltfRoot)
);

const TMP_ROOTS: string[] = [];

function tmp(): string {
  const root = mkdtempSync(join(tmpdir(), 'kaykit-bootstrap-it-'));
  TMP_ROOTS.push(root);
  return root;
}

afterAll(() => {
  setGameboardAssetRoot(undefined);
  for (const root of TMP_ROOTS) {
    rmSync(root, { recursive: true, force: true });
  }
});

async function buildFreeZipFromReference(destination: string): Promise<void> {
  const layout = KAYKIT_MEDIEVAL_FREE_LAYOUT;
  return new Promise<void>((resolveBuild, rejectBuild) => {
    const zip = new yazl.ZipFile();
    const folder = `${layout.packFolderName}/`;
    for (const marker of layout.markerFiles) {
      const markerPath = join(FREE_REFERENCE_ROOT, marker);
      if (existsSync(markerPath)) {
        zip.addFile(markerPath, `${folder}${marker}`);
      }
    }
    const gltfRoot = join(FREE_REFERENCE_ROOT, layout.relativeGltfRoot);
    for (const filePath of walkFiles(gltfRoot)) {
      const rel = relative(FREE_REFERENCE_ROOT, filePath);
      zip.addFile(filePath, `${folder}${rel}`);
    }
    const texturesRoot = join(FREE_REFERENCE_ROOT, layout.relativeTextureRoot);
    for (const texture of layout.textureFiles) {
      const path = join(texturesRoot, texture);
      if (existsSync(path)) {
        zip.addFile(path, `${folder}${layout.relativeTextureRoot}/${texture}`);
      }
    }
    zip.end();
    const stream = createWriteStream(destination);
    stream.on('error', rejectBuild);
    stream.on('close', resolveBuild);
    zip.outputStream.pipe(stream);
  });
}

function walkFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const childPath = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(childPath));
    } else if (entry.isFile()) {
      out.push(childPath);
    }
  }
  return out;
}

describe('bootstrap end-to-end against the local FREE reference pack (PRD RB6)', () => {
  it.skipIf(!REFERENCE_PRESENT)(
    'mirrors every manifest asset under the bootstrap target',
    async () => {
      const zipPath = join(tmp(), 'kaykit-medieval-hexagon-free.zip');
      await buildFreeZipFromReference(zipPath);
      expect(statSync(zipPath).size).toBeGreaterThan(0);

      const outRoot = tmp();
      const result = await bootstrapKayKitAssets({
        source: { kind: 'zip', path: zipPath },
        out: outRoot,
        outRoot: '/',
        edition: 'free',
        libraryVersion: '0.0.0-integration',
        fetchedAt: '2030-01-01T00:00:00.000Z',
      });

      expect(result.edition).toBe('free');
      // GLTF + companion BIN + the single shared texture.
      const gltfRoot = resolveBootstrapGltfRoot(outRoot);
      expect(existsSync(gltfRoot)).toBe(true);

      // verifyBootstrap reports OK after a fresh bootstrap.
      const report = await verifyBootstrap(outRoot);
      expect(report.ok).toBe(true);
      expect(report.drift).toEqual([]);

      // Every asset in the bundled FREE manifest resolves to a real file
      // under the bootstrap target via gameboardAssetUrl + the runtime root
      // override.
      setGameboardAssetRoot(outRoot);
      const targetRoot = resolveBootstrapTargetRoot(outRoot);
      const missing: string[] = [];
      for (const asset of freeManifest.assets) {
        const resolved = gameboardAssetUrl(asset);
        // gameboardAssetUrl prepends the asset root + bootstrap target
        // segments; the absolute path should live under targetRoot.
        const expectedAbsolute = join(targetRoot, rewriteToBootstrapPath(asset).replace(/^addons\/kaykit_medieval_hexagon_pack\//, ''));
        if (!existsSync(expectedAbsolute)) {
          missing.push(asset.id);
        }
        expect(resolved).toContain('addons/kaykit_medieval_hexagon_pack/Assets/gltf');
      }
      expect(missing).toEqual([]);
      // The bootstrap should have produced exactly the manifest's asset count
      // (modulo .bin companions which are extra), plus the single texture.
      expect(result.fileCount).toBeGreaterThanOrEqual(freeManifest.counts.total);
    },
    60_000
  );
});
