import { describe, expect, it } from 'vitest';
import { projectWorldToGameboardPlan, readDecomposedTileSpecs } from '../../coordinates/index';
import { GameboardRuntimeError, GameboardValidationError } from '../../errors';
import { createGameboardBuilder, type GameboardPlan } from '../../gameboard/index';
import { createGameboardInteropSnapshot } from '../../interop/index';
import { createGameboardPlanFromRecipe, createGameboardRecipe } from '../../scenario/recipe';
import { applyGameboardRecipeGeneration } from '../../scenario/recipe-generation';
import { setTileFields } from '../../systems/index';
import { HexTileState, TileBiome, TileFields } from '../../traits/index';
import { createGameboardWorld, findTileEntity, readGameboardTiles } from '../index';

const SHAPE = { kind: 'rectangle', width: 5, height: 5 } as const;

function fieldPlan(): GameboardPlan {
  return createGameboardBuilder({ seed: 'koota-fields', shape: SHAPE })
    .setBiome({ q: 1, r: 1 }, 'wheat')
    .setFields({ q: 1, r: 1 }, { slope: 0.04, wetness: 0.7 })
    .setFields({ q: 2, r: 1 }, { slope: 0.2 })
    .addRoadPath([
      { q: 1, r: 1 },
      { q: 2, r: 1 },
    ])
    .addHill({ q: 3, r: 1 })
    .setFields({ q: 3, r: 1 }, { slope: 0.5, soil: 0 })
    .build();
}

describe('numeric tile fields in the Koota runtime', () => {
  it('spawns TileFields and HexTileState.fields only for tiles that have fields', () => {
    const world = createGameboardWorld(fieldPlan());
    const entity = findTileEntity(world, '1,1');
    expect(entity?.get(TileFields)).toEqual({ slope: 0.04, wetness: 0.7 });
    expect(entity?.get(HexTileState)?.fields).toEqual({ slope: 0.04, wetness: 0.7 });
    expect(findTileEntity(world, '0,0')?.has(TileFields)).toBe(false);
    expect(world.query(TileFields)).toHaveLength(3);
    world.destroy();
  });

  it('round-trips spawn -> world -> read-back -> projection with biome and fields intact', () => {
    const plan = fieldPlan();
    const world = createGameboardWorld(plan);

    const specs = readDecomposedTileSpecs(world);
    for (const tile of plan.tiles) {
      const spec = specs.find((candidate) => candidate.key === tile.key);
      expect(spec?.fields).toEqual(tile.fields);
      expect(spec?.biome).toBe(tile.biome);
    }
    expect(readGameboardTiles(world).find((tile) => tile.key === '3,1')?.fields).toEqual({ slope: 0.5, soil: 0 });

    const projected = projectWorldToGameboardPlan(world);
    expect(projected.tiles.map((tile) => [tile.key, tile.biome, tile.fields])).toEqual(
      plan.tiles.map((tile) => [tile.key, tile.biome, tile.fields])
    );
    expect(projected.tiles.find((tile) => tile.key === '3,1')).toMatchObject({
      terrain: 'hill',
      fields: { slope: 0.5, soil: 0 },
    });
    world.destroy();
  });

  it('reads fields back as copies, so callers cannot mutate world state through a projection', () => {
    const world = createGameboardWorld(fieldPlan());
    const projected = projectWorldToGameboardPlan(world);
    const fields = projected.tiles.find((tile) => tile.key === '1,1')?.fields as Record<string, number>;
    fields.slope = 123;
    expect(findTileEntity(world, '1,1')?.get(TileFields)?.slope).toBe(0.04);
    world.destroy();
  });

  it('does not alias plan fields in world state', () => {
    const plan = fieldPlan();
    const world = createGameboardWorld(plan);
    setTileFields(world, '1,1', { slope: 9 });
    expect(plan.tiles.find((tile) => tile.key === '1,1')?.fields).toEqual({ slope: 0.04, wetness: 0.7 });
    world.destroy();
  });

  it('keeps fields through seeded recipe generation', () => {
    const recipe = createGameboardRecipe(
      { seed: 'generation-fields', shape: SHAPE },
      [
        { action: 'setBiome', at: { q: 1, r: 1 }, biome: 'wheat' },
        { action: 'setFields', at: { q: 1, r: 1 }, fields: { wetness: 0.6 } },
      ],
      { layoutFills: [{ id: 'flags', assetId: 'flag_green', archetype: 'prop', count: 3, idPrefix: 'flags' }] }
    );
    const authored = createGameboardPlanFromRecipe({ ...recipe, generation: undefined });
    const generated = applyGameboardRecipeGeneration(authored, recipe.generation);
    expect(generated.placements.length).toBeGreaterThan(authored.placements.length);
    expect(generated.tiles.find((tile) => tile.key === '1,1')).toMatchObject({
      biome: 'wheat',
      fields: { wetness: 0.6 },
    });
  });
});

describe('setTileFields', () => {
  it('merges by default, replaces on request, and survives projection', () => {
    const world = createGameboardWorld(fieldPlan());
    setTileFields(world, '1,1', { wetness: 0.1, soil: 4 });
    expect(findTileEntity(world, '1,1')?.get(TileFields)).toEqual({ slope: 0.04, soil: 4, wetness: 0.1 });
    expect(findTileEntity(world, '1,1')?.get(HexTileState)?.fields).toEqual({ slope: 0.04, soil: 4, wetness: 0.1 });

    setTileFields(world, { q: 1, r: 1 }, { soil: 1 }, { replace: true });
    expect(findTileEntity(world, '1,1')?.get(TileFields)).toEqual({ soil: 1 });

    setTileFields(world, '0,0', { slope: 0.9 });
    const projected = projectWorldToGameboardPlan(world);
    expect(projected.tiles.find((tile) => tile.key === '0,0')?.fields).toEqual({ slope: 0.9 });
    expect(projected.tiles.find((tile) => tile.key === '1,1')?.biome).toBe('wheat');
    expect(findTileEntity(world, '1,1')?.has(TileBiome)).toBe(true);
    world.destroy();
  });

  it('rejects invalid values and unknown tiles with library errors, leaving state untouched', () => {
    const world = createGameboardWorld(fieldPlan());
    expect(() => setTileFields(world, '1,1', { slope: Number.NaN })).toThrow(GameboardValidationError);
    expect(() => setTileFields(world, '99,99', { slope: 1 })).toThrow(GameboardRuntimeError);
    expect(findTileEntity(world, '1,1')?.get(TileFields)).toEqual({ slope: 0.04, wetness: 0.7 });
    world.destroy();
  });
});

describe('tile fields in engine-neutral interop', () => {
  it('exports TileFields as a tile component only when the tile has fields', () => {
    const snapshot = createGameboardInteropSnapshot(fieldPlan());
    expect(snapshot.entities.find((entity) => entity.id === 'tile:1,1')?.components.TileFields).toEqual({
      slope: 0.04,
      wetness: 0.7,
    });
    expect(snapshot.entities.find((entity) => entity.id === 'tile:0,0')?.components).not.toHaveProperty(
      'TileFields'
    );
  });
});
