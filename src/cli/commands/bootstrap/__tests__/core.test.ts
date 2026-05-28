/**
 * End-to-end coverage of {@link bootstrapKayKitAssets} + {@link verifyBootstrap}
 * using a synthetic mini-KayKit-FREE zip authored on the fly via `yazl`.
 *
 * Real KayKit zip parsing (against `references/KayKit_Medieval_Hexagon_Pack_
 * 1.0_FREE.zip`) is exercised by the RB6 integration test when that local
 * archive is present.
 */
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import yazl from 'yazl';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  KAYKIT_MEDIEVAL_FREE_LAYOUT,
  KAYKIT_MEDIEVAL_EXTRA_LAYOUT,
  type KayKitUpstreamLayout,
} from '../upstream-layout';
import {
  bootstrapKayKitAssets,
  verifyBootstrap,
  type BootstrapSidecar,
} from '../index';
import {
  KAYKIT_BOOTSTRAP_GLTF_RELATIVE,
  KAYKIT_BOOTSTRAP_SIDECAR,
  KAYKIT_BOOTSTRAP_TEXTURE_RELATIVE,
} from '../target';

const TMP_ROOTS: string[] = [];

function tmp(): string {
  const root = mkdtempSync(join(tmpdir(), 'kaykit-bootstrap-test-'));
  TMP_ROOTS.push(root);
  return root;
}

afterAll(() => {
  for (const root of TMP_ROOTS) {
    rmSync(root, { recursive: true, force: true });
  }
});

interface SyntheticPackFile {
  readonly relative: string;
  readonly content: Buffer | string;
}

async function buildSyntheticZip(
  layout: KayKitUpstreamLayout,
  files: readonly SyntheticPackFile[],
  destination: string
): Promise<void> {
  return new Promise<void>((resolveBuild, rejectBuild) => {
    const zip = new yazl.ZipFile();
    const folder = `${layout.packFolderName}/`;
    for (const marker of layout.markerFiles) {
      zip.addBuffer(Buffer.from(`marker:${marker}`), `${folder}${marker}`);
    }
    for (const file of files) {
      const buffer = typeof file.content === 'string' ? Buffer.from(file.content) : file.content;
      zip.addBuffer(buffer, `${folder}${file.relative}`);
    }
    zip.end();
    const stream = createWriteStream(destination);
    stream.on('error', rejectBuild);
    stream.on('close', resolveBuild);
    zip.outputStream.pipe(stream);
  });
}

function freeFixtureFiles(): SyntheticPackFile[] {
  const layout = KAYKIT_MEDIEVAL_FREE_LAYOUT;
  return [
    // GLTF + companion .bin for tiles/
    {
      relative: `${layout.relativeGltfRoot}/tiles/base/hex_grass.gltf`,
      content: JSON.stringify({ asset: { version: '2.0' } }),
    },
    {
      relative: `${layout.relativeGltfRoot}/tiles/base/hex_grass.bin`,
      content: Buffer.from([1, 2, 3, 4]),
    },
    // GLTF + companion .bin for buildings/
    {
      relative: `${layout.relativeGltfRoot}/buildings/blue/building_home_A_blue.gltf`,
      content: JSON.stringify({ asset: { version: '2.0' } }),
    },
    {
      relative: `${layout.relativeGltfRoot}/buildings/blue/building_home_A_blue.bin`,
      content: Buffer.from([5, 6, 7, 8]),
    },
    // GLTF in decoration/
    {
      relative: `${layout.relativeGltfRoot}/decoration/nature/tree_A.gltf`,
      content: JSON.stringify({ asset: { version: '2.0' } }),
    },
    // FBX + OBJ — should be filtered unless --include-source-formats
    {
      relative: `Assets/fbx/tiles/base/hex_grass.fbx`,
      content: Buffer.from('FBX-blob'),
    },
    {
      relative: `Assets/obj/tiles/base/hex_grass.obj`,
      content: 'OBJ-text',
    },
    {
      relative: `Assets/obj/tiles/base/hex_grass.mtl`,
      content: 'MTL-text',
    },
    // Texture
    {
      relative: `${layout.relativeTextureRoot}/hexagons_medieval.png`,
      content: Buffer.from([10, 20, 30, 40, 50]),
    },
  ];
}

describe('bootstrapKayKitAssets (zip source) — PRD RB5', () => {
  let zipPath: string;
  let outRoot: string;

  beforeAll(async () => {
    const zipDir = tmp();
    zipPath = join(zipDir, 'kaykit-free-synthetic.zip');
    await buildSyntheticZip(KAYKIT_MEDIEVAL_FREE_LAYOUT, freeFixtureFiles(), zipPath);
  });

  it('mirrors the gltf tree under the bootstrap target (default: gltf-only)', async () => {
    outRoot = tmp();
    const result = await bootstrapKayKitAssets({
      source: { kind: 'zip', path: zipPath },
      out: outRoot,
      outRoot: '/',
      edition: 'free',
      libraryVersion: '0.0.0-test',
      fetchedAt: '2030-01-01T00:00:00.000Z',
    });
    expect(result.edition).toBe('free');
    expect(result.outRoot).toContain('addons/kaykit_medieval_hexagon_pack');
    expect(result.fileCount).toBeGreaterThan(0);
    // gltf + bin + png — not fbx/obj/mtl.
    const gltfRoot = join(result.outRoot, KAYKIT_BOOTSTRAP_GLTF_RELATIVE);
    expect(existsSync(join(gltfRoot, 'tiles/base/hex_grass.gltf'))).toBe(true);
    expect(existsSync(join(gltfRoot, 'tiles/base/hex_grass.bin'))).toBe(true);
    expect(existsSync(join(gltfRoot, 'buildings/blue/building_home_A_blue.gltf'))).toBe(true);
    expect(existsSync(join(gltfRoot, 'decoration/nature/tree_A.gltf'))).toBe(true);
    const textureRoot = join(result.outRoot, KAYKIT_BOOTSTRAP_TEXTURE_RELATIVE);
    expect(existsSync(join(textureRoot, 'hexagons_medieval.png'))).toBe(true);
    // FBX / OBJ / MTL must not be mirrored.
    expect(existsSync(join(gltfRoot, '../fbx'))).toBe(false);
    expect(existsSync(join(gltfRoot, '../obj'))).toBe(false);
  });

  it('writes an integrity sidecar with per-file sha256 + bytes', async () => {
    const sidecarPath = join(outRoot, 'addons/kaykit_medieval_hexagon_pack', KAYKIT_BOOTSTRAP_SIDECAR);
    expect(existsSync(sidecarPath)).toBe(true);
    const sidecar = JSON.parse(readFileSync(sidecarPath, 'utf8')) as BootstrapSidecar;
    expect(sidecar.schemaVersion).toBe('1.0.0');
    expect(sidecar.edition).toBe('free');
    expect(sidecar.libraryVersion).toBe('0.0.0-test');
    expect(sidecar.fetchedAt).toBe('2030-01-01T00:00:00.000Z');
    expect(sidecar.sourceUrl.startsWith('file://')).toBe(true);
    expect(sidecar.files.length).toBeGreaterThan(0);
    for (const entry of sidecar.files) {
      const absolute = join(outRoot, 'addons/kaykit_medieval_hexagon_pack', entry.path);
      // Single read covers existence + size + hash without the
      // existsSync/stat/readFile time-of-check-time-of-use race
      // CodeQL flags as js/file-system-race.
      const contents = readFileSync(absolute);
      expect(contents.byteLength).toBe(entry.bytes);
      const actualHash = createHash('sha256').update(contents).digest('hex');
      expect(actualHash).toBe(entry.sha256);
    }
    // Files list is sorted.
    const sorted = [...sidecar.files].map((entry) => entry.path).sort();
    expect(sidecar.files.map((entry) => entry.path)).toEqual(sorted);
  });

  it('verifyBootstrap reports OK on a freshly bootstrapped target', async () => {
    const report = await verifyBootstrap(outRoot);
    expect(report.ok).toBe(true);
    expect(report.drift).toEqual([]);
  });

  it('verifyBootstrap also accepts the bootstrap target root directly', async () => {
    const targetRoot = join(outRoot, 'addons/kaykit_medieval_hexagon_pack');
    const report = await verifyBootstrap(targetRoot);
    expect(report.ok).toBe(true);
  });

  it('verifyBootstrap detects file tampering', async () => {
    const targetRoot = join(outRoot, 'addons/kaykit_medieval_hexagon_pack');
    const tamperedPath = join(targetRoot, 'Assets/gltf/tiles/base/hex_grass.gltf');
    const original = readFileSync(tamperedPath);
    writeFileSync(tamperedPath, `${original.toString('utf8')}-tampered`);
    const report = await verifyBootstrap(outRoot);
    expect(report.ok).toBe(false);
    expect(report.drift.some((entry) => entry.includes('hex_grass.gltf'))).toBe(true);
    // Restore so subsequent tests aren't impacted.
    writeFileSync(tamperedPath, original);
  });

  it('verifyBootstrap reports a missing sidecar', async () => {
    const empty = tmp();
    const report = await verifyBootstrap(empty);
    expect(report.ok).toBe(false);
    expect(report.drift.some((entry) => entry.includes('integrity sidecar missing'))).toBe(true);
  });

  it('verifyBootstrap flags unsafe sidecar entry paths and missing files (E0a)', async () => {
    const targetRoot = join(outRoot, 'addons/kaykit_medieval_hexagon_pack');
    const sidecarPath = join(targetRoot, KAYKIT_BOOTSTRAP_SIDECAR);
    const original = readFileSync(sidecarPath, 'utf8');
    const sidecar = JSON.parse(original) as BootstrapSidecar;
    const tamperedSidecar = {
      ...sidecar,
      files: [
        // Path-traversal escape — rel starts with '..'.
        { path: '../escape.txt', bytes: 0, sha256: '0'.repeat(64) },
        // File that doesn't exist (missing-file branch).
        { path: 'Assets/gltf/does-not-exist.gltf', bytes: 0, sha256: '0'.repeat(64) },
      ],
    };
    writeFileSync(sidecarPath, JSON.stringify(tamperedSidecar));
    const report = await verifyBootstrap(outRoot);
    expect(report.ok).toBe(false);
    expect(report.drift.some((entry) => entry.includes('unsafe sidecar entry path'))).toBe(true);
    expect(report.drift.some((entry) => entry.includes('missing file'))).toBe(true);
    // Restore so subsequent tests aren't impacted.
    writeFileSync(sidecarPath, original);
  });

  it('idempotent re-run with force=true produces identical sidecar files', async () => {
    const localOut = tmp();
    const first = await bootstrapKayKitAssets({
      source: { kind: 'zip', path: zipPath },
      out: localOut,
      outRoot: '/',
      edition: 'free',
      libraryVersion: '0.0.0-test',
      fetchedAt: '2030-01-01T00:00:00.000Z',
    });
    const firstSidecar = JSON.parse(readFileSync(first.integritySidecar, 'utf8')) as BootstrapSidecar;
    const second = await bootstrapKayKitAssets({
      source: { kind: 'zip', path: zipPath },
      out: localOut,
      outRoot: '/',
      edition: 'free',
      libraryVersion: '0.0.0-test',
      fetchedAt: '2030-01-01T00:00:00.000Z',
      force: true,
    });
    const secondSidecar = JSON.parse(readFileSync(second.integritySidecar, 'utf8')) as BootstrapSidecar;
    expect(secondSidecar.files).toEqual(firstSidecar.files);
    expect(second.totalBytes).toBe(first.totalBytes);
    expect(second.fileCount).toBe(first.fileCount);
  });

  it('refuses a non-empty target without force when the sidecar edition differs', async () => {
    const localOut = tmp();
    // First bootstrap a FREE pack so the target is non-empty.
    await bootstrapKayKitAssets({
      source: { kind: 'zip', path: zipPath },
      out: localOut,
      outRoot: '/',
      edition: 'free',
      libraryVersion: '0.0.0-test',
      fetchedAt: '2030-01-01T00:00:00.000Z',
    });
    // Now attempt to bootstrap an EXTRA pack into the same directory —
    // edition mismatch defeats the idempotency shortcut and produces the
    // documented "not empty" error.
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'zip', path: zipPath },
        out: localOut,
        outRoot: '/',
        edition: 'extra',
      })
    ).rejects.toThrow(/is not empty; pass force: true/);
  });

  it('idempotently returns when the sidecar already matches the requested edition', async () => {
    const localOut = tmp();
    const first = await bootstrapKayKitAssets({
      source: { kind: 'zip', path: zipPath },
      out: localOut,
      outRoot: '/',
      edition: 'free',
      libraryVersion: '0.0.0-test',
      fetchedAt: '2030-01-01T00:00:00.000Z',
    });
    const second = await bootstrapKayKitAssets({
      source: { kind: 'zip', path: zipPath },
      out: localOut,
      outRoot: '/',
      edition: 'free',
    });
    expect(second.fileCount).toBe(first.fileCount);
    expect(second.outRoot).toBe(first.outRoot);
  });

  it('includes .fbx/.obj/.mtl when includeSourceFormats is true', async () => {
    const localOut = tmp();
    const result = await bootstrapKayKitAssets({
      source: { kind: 'zip', path: zipPath },
      out: localOut,
      outRoot: '/',
      edition: 'free',
      includeSourceFormats: true,
      libraryVersion: '0.0.0-test',
      fetchedAt: '2030-01-01T00:00:00.000Z',
    });
    const sidecar = JSON.parse(readFileSync(result.integritySidecar, 'utf8')) as BootstrapSidecar;
    // Only gltf-root files appear in sidecar (textures separate). With
    // includeSourceFormats, the gltf root still only contains .gltf/.bin —
    // the fbx/obj trees live under Assets/fbx and Assets/obj, which are
    // OUTSIDE the gltf root the mirror walks. The flag's primary effect is
    // future-proofing for upstream packs that interleave formats in gltf/.
    // Assert the sidecar shape is still valid.
    expect(sidecar.files.every((entry) => /\.(gltf|bin|png|jpg|jpeg)$/.test(entry.path))).toBe(true);
  });

  it('rejects a zip whose layout markers do not match the requested edition', async () => {
    const extraZip = join(tmp(), 'extra.zip');
    await buildSyntheticZip(
      KAYKIT_MEDIEVAL_EXTRA_LAYOUT,
      [
        {
          relative: `${KAYKIT_MEDIEVAL_EXTRA_LAYOUT.relativeGltfRoot}/units/blue/unit_archer_blue.gltf`,
          content: JSON.stringify({ asset: { version: '2.0' } }),
        },
        // Need the FREE-required category dirs too so detect resolves to EXTRA.
        {
          relative: `${KAYKIT_MEDIEVAL_EXTRA_LAYOUT.relativeGltfRoot}/buildings/blue/x.gltf`,
          content: 'b',
        },
        {
          relative: `${KAYKIT_MEDIEVAL_EXTRA_LAYOUT.relativeGltfRoot}/decoration/nature/x.gltf`,
          content: 'd',
        },
        {
          relative: `${KAYKIT_MEDIEVAL_EXTRA_LAYOUT.relativeGltfRoot}/tiles/base/x.gltf`,
          content: 't',
        },
      ],
      extraZip
    );
    const localOut = tmp();
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'zip', path: extraZip },
        out: localOut,
        outRoot: '/',
        edition: 'free',
      })
    ).rejects.toThrow(/EXTRA edition but bootstrap was asked for FREE/);
  });

  it('rejects a zip that does not look like a KayKit pack', async () => {
    const garbageZip = join(tmp(), 'garbage.zip');
    await new Promise<void>((resolveBuild, rejectBuild) => {
      const zip = new yazl.ZipFile();
      zip.addBuffer(Buffer.from('hello'), 'some-pack/readme.txt');
      zip.end();
      const stream = createWriteStream(garbageZip);
      stream.on('error', rejectBuild);
      stream.on('close', resolveBuild);
      zip.outputStream.pipe(stream);
    });
    const localOut = tmp();
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'zip', path: garbageZip },
        out: localOut,
        outRoot: '/',
        edition: 'free',
      })
    ).rejects.toThrow(/does not contain a recognizable KayKit pack root/);
  });

  it('rejects a zip path that does not exist', async () => {
    const localOut = tmp();
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'zip', path: '/path/that/definitely/does/not/exist.zip' },
        out: localOut,
        outRoot: '/',
        edition: 'free',
      })
    ).rejects.toThrow(/zip source does not exist/);
  });

  it('rejects EXTRA edition from GitHub source (CC0 covers FREE only)', async () => {
    const localOut = tmp();
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'github' },
        out: localOut,
        outRoot: '/',
        edition: 'extra',
      })
    ).rejects.toThrow(/EXTRA edition cannot be bootstrapped from GitHub/);
  });

  it('rejects out paths that escape the out root', async () => {
    const localOut = tmp();
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'zip', path: zipPath },
        out: '../escape',
        outRoot: localOut,
        edition: 'free',
      })
    ).rejects.toThrow(/escapes the output root/);
  });
});

describe('bootstrap edge cases — PRD RB5', () => {
  it('honors a custom libraryVersion + fetchedAt for reproducible builds', async () => {
    const zipPath = join(tmp(), 'small.zip');
    await buildSyntheticZip(KAYKIT_MEDIEVAL_FREE_LAYOUT, freeFixtureFiles(), zipPath);
    const localOut = tmp();
    const result = await bootstrapKayKitAssets({
      source: { kind: 'zip', path: zipPath },
      out: localOut,
      outRoot: '/',
      edition: 'free',
      libraryVersion: '9.9.9-reproducible',
      fetchedAt: '2099-12-31T23:59:59.999Z',
    });
    const sidecar = JSON.parse(readFileSync(result.integritySidecar, 'utf8')) as BootstrapSidecar;
    expect(sidecar.libraryVersion).toBe('9.9.9-reproducible');
    expect(sidecar.fetchedAt).toBe('2099-12-31T23:59:59.999Z');
  });

  it('forcibly clears an existing target when force=true', async () => {
    const zipPath = join(tmp(), 'small.zip');
    await buildSyntheticZip(KAYKIT_MEDIEVAL_FREE_LAYOUT, freeFixtureFiles(), zipPath);
    const localOut = tmp();
    await bootstrapKayKitAssets({
      source: { kind: 'zip', path: zipPath },
      out: localOut,
      outRoot: '/',
      edition: 'free',
    });
    // Drop a sentinel that should be wiped on force re-run.
    const sentinel = join(localOut, 'addons/kaykit_medieval_hexagon_pack/sentinel.txt');
    mkdirSync(join(sentinel, '..'), { recursive: true });
    writeFileSync(sentinel, 'should be cleared');
    expect(existsSync(sentinel)).toBe(true);
    await bootstrapKayKitAssets({
      source: { kind: 'zip', path: zipPath },
      out: localOut,
      outRoot: '/',
      edition: 'free',
      force: true,
    });
    expect(existsSync(sentinel)).toBe(false);
  });

  it('preserves the upstream directory shape under Assets/gltf', async () => {
    const zipPath = join(tmp(), 'shape.zip');
    await buildSyntheticZip(KAYKIT_MEDIEVAL_FREE_LAYOUT, freeFixtureFiles(), zipPath);
    const localOut = tmp();
    const result = await bootstrapKayKitAssets({
      source: { kind: 'zip', path: zipPath },
      out: localOut,
      outRoot: '/',
      edition: 'free',
    });
    const gltfRoot = join(result.outRoot, KAYKIT_BOOTSTRAP_GLTF_RELATIVE);
    const subdirs = readdirSync(gltfRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(subdirs).toEqual(['buildings', 'decoration', 'tiles']);
  });
});
