/**
 * `src/runtime/` — see `./runtime` for full sub-package documentation.
 *
 * Promoted from `src/runtime.ts` into a sub-package in R2; the original
 * file is preserved as the single source of behavior and re-exported
 * verbatim. Deeper internal decomposition (per-system files for actors/
 * movement/patrol, e.g.) lands in later commits as the surface grows.
 *
 * @module
 */

export * from './runtime';
export * from './asset-root';
