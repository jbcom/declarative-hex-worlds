/**
 * `src/gameboard/` — board lifecycle, occupancy tracking, and navigation.
 *
 * - `./assets` — asset lookup, EXTRA detection, and semantic prop clusters.
 * - `./plan` — serializable plan contracts, plan indexes, and summary helpers.
 * - `./terrain` — derived terrain and connectivity placement construction.
 * - `./gameboard` — fluent board builder and built-in sample boards.
 * - `./occupancy` — placement-vs-tile occupancy maps + collision queries.
 * - `./navigation` — pathfinding, distance queries, patrol-route planning.
 *
 * @module
 */

export * from './assets';
export * from './plan';
export * from './gameboard';
export * from './navigation';
export * from './occupancy';
