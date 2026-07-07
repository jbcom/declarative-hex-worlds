import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import yazl from 'yazl';
import { GameboardIoError } from '../../../../errors';
import { runBootstrap } from '../index';
import {
  assertPackPresent,
  bootstrapPack,
  isPackMaterialized,
  layoutForPack,
  resolveDefaultPackKit,
} from '../pack-bootstrap';
import { PACK_REGISTRY } from '../registry';
import { KAYKIT_BOOTSTRAP_SIDECAR } from '../target';

vi.mock('node:https');

const TMP: string[] = [];
function tmp(): string {
  const root = mkdtempSync(join(tmpdir(), 'pack-bootstrap-test-'));
  TMP.push(root);
  return root;
}
afterAll(() => {
  for (const root of TMP) {
    rmSync(root, { recursive: true, force: true });
  }
});

/** Mark a pack as materialized by writing its sidecar under <root>/<packId>/. */
function materialize(root: string, packId: string): void {
  const dir = join(root, packId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, KAYKIT_BOOTSTRAP_SIDECAR), '{}');
}

async function characterZipBuffer(packFolder: string): Promise<Buffer> {
  const zip = new yazl.ZipFile();
  const folder = `repo-main/addons/${packFolder}/`;
  zip.addBuffer(Buffer.from('{}'), `${folder}Assets/gltf/knight.gltf`);
  zip.end();
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((res, rej) => {
    zip.outputStream.on('data', (c: Buffer) => chunks.push(c));
    zip.outputStream.on('error', rej);
    zip.outputStream.on('end', () => res(Buffer.concat(chunks)));
  });
}

describe('layoutForPack (RFC0-10c)', () => {
  it('maps terrain packs to the medieval layout and character packs to the flat one', () => {
    expect(layoutForPack(PACK_REGISTRY['medieval-hexagon']).detection ?? 'medieval').toBe(
      'medieval'
    );
    expect(layoutForPack(PACK_REGISTRY.adventurers).detection).toBe('character');
    expect(layoutForPack(PACK_REGISTRY.skeletons).packFolderName).toBe(
      'kaykit_character_pack_skeletons'
    );
  });
});

describe('bootstrapPack (RFC0-10c)', () => {
  beforeEach(() => vi.resetAllMocks());

  it('fetches a registered pack from its descriptor github source', async () => {
    const { request } = await import('node:https');
    const mockRequest = vi.mocked(request);
    const zipBuffer = await characterZipBuffer('kaykit_character_pack_adventures');
    let url = '';
    mockRequest.mockImplementation((u, _opts, cb) => {
      url = String(u);
      const callback = cb as unknown as (
        res: { statusCode: number; headers: Record<string, string> } & PassThrough
      ) => void;
      const res = Object.assign(new PassThrough(), { statusCode: 200, headers: {} });
      setImmediate(() => {
        callback(res);
        res.end(zipBuffer);
      });
      return Object.assign(new EventEmitter(), { end: () => undefined }) as unknown as ReturnType<
        typeof request
      >;
    });

    const out = tmp();
    const result = await bootstrapPack('adventurers', {
      out,
      outRoot: '/',
      libraryVersion: '0.0.0-test',
      fetchedAt: '2030-01-01T00:00:00.000Z',
    });
    expect(url).toContain('KayKit-Character-Pack-Adventures-1.0');
    expect(result.fileCount).toBe(1);
  });

  it('throws a clear error for an unknown pack id', async () => {
    await expect(bootstrapPack('nope', { out: tmp(), outRoot: '/' })).rejects.toThrow(
      /Unknown pack "nope"/
    );
  });

  it('CLI `bootstrap --pack <id>` fetches the pack and prints JSON', async () => {
    const { request } = await import('node:https');
    const mockRequest = vi.mocked(request);
    const zipBuffer = await characterZipBuffer('kaykit_character_pack_skeletons');
    mockRequest.mockImplementation((_u, _opts, cb) => {
      const callback = cb as unknown as (
        res: { statusCode: number; headers: Record<string, string> } & PassThrough
      ) => void;
      const res = Object.assign(new PassThrough(), { statusCode: 200, headers: {} });
      setImmediate(() => {
        callback(res);
        res.end(zipBuffer);
      });
      return Object.assign(new EventEmitter(), { end: () => undefined }) as unknown as ReturnType<
        typeof request
      >;
    });

    const out = tmp();
    const prevRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = out;
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });
    try {
      await runBootstrap(
        { command: 'bootstrap', flags: { pack: 'skeletons', out: 'skeletons', json: true } },
        'free'
      );
      const printed = JSON.parse(logs.join('\n'));
      expect(printed.fileCount).toBe(1);
    } finally {
      logSpy.mockRestore();
      process.env.HEX_WORLDS_OUT_ROOT = prevRoot;
    }
  });
});

describe('default source resolution (RFC0-10c)', () => {
  it('isPackMaterialized reflects sidecar presence', () => {
    const root = tmp();
    expect(isPackMaterialized('skeletons', root)).toBe(false);
    materialize(root, 'skeletons');
    expect(isPackMaterialized('skeletons', root)).toBe(true);
  });

  it('resolveDefaultPackKit reports every pack present/absent with its dir', () => {
    const root = tmp();
    materialize(root, 'medieval-hexagon');
    const kit = resolveDefaultPackKit(root);
    expect(kit.map((p) => p.id)).toEqual(['medieval-hexagon', 'adventurers', 'skeletons']);
    expect(kit.find((p) => p.id === 'medieval-hexagon')?.present).toBe(true);
    expect(kit.find((p) => p.id === 'adventurers')?.present).toBe(false);
    expect(kit.find((p) => p.id === 'skeletons')?.dir).toBe(join(root, 'skeletons'));
  });

  it('assertPackPresent returns the dir when present', () => {
    const root = tmp();
    materialize(root, 'adventurers');
    expect(assertPackPresent('adventurers', root)).toBe(join(root, 'adventurers'));
  });

  it('assertPackPresent throws a fetch-command error when absent', () => {
    const root = tmp();
    expect(() => assertPackPresent('skeletons', root)).toThrow(GameboardIoError);
    expect(() => assertPackPresent('skeletons', root)).toThrow(/bootstrap --pack skeletons/);
  });

  it('assertPackPresent rejects an unknown pack id', () => {
    expect(() => assertPackPresent('nope', tmp())).toThrow(/Unknown pack "nope"/);
  });
});
