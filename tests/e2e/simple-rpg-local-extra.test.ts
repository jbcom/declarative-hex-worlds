/**
 * SimpleRPG local-zip bootstrap e2e (PRD RS2).
 *
 * Gated behind `MEDIEVAL_HEXAGON_LOCAL_REFERENCES=1`. Designed for local
 * developer machines that have the FREE pack zip cached under
 * `references/`. CI never runs this (the zip lives outside the repo and
 * outside the CI image).
 *
 * What it asserts:
 *
 * 1. `bootstrapKayKitAssets({ source: { kind: 'zip', path: ... }, out: <target> })`
 *    extracts the FREE pack from the locally cached zip.
 * 2. The resulting tree mirrors the canonical bootstrap layout.
 * 3. `verifyBootstrap(<target>)` is clean.
 * 4. A re-run is idempotent: bootstrap → verify → bootstrap (force=true) → verify
 *    all clean.
 *
 * EXTRA-edition bootstrap is intentionally NOT tested here. EXTRA is paid
 * content (itch.io); no test path assumes its presence on a developer
 * machine. The `assets-embedded/` directory documents how a local
 * contributor with the EXTRA zip can run their own tests against it.
 *
 * @module
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { bootstrapKayKitAssets, verifyBootstrap } from '../../src/cli/commands/bootstrap';

const RUN = process.env.MEDIEVAL_HEXAGON_LOCAL_REFERENCES === '1';
const FREE_ZIP_PATH = resolve(
  process.cwd(),
  'references/KayKit_Medieval_Hexagon_Pack_1.0_FREE.zip'
);
const ZIP_AVAILABLE = RUN && existsSync(FREE_ZIP_PATH);
const tmpRoot = ZIP_AVAILABLE
  ? mkdtempSync(join(tmpdir(), 'medieval-hexagon-rs2-zip-'))
  : '';

afterAll(() => {
  if (ZIP_AVAILABLE && tmpRoot && existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

describe.skipIf(!ZIP_AVAILABLE)('SimpleRPG e2e — bootstrap from local FREE zip (PRD RS2)', () => {
  it('extracts the FREE pack from a local zip and reports verification clean', async () => {
    const result = await bootstrapKayKitAssets({
      source: { kind: 'zip', path: FREE_ZIP_PATH },
      out: tmpRoot,
      edition: 'free',
    });

    expect(result.edition).toBe('free');
    expect(result.fileCount).toBeGreaterThan(0);

    const verification = await verifyBootstrap(tmpRoot);
    expect(verification.ok).toBe(true);
    expect(verification.drift).toEqual([]);
  }, 60_000);

  it('a forced re-run is idempotent — same files, same sidecar, verification stays clean', async () => {
    // The first bootstrap landed in the previous test. Force another run
    // over the same target and confirm the integrity story still holds.
    const second = await bootstrapKayKitAssets({
      source: { kind: 'zip', path: FREE_ZIP_PATH },
      out: tmpRoot,
      edition: 'free',
      force: true,
    });
    expect(second.fileCount).toBeGreaterThan(0);

    const verification = await verifyBootstrap(tmpRoot);
    expect(verification.ok).toBe(true);
    expect(verification.drift).toEqual([]);
  }, 60_000);
});
