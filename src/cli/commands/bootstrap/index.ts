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
import { runBootstrap, type ParsedArgs } from '../../_shared';
import type { PackEdition } from '../../../types';

export * from './core';
export * from './target';
export * from './upstream-layout';

/** CLI `bootstrap` subcommand entry point (dispatched by `cli.ts`). */
export async function run(
  parsed: ParsedArgs,
  _sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  await runBootstrap(parsed, edition);
}
