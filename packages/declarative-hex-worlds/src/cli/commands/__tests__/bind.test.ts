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

  it('measures each tileset PNG when --cols/--rows are given, deriving its cell grid', () => {
    // Overwrite the placeholder empty tileset with a real PNG head (480×830), so
    // readPngDimensions + inferTilesetGrid derive an exact 96×83 cell for a 5×10 grid.
    writeFileSync(join(assets, 'tilesets', 'grassland.png'), pngHead(480, 830));
    runBind({ command: 'bind', flags: { dir: assets, cols: '5', rows: '10' } });

    const spec = JSON.parse(stdout);
    const grassland = spec.assets.find((a: { id: string }) => a.id === 'grassland');
    expect(grassland.grid).toEqual({ cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 });
    // A successfully measured tileset does not trigger the "could not measure" report.
    expect(errors.join('\n')).not.toContain('Could not measure tileset "grassland"');
  });

  it('throws on a present-but-invalid --cols (non-positive-integer)', () => {
    expect(() =>
      runBind({ command: 'bind', flags: { dir: assets, cols: 'abc', rows: '10' } })
    ).toThrow(/--cols must be a positive integer/);
    expect(() =>
      runBind({ command: 'bind', flags: { dir: assets, cols: '0', rows: '10' } })
    ).toThrow(GameboardCliError);
  });

  it('throws when --cols is passed as a bare boolean flag (no value)', () => {
    // parseArgs yields `true` for `--cols` with no value; a grid dimension needs a number.
    expect(() =>
      runBind({ command: 'bind', flags: { dir: assets, cols: true, rows: '10' } })
    ).toThrow(/--cols requires a value/);
  });

  it('throws when only one of --cols/--rows is supplied (a grid needs both)', () => {
    expect(() => runBind({ command: 'bind', flags: { dir: assets, cols: '5' } })).toThrow(
      /--cols and --rows must be supplied together/
    );
    expect(() => runBind({ command: 'bind', flags: { dir: assets, rows: '10' } })).toThrow(
      /must be supplied together/
    );
  });

  it('reports (console.error) and falls back when a tileset PNG cannot be measured', () => {
    // The empty grassland.png can't be measured (readPngDimensions throws), so the
    // resolveTilesetGrid catch branch logs the error and returns no grid → the
    // tileset is still emitted with the placeholder and reported as needing a grid.
    runBind({ command: 'bind', flags: { dir: assets, cols: '5', rows: '10' } });

    const stderr = errors.join('\n');
    expect(stderr).toContain('Could not measure tileset "grassland"');
    expect(stderr).toContain('Tilesets need a grid');
  });
});

/** Build the minimal PNG head (signature + IHDR chunk) encoding width×height. */
function pngHead(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  bytes[16] = (width >>> 24) & 0xff;
  bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff;
  bytes[21] = (height >>> 16) & 0xff;
  bytes[22] = (height >>> 8) & 0xff;
  bytes[23] = height & 0xff;
  return bytes;
}
