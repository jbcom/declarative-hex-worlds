import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeParseAssetSourceSpec } from '../../../asset-source';
import { GameboardCliError } from '../../../errors';
import { run, runBind } from '../bind';

describe('bind CLI command (RFC0-CLI)', () => {
  let root: string;
  let assets: string;
  let previousOutRoot: string | undefined;
  let logs: string[];
  let errors: string[];
  let stdout: string;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hex-worlds-bind-'));
    assets = join(root, 'assets');
    mkdirSync(join(assets, 'tiles'), { recursive: true });
    mkdirSync(join(assets, 'models'), { recursive: true });
    mkdirSync(join(assets, 'tilesets'), { recursive: true });
    writeFileSync(join(assets, 'tiles', 'hex_grass.png'), '');
    writeFileSync(join(assets, 'tiles', 'mystery_A.png'), '');
    writeFileSync(join(assets, 'models', 'knight.glb'), '');
    writeFileSync(join(assets, 'tilesets', 'grassland.png'), '');
    writeFileSync(join(assets, 'readme.txt'), ''); // unclassifiable

    previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = root;
    logs = [];
    errors = [];
    stdout = '';
    logSpy = vi.spyOn(console, 'log').mockImplementation((m: unknown) => {
      logs.push(String(m));
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation((m: unknown) => {
      errors.push(String(m));
    });
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      stdout += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    writeSpy.mockRestore();
    process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
    rmSync(root, { recursive: true, force: true });
  });

  it('scans a dir → emits a valid AssetSourceSpec to stdout and reports gaps to stderr', () => {
    runBind({ command: 'bind', flags: { dir: assets, name: 'my-pack' } });

    const spec = JSON.parse(stdout);
    expect(safeParseAssetSourceSpec(spec).success).toBe(true);
    expect(spec.name).toBe('my-pack');
    const ids = spec.assets.map((a: { id: string }) => a.id).sort();
    expect(ids).toEqual(['grassland', 'hex_grass', 'knight', 'mystery_A']);

    // The unclassifiable readme, the grid-less tileset, and the unknown-biome tile are all reported.
    const stderr = errors.join('\n');
    expect(stderr).toContain('readme.txt');
    expect(stderr).toContain('grassland');
    expect(stderr).toContain('mystery_A');
  });

  it('defaults the source name to the dir basename', () => {
    runBind({ command: 'bind', flags: { dir: assets } });
    expect(JSON.parse(stdout).name).toBe('assets');
  });

  it('writes to a file when --out is given, no warnings for a clean dir', () => {
    // A dir with only well-classified, biome-named assets → zero stderr warnings.
    const clean = join(root, 'clean');
    mkdirSync(join(clean, 'models'), { recursive: true });
    writeFileSync(join(clean, 'models', 'archer.glb'), '');
    runBind({ command: 'bind', flags: { dir: clean, out: 'pack.json' } });
    const written = JSON.parse(readFileSync(join(root, 'pack.json'), 'utf8'));
    expect(safeParseAssetSourceSpec(written).success).toBe(true);
    expect(logs.join('\n')).toContain('Wrote AssetSourceSpec');
    expect(errors).toHaveLength(0);
  });

  it('throws when --dir is missing', () => {
    expect(() => runBind({ command: 'bind', flags: {} })).toThrow(GameboardCliError);
  });

  it('throws when the dir yields no classifiable assets (spec needs ≥1)', () => {
    const empty = join(root, 'empty');
    mkdirSync(empty, { recursive: true });
    writeFileSync(join(empty, 'notes.txt'), ''); // unclassifiable → zero assets
    expect(() => runBind({ command: 'bind', flags: { dir: empty } })).toThrow(/did not validate/);
  });

  it('skips symlinked entries during the directory walk', () => {
    // A symlink (to a file or dir) is skipped so the walk can't cycle or escape.
    symlinkSync(join(assets, 'models', 'knight.glb'), join(assets, 'models', 'link.glb'));
    runBind({ command: 'bind', flags: { dir: assets } });
    const spec = JSON.parse(stdout);
    // Only the real knight.glb is present — the symlink 'link.glb' was skipped.
    expect(spec.assets.filter((a: { role: string }) => a.role === 'model')).toHaveLength(1);
  });

  it('run() delegates to runBind (CLI entrypoint)', () => {
    run({ command: 'bind', flags: { dir: assets } }, root, 'free');
    expect(JSON.parse(stdout).name).toBe('assets');
  });

  it('records the scanned dir as assetRoot by default, overridable by --asset-root', () => {
    runBind({ command: 'bind', flags: { dir: assets } });
    expect(JSON.parse(stdout).assetRoot).toBe(assets);
    stdout = '';
    runBind({ command: 'bind', flags: { dir: assets, 'asset-root': 'public/assets' } });
    expect(JSON.parse(stdout).assetRoot).toBe('public/assets');
  });
});
