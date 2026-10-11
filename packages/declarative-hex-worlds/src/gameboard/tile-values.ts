/**
 * Validation for the open, game-owned values a tile can carry beside its
 * terrain: the `biome` string. Koota-free so both the builder and the
 * runtime can share one definition of "valid".
 *
 * @module
 */
import { GameboardValidationError } from '../errors';

/** Whether a value is a usable tile biome: a string with a non-blank character. */
export function isGameboardTileBiome(biome: unknown): biome is string {
  return typeof biome === 'string' && biome.trim().length > 0;
}

/**
 * Throws `GameboardValidationError` unless `biome` is a non-empty string. The
 * library never enumerates or restricts the vocabulary: any non-blank string
 * is a biome. Pass `tileKey` to name the offending tile in the message.
 */
export function assertGameboardTileBiome(biome: unknown, tileKey?: string): asserts biome is string {
  if (!isGameboardTileBiome(biome)) {
    throw new GameboardValidationError(
      `${tileKey === undefined ? 'Tile' : `Tile ${tileKey}`} biome must be a non-empty string`
    );
  }
}
