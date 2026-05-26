/**
 * `src/gameboard/` — board lifecycle, occupancy tracking, and navigation.
 *
 * - `./gameboard` — board construction from plan/recipe, tile bookkeeping,
 *   placement queries.
 * - `./occupancy` — placement-vs-tile occupancy maps + collision queries.
 * - `./navigation` — pathfinding, distance queries, patrol-route planning.
 *
 * @module
 */

export * from './gameboard';
export * from './navigation';
export * from './occupancy';
