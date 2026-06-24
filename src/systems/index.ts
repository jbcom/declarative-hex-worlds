/**
 * `src/systems/` — per-tick systems that read traits + apply mutations to the
 * koota world.
 *
 * Each file is a single system function (or a small cohesive bundle of
 * related system functions). Composition into the per-frame tick happens in
 * `src/frameloop.ts` (post-Epic-R2r).
 *
 * - `./events` — system event contracts and serializable event snapshots.
 * - `./systems` — combined movement/patrol/quests/command-handling systems
 *   (will split per-system as the simulation grows).
 * - `./world-rules-system` — runtime rule-evaluation system (was
 *   `src/world-rules.ts` before R2n).
 *
 * @module
 */

export * from './events';
export * from './systems';
export * from './world-rules-system';
