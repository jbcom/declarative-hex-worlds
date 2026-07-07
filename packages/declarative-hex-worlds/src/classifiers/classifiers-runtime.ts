/**
 * `src/classifiers/classifiers-runtime.ts` — koota-backed classifier queries
 * (RFC 0001 RFC0-TAG, runtime tier).
 *
 * The koota-touching half of the classifier system: query a live world's placements by
 * classifier tag. Split from the pure `./classifiers` (vocabulary + assignment) so the
 * classifier vocabulary + `classifyPlacement` stay koota-free (`./core`-eligible); only
 * this file imports koota.
 *
 * @module
 */
import type { World } from 'koota';
import { readGameboardPlacements } from '../koota';
import { type ClassifierTag, classifierTagsOf, placementHasClassifier } from './classifiers';

/** A placement read from the world, as returned by `readGameboardPlacements`. */
type PlacementRecord = ReturnType<typeof readGameboardPlacements>[number];

/**
 * All placements in `world` that carry the given classifier tag (in their tag list under
 * the `classifier:` namespace). The renderer-neutral query behind
 * `usePlacementsByClassifier`.
 */
export function selectPlacementsByClassifier(
  world: World,
  tag: ClassifierTag
): readonly PlacementRecord[] {
  return readGameboardPlacements(world).filter((placement) =>
    placementHasClassifier(placement.metadata, tag)
  );
}

/** Distinct classifier tags present across all placements in `world`. */
export function listClassifiersInWorld(world: World): readonly ClassifierTag[] {
  const seen = new Set<ClassifierTag>();
  for (const placement of readGameboardPlacements(world)) {
    for (const tag of classifierTagsOf(placement.metadata)) {
      seen.add(tag);
    }
  }
  return [...seen];
}
