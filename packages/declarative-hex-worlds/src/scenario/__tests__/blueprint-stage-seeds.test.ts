import { describe, expect, it } from 'vitest';
import { createGameboardBlueprintRecipe, type GameboardBlueprintOptions } from '../blueprint';

const base: GameboardBlueprintOptions = {
  seed: 'independent-blueprint-stages',
  shape: { kind: 'rectangle', width: 12, height: 10 },
  mountainRanges: [],
  rivers: [],
  propClusterDressing: false,
  transitionPolicy: { biomeTransitions: false, elevationRamps: false },
  biomeFills: [{ id: 'autumn', textureSet: 'fall', fill: 0.4 }],
};

function paint(options: GameboardBlueprintOptions) {
  return createGameboardBlueprintRecipe(options).steps.filter(
    (step) => step.action === 'setTextureSet'
  );
}

describe('blueprint stage seed isolation', () => {
  it('keeps biome draws stable when the town stage consumes more random values', () => {
    expect(paint({ ...base, towns: 1, harbors: [] })).toEqual(
      paint({ ...base, towns: 3, harbors: [] })
    );
  });

  it('keeps biome draws stable when authored towns replace generated towns', () => {
    expect(paint({ ...base, towns: 1, harbors: [] })).toEqual(
      paint({ ...base, towns: [], harbors: [] })
    );
  });

  it('keeps biome draws stable when the harbor stage consumes more random values', () => {
    expect(paint({ ...base, towns: [], harbors: 1 })).toEqual(
      paint({ ...base, towns: [], harbors: 3 })
    );
  });

  it('still responds to the root seed', () => {
    expect(paint(base)).not.toEqual(paint({ ...base, seed: 'another-root-seed' }));
  });
});
