/**
 * `src/cli/commands/bootstrap/` — the `bootstrap` CLI command + its runtime
 * asset-bootstrap implementation.
 *
 * @remarks
 * Bootstrap is a CLI-domain capability (reachable only from `src/cli/`), not a
 * runtime-library domain — the umbrella does not re-export it. The published
 * npm tarball does NOT ship KayKit GLTF binaries; consumers run the CLI
 * `bootstrap` subcommand (or call {@link bootstrapKayKitAssets} directly via the
 * `./bootstrap` subpath) after install to materialize the asset tree under
 * their app's asset root. Two source modes are supported:
 *
 * - `{ kind: 'github' }` — downloads the upstream GitHub tarball via `https`
 *   (CC0 FREE edition only).
 * - `{ kind: 'zip', path }` — extracts a user-supplied zip on disk (works for
 *   both FREE and the EXTRA edition purchased on itch.io).
 *
 * Both modes mirror only the `.gltf` + `.bin` + texture files (unless
 * `includeSourceFormats` is set), preserving the upstream `Assets/gltf/`
 * directory structure under
 * `<out>/addons/kaykit_medieval_hexagon_pack/Assets/gltf/`. A
 * `.bootstrap.json` integrity sidecar is written alongside, recording per-file
 * SHA-256 hashes plus provenance. {@link verifyBootstrap} re-hashes a
 * bootstrapped tree and reports drift.
 *
 * @module
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GameboardCliError } from '../../../errors';
import type { PackEdition } from '../../../types';
import { defaultOutRoot, type ParsedArgs, relativizePath, safeResolveOutput } from '../../_shared';
import type {
  BootstrapKayKitAssetsSource,
  BootstrapResult,
  BootstrapVerificationReport,
} from './core';
import { bootstrapKayKitAssets, verifyBootstrap } from './core';
import { bootstrapPack } from './pack-bootstrap';

export * from './core';
export * from './pack-bootstrap';
export * from './registry';
export * from './target';
export * from './upstream-layout';

/**
 * CLI `bootstrap` subcommand entry point (dispatched by `cli.ts`).
 *
 * @internal — invoked only by the CLI dispatcher; not part of the published
 * runtime API and intentionally excluded from TypeDoc.
 */
export async function run(
  parsed: ParsedArgs,
  _sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  await runBootstrap(parsed, edition);
}

export async function runBootstrap(parsed: ParsedArgs, edition: PackEdition): Promise<void> {
  const verifyOnly = parsed.flags.verify === true;
  const outFlag =
    typeof parsed.flags.out === 'string' ? parsed.flags.out : detectDefaultBootstrapOut();
  const outAbsolute = safeResolveOutput(outFlag);
  const jsonMode = parsed.flags.json === true;

  if (verifyOnly) {
    const report = await verifyBootstrap(outAbsolute);
    if (jsonMode) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printBootstrapVerifyReport(report);
    }
    if (!report.ok) {
      process.exit(1);
    }
    return;
  }

  // `--pack <id>`: fetch one of the registered downloadable packs (RFC0-10) from
  // its upstream github source. `--out` is the raw-assets ROOT; the pack lands in
  // `<out>/<packId>/` so `resolveDefaultPackKit`/`assertPackPresent` find it.
  // Bypasses the medieval-only edition/source flags.
  if (typeof parsed.flags.pack === 'string') {
    const packResult = await bootstrapPack(parsed.flags.pack, {
      rawAssetsRoot: outAbsolute,
      outRoot: defaultOutRoot(),
      force: parsed.flags.force === true,
      ...(typeof parsed.flags.commit === 'string' ? { ref: parsed.flags.commit } : {}),
    });
    if (jsonMode) {
      console.log(JSON.stringify(packResult, null, 2));
    } else {
      printBootstrapResult(packResult);
    }
    return;
  }

  const sourceFlag = typeof parsed.flags.source === 'string' ? parsed.flags.source : 'github';
  if (sourceFlag !== 'github' && sourceFlag !== 'zip') {
    throw new GameboardCliError(
      `bootstrap --source must be 'github' or 'zip' (got: ${sourceFlag})`
    );
  }
  const source: BootstrapKayKitAssetsSource =
    sourceFlag === 'github'
      ? {
          kind: 'github',
          ...(typeof parsed.flags.commit === 'string' ? { commit: parsed.flags.commit } : {}),
        }
      : (() => {
          if (typeof parsed.flags.zip !== 'string') {
            throw new GameboardCliError('bootstrap --source zip requires --zip <path>');
          }
          return { kind: 'zip', path: parsed.flags.zip } as const;
        })();

  const result = await bootstrapKayKitAssets({
    source,
    out: outAbsolute,
    outRoot: defaultOutRoot(),
    edition,
    force: parsed.flags.force === true,
    includeSourceFormats: parsed.flags['include-source-formats'] === true,
  });

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printBootstrapResult(result);
  }
}

/**
 * Default `--out` heuristic. Prefers existing `models` (flat bootstrap
 * default), then `public/models` (Vite / Next.js public dir convention), then
 * falls back to `models`. Cosmetic only: every call still routes through
 * {@link safeResolveOutput}.
 */
export function detectDefaultBootstrapOut(): string {
  const cwd = process.cwd();
  const candidates = ['models', 'public/models'];
  for (const candidate of candidates) {
    if (existsSync(join(cwd, candidate))) {
      return candidate;
    }
  }
  return 'models';
}

export function printBootstrapResult(result: BootstrapResult): void {
  console.log(`bootstrapped ${result.edition.toUpperCase()} edition`);
  console.log(`  ${result.fileCount} file(s), ${formatBytes(result.totalBytes)}`);
  console.log(`  root: ${relativizePath(result.outRoot)}`);
  console.log(`  sidecar: ${relativizePath(result.integritySidecar)}`);
}

export function printBootstrapVerifyReport(report: BootstrapVerificationReport): void {
  if (report.ok) {
    console.log(`bootstrap verify OK (${relativizePath(report.sidecarPath)})`);
    return;
  }
  console.error(`bootstrap verify FAILED for ${relativizePath(report.sidecarPath)}`);
  for (const drift of report.drift) {
    console.error(`  ${drift}`);
  }
}

export function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KiB`;
  }
  return `${(value / 1024 / 1024).toFixed(2)} MiB`;
}
