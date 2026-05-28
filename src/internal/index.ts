/**
 * `src/internal/` — cross-cutting internal utilities shared across domains.
 *
 * NOT part of the published API. Absent from `package.json#exports`; the root
 * umbrella does not re-export it. Domains import from `'../internal'` for shared
 * predicates/helpers that have no single domain home.
 *
 * @module
 * @internal
 */

export * from './predicates';
