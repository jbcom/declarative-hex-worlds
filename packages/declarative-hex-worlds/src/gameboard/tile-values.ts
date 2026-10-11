/**
 * Validation for the open, game-owned values a tile can carry beside its
 * terrain: the `biome` string and the named numeric `fields`. Koota-free so
 * the builder, the runtime and the terrain bridge share one definition of
 * "valid".
 *
 * @module
 */
import { GameboardValidationError } from '../errors';

/** Field names that would reach the prototype chain through a dynamic key. */
const FORBIDDEN_FIELD_NAMES: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);

function tileLabel(tileKey: string | undefined): string {
  return tileKey === undefined ? 'Tile' : `Tile ${tileKey}`;
}

/** Whether a value is a usable tile biome: a string with a non-blank character. */
export function isGameboardTileBiome(biome: unknown): biome is string {
  return typeof biome === 'string' && biome.trim().length > 0;
}

/**
 * Throws `GameboardValidationError` unless `biome` is a non-empty string. The
 * library never enumerates or restricts the vocabulary: any non-blank string
 * is a biome. Pass `tileKey` to name the offending tile in the message.
 */
export function assertGameboardTileBiome(
  biome: unknown,
  tileKey?: string
): asserts biome is string {
  if (!isGameboardTileBiome(biome)) {
    throw new GameboardValidationError(`${tileLabel(tileKey)} biome must be a non-empty string`);
  }
}

/**
 * Describes why `fields` is not a valid tile field store, or `undefined` when
 * it is valid: a plain record whose names are non-empty (and not prototype
 * keys) and whose values are finite numbers.
 */
export function describeGameboardTileFieldsProblem(fields: unknown): string | undefined {
  if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) {
    return 'fields must be a record of finite numbers keyed by field name';
  }
  const prototype = Object.getPrototypeOf(fields);
  if (prototype !== Object.prototype && prototype !== null) {
    return 'fields must be a record of finite numbers keyed by field name';
  }
  for (const [name, value] of Object.entries(fields)) {
    if (name.length === 0 || FORBIDDEN_FIELD_NAMES.has(name)) {
      return `field name ${JSON.stringify(name)} is not allowed`;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return `field ${name} must be a finite number`;
    }
  }
  return undefined;
}

/**
 * Throws `GameboardValidationError` unless `fields` is a record of finite
 * numbers keyed by non-empty field names. Pass `tileKey` to name the offending
 * tile in the message.
 */
export function assertGameboardTileFields(
  fields: unknown,
  tileKey?: string
): asserts fields is Readonly<Record<string, number>> {
  const problem = describeGameboardTileFieldsProblem(fields);
  if (problem !== undefined) {
    throw new GameboardValidationError(`${tileLabel(tileKey)} ${problem}`);
  }
}

/**
 * Validates `incoming` and returns the tile's next field store: `incoming`
 * alone when `replace` is set, otherwise `existing` with `incoming` merged
 * over it. The result is a fresh, name-sorted copy; nothing is returned (an
 * error is thrown instead) when `incoming` is invalid.
 */
export function mergeGameboardTileFields(
  existing: Readonly<Record<string, number>> | undefined,
  incoming: unknown,
  options: { replace?: boolean } = {},
  tileKey?: string
): Readonly<Record<string, number>> {
  assertGameboardTileFields(incoming, tileKey);
  return normalizeGameboardTileFields(
    options.replace ? incoming : { ...existing, ...incoming },
    tileKey
  );
}

/**
 * Validates `fields` and returns a fresh copy with its names sorted, so equal
 * field sets serialize identically whatever order they were written in.
 */
export function normalizeGameboardTileFields(
  fields: unknown,
  tileKey?: string
): Readonly<Record<string, number>> {
  assertGameboardTileFields(fields, tileKey);
  const normalized: Record<string, number> = {};
  for (const name of Object.keys(fields).sort((left, right) => {
    if (left < right) return -1;
    return Number(left > right);
  })) {
    normalized[name] = fields[name] as number;
  }
  return normalized;
}
