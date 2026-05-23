import { hexKey, neighbor } from './coordinates';
import type { GameboardTerrain, GameboardTileSpec } from './gameboard';
import { HexTileState, TileElevation, TileTerrain, findTileEntity } from './koota';
import { readDecomposedTileSpecs, readValidationGameboardPlanFromWorld } from './projection';
import type { GameboardRuleConfig, GameboardRuleViolation } from './rule-types';
import type { HexCoordinates } from './types';
import { canStackInPlan, validateGameboardPlan } from './validation';
import type { World } from 'koota';

export function validateGameboardRules(
  world: World,
  config: GameboardRuleConfig = {}
): GameboardRuleViolation[] {
  return validateGameboardPlan(readValidationGameboardPlanFromWorld(world), config);
}

export function canStackAt(
  world: World,
  coordinates: HexCoordinates | string,
  height: number,
  config: GameboardRuleConfig = {}
): boolean {
  const key = typeof coordinates === 'string' ? coordinates : hexKey(coordinates);
  return canStackInPlan(readValidationGameboardPlanFromWorld(world), key, height, config);
}

export function canPlaceHarborAt(world: World, coordinates: HexCoordinates, facing: number): boolean {
  const tile = tileSpecFor(world, coordinates);
  const adjacent = tileSpecFor(world, neighbor(coordinates, facing));
  return Boolean(tile && tile.terrain !== 'water' && adjacent?.terrain === 'water');
}

export function setTileTerrain(
  world: World,
  coordinates: HexCoordinates | string,
  terrain: GameboardTerrain
): void {
  const entity = findTileEntity(world, coordinates);
  if (!entity) {
    throw new Error(`No tile exists at ${typeof coordinates === 'string' ? coordinates : hexKey(coordinates)}`);
  }
  entity.set(TileTerrain, { terrain });
  entity.set(HexTileState, { terrain });
}

export function setTileElevation(
  world: World,
  coordinates: HexCoordinates | string,
  elevation: number
): void {
  const entity = findTileEntity(world, coordinates);
  if (!entity) {
    throw new Error(`No tile exists at ${typeof coordinates === 'string' ? coordinates : hexKey(coordinates)}`);
  }
  entity.set(TileElevation, { elevation });
  entity.set(HexTileState, { elevation });
}

function tileSpecFor(world: World, coordinates: HexCoordinates): GameboardTileSpec | undefined {
  return readDecomposedTileSpecs(world).find((tile) => tile.key === hexKey(coordinates));
}
