/**
 * `src/cli/commands/bootstrap/pack-bootstrap.ts` — registry-driven pack
 * bootstrap + default-source resolution (RFC 0001 RFC0-10c).
 *
 * Ties the pack REGISTRY (which packs exist + their github source + role) to the
 * descriptor-parameterized download machinery in `./core`. `bootstrapPack`
 * fetches a registered pack by id into a raw-assets root; `resolveDefaultPackKit`
 * reports which packs are materialized there (present) vs missing (with the exact
 * command to fetch them) so an app can compose a default game from whatever is
 * downloaded and fail clearly on what isn't.
 *
 * @module
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GameboardIoError } from '../../../errors';
import { type BootstrapResult, bootstrapKayKitAssets } from './core';
import { PACK_IDS, type PackDescriptor, type PackId, packDescriptor } from './registry';
import { KAYKIT_BOOTSTRAP_SIDECAR } from './target';
import {
  characterPackLayout,
  type KayKitUpstreamLayout,
  kayKitLayoutForEdition,
} from './upstream-layout';

/**
 * Resolve the upstream layout for a pack descriptor. `terrain` packs use the
 * medieval-hexagon layout (FREE edition); `playable`/`enemy` character packs use
 * the flat character-pack layout keyed by the descriptor's `addons/` folder.
 */
export function layoutForPack(descriptor: PackDescriptor): KayKitUpstreamLayout {
  if (descriptor.category === 'terrain') {
    return kayKitLayoutForEdition('free');
  }
  return characterPackLayout(descriptor.packFolder);
}

/** Options for {@link bootstrapPack}. */
export interface BootstrapPackOptions {
  /** Directory the pack materializes into (a gitignored raw-assets root). */
  readonly out: string;
  /** Jail root for `out` resolution (defaults to cwd inside core). */
  readonly outRoot?: string;
  /** Git ref to fetch (defaults to the descriptor's default ref). */
  readonly ref?: string;
  /** Overwrite an existing non-empty target. */
  readonly force?: boolean;
  /** Reproducible sidecar timestamp (tests). */
  readonly fetchedAt?: string;
  /** Sidecar library-version override (tests). */
  readonly libraryVersion?: string;
}

/**
 * Fetch a registered pack by id from its upstream GitHub archive into `out`.
 * Throws a clear error for an unknown pack id (via {@link packDescriptor}).
 */
export async function bootstrapPack(
  id: string,
  options: BootstrapPackOptions
): Promise<BootstrapResult> {
  const descriptor = packDescriptor(id);
  return bootstrapKayKitAssets({
    source: { kind: 'github', commit: options.ref },
    out: options.out,
    outRoot: options.outRoot,
    edition: 'free',
    layout: layoutForPack(descriptor),
    githubSource: descriptor.github,
    force: options.force,
    fetchedAt: options.fetchedAt,
    libraryVersion: options.libraryVersion,
  });
}

/** Whether a pack is materialized at `<rawAssetsRoot>/<packId>` (sidecar present). */
export function isPackMaterialized(id: PackId, rawAssetsRoot: string): boolean {
  return existsSync(join(rawAssetsRoot, id, KAYKIT_BOOTSTRAP_SIDECAR));
}

/** A pack's default-resolution status against a raw-assets root. */
export interface PackResolution {
  /** Pack id. */
  readonly id: PackId;
  /** Absolute directory the pack resolves to (whether or not it's present). */
  readonly dir: string;
  /** True when the pack is materialized there. */
  readonly present: boolean;
}

/**
 * Resolve every registered pack against a raw-assets root, reporting which are
 * present and which are missing. An app composes its default game from the
 * present packs; {@link assertPackPresent} turns a missing required pack into a
 * clear, actionable error. Convention: each pack lives at `<root>/<packId>/`.
 */
export function resolveDefaultPackKit(rawAssetsRoot: string): readonly PackResolution[] {
  return PACK_IDS.map((id) => ({
    id,
    dir: join(rawAssetsRoot, id),
    present: isPackMaterialized(id, rawAssetsRoot),
  }));
}

/**
 * Assert a pack is materialized at `<rawAssetsRoot>/<packId>`, or throw a clear
 * error naming the pack + the exact command to fetch it. This is the
 * "absent → clear error" half of default source resolution (RFC0-10).
 */
export function assertPackPresent(id: string, rawAssetsRoot: string): string {
  const descriptor = packDescriptor(id);
  const dir = join(rawAssetsRoot, descriptor.id);
  if (!existsSync(join(dir, KAYKIT_BOOTSTRAP_SIDECAR))) {
    throw new GameboardIoError(
      `Pack "${descriptor.id}" (${descriptor.displayName}) is not downloaded. ` +
        `Run \`declarative-hex-worlds bootstrap --pack ${descriptor.id} --out ${dir}\` to fetch it.`
    );
  }
  return dir;
}
