import { describe, expect, it } from 'vitest';
import type { GameboardPlacementSpec } from '../../gameboard';
import {
  CLASSIFIER_TAGS,
  DEFAULT_PLACEMENT_CLASSIFIERS,
  type PlacementClassifier,
  classifierMetadata,
  classifierMetadataKey,
  classifierTagsOf,
  classifyPlacement,
  packClassifier,
  packDefaultClassifiers,
  placementHasClassifier,
} from '../classifiers';

function placement(
  kind: GameboardPlacementSpec['kind'],
  metadata: Record<string, string | number | boolean | null> = {}
): GameboardPlacementSpec {
  return { id: 'p', kind, metadata } as unknown as GameboardPlacementSpec;
}

describe('placement classifiers (RFC0-TAG)', () => {
  it('exposes the first-class classifier vocabulary', () => {
    expect(CLASSIFIER_TAGS).toContain('playable');
    expect(CLASSIFIER_TAGS).toContain('enemy');
    expect(CLASSIFIER_TAGS).toContain('building');
  });

  describe('classifyPlacement (default kind→classifier)', () => {
    it('maps unit → unit, structure → building, prop/decoration → prop', () => {
      expect(classifyPlacement(placement('unit'))).toEqual(['unit']);
      expect(classifyPlacement(placement('structure'))).toEqual(['building']);
      expect(classifyPlacement(placement('prop'))).toEqual(['prop']);
      expect(classifyPlacement(placement('decoration'))).toEqual(['prop']);
    });

    it('returns no classifiers for a purely structural kind (terrain/road)', () => {
      expect(classifyPlacement(placement('terrain'))).toEqual([]);
      expect(classifyPlacement(placement('road'))).toEqual([]);
    });

    it('unions + dedupes across multiple classifiers', () => {
      const custom: PlacementClassifier[] = [
        () => ['playable', 'unit'],
        () => ['unit', 'enemy'], // 'unit' repeated → deduped
      ];
      expect(classifyPlacement(placement('unit'), custom)).toEqual(['playable', 'unit', 'enemy']);
    });
  });

  describe('recognized-pack classifiers (RFC0-TAGb)', () => {
    it('maps pack category → default classifiers', () => {
      expect(packDefaultClassifiers('playable')).toEqual(['playable']);
      expect(packDefaultClassifiers('enemy')).toEqual(['enemy', 'random-encounter']);
      expect(packDefaultClassifiers('terrain')).toEqual([]);
    });

    it('packClassifier tags a placement matched by sourcePack metadata', () => {
      const adventurers = packClassifier('adventurers', 'playable');
      expect(adventurers(placement('unit', { sourcePack: 'adventurers' }))).toEqual(['playable']);
      // A different pack's placement is not matched.
      expect(adventurers(placement('unit', { sourcePack: 'skeletons' }))).toEqual([]);
    });

    it('packClassifier tags a placement matched by the <packId>: assetId namespace', () => {
      const skeletons = packClassifier('skeletons', 'enemy');
      const spec = { id: 'p', kind: 'unit', assetId: 'skeletons:Skeleton_Warrior', metadata: {} };
      expect(skeletons(spec as unknown as GameboardPlacementSpec)).toEqual([
        'enemy',
        'random-encounter',
      ]);
    });

    it('packClassifier accepts an explicit assetId prefix distinct from the pack id', () => {
      // The e2e convention uses `adventurer:` (singular) for the `adventurers` pack.
      const adventurers = packClassifier('adventurers', 'playable', 'adventurer');
      const spec = { id: 'p', kind: 'unit', assetId: 'adventurer:knight', metadata: {} };
      expect(adventurers(spec as unknown as GameboardPlacementSpec)).toEqual(['playable']);
    });

    it('a terrain pack contributes no gameplay classifier even when matched', () => {
      const terrain = packClassifier('medieval-hexagon', 'terrain');
      expect(terrain(placement('terrain', { sourcePack: 'medieval-hexagon' }))).toEqual([]);
    });

    it('composes with the default kind classifiers via classifyPlacement', () => {
      const skeletons = packClassifier('skeletons', 'enemy');
      const spec = placement('unit', { sourcePack: 'skeletons' });
      // kind→unit + pack→enemy/random-encounter, unioned + deduped.
      expect(classifyPlacement(spec, [...DEFAULT_PLACEMENT_CLASSIFIERS, skeletons])).toEqual([
        'unit',
        'enemy',
        'random-encounter',
      ]);
    });
  });

  describe('metadata storage', () => {
    it('classifierMetadata flags each classifier as a boolean under the namespace', () => {
      expect(classifierMetadata(['enemy', 'unit'])).toEqual({
        'classifier:enemy': true,
        'classifier:unit': true,
      });
      expect(classifierMetadataKey('building')).toBe('classifier:building');
    });

    it('classifierTagsOf reads flagged classifiers back from metadata', () => {
      const meta = { 'classifier:enemy': true, 'classifier:unit': false, other: 'x', flag: 3 };
      expect(classifierTagsOf(meta)).toEqual(['enemy']); // false + non-classifier keys ignored
    });

    it('placementHasClassifier checks a single classifier flag', () => {
      const meta = classifierMetadata(['building']);
      expect(placementHasClassifier(meta, 'building')).toBe(true);
      expect(placementHasClassifier(meta, 'enemy')).toBe(false);
      expect(placementHasClassifier({}, 'unit')).toBe(false);
    });
  });
});
