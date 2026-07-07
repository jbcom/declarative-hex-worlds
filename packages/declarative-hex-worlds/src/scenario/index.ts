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
// Runtime tier: re-export the koota generation applier. `./core` omits it.
export * from './recipe-generation';
export * from './registry';
export * from './scenario';
// LAST: side-effect module that wires the koota applier as the default. Imported
// after ./recipe + ./recipe-generation are fully initialized to avoid the
// import-cycle TDZ. `./core` never pulls this (it imports ../scenario/recipe
// directly, not the barrel).
import './recipe-generation-wiring';
