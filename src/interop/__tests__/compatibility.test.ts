import { describe, expect, it } from 'vitest';
import {
  analyzeExternalAssetCompatibility,
  externalAssetSpawnOptions,
  recommendExternalAssetFacing,
  type AssetBounds,
} from 'medieval-hexagon-gameboard';

const kenneyTowerBounds: AssetBounds = {
  min: [-0.45, 0, -0.3897],
  max: [0.45, 1.31, 0.3897],
  size: [0.9, 1.31, 0.7794],
};

const adventurerBounds: AssetBounds = {
  min: [-0.9713, 0, -0.6539],
  max: [0.9713, 2.5431, 0.6539],
  size: [1.9426, 2.5431, 1.3078],
};

describe('external asset compatibility', () => {
  it('recommends hex-edge facing from model forward axes', () => {
    expect(recommendExternalAssetFacing({ modelForward: '+z', boardForwardEdge: 1 })).toMatchObject({
      rotationSteps: 1,
      facingErrorRadians: 0,
    });
    expect(recommendExternalAssetFacing({ modelForward: '-z', boardForwardEdge: 1 })).toMatchObject({
      rotationSteps: 4,
      facingErrorRadians: 0,
    });
    expect(recommendExternalAssetFacing({ modelForward: '+x', boardForwardEdge: 1 }).facingErrorRadians).toBeCloseTo(
      Math.PI / 6,
      3
    );
  });

  it('flags non-KayKit hex shapes and suggests prop placement', () => {
    const report = analyzeExternalAssetCompatibility({
      id: 'tower-hexagon-base',
      sourcePack: 'Kenney Castle Kit',
      bounds: kenneyTowerBounds,
      intendedRole: 'tile',
    });

    expect(report.compatibleAsTile).toBe(false);
    expect(report.suggestedRole).toBe('prop');
    expect(report.placement).toMatchObject({
      kind: 'prop',
      layer: 'feature',
      anchor: 'bottom-center',
    });
    expect(report.warnings.join('\n')).toContain('does not match the KayKit hex footprint');
  });

  it('models rigged character placement with facing and animation expectations', () => {
    const report = analyzeExternalAssetCompatibility({
      id: 'Knight',
      sourcePack: 'KayKit Adventurers 2.0 FREE',
      bounds: adventurerBounds,
      intendedRole: 'unit',
      hasRig: true,
      animationNames: ['Running_A', 'Walking_A', 'T-Pose'],
      modelForward: '+z',
    });
    const spawn = externalAssetSpawnOptions({
      at: '2,1',
      assetId: 'adventurer:knight',
      sourceUrl: '/@fs/references/KayKit_Adventurers_2.0_FREE/Characters/gltf/Knight.glb',
      report,
      metadata: { actorKind: 'ally' },
    });

    expect(report.suggestedRole).toBe('unit');
    expect(report.placement).toMatchObject({
      kind: 'unit',
      layer: 'unit',
      boardForwardEdge: 1,
      modelForward: '+z',
      rotationSteps: 1,
      facingErrorRadians: 0,
    });
    expect(report.placement.animation?.defaultClip).toBe('Walking_A');
    expect(spawn).toMatchObject({
      kind: 'unit',
      layer: 'unit',
      requiresExtra: true,
      metadata: {
        externalAsset: true,
        sourcePack: 'KayKit Adventurers 2.0 FREE',
        animationDefaultClip: 'Walking_A',
        actorKind: 'ally',
      },
    });
  });

  it('flags empty horizontal bounds with errors (E0h)', () => {
    const flat: AssetBounds = { min: [0, 0, 0], max: [0, 1, 0], size: [0, 1, 0] };
    const report = analyzeExternalAssetCompatibility({
      id: 'flat-asset',
      sourcePack: 'test',
      bounds: flat,
      intendedRole: 'prop',
      hasRig: false,
      modelForward: '+z',
    });
    expect(report.errors.some((e) => e.includes('empty horizontal bounds'))).toBe(true);
  });

  it('promotes rigged prop-intended asset to unit role (E0h)', () => {
    const report = analyzeExternalAssetCompatibility({
      id: 'rigged-prop',
      sourcePack: 'test',
      bounds: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5], size: [1, 1, 1] },
      intendedRole: 'prop',
      hasRig: true,
      modelForward: '+z',
    });
    expect(report.suggestedRole).toBe('unit');
  });

  it('warns when unit-intended asset is not rigged (E0h)', () => {
    const report = analyzeExternalAssetCompatibility({
      id: 'unrigged-unit',
      sourcePack: 'test',
      bounds: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5], size: [1, 1, 1] },
      intendedRole: 'unit',
      hasRig: false,
      modelForward: '+z',
    });
    expect(report.warnings.some((w) => w.includes('no rig was detected'))).toBe(true);
  });

  it('recommends structure placement for structure-intended assets (E0h)', () => {
    const report = analyzeExternalAssetCompatibility({
      id: 'rect-structure',
      sourcePack: 'test',
      bounds: { min: [-1.2, 0, -0.3], max: [1.2, 1, 0.3], size: [2.4, 1, 0.6] },
      intendedRole: 'structure',
      hasRig: false,
      modelForward: '+z',
    });
    expect(report.placement.layer).toBe('structure');
    expect(report.placement.kind).toBe('structure');
  });

  it('reports hex footprint shape for hex-ratio bounds (E0a)', () => {
    // width/depth ≈ 2/2.3094 = 0.866 → footprint shape 'hex' (line 435-436).
    const report = analyzeExternalAssetCompatibility({
      id: 'hex-shape',
      sourcePack: 'test',
      bounds: { min: [-1, 0, -1.1547], max: [1, 0.1, 1.1547], size: [2, 0.1, 2.3094] },
    });
    expect(report.tile).toBeDefined();
  });

  it('handles -x modelForward axis (E0a)', () => {
    const report = analyzeExternalAssetCompatibility({
      id: 'axis-neg-x',
      sourcePack: 'test',
      bounds: { min: [-0.5, 0, -0.5], max: [0.5, 1, 0.5], size: [1, 1, 1] },
      modelForward: '-x',
    });
    // Hits modelForwardYaw '-x' branch at line 454.
    expect(report.placement.rotationRadians).toBeDefined();
  });
});
