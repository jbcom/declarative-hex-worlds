/**
 * `src/bootstrap/` — runtime asset bootstrap for `@jbcom/medieval-hexagon-gameboard`.
 *
 * @remarks
 * The published npm tarball does NOT ship KayKit GLTF binaries. Consumers run
 * the CLI `bootstrap` subcommand (or call {@link bootstrapKayKitAssets}
 * directly) after install to materialize the asset tree under their app's
 * asset root. Two source modes are supported:
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
 * SHA-256 hashes plus provenance (source URL, library version, fetched-at
 * timestamp). {@link verifyBootstrap} re-hashes a bootstrapped tree and
 * reports drift.
 *
 * @module
 */
export * from './bootstrap';
export * from './bootstrap-target';
