import { describe, expect, it } from 'vitest';
import {
  analyzeExternalAssetCompatibility,
  externalAssetSpawnOptions,
  recommendExternalAssetFacing,
  type AssetBounds,
} from '@jbcom/medieval-hexagon-gameboard';

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
});
