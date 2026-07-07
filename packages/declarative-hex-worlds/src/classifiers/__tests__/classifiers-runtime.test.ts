import { describe, expect, it } from 'vitest';
import { spawnGameboardActor } from '../../actors';
import { createGameboardBuilder } from '../../gameboard';
import { createGameboardWorld } from '../../koota';
import { classifierMetadata } from '../classifiers';
import { listClassifiersInWorld, selectPlacementsByClassifier } from '../classifiers-runtime';

/**
 * Build a world and spawn a few actors carrying classifier metadata. Actor metadata is
 * merged onto the placement record, so `selectPlacementsByClassifier` finds them — the
 * real injection path for gameplay pieces (units/enemies/props are actors).
 */
function worldWithClassifiedPlacements() {
  const builder = createGameboardBuilder({
    seed: 'classifiers-runtime',
    shape: { kind: 'rectangle', width: 4, height: 4 },
  });
  const world = createGameboardWorld(builder.build());
  spawnGameboardActor(world, {
    id: 'a:cache',
    actorId: 'cache',
    at: { q: 0, r: 0 },
    assetId: 'crate_A_small',
    kind: 'prop',
    metadata: classifierMetadata(['prop', 'random-encounter']),
  });
  spawnGameboardActor(world, {
    id: 'a:raider',
    actorId: 'raider',
    at: { q: 1, r: 0 },
    assetId: 'flag_red',
    kind: 'unit',
    metadata: classifierMetadata(['enemy', 'unit']),
  });
  return world;
}

describe('classifier world queries (RFC0-TAG, koota-backed)', () => {
  it('selects placements carrying a classifier tag', () => {
    const world = worldWithClassifiedPlacements();
    expect(selectPlacementsByClassifier(world, 'enemy').length).toBe(1);
    expect(selectPlacementsByClassifier(world, 'random-encounter').length).toBe(1);
    expect(selectPlacementsByClassifier(world, 'unit').length).toBe(1);
    // A classifier no placement carries returns nothing.
    expect(selectPlacementsByClassifier(world, 'playable')).toEqual([]);
  });

  it('lists the distinct classifiers present in the world', () => {
    const classifiers = [...listClassifiersInWorld(worldWithClassifiedPlacements())].sort();
    expect(classifiers).toEqual(['enemy', 'prop', 'random-encounter', 'unit']);
  });
});
