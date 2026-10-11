import { describe, expect, it } from 'vitest';
import { projectWorldToGameboardPlan } from '../../coordinates';
import { createGameboardWorld, readGameboardTiles } from '../../koota';
import type { GameboardBiomeRegionsSpec } from '../../rules/biome-regions';
import {
  createGameboardPlanFromRecipe,
  createGameboardRecipe,
  mergeGameboardRecipes,
  pureRecipeGenerationApplier,
} from '../recipe';
import { applyGameboardRecipeGeneration } from '../recipe-generation';

const OPTIONS = { seed: 'campaign', shape: { kind: 'rectangle', width: 10, height: 8 } } as const;
const stage: GameboardBiomeRegionsSpec = {
  seed: 'campaign:biomes',
  fill: 'pasture',
  biomes: [{ biome: 'wheat', target: 0.4, sources: { tiles: [{ q: 3, r: 3 }] } }],
};

describe('recipe biome generation', () => {
  it('retains earlier generated regions when later recipes add another biome stage', () => {
    const first = createGameboardRecipe(OPTIONS, [], { biomeRegions: [stage] });
    const second = createGameboardRecipe(OPTIONS, [], {
      biomeRegions: [
        {
          seed: 'campaign:corn',
          fill: 'pasture',
          biomes: [{ biome: 'corn', target: 0.25, sources: { count: 1 } }],
        },
      ],
    });
    const result = createGameboardPlanFromRecipe(
      mergeGameboardRecipes(first, [second]),
      {},
      pureRecipeGenerationApplier
    );
    expect(result.tiles.filter((tile) => tile.biome === 'wheat')).toHaveLength(32);
    expect(result.tiles.filter((tile) => tile.biome === 'corn')).toHaveLength(12);
    expect(result.tiles.some((tile) => tile.pinned)).toBe(false);
  });

  it('preserves input diagnostics in region-only runtime generation', () => {
    const recipe = createGameboardRecipe(OPTIONS, [], { biomeRegions: [stage] });
    const source = createGameboardPlanFromRecipe(createGameboardRecipe(OPTIONS, []));
    const warned = { ...source, warnings: ['Authored terrain warning'] };
    const result = applyGameboardRecipeGeneration(warned, recipe.generation);
    expect(result.warnings).toEqual(warned.warnings);
  });

  it('clones automatic sources, suitability and affinity before saved intent changes', () => {
    const sources = { count: 2, spacing: 3 };
    const suits = [{ field: 'soil', from: 0, to: 1, weight: 2 }];
    const affinity = [{ a: 'wheat', b: 'wheat', weight: 0.4 }];
    const recipe = createGameboardRecipe(OPTIONS, [], {
      biomeRegions: [
        {
          ...stage,
          affinity,
          biomes: [{ biome: 'wheat', target: 0.4, sources, suits }],
        },
      ],
    });
    sources.count = 99;
    const band = suits[0];
    if (band) band.weight = 99;
    const pair = affinity[0];
    if (pair) pair.weight = 99;
    expect(recipe.generation?.biomeRegions?.[0]).toMatchObject({
      affinity: [{ a: 'wheat', b: 'wheat', weight: 0.4 }],
      biomes: [
        {
          sources: { count: 2, spacing: 3 },
          suits: [{ field: 'soil', from: 0, to: 1, weight: 2 }],
        },
      ],
    });
  });

  it('the pure recipe compiler and Koota generation agree, and biome traits round-trip', () => {
    const recipe = createGameboardRecipe(OPTIONS, [], { biomeRegions: [stage] });
    const pure = createGameboardPlanFromRecipe(recipe, {}, pureRecipeGenerationApplier);
    const runtime = createGameboardPlanFromRecipe(recipe, {}, applyGameboardRecipeGeneration);
    expect(runtime.tiles.map((tile) => tile.biome)).toEqual(pure.tiles.map((tile) => tile.biome));
    const world = createGameboardWorld(runtime);
    try {
      expect(readGameboardTiles(world).every((tile) => tile.biome)).toBe(true);
      expect(projectWorldToGameboardPlan(world).tiles.map((tile) => tile.biome)).toEqual(
        runtime.tiles.map((tile) => tile.biome)
      );
    } finally {
      world.destroy();
    }
  });

  it('placement rules see the generated biome and its original numeric fields', () => {
    const recipe = createGameboardRecipe(
      OPTIONS,
      [{ action: 'setFields', at: { q: 3, r: 3 }, fields: { soil: 1 } }],
      {
        biomeRegions: [stage],
        layoutFills: [
          {
            assetId: 'flag_green',
            archetype: 'prop',
            count: 1,
            criteria: {
              biome: 'wheat',
              fields: [{ field: 'soil', min: 1 }],
              allowOccupied: true,
            },
          },
        ],
      }
    );
    const plan = createGameboardPlanFromRecipe(recipe, {}, applyGameboardRecipeGeneration);
    expect(
      plan.placements
        .filter((placement) => placement.assetId === 'flag_green')
        .map((placement) => placement.tileKey)
    ).toEqual(['3,3']);
  });

  it('authored pins protect every generation stage in a merged recipe', () => {
    const early = createGameboardRecipe(OPTIONS, [], { biomeRegions: [stage] });
    const later = createGameboardRecipe(
      OPTIONS,
      [
        { action: 'setBiome', at: { q: 3, r: 3 }, biome: 'orchard' },
        { action: 'pinTile', at: { q: 3, r: 3 } },
      ],
      {
        biomeRegions: [
          {
            ...stage,
            seed: 'campaign:later',
          },
        ],
      }
    );
    const merged = mergeGameboardRecipes(early, [later]);
    const plan = createGameboardPlanFromRecipe(merged, {}, applyGameboardRecipeGeneration);
    expect(plan.tiles.find((tile) => tile.key === '3,3')?.biome).toBe('orchard');
  });

  it('snapshots nested region data and preserves it through recipe serialization', () => {
    const sources = [{ q: 3, r: 3 }];
    const requires = [{ field: 'slope', max: 0.1 }];
    const recipe = createGameboardRecipe(OPTIONS, [], {
      biomeRegions: [
        {
          ...stage,
          biomes: [{ biome: 'wheat', target: 0.4, sources: { tiles: sources }, requires }],
        },
      ],
    });
    const source = sources[0];
    if (source) source.q = 99;
    const band = requires[0];
    if (band) band.max = 99;
    const revived = JSON.parse(JSON.stringify(recipe)) as typeof recipe;
    expect(revived.generation?.biomeRegions?.[0]).toMatchObject({
      biomes: [{ sources: { tiles: [{ q: 3, r: 3 }] }, requires: [{ field: 'slope', max: 0.1 }] }],
    });
  });
});
