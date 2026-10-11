/**
 * Region id bookkeeping for `GameboardBiomeRegionsSpec.regionField`: where a
 * stage's numbering starts and how an id is merged into a tile's fields.
 * @module
 */
import type { GameboardTileSpec } from '../gameboard/plan';
import { mergeGameboardTileFields } from '../gameboard/tile-values';
import { field } from './biome-regions-tiles';

/**
 * The highest value already stored in `name` on any tile, rounded up to a whole
 * number and never below zero. A stage numbers its regions from the next
 * integer, so ids from stages sharing a field never collide.
 */
export function regionIdOffset(tiles: readonly GameboardTileSpec[], name: string): number {
  let highest = 0;
  for (const tile of tiles) highest = Math.max(highest, field(tile, name) ?? 0);
  return Math.ceil(highest);
}

/** The tile with `id` merged into its fields; every other field is kept, name-sorted. */
export function withRegionId(tile: GameboardTileSpec, name: string, id: number): GameboardTileSpec {
  return {
    ...tile,
    fields: mergeGameboardTileFields(tile.fields, Object.fromEntries([[name, id]]), {}, tile.key),
  };
}
