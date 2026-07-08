/**
 * `web` CLI command (RFC 0001 RFC0-CLI, authoring path 3 — the VISUAL configurator).
 *
 * Scans an assets directory, then serves a local web form on `127.0.0.1`: the developer
 * makes visual binding choices (biome / gameplay category / tileset grid) in the browser
 * and clicks Save; the CLI validates + writes the `AssetSourceSpec` and shuts the server
 * down. It complements `bind` (agent, flags/JSON) and `init` (human, TTY wizard) — same
 * pure scan core, a third front-end for the developer who wants a visual pass.
 *
 * Security: the server binds to loopback only (never `0.0.0.0`), caps the request body,
 * and only ever WRITES the spec through the same `safeResolveOutput` path-traversal guard
 * the other write-commands use. It serves exactly two routes and 404s everything else.
 *
 * Flags:
 *   --dir <path>    (required) the assets root to scan.
 *   --name <name>   source name (default: the dir's basename).
 *   --asset-root <p> assetRoot recorded in the spec (default: the scanned --dir).
 *   --out <path>    write the JSON here (default: <name>.assets.json in the cwd).
 *   --port <n>      port to listen on (default: 0 → an OS-assigned free port).
 *
 * The URL is printed for the developer to open — no auto-launch, so the command stays
 * dependency-free and works over SSH / in a headless/remote shell.
 *
 * @module
 */

import { readdirSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { basename, join, relative, resolve } from 'node:path';
import { buildAssetSourceSpec, safeParseAssetSourceSpec } from '../../../asset-source';
import { GameboardCliError } from '../../../errors';
import type { PackEdition } from '../../../types';
import { type ParsedArgs, safeResolveOutput } from '../../_shared';
import {
  applyWebChoices,
  buildWebConfigPayload,
  renderConfigPage,
  type WebAssetChoice,
} from './config-page';

/** Max accepted POST body — a spec of choices is tiny; anything larger is rejected. */
const MAX_BODY_BYTES = 1_000_000;

/** Recursively collect every file path under `root`, relative to `root` (see bind.ts). */
function collectFiles(root: string, current: string = root): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const full = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...collectFiles(root, full));
    } else {
      files.push(relative(root, full).replace(/\\/g, '/'));
    }
  }
  return files;
}

/** Read a request body up to the cap, rejecting an oversized stream. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejectPromise(new GameboardCliError('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rejectPromise);
  });
}

/** Parse the posted `{ choices }` body into a validated choice list (throws on bad shape). */
export function parseChoicesBody(raw: string): WebAssetChoice[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GameboardCliError('body is not valid JSON');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { choices?: unknown }).choices)
  ) {
    throw new GameboardCliError('body must be { choices: [...] }');
  }
  return (parsed as { choices: WebAssetChoice[] }).choices;
}

/**
 * The pure request → response mapping for the two routes, given the current payload +
 * a `save` callback the POST handler invokes with the validated final spec. Returns the
 * status, content-type, and body; `done` signals the server can shut down. Split out so it
 * is unit-testable without a live socket.
 */
export async function handleRequest(
  method: string | undefined,
  url: string | undefined,
  readRawBody: () => Promise<string>,
  ctx: {
    readonly payloadJson: string;
    readonly page: string;
    save: (choices: readonly WebAssetChoice[]) => { path: string };
  }
): Promise<{ status: number; contentType: string; body: string; done: boolean }> {
  if (method === 'GET' && (url === '/' || url === '/index.html')) {
    return { status: 200, contentType: 'text/html; charset=utf-8', body: ctx.page, done: false };
  }
  if (method === 'GET' && url === '/api/spec') {
    return { status: 200, contentType: 'application/json', body: ctx.payloadJson, done: false };
  }
  if (method === 'POST' && url === '/api/spec') {
    try {
      const choices = parseChoicesBody(await readRawBody());
      const { path } = ctx.save(choices);
      return {
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ path }),
        done: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: message }),
        done: false,
      };
    }
  }
  return { status: 404, contentType: 'text/plain', body: 'Not found', done: false };
}

/** CLI entrypoint — scan, serve on loopback, write the spec on Save, then exit. */
export async function run(
  parsed: ParsedArgs,
  _sourceRoot: string,
  _edition: PackEdition
): Promise<void> {
  const dirFlag = parsed.flags.dir;
  if (typeof dirFlag !== 'string' || dirFlag.length === 0) {
    throw new GameboardCliError('web requires --dir <assets path>');
  }
  const dir = resolve(String(dirFlag));
  const name = typeof parsed.flags.name === 'string' ? parsed.flags.name : basename(dir);
  const assetRoot =
    typeof parsed.flags['asset-root'] === 'string' ? String(parsed.flags['asset-root']) : dir;
  const port = typeof parsed.flags.port === 'string' ? Number(parsed.flags.port) : 0;
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new GameboardCliError('--port must be an integer between 0 and 65535');
  }

  const files = collectFiles(dir).map((path) => ({ path }));
  const { spec } = buildAssetSourceSpec(files, { name, assetRoot });
  const payload = buildWebConfigPayload(spec);
  const payloadJson = JSON.stringify(payload);
  const page = renderConfigPage(payload);

  const outFlag = typeof parsed.flags.out === 'string' ? parsed.flags.out : `${name}.assets.json`;

  const save = (choices: readonly WebAssetChoice[]): { path: string } => {
    const refined = applyWebChoices(spec, choices);
    const validation = safeParseAssetSourceSpec(refined);
    if (!validation.success) {
      /* v8 ignore next -- a failed parse always carries ≥1 issue; the ?? is defensive. */
      const firstIssue = validation.error.issues[0]?.message ?? 'unknown';
      throw new GameboardCliError(`The spec did not validate. First issue: ${firstIssue}`);
    }
    const outPath = safeResolveOutput(outFlag);
    writeFileSync(outPath, `${JSON.stringify(refined, null, 2)}\n`, 'utf8');
    return { path: outPath };
  };

  await serve({ page, payloadJson, save, port });
}

/**
 * Start the loopback server and resolve once the spec is saved (or the process is
 * interrupted). Exported for an integration test that drives it over a real socket.
 */
export function serve(ctx: {
  readonly page: string;
  readonly payloadJson: string;
  save: (choices: readonly WebAssetChoice[]) => { path: string };
  readonly port: number;
}): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
      void handleRequest(req.method, req.url, () => readBody(req), ctx)
        .then((result) => {
          res.writeHead(result.status, { 'content-type': result.contentType });
          res.end(result.body);
          if (result.done) {
            server.close(() => resolvePromise());
          }
        })
        .catch((error: unknown) => {
          /* v8 ignore start -- defensive: handleRequest catches its own errors, so this
             only fires on an unexpected internal fault. */
          res.writeHead(500, { 'content-type': 'text/plain' });
          res.end('Internal error');
          rejectPromise(error instanceof Error ? error : new Error(String(error)));
          /* v8 ignore stop */
        });
    });
    // Loopback only — never expose the config server on the network.
    server.listen(ctx.port, '127.0.0.1', () => {
      const address = server.address();
      /* v8 ignore next -- server.address() is an AddressInfo object once listening; the fallback is defensive. */
      const boundPort = typeof address === 'object' && address ? address.port : ctx.port;
      console.log(
        `\nOpen http://127.0.0.1:${boundPort}/ to configure the bindings, then click Save.`
      );
    });
    server.on('error', rejectPromise);
  });
}
