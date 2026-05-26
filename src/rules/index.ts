/**
 * `src/rules/` — gameboard rule engine + plan validation.
 *
 * - `./rules` — rule definitions and evaluation.
 * - `./rule-types` — typed shape of rules, violations, severity.
 * - `./validation` — plan-level validators (checks a `GameboardPlan` against
 *   the active rule config and returns typed violations).
 *
 * `world-rules.ts` (lives in src/ root) is kept separate for now — it owns
 * the runtime rule-evaluation system that ticks against the koota world,
 * which is a different concern from authored rule definitions. It moves to
 * `systems/world-rules-system.ts` in R2n.
 *
 * @module
 */

export * from './rule-types';
export * from './rules';
export * from './validation';
