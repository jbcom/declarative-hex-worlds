import { describe, expect, it } from 'vitest';
import { projectWorldToGameboardPlan, readDecomposedTileSpecs } from '../../coordinates/index';
import { GameboardRuntimeError, GameboardValidationError } from '../../errors';
import { createGameboardBuilder, type GameboardPlan } from '../../gameboard/index';
import { createGameboardInteropSnapshot } from '../../interop/index';
import { createGameboardPlanFromRecipe, createGameboardRecipe } from '../../scenario/recipe';
import { applyGameboardRecipeGeneration } from '../../scenario/recipe-generation';
import { setTileBiome } from '../../systems/index';
import { HexTileState, TileBiome } from '../../traits/index';
import {
  createGameboardWorld,
  findTileEntity,
  readGameboardTiles,
  spawnGameboardPlan,
} from '../index';

const SHAPE = { kind: 'rectangle', width: 5, height: 5 } as const;

function biomePlan(): GameboardPlan {
  return createGameboardBuilder({ seed: 'koota-biome', shape: SHAPE })
    .setBiome({ q: 1, r: 1 }, 'wheat')
    .setBiome({ q: 2, r: 1 }, 'orchard')
    .addRoadPath([
      { q: 1, r: 1 },
      { q: 2, r: 1 },
    ])
    .addRiverPath([
      { q: 2, r: 2 },
      { q: 3, r: 2 },
    ])
    .setBiome({ q: 2, r: 2 }, 'marsh')
    .addHill({ q: 3, r: 1 })
    .setBiome({ q: 3, r: 1 }, 'upland')
    .build();
}

describe('tile biome in the Koota runtime', () => {
  it('spawns TileBiome and HexTileState.biome only for tiles that have a biome', () => {
    const world = createGameboardWorld(biomePlan());
    const entity = findTileEntity(world, '1,1');
    expect(entity?.get(TileBiome)).toEqual({ biome: 'wheat' });
    expect(entity?.get(HexTileState)?.biome).toBe('wheat');
    const bare = findTileEntity(world, '0,0');
    expect(bare?.has(TileBiome)).toBe(false);
    expect(bare?.get(HexTileState)?.biome).toBeUndefined();
    expect(world.query(TileBiome)).toHaveLength(4);
    world.destroy();
  });

  it('round-trips spawn -> world -> read-back -> projection without loss', () => {
    const plan = biomePlan();
    const world = createGameboardWorld(plan);

    const specs = readDecomposedTileSpecs(world);
    for (const tile of plan.tiles) {
      expect(specs.find((spec) => spec.key === tile.key)?.biome).toBe(tile.biome);
    }
    expect(readGameboardTiles(world).find((tile) => tile.key === '2,2')?.biome).toBe('marsh');

    const projected = projectWorldToGameboardPlan(world);
    expect(projected.tiles.map((tile) => [tile.key, tile.biome])).toEqual(
      plan.tiles.map((tile) => [tile.key, tile.biome])
    );
    // Terrain features did not disturb biome.
    expect(projected.tiles.find((tile) => tile.key === '2,2')).toMatchObject({ terrain: 'river', biome: 'marsh' });
    expect(projected.tiles.find((tile) => tile.key === '3,1')).toMatchObject({ terrain: 'hill', biome: 'upland' });

    // A second generation of the same trip is stable.
    const again = createGameboardWorld(projected);
    expect(projectWorldToGameboardPlan(again).tiles).toEqual(projected.tiles);
    again.destroy();
    world.destroy();
  });

  it('keeps biome through seeded recipe generation, which projects through a world', () => {
    const recipe = createGameboardRecipe(
      { seed: 'generation-biome', shape: SHAPE },
      [
        { action: 'setBiome', at: { q: 1, r: 1 }, biome: 'wheat' },
        { action: 'setBiome', at: { q: 2, r: 2 }, biome: 'marsh' },
      ],
      {
        layoutFills: [{ id: 'flags', assetId: 'flag_green', archetype: 'prop', count: 3, idPrefix: 'flags' }],
      }
    );
    const plan = createGameboardPlanFromRecipe(recipe);
    expect(plan.placements.some((placement) => placement.id.startsWith('flags'))).toBe(true);
    expect(plan.tiles.find((tile) => tile.key === '1,1')?.biome).toBe('wheat');
    expect(plan.tiles.find((tile) => tile.key === '2,2')?.biome).toBe('marsh');

    const authored = createGameboardPlanFromRecipe({ ...recipe, generation: undefined });
    const generated = applyGameboardRecipeGeneration(authored, recipe.generation);
    expect(generated.tiles.map((tile) => tile.biome)).toEqual(authored.tiles.map((tile) => tile.biome));
  });

  it('does not alias plan tiles in world state', () => {
    const plan = biomePlan();
    const world = createGameboardWorld(plan);
    setTileBiome(world, '1,1', 'fallow');
    expect(plan.tiles.find((tile) => tile.key === '1,1')?.biome).toBe('wheat');
    world.destroy();
  });

  it('spawns into an existing world', () => {
    const world = createGameboardWorld();
    const { tiles } = spawnGameboardPlan(world, biomePlan());
    expect(tiles.get('1,1')?.get(TileBiome)?.biome).toBe('wheat');
    world.destroy();
  });
});

describe('setTileBiome', () => {
  it('updates the aggregate and decomposed traits together, and survives projection', () => {
    const world = createGameboardWorld(biomePlan());
    setTileBiome(world, '0,0', 'fallow');
    setTileBiome(world, { q: 1, r: 1 }, 'corn');
    const entity = findTileEntity(world, '0,0');
    expect(entity?.get(TileBiome)).toEqual({ biome: 'fallow' });
    expect(entity?.get(HexTileState)?.biome).toBe('fallow');
    const projected = projectWorldToGameboardPlan(world);
    expect(projected.tiles.find((tile) => tile.key === '0,0')?.biome).toBe('fallow');
    expect(projected.tiles.find((tile) => tile.key === '1,1')?.biome).toBe('corn');
    world.destroy();
  });

  it('clears a biome when given undefined', () => {
    const world = createGameboardWorld(biomePlan());
    setTileBiome(world, '1,1', undefined);
    const entity = findTileEntity(world, '1,1');
    expect(entity?.has(TileBiome)).toBe(false);
    expect(entity?.get(HexTileState)?.biome).toBeUndefined();
    expect(projectWorldToGameboardPlan(world).tiles.find((tile) => tile.key === '1,1')).not.toHaveProperty('biome');
    setTileBiome(world, '0,0', undefined);
    expect(findTileEntity(world, '0,0')?.has(TileBiome)).toBe(false);
    world.destroy();
  });

  it('rejects blank biomes and unknown tiles with library errors', () => {
    const world = createGameboardWorld(biomePlan());
    expect(() => setTileBiome(world, '1,1', '')).toThrow(GameboardValidationError);
    expect(() => setTileBiome(world, '99,99', 'wheat')).toThrow(GameboardRuntimeError);
    expect(findTileEntity(world, '1,1')?.get(TileBiome)).toEqual({ biome: 'wheat' });
    world.destroy();
  });
});

describe('tile biome in engine-neutral interop', () => {
  it('exports TileBiome as a tile component only when the tile has a biome', () => {
    const snapshot = createGameboardInteropSnapshot(biomePlan());
    const wheat = snapshot.entities.find((entity) => entity.id === 'tile:1,1');
    const bare = snapshot.entities.find((entity) => entity.id === 'tile:0,0');
    expect(wheat?.components.TileBiome).toEqual({ biome: 'wheat' });
    expect(bare?.components).not.toHaveProperty('TileBiome');
  });
});
