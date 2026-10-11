import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { createGameboardBuilder } from '../../gameboard/index';
import {
  applyRecipeStep,
  createGameboardPlanFromRecipe,
  createGameboardRecipe,
  inspectGameboardRecipe,
  type GameboardRecipeStep,
} from '../recipe';

const OPTIONS = { seed: 'recipe-biome', shape: { kind: 'rectangle', width: 4, height: 4 } } as const;

describe('setBiome recipe step', () => {
  it('assigns an open biome and keeps it through later road and river steps', () => {
    const steps: GameboardRecipeStep[] = [
      { action: 'setBiome', at: { q: 1, r: 1 }, biome: 'wheat' },
      { action: 'setBiome', at: { q: 2, r: 1 }, biome: 'wheat' },
      {
        action: 'addRoadPath',
        path: [
          { q: 1, r: 1 },
          { q: 2, r: 1 },
        ],
      },
      {
        action: 'addRiverPath',
        path: [
          { q: 2, r: 1 },
          { q: 3, r: 1 },
        ],
      },
      { action: 'setTerrain', at: { q: 1, r: 1 }, terrain: 'water' },
    ];
    const plan = createGameboardPlanFromRecipe(createGameboardRecipe(OPTIONS, steps));
    const one = plan.tiles.find((tile) => tile.key === '1,1');
    const two = plan.tiles.find((tile) => tile.key === '2,1');
    expect(one).toMatchObject({ terrain: 'water', biome: 'wheat' });
    expect(two).toMatchObject({ biome: 'wheat' });
    expect(two?.roadEdges).not.toBe(0);
  });

  it('applies through applyRecipeStep and does not alias the recipe step', () => {
    const step: GameboardRecipeStep = { action: 'setBiome', at: { q: 0, r: 0 }, biome: 'orchard' };
    const recipe = createGameboardRecipe(OPTIONS, [step]);
    (step.at as { q: number }).q = 3;
    expect(recipe.steps[0]).toMatchObject({ at: { q: 0, r: 0 }, biome: 'orchard' });
    const built = applyRecipeStep(createGameboardBuilder(OPTIONS), recipe.steps[0] as GameboardRecipeStep).build();
    expect(built.tiles.find((tile) => tile.key === '0,0')?.biome).toBe('orchard');
  });

  it('round-trips through JSON', () => {
    const recipe = createGameboardRecipe(OPTIONS, [{ action: 'setBiome', at: { q: 1, r: 2 }, biome: 'marsh' }]);
    const revived = JSON.parse(JSON.stringify(recipe)) as typeof recipe;
    expect(createGameboardPlanFromRecipe(revived).tiles.find((tile) => tile.key === '1,2')?.biome).toBe('marsh');
  });

  it('rejects an empty biome with a validation error, and inspect reports it as a compile failure', () => {
    const recipe = createGameboardRecipe(OPTIONS, [{ action: 'setBiome', at: { q: 1, r: 1 }, biome: '' }]);
    expect(() => createGameboardPlanFromRecipe(recipe)).toThrow(GameboardValidationError);
    const inspected = inspectGameboardRecipe(recipe);
    expect(inspected.violations.map((violation) => violation.code)).toContain('recipe.compile_failed');
  });

  it('is carried by setTileAsset steps', () => {
    const recipe = createGameboardRecipe(OPTIONS, [
      { action: 'setTileAsset', at: { q: 1, r: 1 }, assetId: 'hex_grass', biome: 'meadow' },
    ]);
    expect(createGameboardPlanFromRecipe(recipe).tiles.find((tile) => tile.key === '1,1')?.biome).toBe('meadow');
  });
});
