import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  analyzeExternalAssetCompatibility,
  createGameboardLayoutPlacements,
  createGameboardLayoutPlacementOptionsFromPiece,
  createGameboardPieceRegistry,
  createGameboardPieceSourceUrlMap,
  declareGameboardPiecesFromCompatibilityReports,
  externalAssetSpawnOptions,
  projectWorldToGameboardPlan,
  spawnGameboardPlacement,
  type AssetBounds,
  type GameboardPieceDeclaration,
  type GameboardPieceRegistry,
} from 'medieval-hexagon-gameboard';
import {
  findGameboardPlacementObjectUserData,
  findLoadedGameboardPlacementObjectForObject,
  loadGameboardPlacementObject,
  updateGameboardPlacementAnimation,
} from 'medieval-hexagon-gameboard/three';
import { createFixedSimpleRpgGame } from '../../simple-rpg/game';
import { assertCanvasHasRenderableContent, renderGameboardPlan } from '../../browser/rendering';

declare const __KENNEY_CASTLE_ROOT__: string;
declare const __KAYKIT_ADVENTURERS_ROOT__: string;

interface LoadedExternalAssetMetadata {
  bounds: AssetBounds;
  hasRig: boolean;
  animationNames: readonly string[];
  materialSlots: readonly string[];
}

const loader = new GLTFLoader();

describe('local third-party asset E2E compatibility', () => {
  it('flags Kenney non-hex pieces as prop placements and places Adventurers rigged units from references', async () => {
    await page.viewport(1500, 950);

    const sourceRoots = {
      'Kenney Castle Kit': localAssetRootUrl(__KENNEY_CASTLE_ROOT__),
      'KayKit Adventurers 2.0 FREE': localAssetRootUrl(__KAYKIT_ADVENTURERS_ROOT__),
    };
    const urls = {
      roundTower: `${sourceRoots['Kenney Castle Kit']}/tower-hexagon-base.glb`,
      squareTower: `${sourceRoots['Kenney Castle Kit']}/tower-square-base.glb`,
      tree: `${sourceRoots['Kenney Castle Kit']}/tree-large.glb`,
      knight: `${sourceRoots['KayKit Adventurers 2.0 FREE']}/Characters/gltf/Knight.glb`,
      movement: `${sourceRoots['KayKit Adventurers 2.0 FREE']}/Animations/gltf/Rig_Medium/Rig_Medium_MovementBasic.glb`,
    };

    const [roundTower, squareTower, tree, knight, movement] = await Promise.all([
      inspectExternalGltf(urls.roundTower),
      inspectExternalGltf(urls.squareTower),
      inspectExternalGltf(urls.tree),
      inspectExternalGltf(urls.knight),
      inspectExternalGltf(urls.movement),
    ]);
    const reports = {
      roundTower: analyzeExternalAssetCompatibility({
        id: 'kenney:tower-hexagon-base',
        sourcePack: 'Kenney Castle Kit',
        creator: 'Kenney',
        license: 'CC0-1.0',
        bounds: roundTower.bounds,
        intendedRole: 'tile',
      }),
      squareTower: analyzeExternalAssetCompatibility({
        id: 'kenney:tower-square-base',
        sourcePack: 'Kenney Castle Kit',
        creator: 'Kenney',
        license: 'CC0-1.0',
        bounds: squareTower.bounds,
        intendedRole: 'tile',
      }),
      tree: analyzeExternalAssetCompatibility({
        id: 'kenney:tree-large',
        sourcePack: 'Kenney Castle Kit',
        creator: 'Kenney',
        license: 'CC0-1.0',
        bounds: tree.bounds,
        intendedRole: 'prop',
      }),
      knight: analyzeExternalAssetCompatibility({
        id: 'adventurer:knight',
        sourcePack: 'KayKit Adventurers 2.0 FREE',
        creator: 'Kay Lousberg',
        license: 'CC0-1.0',
        bounds: knight.bounds,
        intendedRole: 'unit',
        hasRig: knight.hasRig,
        animationNames: movement.animationNames,
        materialSlots: knight.materialSlots,
        modelForward: '+z',
      }),
    };

    expect(reports.roundTower.compatibleAsTile).toBe(false);
    expect(reports.squareTower.compatibleAsTile).toBe(false);
    expect(reports.roundTower.suggestedRole).toBe('prop');
    expect(reports.squareTower.suggestedRole).toBe('prop');
    expect(reports.roundTower.warnings.join('\n')).toContain('does not match the KayKit hex footprint');
    expect(knight.hasRig).toBe(true);
    expect(movement.animationNames).toContain('Walking_A');
    expect(reports.knight.placement).toMatchObject({
      kind: 'unit',
      layer: 'unit',
      boardForwardEdge: 1,
      modelForward: '+z',
      animation: expect.objectContaining({ defaultClip: 'Walking_A' }),
    });

    const registry = createGameboardPieceRegistry(
      declareGameboardPiecesFromCompatibilityReports(Object.values(reports), {
        overrides: {
          'kenney:tower-hexagon-base': {
            id: 'kenney-round-tower',
            role: 'landmark',
            footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
            criteria: {
              terrain: ['grass', 'road'],
              edgePadding: 1,
              allowOccupied: false,
              prefer: [
                { kind: 'center', weight: 1 },
                { kind: 'near-placement-kind', placementKind: 'structure', radius: 4, weight: 0.3 },
              ],
            },
            metadata: {
              placementCriteria: 'round tower prop on open central grass',
              sourceRelativePath: 'tower-hexagon-base.glb',
            },
          },
          'kenney:tower-square-base': {
            id: 'kenney-square-tower',
            role: 'landmark',
            footprint: { kind: 'adjacent', edges: [2, 3], includeCenter: true },
            criteria: {
              terrain: ['grass', 'road', 'coast'],
              allowOccupied: false,
              minDistanceBetween: 1,
              prefer: [
                { kind: 'center', weight: 1 },
                { kind: 'far-from-placement-kind', placementKind: 'prop', radius: 2, weight: 0.4 },
              ],
            },
            metadata: {
              placementCriteria: 'square wall piece centered on an unoccupied tile',
              sourceRelativePath: 'tower-square-base.glb',
            },
          },
          'kenney:tree-large': {
            id: 'kenney-large-tree',
            role: 'tree',
            rotationSteps: 'random',
            criteria: {
              terrain: ['grass', 'forest', 'hill'],
              allowOccupied: true,
              prefer: [
                { kind: 'near-terrain', terrain: 'forest', radius: 3, weight: 1 },
                { kind: 'far-from-placement-kind', placementKind: 'structure', radius: 3, weight: 0.25 },
              ],
            },
            metadata: {
              placementCriteria: 'decorative tree near forested terrain',
              sourceRelativePath: 'tree-large.glb',
            },
          },
          'adventurer:knight': {
            id: 'kaykit-adventurer-knight',
            role: 'unit',
            criteria: {
              terrain: ['grass', 'road', 'coast'],
              allowOccupied: false,
              prefer: [
                { kind: 'near-placement-kind', placementKind: 'structure', radius: 4, weight: 1 },
                { kind: 'center', weight: 0.2 },
              ],
            },
            metadata: {
              placementCriteria: 'rigged adventurer facing board-forward near settlement',
              actorKind: 'ally',
              sourceRelativePath: 'Characters/gltf/Knight.glb',
            },
          },
        },
      })
    );
    expect(registry.warnings).toEqual([]);

    const pieces = {
      roundTower: requirePiece(registry, 'kenney-round-tower'),
      squareTower: requirePiece(registry, 'kenney-square-tower'),
      tree: requirePiece(registry, 'kenney-large-tree'),
      knight: requirePiece(registry, 'kaykit-adventurer-knight'),
    } as const;
    const urlByAssetId = createGameboardPieceSourceUrlMap(registry, { sourceRoots });
    expect(urlByAssetId['kenney:tower-hexagon-base']).toBe(urls.roundTower);
    expect(urlByAssetId['kenney:tower-square-base']).toBe(urls.squareTower);
    expect(urlByAssetId['kenney:tree-large']).toBe(urls.tree);
    expect(urlByAssetId['adventurer:knight']).toBe(urls.knight);

    const game = createFixedSimpleRpgGame();
    spawnLaidOutExternalAsset(game.world, {
      piece: pieces.roundTower,
      report: reports.roundTower,
      sourceUrl: requireSourceUrl(urlByAssetId, pieces.roundTower.assetId),
      seed: 'local-third-party:round-tower',
    });
    spawnLaidOutExternalAsset(game.world, {
      piece: pieces.squareTower,
      report: reports.squareTower,
      sourceUrl: requireSourceUrl(urlByAssetId, pieces.squareTower.assetId),
      seed: 'local-third-party:square-tower',
    });
    spawnLaidOutExternalAsset(game.world, {
      piece: pieces.tree,
      report: reports.tree,
      sourceUrl: requireSourceUrl(urlByAssetId, pieces.tree.assetId),
      seed: 'local-third-party:tree',
    });
    spawnLaidOutExternalAsset(game.world, {
      piece: pieces.knight,
      report: reports.knight,
      sourceUrl: requireSourceUrl(urlByAssetId, pieces.knight.assetId),
      seed: 'local-third-party:knight',
    });

    const projected = projectWorldToGameboardPlan(game.world);
    expect(projected.placements.filter((placement) => placement.metadata.externalAsset === true)).toHaveLength(4);
    expect(projected.placements.find((placement) => placement.assetId === 'kenney:tower-hexagon-base')).toMatchObject({
      metadata: {
        layoutFootprintSize: 3,
        pieceId: 'kenney-round-tower',
        pieceRole: 'landmark',
      },
    });
    expect(projected.placements.find((placement) => placement.assetId === 'kenney:tower-square-base')).toMatchObject({
      metadata: {
        layoutFootprintSize: 3,
        pieceId: 'kenney-square-tower',
        pieceRole: 'landmark',
      },
    });
    const knightPlacement = projected.placements.find((placement) => placement.assetId === 'adventurer:knight');
    expect(knightPlacement).toMatchObject({
      kind: 'unit',
      layer: 'unit',
      metadata: {
        animationDefaultClip: 'Walking_A',
        modelForward: '+z',
        boardForwardEdge: 1,
        pieceId: 'kaykit-adventurer-knight',
        pieceRole: 'unit',
      },
    });
    if (!knightPlacement) {
      throw new Error('Expected projected Adventurers knight placement');
    }
    const loadedKnight = await loadGameboardPlacementObject(knightPlacement, {
      loader,
      assetUrls: urlByAssetId,
      animationUrls: { [pieces.knight.assetId]: urls.movement },
    });
    updateGameboardPlacementAnimation(loadedKnight, 0.25);
    expect(loadedKnight.modelUrl).toBe(urls.knight);
    expect(loadedKnight.animationUrl).toBe(urls.movement);
    expect(loadedKnight.activeClip?.name).toBe('Walking_A');
    expect(loadedKnight.mixer).toBeDefined();
    const knightRecords = new Map([[loadedKnight.placementId, loadedKnight]]);
    const knightHitObject = loadedKnight.object.children[0] ?? loadedKnight.object;
    expect(findGameboardPlacementObjectUserData(knightHitObject)).toMatchObject({
      placementId: knightPlacement.id,
      tileKey: knightPlacement.tileKey,
      assetId: pieces.knight.assetId,
      kind: 'unit',
      layer: 'unit',
      requiresExtra: true,
    });
    expect(findLoadedGameboardPlacementObjectForObject(knightHitObject, knightRecords)).toBe(loadedKnight);

    const canvas = await renderGameboardPlan(projected, {
      title: 'simple-rpg-local-third-party-assets',
      width: 1450,
      height: 900,
      includeExtra: true,
      resolvePlacementUrl: (placement) => urlByAssetId[placement.assetId],
      resolvePlacementAnimationUrl: (placement) =>
        placement.assetId === pieces.knight.assetId ? urls.movement : undefined,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '../../browser/__screenshots__/simple-rpg-local-third-party-assets.png',
    });
    expect(screenshot).toContain('simple-rpg-local-third-party-assets.png');
  });
});

function spawnLaidOutExternalAsset(
  world: ReturnType<typeof createFixedSimpleRpgGame>['world'],
  input: {
    piece: GameboardPieceDeclaration;
    report: ReturnType<typeof analyzeExternalAssetCompatibility>;
    sourceUrl: string;
    seed: string;
  }
): { assetId: string; sourceUrl: string } {
  const external = externalAssetSpawnOptions({
    at: '0,0',
    assetId: input.piece.assetId,
    report: input.report,
    sourceUrl: input.sourceUrl,
    metadata: input.piece.metadata,
  });
  const [placement] = createGameboardLayoutPlacements(projectWorldToGameboardPlan(world), createGameboardLayoutPlacementOptionsFromPiece(input.piece, {
    count: 1,
    seed: input.seed,
    idPrefix: `local:${input.piece.assetId.replaceAll(':', '-')}`,
    assetId: external.assetId,
    scale: external.scale,
    rotationSteps: external.rotationSteps,
    elevationOffset: external.elevationOffset,
    requiresExtra: external.requiresExtra,
    metadata: external.metadata,
  }));
  if (!placement) {
    throw new Error(`No layout site found for ${input.piece.assetId}`);
  }
  spawnGameboardPlacement(world, placement);
  return { assetId: input.piece.assetId, sourceUrl: input.sourceUrl };
}

function requirePiece(registry: GameboardPieceRegistry, id: string): GameboardPieceDeclaration {
  const piece = registry.byId[id];
  if (!piece) {
    throw new Error(`Expected local asset piece ${id} to exist`);
  }
  return piece;
}

function requireSourceUrl(urls: Readonly<Record<string, string>>, assetId: string): string {
  const url = urls[assetId];
  if (!url) {
    throw new Error(`Expected source URL for ${assetId}`);
  }
  return url;
}

async function inspectExternalGltf(url: string): Promise<LoadedExternalAssetMetadata> {
  const gltf = await loader.loadAsync(url);
  const scene = gltf.scene;
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(scene);
  const min = new Vector3();
  const max = new Vector3();
  const size = new Vector3();
  box.getSize(size);
  min.copy(box.min);
  max.copy(box.max);

  let hasRig = (gltf.parser.json.skins?.length ?? 0) > 0;
  scene.traverse((object) => {
    if ((object as { isSkinnedMesh?: boolean }).isSkinnedMesh === true) {
      hasRig = true;
    }
  });

  return {
    bounds: {
      min: vectorTuple(min),
      max: vectorTuple(max),
      size: vectorTuple(size),
    },
    hasRig,
    animationNames: gltf.animations.map((animation, index) => animation.name || `animation_${index}`),
    materialSlots: (gltf.parser.json.materials ?? []).map(
      (material: { name?: string }, index: number) => material.name ?? `material_${index}`
    ),
  };
}

function localAssetRootUrl(root: string): string {
  return `/@fs/${root}`.replaceAll(' ', '%20');
}

function vectorTuple(vector: Vector3): [number, number, number] {
  return [round(vector.x), round(vector.y), round(vector.z)];
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
