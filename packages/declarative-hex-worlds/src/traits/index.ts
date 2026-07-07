/**
 * `src/traits/` — umbrella over every koota `trait()` declaration the library
 * defines.
 *
 * Traits live in this sub-package (not scattered through sibling sub-packages)
 * specifically to avoid the koota↔gameboard↔scenario top-level evaluation
 * cycle that the original flat `src/*.ts` layout dodged accidentally. Each
 * trait file imports only `koota` (the npm dep) and pure-type imports —
 * never runtime values from sibling sub-packages.
 *
 * Per PRD §6 invariant 7 (`splitting: true` + trait identity) each trait is
 * exported from exactly one location so reference-equality holds regardless
 * of which subpath a consumer imports from.
 *
 * @module
 */

export * from './board';
export * from './actors';
export * from './movement';
export * from './patrol';
export * from './quests';
