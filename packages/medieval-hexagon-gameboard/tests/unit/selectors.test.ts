import { describe, expect, it } from 'vitest';
import { listGuideTilePermutations as listGuideTilePermutationsFromRoot } from '../../src';
import { freeManifest } from '../../src/manifest/free';
import {
  COAST_VARIANTS,
  HEX_EDGE_COUNT,
  RIVER_VARIANTS,
  ROAD_VARIANTS,
  edgeMask,
  listCoastGuidePermutations,
  listGuideTilePermutations,
  listRiverCrossingGuidePermutations,
  listRiverCurvyGuidePermutations,
  listRiverGuidePermutations,
  listRoadGuidePermutations,
  rotateMask,
  selectCoastVariant,
  selectCoastVariantByLabel,
  selectRiverCrossingVariant,
  selectRiverVariant,
  selectRiverVariantByLabel,
  selectRoadVariant,
  selectRoadVariantByLabel,
} from '../../src/selectors';

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
    expect(freeManifest.assetsById[selectRiverCrossingVariant('B', { waterless: true }).assetId]).toBeTruthy();
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
      expect(rotateMask(selected.canonicalMask, selected.rotationSteps)).toBe(permutation.inputMask);
    }
    for (const permutation of listRiverGuidePermutations()) {
      const selected = selectRiverVariant(permutation.inputMask, { waterless: permutation.waterless });
      expect(rotateMask(selected.canonicalMask, selected.rotationSteps)).toBe(permutation.inputMask);
      expect(selected.assetId.endsWith('_waterless')).toBe(permutation.waterless);
    }
    for (const permutation of listRiverCurvyGuidePermutations()) {
      expect(selectRiverVariant(permutation.inputMask, {
        curvy: true,
        waterless: permutation.waterless,
      })).toMatchObject({
        assetId: permutation.assetId,
        label: permutation.label,
      });
    }
    for (const permutation of listCoastGuidePermutations()) {
      expect(selectCoastVariant(permutation.inputMask, { waterless: permutation.waterless })).toMatchObject({
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
});
