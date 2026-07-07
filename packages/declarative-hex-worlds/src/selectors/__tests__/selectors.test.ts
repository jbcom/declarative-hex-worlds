import { describe, expect, it } from 'vitest';
import { listGuideTilePermutations as listGuideTilePermutationsFromRoot } from '../..';
import { freeManifest } from '../../manifest/free';
import {
  COAST_VARIANTS,
  edgeMask,
  HEX_EDGE_COUNT,
  isTransitionFamily,
  listCoastGuidePermutations,
  listGuideTilePermutations,
  listRiverCrossingGuidePermutations,
  listRiverCurvyGuidePermutations,
  listRiverGuidePermutations,
  listRoadGuidePermutations,
  RIVER_VARIANTS,
  ROAD_VARIANTS,
  rotateMask,
  selectCoastVariant,
  selectCoastVariantByLabel,
  selectRiverCrossingVariant,
  selectRiverVariant,
  selectRiverVariantByLabel,
  selectRoadVariant,
  selectRoadVariantByLabel,
  selectTransitionVariant,
  TRANSITION_VARIANTS,
} from '../../selectors';

describe('tile selectors', () => {
  it('points every road guide label at a published FREE asset', () => {
    expect(ROAD_VARIANTS.map((variant) => variant.label).join('')).toBe('ABCDEFGHIJKLM');
    for (const variant of ROAD_VARIANTS) {
      const selected = selectRoadVariantByLabel(variant.label);
      expect(freeManifest.assetsById[selected.assetId]).toBeTruthy();
      expect(selected.rotationSteps).toBe(0);
    }
  });

  it('points every river guide label and waterless variant at published FREE assets', () => {
    expect(RIVER_VARIANTS.map((variant) => variant.label).join('')).toBe('ABCDEFGHIJKL');
    for (const variant of RIVER_VARIANTS) {
      const selected = selectRiverVariantByLabel(variant.label);
      const waterless = selectRiverVariantByLabel(variant.label, { waterless: true });
      expect(freeManifest.assetsById[selected.assetId]).toBeTruthy();
      expect(freeManifest.assetsById[waterless.assetId]).toBeTruthy();
    }

    expect(freeManifest.assetsById[selectRiverCrossingVariant('A').assetId]).toBeTruthy();
    expect(
      freeManifest.assetsById[selectRiverCrossingVariant('B', { waterless: true }).assetId]
    ).toBeTruthy();
  });

  it('points every coast guide label and waterless variant at published FREE assets', () => {
    expect(COAST_VARIANTS.map((variant) => variant.label).join('')).toBe('ABCDE');
    for (const variant of COAST_VARIANTS) {
      const selected = selectCoastVariantByLabel(variant.label);
      const waterless = selectCoastVariantByLabel(variant.label, { waterless: true });
      expect(freeManifest.assetsById[selected.assetId]).toBeTruthy();
      expect(freeManifest.assetsById[waterless.assetId]).toBeTruthy();
    }
  });

  it('returns rotation metadata for rotated edge masks', () => {
    const mask = rotateMask(edgeMask([0, 3]), 2);
    const selected = selectRoadVariant(mask);
    expect(selected.assetId).toBe('hex_road_A');
    expect(selected.rotationSteps).toBe(2);
    expect(selected.rotationRadians).toBeCloseTo((Math.PI / 3) * 2);
  });

  it('lists every guide permutation for visual tests and public inspectors', () => {
    const roads = listRoadGuidePermutations();
    const rivers = listRiverGuidePermutations();
    const curvyRivers = listRiverCurvyGuidePermutations();
    const crossings = listRiverCrossingGuidePermutations();
    const coasts = listCoastGuidePermutations();
    const all = listGuideTilePermutations();

    expect(roads).toHaveLength(ROAD_VARIANTS.length * HEX_EDGE_COUNT);
    expect(rivers).toHaveLength(RIVER_VARIANTS.length * HEX_EDGE_COUNT * 2);
    expect(curvyRivers).toHaveLength(HEX_EDGE_COUNT * 2);
    expect(crossings).toHaveLength(4);
    expect(coasts).toHaveLength(COAST_VARIANTS.length * HEX_EDGE_COUNT * 2);
    expect(all).toHaveLength(298);
    expect(new Set(all.map((permutation) => permutation.id)).size).toBe(all.length);
    expect(all.every((permutation) => freeManifest.assetsById[permutation.assetId])).toBe(true);
    expect(listGuideTilePermutationsFromRoot()).toEqual(all);
  });

  it('keeps permutation metadata aligned with selector helpers', () => {
    for (const permutation of listRoadGuidePermutations()) {
      const selected = selectRoadVariant(permutation.inputMask);
      expect(rotateMask(selected.canonicalMask, selected.rotationSteps)).toBe(
        permutation.inputMask
      );
    }
    for (const permutation of listRiverGuidePermutations()) {
      const selected = selectRiverVariant(permutation.inputMask, {
        waterless: permutation.waterless,
      });
      expect(rotateMask(selected.canonicalMask, selected.rotationSteps)).toBe(
        permutation.inputMask
      );
      expect(selected.assetId.endsWith('_waterless')).toBe(permutation.waterless);
    }
    for (const permutation of listRiverCurvyGuidePermutations()) {
      expect(
        selectRiverVariant(permutation.inputMask, {
          curvy: true,
          waterless: permutation.waterless,
        })
      ).toMatchObject({
        assetId: permutation.assetId,
        label: permutation.label,
      });
    }
    for (const permutation of listCoastGuidePermutations()) {
      expect(
        selectCoastVariant(permutation.inputMask, { waterless: permutation.waterless })
      ).toMatchObject({
        assetId: permutation.assetId,
        label: permutation.label,
      });
    }
    expect(listRiverCrossingGuidePermutations().map((permutation) => permutation.assetId)).toEqual([
      selectRiverCrossingVariant('A').assetId,
      selectRiverCrossingVariant('A', { waterless: true }).assetId,
      selectRiverCrossingVariant('B').assetId,
      selectRiverCrossingVariant('B', { waterless: true }).assetId,
    ]);
  });

  it('listRiverGuidePermutations honors explicit waterless: true|false (E0b)', () => {
    const onlyWaterless = listRiverGuidePermutations({ waterless: true });
    const onlyWatered = listRiverGuidePermutations({ waterless: false });
    expect(onlyWaterless.length).toBeGreaterThan(0);
    expect(onlyWatered.length).toBeGreaterThan(0);
    expect(onlyWaterless.every((p) => p.waterless === true)).toBe(true);
    expect(onlyWatered.every((p) => p.waterless === false)).toBe(true);
  });

  it('selectRoadVariantByLabel throws for unknown labels (E0h)', () => {
    expect(() => selectRoadVariantByLabel('definitely-not-a-label')).toThrow(
      /Unknown road guide label/
    );
  });

  it('selectRiverVariantByLabel throws for unknown labels (E0h)', () => {
    expect(() => selectRiverVariantByLabel('definitely-not-a-label')).toThrow(
      /Unknown river guide label/
    );
  });

  it('selectCoastVariantByLabel throws for unknown labels (E0h)', () => {
    expect(() => selectCoastVariantByLabel('definitely-not-a-label')).toThrow(
      /Unknown coast guide label/
    );
  });

  it('selectRoadVariant throws when mask has no canonical variant (E0a)', () => {
    // 0b111111 (all edges) is not a canonical road variant — road variants
    // cover 1, 2, or 3 edges in specific patterns.
    expect(() => selectRoadVariant([0, 1, 2, 3, 4, 5])).toThrow(/No road variant covers edge mask/);
  });
});

describe('transition-variant seam (RFC0-9b)', () => {
  it('exposes a family→variants table for all three transition families', () => {
    expect(Object.keys(TRANSITION_VARIANTS).sort()).toEqual(['coast', 'river', 'road']);
    expect(TRANSITION_VARIANTS.coast).toBe(COAST_VARIANTS);
    expect(TRANSITION_VARIANTS.road).toBe(ROAD_VARIANTS);
    expect(TRANSITION_VARIANTS.river).toBe(RIVER_VARIANTS);
  });

  it('isTransitionFamily recognizes the three families and rejects others', () => {
    expect(isTransitionFamily('coast')).toBe(true);
    expect(isTransitionFamily('road')).toBe(true);
    expect(isTransitionFamily('river')).toBe(true);
    expect(isTransitionFamily('unit')).toBe(false);
    expect(isTransitionFamily('')).toBe(false);
  });

  it('selectTransitionVariant selects the rotated variant for a coast mask', () => {
    // A single water edge at index 0 → coast variant A, unrotated.
    const selection = selectTransitionVariant('coast', [0]);
    expect(selection).toMatchObject({ family: 'coast', label: 'A', rotationSteps: 0 });
    // A single water edge at index 2 → the same canonical A, rotated 2 steps.
    const rotated = selectTransitionVariant('coast', [2]);
    expect(rotated).toMatchObject({ family: 'coast', label: 'A', rotationSteps: 2 });
  });

  it('selectTransitionVariant dispatches by family (road, river)', () => {
    expect(selectTransitionVariant('road', [0, 3])).toMatchObject({ family: 'road', label: 'A' });
    expect(selectTransitionVariant('river', [0, 1])).toMatchObject({ family: 'river', label: 'B' });
  });

  it('returns undefined for an unknown family (falls through instead of throwing)', () => {
    expect(selectTransitionVariant('unit', [0])).toBeUndefined();
  });

  it('returns undefined for a mask no variant covers (non-throwing)', () => {
    // 0b111111 (all six edges) has no coast variant — max coast is 5 contiguous.
    expect(selectTransitionVariant('coast', [0, 1, 2, 3, 4, 5])).toBeUndefined();
  });
});
