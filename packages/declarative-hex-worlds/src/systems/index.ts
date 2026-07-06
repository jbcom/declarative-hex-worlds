/**
 * `src/systems/` — per-tick systems that read traits + apply mutations to the
 * koota world.
 *
 * Each file is a single system function (or a small cohesive bundle of
 * related system functions). Composition into the per-frame tick happens in
 * `src/frameloop.ts` (post-Epic-R2r).
 *
 * - `./command-dispatch` — command planning/dispatch plus command event
 *   conversion.
 * - `./events` — system event contracts and serializable event snapshots.
 * - `./tick` — movement/patrol/quest tick orchestration.
 * - `./systems` — high-level actions and command-plus-tick composition.
 * - `./world-rules-system` — runtime rule-evaluation system (was
 *   `src/world-rules.ts` before R2n).
 *
 * @module
 */

export * from './command-dispatch';
export * from './events';
export * from './systems';
export * from './tick';
export * from './world-rules-system';
