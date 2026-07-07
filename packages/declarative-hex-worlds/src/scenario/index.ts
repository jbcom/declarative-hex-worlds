/**
 * `src/scenario/` — authored content layer.
 *
 * - `./scenario` — top-level scenario document (board + actors + quests + scripts)
 * - `./recipe` — recipe DSL that compiles to a `GameboardPlan`
 * - `./blueprint` — high-level blueprint generation (procedural board recipes)
 * - `./catalog` — KayKit asset catalog + guide-scenario surface
 * - `./registry` — typed registries for tiles + pieces
 *
 * @module
 */

export * from './blueprint';
export * from './catalog';
export * from './recipe';
// Runtime tier: importing this wires the koota generation applier as the default
// (side-effect) and re-exports applyGameboardRecipeGeneration. `./core` omits it.
export * from './recipe-generation';
export * from './registry';
export * from './scenario';
