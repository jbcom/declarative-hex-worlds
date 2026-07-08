import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { safeParseAssetSourceSpec } from '../../../../asset-source';
import { GameboardCliError } from '../../../../errors';
import { run, runInitWith } from '../index';
import type { Prompter, PrompterChoice } from '../prompter';

/** Scripted prompter (see wizard.test) — select values + text lines consumed in order. */
function scripted(selects: string[], texts: string[]): Prompter {
  const s = [...selects];
  const t = [...texts];
  return {
    note: () => {},
    text: async () => t.shift() ?? '',
    confirm: async () => true,
    select: async <T extends string>(_m: string, _c: ReadonlyArray<PrompterChoice<T>>) =>
      (s.shift() ?? '__keep__') as T,
  };
}

/** Minimal PNG head (signature + IHDR) encoding width×height. */
function pngHead(width: number, height: number): Uint8Array {
  const b = new Uint8Array(24);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  b.set([0x49, 0x48, 0x44, 0x52], 12);
  b[16] = (width >>> 24) & 0xff;
  b[17] = (width >>> 16) & 0xff;
  b[18] = (width >>> 8) & 0xff;
  b[19] = width & 0xff;
  b[20] = (height >>> 24) & 0xff;
  b[21] = (height >>> 16) & 0xff;
  b[22] = (height >>> 8) & 0xff;
  b[23] = height & 0xff;
  return b;
}

describe('init CLI command (RFC0-CLI interactive path)', () => {
  let root: string;
  let assets: string;
  let previousOutRoot: string | undefined;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hex-worlds-init-'));
    assets = join(root, 'assets');
    mkdirSync(join(assets, 'tiles'), { recursive: true });
    mkdirSync(join(assets, 'models'), { recursive: true });
    mkdirSync(join(assets, 'tilesets'), { recursive: true });
    writeFileSync(join(assets, 'tiles', 'hex_grass.png'), '');
    writeFileSync(join(assets, 'models', 'knight.glb'), '');
    writeFileSync(join(assets, 'tilesets', 'sheet.png'), pngHead(480, 830));
    previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = root;
  });

  afterEach(() => {
    process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
    rmSync(root, { recursive: true, force: true });
  });

  it('runInitWith scans, runs the wizard, and returns a valid spec JSON', async () => {
    // tile biome: keep; model category: keep; tileset: cols 5, rows 10.
    const prompter = scripted(['__keep__', '__keep__'], ['5', '10']);
    const json = await runInitWith(prompter, { command: 'init', flags: { dir: assets } });
    const spec = JSON.parse(json);
    expect(safeParseAssetSourceSpec(spec).success).toBe(true);
    const sheet = spec.assets.find((a: { id: string }) => a.id === 'sheet');
    expect(sheet.grid).toEqual({ cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 });
  });

  it('runInitWith throws when --dir is missing', async () => {
    const prompter = scripted([], []);
    await expect(runInitWith(prompter, { command: 'init', flags: {} })).rejects.toThrow(
      GameboardCliError
    );
  });

  it('run() refuses in a non-TTY context and points at bind', async () => {
    const original = process.stdin.isTTY;
    Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true });
    try {
      await expect(run({ command: 'init', flags: { dir: assets } }, root, 'free')).rejects.toThrow(
        /interactive and needs a TTY/
      );
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: original, configurable: true });
    }
  });
});
