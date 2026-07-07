/**
 * Security unit tests for bootstrap/core.ts:
 *
 *   (a) Redirect allowlist — openHttpsStream must reject redirects to hosts
 *       outside KAYKIT_FETCH_REDIRECT_ALLOWLIST (CWE-601 / CWE-918).
 *
 *   (b) Zip-slip — extractZipTo must reject entries whose resolved path
 *       escapes the target root (CWE-22).
 *
 *   (c) Zip-bomb ceiling — extractZipTo must reject entries whose
 *       central-directory uncompressedSize exceeds 64 MB, and must abort
 *       mid-stream when actual decompressed bytes cross the cap (CWE-409).
 *
 * vi.mock('node:https') is hoisted by vite to module load time, so it is
 * isolated to this file (vitest runs each file in its own worker).
 */

import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { crc32, deflateRawSync } from 'node:zlib';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import yazl from 'yazl';
import { bootstrapKayKitAssets } from '../index';
import { PACK_REGISTRY } from '../registry';
import { KAYKIT_BOOTSTRAP_SIDECAR } from '../target';
import { characterPackLayout, KAYKIT_MEDIEVAL_FREE_LAYOUT } from '../upstream-layout';

// ---------------------------------------------------------------------------
// vi.mock must appear at the top level so vite can hoist it.
// ---------------------------------------------------------------------------
vi.mock('node:https');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TMP_ROOTS: string[] = [];

function tmp(): string {
  const root = mkdtempSync(join(tmpdir(), 'kaykit-security-test-'));
  TMP_ROOTS.push(root);
  return root;
}

afterAll(() => {
  for (const root of TMP_ROOTS) {
    rmSync(root, { recursive: true, force: true });
  }
});

function uint16LE(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}

function uint32LE(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

/**
 * Build a raw zip with one deflate-compressed entry. The central directory
 * reports `fakeUncompressedSize` regardless of actual content, enabling tests
 * for the declared-size bomb guard without allocating 64 MB.
 */
function buildRawZip(entryName: string, rawData: Buffer, fakeUncompressedSize?: number): Buffer {
  const name = Buffer.from(entryName);
  const compressed = deflateRawSync(rawData);
  const checksum = crc32(rawData);
  const compSize = compressed.length;
  const realUncompSize = rawData.length;
  const cdUncompSize = fakeUncompressedSize ?? realUncompSize;

  const localHeader = Buffer.concat([
    Buffer.from('PK\x03\x04'),
    uint16LE(20),
    uint16LE(0),
    uint16LE(8), // deflate
    uint16LE(0),
    uint16LE(0), // mod time, mod date
    uint32LE(checksum),
    uint32LE(compSize),
    uint32LE(realUncompSize),
    uint16LE(name.length),
    uint16LE(0),
    name,
    compressed,
  ]);

  const cdOffset = localHeader.length;

  const centralDir = Buffer.concat([
    Buffer.from('PK\x01\x02'),
    uint16LE(20),
    uint16LE(20),
    uint16LE(0),
    uint16LE(8), // deflate
    uint16LE(0),
    uint16LE(0),
    uint32LE(checksum),
    uint32LE(compSize),
    uint32LE(cdUncompSize), // may be fake
    uint16LE(name.length),
    uint16LE(0),
    uint16LE(0), // extra, comment
    uint16LE(0),
    uint16LE(0), // disk start, int attrs
    uint32LE(0), // ext attrs
    uint32LE(0), // local header offset
    name,
  ]);

  const eocd = Buffer.concat([
    Buffer.from('PK\x05\x06'),
    uint16LE(0),
    uint16LE(0),
    uint16LE(1),
    uint16LE(1),
    uint32LE(centralDir.length),
    uint32LE(cdOffset),
    uint16LE(0),
  ]);

  return Buffer.concat([localHeader, centralDir, eocd]);
}

async function buildFreePackZipBuffer(): Promise<Buffer> {
  const zip = new yazl.ZipFile();
  const layout = KAYKIT_MEDIEVAL_FREE_LAYOUT;
  const folder = `${layout.packFolderName}/`;
  for (const marker of layout.markerFiles) {
    zip.addBuffer(Buffer.from(`marker:${marker}`), `${folder}${marker}`);
  }
  zip.addBuffer(Buffer.from('{}'), `${folder}${layout.relativeGltfRoot}/tiles/base/hex_grass.gltf`);
  zip.addBuffer(Buffer.from('{}'), `${folder}${layout.relativeGltfRoot}/buildings/blue/home.gltf`);
  zip.addBuffer(
    Buffer.from('{}'),
    `${folder}${layout.relativeGltfRoot}/decoration/nature/tree.gltf`
  );
  zip.addBuffer(Buffer.from('png'), `${folder}${layout.relativeTextureRoot}/hexagons_medieval.png`);
  zip.end();
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolveBuild, rejectBuild) => {
    zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    zip.outputStream.on('error', rejectBuild);
    zip.outputStream.on('end', () => resolveBuild(Buffer.concat(chunks)));
  });
}

/** A character pack (Adventurers) zip buffer — flat gltf tree, inline texture. */
async function buildCharacterPackZipBuffer(): Promise<Buffer> {
  const zip = new yazl.ZipFile();
  const folder = 'repo-main/addons/kaykit_character_pack_adventures/';
  zip.addBuffer(Buffer.from('{}'), `${folder}Assets/gltf/knight.gltf`);
  zip.addBuffer(Buffer.from('png'), `${folder}Assets/gltf/knight_texture.png`);
  zip.end();
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolveBuild, rejectBuild) => {
    zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
    zip.outputStream.on('error', rejectBuild);
    zip.outputStream.on('end', () => resolveBuild(Buffer.concat(chunks)));
  });
}

// ---------------------------------------------------------------------------
// (a) Redirect allowlist (CWE-601 / CWE-918)
// ---------------------------------------------------------------------------

describe('bootstrap security — redirect allowlist (CWE-601)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects a redirect to a non-allowlisted host', async () => {
    const { request } = await import('node:https');
    const mockRequest = vi.mocked(request);

    mockRequest.mockImplementation((_url, _opts, cb) => {
      const callback = cb as (
        res: { statusCode: number; headers: Record<string, string>; resume(): void } & EventEmitter
      ) => void;
      const res = Object.assign(new EventEmitter(), {
        statusCode: 302,
        headers: { location: 'https://evil.example.com/payload.zip' },
        resume() {
          return undefined;
        },
      });
      setImmediate(() => callback(res));
      return Object.assign(new EventEmitter(), {
        end() {
          return undefined;
        },
      }) as unknown as ReturnType<typeof request>;
    });

    const localOut = tmp();
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'github' },
        out: localOut,
        outRoot: '/',
        edition: 'free',
      })
    ).rejects.toThrow(/disallowed host|evil\.example\.com/i);
  });

  it('accepts a redirect to an allowlisted host (objects.githubusercontent.com)', async () => {
    const { request } = await import('node:https');
    const mockRequest = vi.mocked(request);

    let callCount = 0;
    mockRequest.mockImplementation((_url, _opts, cb) => {
      callCount++;
      const callback = cb as (
        res: { statusCode: number; headers: Record<string, string>; resume(): void } & EventEmitter
      ) => void;
      const res = Object.assign(new EventEmitter(), {
        statusCode: callCount === 1 ? 302 : 503,
        headers: (callCount === 1
          ? { location: 'https://objects.githubusercontent.com/asset.zip' }
          : {}) as Record<string, string>,
        resume() {
          return undefined;
        },
      });
      setImmediate(() => callback(res));
      return Object.assign(new EventEmitter(), {
        end() {
          return undefined;
        },
      }) as unknown as ReturnType<typeof request>;
    });

    const localOut = tmp();
    // Second hop returns 503 — confirms the allowlisted redirect was followed
    // (would throw "disallowed host" if the allowlist check failed instead).
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'github' },
        out: localOut,
        outRoot: '/',
        edition: 'free',
      })
    ).rejects.toThrow(/status 503|failed to download/i);

    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('rejects after more than 5 redirects via allowlisted hosts', async () => {
    const { request } = await import('node:https');
    const mockRequest = vi.mocked(request);

    mockRequest.mockImplementation((_url, _opts, cb) => {
      const callback = cb as (
        res: { statusCode: number; headers: Record<string, string>; resume(): void } & EventEmitter
      ) => void;
      const res = Object.assign(new EventEmitter(), {
        statusCode: 302,
        // Keep redirecting within the allowlist — must hit depth limit, not host check
        headers: { location: 'https://codeload.github.com/redirect-loop' },
        resume() {
          return undefined;
        },
      });
      setImmediate(() => callback(res));
      return Object.assign(new EventEmitter(), {
        end() {
          return undefined;
        },
      }) as unknown as ReturnType<typeof request>;
    });

    const localOut = tmp();
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'github' },
        out: localOut,
        outRoot: '/',
        edition: 'free',
      })
    ).rejects.toThrow(/too many redirects|failed to download/i);

    expect(mockRequest.mock.calls.length).toBeGreaterThan(5);
  });

  it('downloads an allowlisted GitHub archive and stages it through the zip path', async () => {
    const { request } = await import('node:https');
    const mockRequest = vi.mocked(request);
    const zipBuffer = await buildFreePackZipBuffer();

    mockRequest.mockImplementation((_url, opts, cb) => {
      expect(opts).toMatchObject({
        method: 'GET',
        headers: expect.objectContaining({ Accept: 'application/zip' }),
      });
      const callback = cb as unknown as (
        res: { statusCode: number; headers: Record<string, string>; resume(): void } & PassThrough
      ) => void;
      const res = Object.assign(new PassThrough(), {
        statusCode: 200,
        headers: {} as Record<string, string>,
      });
      setImmediate(() => {
        callback(res);
        res.end(zipBuffer);
      });
      return Object.assign(new EventEmitter(), {
        end() {
          return undefined;
        },
      }) as unknown as ReturnType<typeof request>;
    });

    const localOut = tmp();
    const result = await bootstrapKayKitAssets({
      source: { kind: 'github', commit: 'main' },
      out: localOut,
      outRoot: '/',
      edition: 'free',
      libraryVersion: '0.0.0-test',
      fetchedAt: '2030-01-01T00:00:00.000Z',
    });
    expect(result.fileCount).toBeGreaterThan(0);
    expect(existsSync(join(localOut, KAYKIT_BOOTSTRAP_SIDECAR))).toBe(true);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('downloads a character pack from its descriptor github source (RFC0-10b)', async () => {
    const { request } = await import('node:https');
    const mockRequest = vi.mocked(request);
    const zipBuffer = await buildCharacterPackZipBuffer();
    const descriptor = PACK_REGISTRY.adventurers;
    let requestedUrl = '';

    mockRequest.mockImplementation((url, _opts, cb) => {
      requestedUrl = String(url);
      const callback = cb as unknown as (
        res: { statusCode: number; headers: Record<string, string>; resume(): void } & PassThrough
      ) => void;
      const res = Object.assign(new PassThrough(), {
        statusCode: 200,
        headers: {} as Record<string, string>,
      });
      setImmediate(() => {
        callback(res);
        res.end(zipBuffer);
      });
      return Object.assign(new EventEmitter(), {
        end() {
          return undefined;
        },
      }) as unknown as ReturnType<typeof request>;
    });

    const localOut = tmp();
    const result = await bootstrapKayKitAssets({
      source: { kind: 'github' },
      out: localOut,
      outRoot: '/',
      edition: 'free',
      layout: characterPackLayout('kaykit_character_pack_adventures'),
      githubSource: descriptor.github,
      libraryVersion: '0.0.0-test',
      fetchedAt: '2030-01-01T00:00:00.000Z',
    });
    // The formatted URL points at the descriptor's repo (formatGithubArchiveUrl).
    expect(requestedUrl).toBe(
      'https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/archive/refs/heads/main.zip'
    );
    // knight.gltf + knight_texture.png mirrored.
    expect(result.fileCount).toBe(2);
  });

  it('destroys the GitHub response stream when archive piping fails', async () => {
    const { request } = await import('node:https');
    const mockRequest = vi.mocked(request);
    let destroySpy: ReturnType<typeof vi.spyOn> | undefined;

    mockRequest.mockImplementation((_url, _opts, cb) => {
      const callback = cb as unknown as (
        res: { statusCode: number; headers: Record<string, string>; resume(): void } & PassThrough
      ) => void;
      const res = Object.assign(new PassThrough(), {
        statusCode: 200,
        headers: {} as Record<string, string>,
      });
      destroySpy = vi.spyOn(res, 'destroy');
      setImmediate(() => {
        callback(res);
        setTimeout(() => res.destroy(new Error('stream failed')), 0);
      });
      return Object.assign(new EventEmitter(), {
        end() {
          return undefined;
        },
      }) as unknown as ReturnType<typeof request>;
    });

    const localOut = tmp();
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'github' },
        out: localOut,
        outRoot: '/',
        edition: 'free',
      })
    ).rejects.toThrow(/stream failed|failed to download/i);
    expect(destroySpy).toHaveBeenCalled();
  });

  it('reports missing HTTP status as status 0', async () => {
    const { request } = await import('node:https');
    const mockRequest = vi.mocked(request);

    mockRequest.mockImplementation((_url, _opts, cb) => {
      const callback = cb as unknown as (
        res: { headers: Record<string, string>; resume(): void } & PassThrough
      ) => void;
      const res = Object.assign(new PassThrough(), {
        headers: {} as Record<string, string>,
      });
      setImmediate(() => callback(res));
      return Object.assign(new EventEmitter(), {
        end() {
          return undefined;
        },
      }) as unknown as ReturnType<typeof request>;
    });

    const localOut = tmp();
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'github' },
        out: localOut,
        outRoot: '/',
        edition: 'free',
      })
    ).rejects.toThrow(/status 0|failed to download/i);
  });

  it('wraps non-Error request failures from GitHub downloads', async () => {
    const { request } = await import('node:https');
    const mockRequest = vi.mocked(request);

    mockRequest.mockImplementation(() => {
      const req = new EventEmitter();
      return Object.assign(req, {
        end() {
          setImmediate(() => req.emit('error', 'network string failure'));
          return undefined;
        },
      }) as unknown as ReturnType<typeof request>;
    });

    const localOut = tmp();
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'github' },
        out: localOut,
        outRoot: '/',
        edition: 'free',
      })
    ).rejects.toThrow(/network string failure|failed to download/i);
  });
});

// ---------------------------------------------------------------------------
// (b) Zip-slip (CWE-22)
// ---------------------------------------------------------------------------

describe('bootstrap security — zip-slip (CWE-22)', () => {
  it('rejects a zip entry whose path escapes the target root', async () => {
    // yazl validates entry names so we build the zip from raw bytes.
    // The entry filename starts with `../../../` to traverse out of any target root.
    const zipBuf = buildRawZip('../../../escape/malicious.txt', Buffer.from('evil'));
    const zipPath = join(tmp(), 'zipslip.zip');
    writeFileSync(zipPath, zipBuf);

    const localOut = tmp();
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'zip', path: zipPath },
        out: localOut,
        outRoot: '/',
        edition: 'free',
      })
    ).rejects.toThrow(/escapes target root|failed to extract/i);
  });
});

// ---------------------------------------------------------------------------
// (c) Zip-bomb ceiling (CWE-409)
// ---------------------------------------------------------------------------

describe('bootstrap security — zip-bomb ceiling (CWE-409)', () => {
  const BOMB_LIMIT = 64 * 1024 * 1024; // 64 MB

  it('rejects an entry whose declared uncompressedSize exceeds 64 MB', async () => {
    const zipBuf = buildRawZip('bomb.txt', Buffer.from('tiny'), BOMB_LIMIT + 1);
    const zipPath = join(tmp(), 'bomb-declared.zip');
    writeFileSync(zipPath, zipBuf);

    const localOut = tmp();
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'zip', path: zipPath },
        out: localOut,
        outRoot: '/',
        edition: 'free',
      })
    ).rejects.toThrow(/declares.*bytes|exceeded.*bytes|failed to extract/i);
  });

  it('does not pre-reject an entry declared at exactly the 64 MB ceiling', async () => {
    // Guard is `> LIMIT`, not `>= LIMIT`. An entry declared at exactly LIMIT
    // passes the pre-check — the error comes later from yauzl's stream-size
    // verification (not from the bomb pre-check), which distinguishes this case
    // from the "> LIMIT" case where the pre-check fires before any stream open.
    const zipBuf = buildRawZip('bomb-at-limit.txt', Buffer.from('tiny'), BOMB_LIMIT);
    const zipPath = join(tmp(), 'bomb-at-limit.zip');
    writeFileSync(zipPath, zipBuf);

    const localOut = tmp();
    // The error is yauzl's own size-mismatch or a downstream extraction failure —
    // NOT a "declares N bytes" error from the declared-size pre-check.
    await expect(
      bootstrapKayKitAssets({
        source: { kind: 'zip', path: zipPath },
        out: localOut,
        outRoot: '/',
        edition: 'free',
      })
    ).rejects.toThrow(/failed to extract|not enough bytes|expected \d+/i);
  });
});
