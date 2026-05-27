/**
 * Lightweight runtime predicates and Koota world validation helpers for rule
 * checks that should not pull in seeded generation or renderer dependencies.
 *
 * @module
 */
import { hexKey, neighbor } from '../coordinates';
import { GameboardRuntimeError } from '../errors';
import type { GameboardTerrain, GameboardTileSpec } from '../gameboard';
import { HexTileState, TileElevation, TileTerrain } from '../traits';
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
