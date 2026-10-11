import { describe, expect, it } from 'vitest';
import { createGameboardRecipe } from '../recipe';

const OPTIONS = { seed: 'recipe-criteria', shape: { kind: 'rectangle', width: 4, height: 4 } } as const;

describe('biome and field-band layout criteria in recipes', () => {
  it('clones them so saved recipes cannot be mutated through their inputs', () => {
    const biome = ['wheat', 'corn'];
    const excludeBiome = ['fallow'];
    const requiredAdjacentBiome = ['orchard'];
    const forbiddenAdjacentBiome = ['marsh'];
    const fields = [{ field: 'wetness', min: 0.5 }];
    const recipe = createGameboardRecipe(OPTIONS, [], {
      layoutFills: [
        {
          assetId: 'flag_green',
          archetype: 'prop',
          count: 1,
          criteria: { biome, excludeBiome, requiredAdjacentBiome, forbiddenAdjacentBiome, fields },
        },
        {
          assetId: 'flag_green',
          archetype: 'prop',
          count: 1,
          criteria: {
            biome: 'wheat',
            excludeBiome: 'fallow',
            requiredAdjacentBiome: 'a',
            forbiddenAdjacentBiome: 'b',
          },
        },
      ],
    });
    biome.push('mutated');
    excludeBiome.push('mutated');
    requiredAdjacentBiome.push('mutated');
    forbiddenAdjacentBiome.push('mutated');
    (fields[0] as { min: number }).min = 99;

    const [arrays, scalars] = recipe.generation?.layoutFills ?? [];
    expect(arrays?.criteria).toMatchObject({
      biome: ['wheat', 'corn'],
      excludeBiome: ['fallow'],
      requiredAdjacentBiome: ['orchard'],
      forbiddenAdjacentBiome: ['marsh'],
      fields: [{ field: 'wetness', min: 0.5 }],
    });
    expect(scalars?.criteria).toMatchObject({
      biome: 'wheat',
      excludeBiome: 'fallow',
      requiredAdjacentBiome: 'a',
      forbiddenAdjacentBiome: 'b',
    });
  });
});
