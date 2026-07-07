/**
 * A library-internal feature-rich world fixture for the visual gallery + perf
 * tests. Built purely with the public gameboard builder — it exercises a broad
 * spread of board features (roads, rivers, forests, hills, harbors, settlements,
 * units, props) so the gallery screenshots and simulation benchmark have a
 * representative populated board.
 *
 * This is DELIBERATELY not the SimpleRPG game: the library's own visual/perf
 * fixtures must not depend on the SimpleRPG consumer package (which imports the
 * library — a library→package dependency would be circular). SimpleRPG's gameplay
 * lives in `packages/simple-rpg`; this fixture is the library's neutral exerciser.
 *
 * @module
 */
import { createGameboardWorld } from '../../src/koota';
import { createGameboardBuilder } from '../../src/gameboard';
import type { GameboardPlan } from '../../src/gameboard';
import type { World } from 'koota';

/** Build the feature-gallery board plan (deterministic — fixed seed). */
export function createFeatureGalleryPlan(): GameboardPlan {
  const builder = createGameboardBuilder({
    seed: 'feature-gallery-v1',
    shape: { kind: 'rectangle', width: 8, height: 6 },
  });

  for (let q = 0; q < 8; q += 1) {
    builder.setTerrain({ q, r: 5 }, 'water');
    builder.setCoastEdges({ q, r: 4 }, [1]);
  }

  builder
    .addRoadPath([
      { q: 0, r: 1 },
      { q: 1, r: 1 },
      { q: 2, r: 1 },
      { q: 2, r: 2 },
      { q: 3, r: 2 },
      { q: 4, r: 2 },
      { q: 5, r: 2 },
      { q: 5, r: 3 },
      { q: 6, r: 3 },
      { q: 6, r: 4 },
    ])
    .addRiverPath(
      [
        { q: 1, r: 0 },
        { q: 1, r: 1 },
        { q: 2, r: 1 },
        { q: 2, r: 2 },
      ],
      { curvy: true, waterless: true }
    )
    .addMountainStack({ at: { q: 7, r: 0 }, height: 2, variant: 'B', withTrees: true })
    .addHill({ q: 0, r: 3 }, { variant: 'C', withTrees: true })
    .addForest({ q: 1, r: 3 }, { species: 'A', size: 'large' })
    .addHarbor({ at: { q: 6, r: 4 }, facing: 1, faction: 'blue', kind: 'watermill', includeProps: false })
    .addFactionBuilding({ at: { q: 6, r: 3 }, faction: 'blue', building: 'market' })
    .addSettlement({ at: { q: 4, r: 0 }, faction: 'blue', building: 'home_A', rotationSteps: 1 })
    .addNeutralStructure({ at: { q: 7, r: 1 }, structure: 'building_grain' })
    .addBridge({ at: { q: 7, r: 4 }, variant: 'A', facing: 1 })
    .addUnit({ at: { q: 6, r: 0 }, faction: 'blue', part: 'sword', style: 'full' })
    .addUnitPreset({ at: { q: 6, r: 1 }, faction: 'blue', role: 'soldier', style: 'accent' })
    .addProp({ at: { q: 2, r: 2 }, assetId: 'crate_A_small' });

  return builder.build();
}

/** Build a live koota world from the feature-gallery plan. */
export function createFeatureGalleryWorld(): World {
  return createGameboardWorld(createFeatureGalleryPlan());
}
