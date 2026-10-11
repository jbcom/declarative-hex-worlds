/**
 * Lightweight runtime predicates and Koota world validation helpers for rule
 * checks that should not pull in seeded generation or renderer dependencies.
 *
 * @module
 */
import { hexKey, neighbor } from '../coordinates';
import { GameboardRuntimeError, GameboardValidationError } from '../errors';
import {
  assertGameboardTileBiome,
  type GameboardTerrain,
  type GameboardTileSpec,
  mergeGameboardTileFields,
} from '../gameboard';
import { HexTileState, TileBiome, TileElevation, TileFields, TilePinned, TileTerrain } from '../traits';
import { findTileEntity } from '../koota';
import { readDecomposedTileSpecs, readValidationGameboardPlanFromWorld } from '../coordinates';
import type { GameboardRuleConfig, GameboardRuleViolation } from '../rules';
import type { HexCoordinates } from '../types';
import { canStackInPlan, validateGameboardPlan } from '../rules';
import type { World } from 'koota';

/** Validates the current Koota world by projecting it into a validation plan. */
export function validateGameboardRules(
  world: World,
  config: GameboardRuleConfig = {}
): GameboardRuleViolation[] {
  return validateGameboardPlan(readValidationGameboardPlanFromWorld(world), config);
}

/** Checks whether a world tile can support the requested elevation. */
export function canStackAt(
  world: World,
  coordinates: HexCoordinates | string,
  height: number,
  config: GameboardRuleConfig = {}
): boolean {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  return canStackInPlan(readValidationGameboardPlanFromWorld(world), key, height, config);
}

/** Checks whether a harbor may face water from the requested world tile. */
export function canPlaceHarborAt(world: World, coordinates: HexCoordinates, facing: number): boolean {
  const tile = tileSpecFor(world, coordinates);
  const adjacent = tileSpecFor(world, neighbor(coordinates, facing));
  return Boolean(tile && tile.terrain !== 'water' && adjacent?.terrain === 'water');
}

/** Mutates the terrain state for one tile entity in a Koota world. */
export function setTileTerrain(
  world: World,
  coordinates: HexCoordinates | string,
  terrain: GameboardTerrain
): void {
  const entity = findTileEntity(world, coordinates);
  if (!entity) {
    throw new GameboardRuntimeError(`No tile exists at ${typeof coordinates === 'string' ? coordinates : hexKey(coordinates)}`);
  }
  entity.set(TileTerrain, { terrain });
  entity.set(HexTileState, { terrain });
}

/**
 * Mutates the game-owned biome of one tile entity in a Koota world, keeping
 * the aggregate `HexTileState` and the decomposed `TileBiome` trait in step.
 * Pass `undefined` to remove the biome (and the `TileBiome` trait). The biome
 * is independent of terrain, so `setTileTerrain` never changes it.
 */
export function setTileBiome(
  world: World,
  coordinates: HexCoordinates | string,
  biome: string | undefined
): void {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const entity = findTileEntity(world, coordinates);
  if (!entity) {
    throw new GameboardRuntimeError(`No tile exists at ${key}`);
  }
  if (biome === undefined) {
    entity.remove(TileBiome);
    entity.set(HexTileState, { biome: undefined });
    return;
  }
  assertGameboardTileBiome(biome, key);
  if (entity.has(TileBiome)) {
    entity.set(TileBiome, { biome });
  } else {
    entity.add(TileBiome({ biome }));
  }
  entity.set(HexTileState, { biome });
}

/**
 * Mutates the numeric field channels of one tile entity in a Koota world,
 * keeping the aggregate `HexTileState` and the decomposed `TileFields` trait in
 * step. New values merge into the tile's existing fields; pass
 * `{ replace: true }` to replace the whole store. Every value must be a finite
 * number, and nothing changes when validation fails.
 */
export function setTileFields(
  world: World,
  coordinates: HexCoordinates | string,
  fields: Readonly<Record<string, number>>,
  options: { replace?: boolean } = {}
): void {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const entity = findTileEntity(world, coordinates);
  if (!entity) {
    throw new GameboardRuntimeError(`No tile exists at ${key}`);
  }
  const next = mergeGameboardTileFields(entity.get(TileFields), fields, options, key);
  if (entity.has(TileFields)) {
    entity.set(TileFields, { ...next });
  } else {
    entity.add(TileFields({ ...next }));
  }
  entity.set(HexTileState, { fields: { ...next } });
}

/**
 * Changes a live tile's generation pin, keeping the marker and aggregate view
 * synchronized for layout fills and serialization. Defaults to pinning; pass
 * false to unpin. Invalid values do not modify either representation.
 */
export function setTilePinned(
  world: World,
  coordinates: HexCoordinates | string,
  pinned = true
): void {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  const entity = findTileEntity(world, coordinates);
  if (!entity) throw new GameboardRuntimeError(`No tile exists at ${key}`);
  if (typeof pinned !== 'boolean') {
    throw new GameboardValidationError(`Tile ${key} pinned must be a boolean`);
  }
  if (pinned) {
    if (!entity.has(TilePinned)) entity.add(TilePinned);
  } else {
    entity.remove(TilePinned);
  }
  entity.set(HexTileState, { pinned: pinned ? true : undefined });
}

/** Mutates the elevation state for one tile entity in a Koota world. */
export function setTileElevation(
  world: World,
  coordinates: HexCoordinates | string,
  elevation: number
): void {
  const entity = findTileEntity(world, coordinates);
  if (!entity) {
    throw new GameboardRuntimeError(`No tile exists at ${typeof coordinates === 'string' ? coordinates : hexKey(coordinates)}`);
  }
  entity.set(TileElevation, { elevation });
  entity.set(HexTileState, { elevation });
}

function tileSpecFor(world: World, coordinates: HexCoordinates): GameboardTileSpec | undefined {
  return readDecomposedTileSpecs(world).find((tile) => tile.key === hexKey(coordinates));
}
