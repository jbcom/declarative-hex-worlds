/**
 * `src/coordinates/` — hex coordinate algebra, world-space projection, grid
 * construction, and board layout.
 *
 * Public surface re-exported from the umbrella `@jbcom/medieval-hexagon-gameboard`.
 * Cross-domain consumers MUST import from this barrel — never reach into a
 * sibling file via `'@jbcom/medieval-hexagon-gameboard/coordinates/grid'`.
 *
 * Sub-modules:
 * - `./coordinates` — pure hex axial-coordinate algebra (parse/normalize/distance/range/neighbor/edges)
 * - `./grid` — honeycomb-grid wrappers, axial↔world conversion, KayKit tile dimensions
 * - `./projection` — placement projection (recipe + plan → world-space tile/placement records)
 * - `./layout` — board layout generation (seeded procedural shapes, tile distribution rules)
 *
 * @module
 */

export * from './coordinates';
export * from './grid';
export * from './layout';
export * from './projection';
