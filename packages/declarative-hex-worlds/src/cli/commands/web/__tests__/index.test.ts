import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeParseAssetSourceSpec } from '../../../../asset-source';
import { GameboardCliError } from '../../../../errors';
import type { WebAssetChoice } from '../config-page';
import { handleRequest, parseChoicesBody, run, serve } from '../index';

describe('web CLI command (RFC0-CLI visual authoring)', () => {
  let root: string;
  let assets: string;
  let previousOutRoot: string | undefined;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hex-worlds-web-'));
    assets = join(root, 'assets');
    mkdirSync(join(assets, 'tiles'), { recursive: true });
    mkdirSync(join(assets, 'models'), { recursive: true });
    writeFileSync(join(assets, 'tiles', 'hex_grass.png'), '');
    writeFileSync(join(assets, 'models', 'knight.glb'), '');
    previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = root;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
    rmSync(root, { recursive: true, force: true });
  });

  describe('parseChoicesBody', () => {
    it('parses a valid { choices } body', () => {
      expect(parseChoicesBody('{"choices":[{"id":"t","biome":"grass"}]}')).toEqual([
        { id: 't', biome: 'grass' },
      ]);
    });
    it('throws on non-JSON', () => {
      expect(() => parseChoicesBody('not json')).toThrow(/not valid JSON/);
    });
    it('throws when choices is missing or not an array', () => {
      expect(() => parseChoicesBody('{"x":1}')).toThrow(/must be \{ choices/);
      expect(() => parseChoicesBody('null')).toThrow(GameboardCliError);
    });
  });

  describe('handleRequest', () => {
    const ctx = {
      payloadJson: '{"spec":{}}',
      page: '<html>page</html>',
      save: (_c: readonly WebAssetChoice[]) => ({ path: '/tmp/out.json' }),
    };
    const noBody = async () => '';

    it('serves the page at / and /index.html', async () => {
      for (const url of ['/', '/index.html']) {
        const r = await handleRequest('GET', url, noBody, ctx);
        expect(r.status).toBe(200);
        expect(r.body).toContain('page');
        expect(r.done).toBe(false);
      }
    });

    it('serves the payload JSON at GET /api/spec', async () => {
      const r = await handleRequest('GET', '/api/spec', noBody, ctx);
      expect(r.contentType).toBe('application/json');
      expect(r.body).toBe('{"spec":{}}');
    });

    it('saves + signals done on a valid POST /api/spec', async () => {
      const r = await handleRequest('POST', '/api/spec', async () => '{"choices":[]}', ctx);
      expect(r.status).toBe(200);
      expect(JSON.parse(r.body).path).toBe('/tmp/out.json');
      expect(r.done).toBe(true);
    });

    it('returns 400 (not done) when the POST body is invalid', async () => {
      const r = await handleRequest('POST', '/api/spec', async () => 'bad', ctx);
      expect(r.status).toBe(400);
      expect(r.done).toBe(false);
      expect(JSON.parse(r.body).error).toMatch(/not valid JSON/);
    });

    it('returns 400 when save() throws (e.g. invalid resulting spec)', async () => {
      const throwing = {
        ...ctx,
        save: () => {
          throw new GameboardCliError('did not validate');
        },
      };
      const r = await handleRequest('POST', '/api/spec', async () => '{"choices":[]}', throwing);
      expect(r.status).toBe(400);
      expect(JSON.parse(r.body).error).toMatch(/did not validate/);
    });

    it('404s an unknown route', async () => {
      const r = await handleRequest('GET', '/nope', noBody, ctx);
      expect(r.status).toBe(404);
    });
  });

  it('serve() answers over a real loopback socket and resolves after a saved POST', async () => {
    let savedChoices: readonly WebAssetChoice[] | undefined;
    const ctx = {
      page: '<html>hi</html>',
      payloadJson: '{"ok":true}',
      port: 0,
      save: (choices: readonly WebAssetChoice[]) => {
        savedChoices = choices;
        return { path: join(root, 'out.json') };
      },
    };
    // Start the server; capture the bound port by spying on listen via the log message.
    let boundPort = 0;
    logSpy.mockImplementation((msg: unknown) => {
      const match = /127\.0\.0\.1:(\d+)/.exec(String(msg));
      if (match) boundPort = Number(match[1]);
    });
    const done = serve(ctx);
    await vi.waitFor(() => expect(boundPort).toBeGreaterThan(0));

    const base = `http://127.0.0.1:${boundPort}`;
    // GET the page + payload.
    expect(await (await fetch(`${base}/`)).text()).toContain('hi');
    expect(await (await fetch(`${base}/api/spec`)).json()).toEqual({ ok: true });
    // POST choices → saves + server shuts down.
    const res = await fetch(`${base}/api/spec`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ choices: [{ id: 'x', biome: 'grass' }] }),
    });
    expect((await res.json()).path).toContain('out.json');
    await done;
    expect(savedChoices).toEqual([{ id: 'x', biome: 'grass' }]);
  });

  it('run() scans, serves, and writes the validated spec on Save (end-to-end)', async () => {
    let boundPort = 0;
    logSpy.mockImplementation((msg: unknown) => {
      const match = /127\.0\.0\.1:(\d+)/.exec(String(msg));
      if (match) boundPort = Number(match[1]);
    });
    const done = run({ command: 'web', flags: { dir: assets, name: 'my-pack' } }, root, 'free');
    await vi.waitFor(() => expect(boundPort).toBeGreaterThan(0));

    const res = await fetch(`http://127.0.0.1:${boundPort}/api/spec`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ choices: [{ id: 'hex_grass', biome: 'grass' }] }),
    });
    const outPath = (await res.json()).path;
    await done;

    const written = JSON.parse(readFileSync(outPath, 'utf8'));
    expect(safeParseAssetSourceSpec(written).success).toBe(true);
    expect(written.name).toBe('my-pack');
  });

  it('run() throws when --dir is missing', async () => {
    await expect(run({ command: 'web', flags: {} }, root, 'free')).rejects.toThrow(
      GameboardCliError
    );
  });

  it('run() throws on an out-of-range --port', async () => {
    await expect(
      run({ command: 'web', flags: { dir: assets, port: '99999' } }, root, 'free')
    ).rejects.toThrow(/--port must be an integer/);
  });
});
