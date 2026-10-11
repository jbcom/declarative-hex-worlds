import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import {
  createGameboardPlanFromRecipe,
  createGameboardRecipe,
  type GameboardRecipeStep,
} from '../recipe';

const OPTIONS = {
  seed: 'recipe-fields',
  shape: { kind: 'rectangle', width: 4, height: 4 },
} as const;

describe('setFields recipe step', () => {
  it('merges by default and replaces on request, in step order', () => {
    const steps: GameboardRecipeStep[] = [
      { action: 'setFields', at: { q: 1, r: 1 }, fields: { slope: 0.1, wetness: 0.2 } },
      { action: 'setFields', at: { q: 1, r: 1 }, fields: { wetness: 0.8 } },
      { action: 'setFields', at: { q: 2, r: 1 }, fields: { slope: 1 } },
      { action: 'setFields', at: { q: 2, r: 1 }, fields: { soil: 2 }, replace: true },
      {
        action: 'addRoadPath',
        path: [
          { q: 1, r: 1 },
          { q: 2, r: 1 },
        ],
      },
    ];
    const plan = createGameboardPlanFromRecipe(createGameboardRecipe(OPTIONS, steps));
    expect(plan.tiles.find((tile) => tile.key === '1,1')?.fields).toEqual({
      slope: 0.1,
      wetness: 0.8,
    });
    expect(plan.tiles.find((tile) => tile.key === '2,1')?.fields).toEqual({ soil: 2 });
  });

  it('does not alias the authored field record and round-trips through JSON', () => {
    const fields = { slope: 0.1 };
    const recipe = createGameboardRecipe(OPTIONS, [
      { action: 'setFields', at: { q: 0, r: 0 }, fields },
    ]);
    fields.slope = 5;
    const revived = JSON.parse(JSON.stringify(recipe)) as typeof recipe;
    expect(recipe.steps[0]).toMatchObject({ fields: { slope: 0.1 } });
    expect(
      createGameboardPlanFromRecipe(revived).tiles.find((tile) => tile.key === '0,0')?.fields
    ).toEqual({
      slope: 0.1,
    });
  });

  it('clones setTileAsset fields too', () => {
    const fields = { soil: 1 };
    const recipe = createGameboardRecipe(OPTIONS, [
      { action: 'setTileAsset', at: { q: 0, r: 0 }, assetId: 'hex_grass', fields },
    ]);
    fields.soil = 7;
    expect(
      createGameboardPlanFromRecipe(recipe).tiles.find((tile) => tile.key === '0,0')?.fields
    ).toEqual({ soil: 1 });
  });

  it('rejects non-finite values with the library validation error', () => {
    const recipe = createGameboardRecipe(OPTIONS, [
      { action: 'setFields', at: { q: 0, r: 0 }, fields: { slope: Number.NaN } },
    ]);
    expect(() => createGameboardPlanFromRecipe(recipe)).toThrow(GameboardValidationError);
  });
});
