/**
 * Packed-consumer smoke orchestrator (PRD D10).
 *
 * Coordinates a labelled-phase run against a freshly packed tarball:
 *   1. `setup` — create the shared tempdir tree.
 *   2. `pack-install` — runtime smoke; pack + install + run the CLI + run
 *      `smoke.mjs` (see {@link ./smoke/pack-install#runPackInstallSmoke}).
 *   3. `types-attestation` — compile-time API attestation; `tsc --noEmit`
 *      against the installed `.d.ts` surface (see
 *      {@link ./smoke/types#runTypesAttestation}).
 *   4. `cleanup` — remove the tempdir (unless
 *      `HEX_WORLDS_KEEP_CONSUMER_SMOKE=1`).
 *
 * Each phase prints a delimiter (`========== phase: <name> ==========`) so
 * log readers can locate the failing phase at a glance. A phase failure
 * prints `phase <name> FAILED: <message>` and exits the orchestrator with
 * status 1; later phases are skipped, but `cleanup` always runs via the
 * outer try/finally.
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPackInstallSmoke } from './smoke/pack-install.js';
import { runTypesAttestation } from './smoke/types.js';
import type { SmokeContext } from './smoke/_shared.js';

type Log = (message: string) => void;
type ErrorLog = (message: string) => void;
type Mkdir = (path: string) => void;
type Mkdtemp = (prefix: string) => string;
type Rm = (path: string, options: { recursive: true; force: true }) => void;
type SmokePhase = (ctx: SmokeContext) => void;

export interface PackedConsumerSmokeDependencies {
  workspaceRoot?: string;
  env?: NodeJS.ProcessEnv;
  tmpdirImpl?: () => string;
  mkdtempSyncImpl?: Mkdtemp;
  mkdirSyncImpl?: Mkdir;
  rmSyncImpl?: Rm;
  runPackInstallSmokeImpl?: SmokePhase;
  runTypesAttestationImpl?: SmokePhase;
  log?: Log;
  error?: ErrorLog;
}

/**
 * Run `fn` inside a labelled-phase wrapper. Prints a delimiter before the
 * phase, then either `phase <name> PASSED` or `phase <name> FAILED: ...`.
 * Re-throws on failure so the caller can decide whether to continue.
 */
export function phase(
  name: string,
  fn: () => void,
  log: Log = console.log,
  errorLog: ErrorLog = console.error
): void {
  log(`========== phase: ${name} ==========`);
  try {
    fn();
    log(`phase ${name} PASSED`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errorLog(`phase ${name} FAILED: ${message}`);
    throw error;
  }
}

export function createPackedConsumerSmokeContext(
  dependencies: PackedConsumerSmokeDependencies = {}
): SmokeContext {
  const workspaceRoot = dependencies.workspaceRoot ?? resolve(import.meta.dirname, '..');
  const tempRoot = (dependencies.mkdtempSyncImpl ?? mkdtempSync)(
    join((dependencies.tmpdirImpl ?? tmpdir)(), 'medieval-hexagon-consumer-')
  );
  return {
    workspaceRoot,
    packageRoot: workspaceRoot,
    tempRoot,
    packRoot: join(tempRoot, 'pack'),
    appRoot: join(tempRoot, 'app'),
    keepTemp: (dependencies.env ?? process.env).HEX_WORLDS_KEEP_CONSUMER_SMOKE === '1',
  };
}

export function runPackedConsumerSmoke(dependencies: PackedConsumerSmokeDependencies = {}): number {
  const ctx = createPackedConsumerSmokeContext(dependencies);
  const log = dependencies.log ?? console.log;
  const errorLog = dependencies.error ?? console.error;
  const mkdir = dependencies.mkdirSyncImpl ?? mkdirSync;
  const rm = dependencies.rmSyncImpl ?? rmSync;
  const packInstall = dependencies.runPackInstallSmokeImpl ?? runPackInstallSmoke;
  const typesAttestation = dependencies.runTypesAttestationImpl ?? runTypesAttestation;
  let exitCode = 0;

  try {
    phase(
      'setup',
      () => {
        mkdir(ctx.packRoot);
        mkdir(ctx.appRoot);
      },
      log,
      errorLog
    );
    phase('pack-install', () => packInstall(ctx), log, errorLog);
    phase('types-attestation', () => typesAttestation(ctx), log, errorLog);
    log('ALL PHASES PASSED');
  } catch {
    exitCode = 1;
  } finally {
    phase(
      'cleanup',
      () => {
        if (!ctx.keepTemp) {
          rm(ctx.tempRoot, { recursive: true, force: true });
        } else {
          log(`tempdir preserved at ${ctx.tempRoot}`);
        }
      },
      log,
      errorLog
    );
  }

  return exitCode;
}

export function isDirectRun(
  argvEntry = process.argv[1],
  moduleUrl = import.meta.url,
  realpath: (path: string) => string = realpathSync
): boolean {
  if (!argvEntry) {
    return false;
  }
  try {
    return (
      realpath(resolve(argvEntry)).toLowerCase() === realpath(fileURLToPath(moduleUrl)).toLowerCase()
    );
  } catch {
    return false;
  }
}

/* v8 ignore next 3 -- thin executable entrypoint; predicate and smoke helpers are unit-tested. */
if (isDirectRun()) {
  process.exitCode = runPackedConsumerSmoke();
}
