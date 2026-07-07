import { describe, expect, it } from 'vitest';
import type { GameboardPlacementSpec } from '../../gameboard';
import {
  CLASSIFIER_TAGS,
  type PlacementClassifier,
  classifierMetadata,
  classifierMetadataKey,
  classifierTagsOf,
  classifyPlacement,
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
