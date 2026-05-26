/**
 * `src/interop/` — schema migration, version compatibility, and coverage.
 *
 * - `./interop` — adapter surface for ECS interop (snapshot ↔ external engine
 *   wire shapes), schema-version normalization.
 * - `./compatibility` — peer-compatibility helpers (manifest vs library
 *   version, asset registry compatibility checks).
 * - `./coverage` — release-readiness coverage ledger generation + curated
 *   showcase artifact tables consumed by the CLI's `coverage` subcommand.
 *
 * @module
 */

export * from './compatibility';
export * from './coverage';
export * from './interop';
