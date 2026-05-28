/**
 * SimpleRPG GitHub-bootstrap e2e (PRD RS2, RB7).
 *
 * Scheduled-CI only. Per-PR runs would hit GitHub's anonymous-tarball
 * rate limit. Gated behind `HEX_WORLDS_E2E_GITHUB=1` so the default
 * `pnpm test` loop stays offline-clean.
 *
 * What it asserts:
 *
 * 1. `bootstrapKayKitAssets({ source: { kind: 'github' }, out: <target> })`
 *    downloads + extracts the FREE pack successfully.
 * 2. The resulting tree lives at `<target>/addons/kaykit_medieval_hexagon_pack/Assets/gltf/`.
 * 3. `verifyBootstrap(<target>)` reports clean — every file's sha256
 *    matches the integrity sidecar.
 * 4. The bootstrapped file count matches the FREE manifest's asset count.
 *
 * Rendering assertions land in RS3 once the SimpleRPG `game/` directory's
 * scene/UI builders exist.
 *
 * @module
 */
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import {
  bootstrapKayKitAssets,
  KAYKIT_BOOTSTRAP_GLTF_RELATIVE,
  KAYKIT_BOOTSTRAP_ROOT,
  verifyBootstrap,
} from '../../src/cli/commands/bootstrap';
import { freeManifest } from '../../src/manifest';

function walkFileCount(root: string): number {
  if (!existsSync(root)) {
    return 0;
  }
  let count = 0;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const child = join(root, entry.name);
    if (entry.isDirectory()) {
      count += walkFileCount(child);
    } else if (statSync(child).isFile()) {
      count += 1;
    }
  }
  return count;
}

const RUN = process.env.HEX_WORLDS_E2E_GITHUB === '1';
const tmpRoot = RUN
  ? mkdtempSync(join(tmpdir(), 'medieval-hexagon-rs2-github-'))
  : '';

afterAll(() => {
  if (RUN && tmpRoot && existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

describe.skipIf(!RUN)('SimpleRPG e2e — bootstrap from GitHub (PRD RS2 / RB7)', () => {
  it('downloads + extracts the FREE pack and reports verification clean', async () => {
    const result = await bootstrapKayKitAssets({
      source: { kind: 'github' },
      out: tmpRoot,
      edition: 'free',
    });

    expect(result.edition).toBe('free');
    expect(result.fileCount).toBeGreaterThan(0);

    const gltfRoot = join(tmpRoot, KAYKIT_BOOTSTRAP_ROOT, KAYKIT_BOOTSTRAP_GLTF_RELATIVE);
    expect(existsSync(gltfRoot)).toBe(true);

    const verification = await verifyBootstrap(tmpRoot);
    expect(verification.ok).toBe(true);
    expect(verification.drift).toEqual([]);
  }, 120_000);

  it('bootstrapped GLTF tree contains at least one file per manifest asset', async () => {
    // Re-runs are idempotent — the previous test's bootstrap stays in place.
    const verification = await verifyBootstrap(tmpRoot);
    expect(verification.ok).toBe(true);

    // Manifest names 221 FREE assets. Count actual files (each .gltf has
    // a .bin companion + textures may be shared) and assert the tree is
    // populous enough to cover every manifest entry.
    const gltfRoot = join(tmpRoot, KAYKIT_BOOTSTRAP_ROOT, KAYKIT_BOOTSTRAP_GLTF_RELATIVE);
    expect(walkFileCount(gltfRoot)).toBeGreaterThanOrEqual(freeManifest.counts.total);
  });
});
