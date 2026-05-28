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
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { runPackInstallSmoke } from './smoke/pack-install.js';
import { runTypesAttestation } from './smoke/types.js';
import type { SmokeContext } from './smoke/_shared.js';

/**
 * Run `fn` inside a labelled-phase wrapper. Prints a delimiter before the
 * phase, then either `phase <name> PASSED` or `phase <name> FAILED: ...`.
 * Re-throws on failure so the caller can decide whether to continue.
 */
function phase(name: string, fn: () => void): void {
  console.log(`========== phase: ${name} ==========`);
  try {
    fn();
    console.log(`phase ${name} PASSED`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`phase ${name} FAILED: ${message}`);
    throw error;
  }
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const packageRoot = workspaceRoot;
const tempRoot = mkdtempSync(join(tmpdir(), 'medieval-hexagon-consumer-'));
const packRoot = join(tempRoot, 'pack');
const appRoot = join(tempRoot, 'app');
const keepTemp = process.env.HEX_WORLDS_KEEP_CONSUMER_SMOKE === '1';

const ctx: SmokeContext = {
  workspaceRoot,
  packageRoot,
  tempRoot,
  packRoot,
  appRoot,
  keepTemp,
};

try {
  phase('setup', () => {
    mkdirSync(packRoot);
    mkdirSync(appRoot);
  });
  phase('pack-install', () => runPackInstallSmoke(ctx));
  phase('types-attestation', () => runTypesAttestation(ctx));
  console.log('ALL PHASES PASSED');
} catch {
  process.exitCode = 1;
} finally {
  phase('cleanup', () => {
    if (!keepTemp) {
      rmSync(tempRoot, { recursive: true, force: true });
    } else {
      console.log(`tempdir preserved at ${tempRoot}`);
    }
  });
}
