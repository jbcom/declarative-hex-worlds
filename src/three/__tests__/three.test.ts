import { describe, expect, it } from 'vitest';
import { AnimationClip, Group } from 'three';
import type { GameboardPlacementSpec } from '../../gameboard/index';
import { freeManifest } from '../../manifest/free';
import {
  createGameboardPlacementAssetUrlResolver,
  findGameboardPlacementObjectUserData,
  findLoadedGameboardPlacementObjectForObject,
  gameboardInteractionTargetForObject,
  loadGameboardPlacementObject,
  readGameboardPlacementObjectUserData,
  resolveGameboardPlacementAssetUrl,
  resolveGameboardPlacementAnimationUrl,
  syncGameboardPlacementObjects,
  transformForPlacement,
  updateGameboardPlacementAnimation,
} from '../../three/index';

describe('three placement asset URL helpers', () => {
  it('resolves placement model URLs from explicit maps, metadata, manifests, and fallback handlers', () => {
    const manifestPlacement = placement({ assetId: 'hex_grass' });
    const externalPlacement = placement({
      assetId: 'kenney:tower-hexagon-base',
      metadata: { sourceUrl: '/@fs/references/kenney/tower-hexagon-base.glb' },
    });
    const mappedPlacement = placement({ assetId: 'adventurer:knight' });
    const unknownPlacement = placement({ assetId: 'external:unknown' });

    expect(resolveGameboardPlacementAssetUrl(manifestPlacement, {
      catalog: freeManifest,
      baseUrl: '/vendor/kaykit',
    })).toBe('/vendor/kaykit/tiles/base/hex_grass.gltf');
    expect(resolveGameboardPlacementAssetUrl(externalPlacement, { catalog: freeManifest })).toBe(
      '/@fs/references/kenney/tower-hexagon-base.glb'
    );
    expect(resolveGameboardPlacementAssetUrl(mappedPlacement, {
      assetUrls: { 'adventurer:knight': '/@fs/references/adventurers/Knight.glb' },
      catalog: freeManifest,
    })).toBe('/@fs/references/adventurers/Knight.glb');
    expect(resolveGameboardPlacementAssetUrl(unknownPlacement, {
      fallback: (placement) => `/fallback/${placement.assetId}.glb`,
    })).toBe('/fallback/external:unknown.glb');
  });

  it('creates reusable placement URL resolvers for render loops', () => {
    const resolve = createGameboardPlacementAssetUrlResolver({
      catalog: freeManifest,
      assetUrls: { 'kenney:tree-large': '/@fs/references/kenney/tree-large.glb' },
    });

    expect(resolve(placement({ assetId: 'kenney:tree-large' }))).toBe('/@fs/references/kenney/tree-large.glb');
    expect(resolve(placement({ assetId: 'flag_blue' }))).toBe('decoration/props/flag_blue.gltf');
  });

  it('loads transformed placements with external animation clips', async () => {
    const loadedUrls: string[] = [];
    const loader = {
      async loadAsync(url: string) {
        loadedUrls.push(url);
        return {
          scene: new Group(),
          animations: url.endsWith('movement.glb') ? [new AnimationClip('Walking_A', 1, [])] : [],
        };
      },
    };
    const actor = placement({
      assetId: 'adventurer:knight',
      position: { x: 1.25, y: 0.5, z: -2 },
      rotationRadians: Math.PI / 3,
      scale: 0.7,
      metadata: {
        sourceUrl: '/models/Knight.glb',
        animationSourceUrl: '/animations/movement.glb',
        animationDefaultClip: 'Walking_A',
        actorId: 'hero',
        actorKind: 'player',
        sourcePack: 'KayKit Adventurers 2.0 FREE',
      },
    });

    expect(resolveGameboardPlacementAnimationUrl(actor)).toBe('/animations/movement.glb');
    expect(transformForPlacement(actor)).toEqual({
      position: { x: 1.25, y: 0.5, z: -2 },
      rotationY: Math.PI / 3,
      scale: 0.7,
    });

    const loaded = await loadGameboardPlacementObject(actor, { loader });
    updateGameboardPlacementAnimation(loaded, 0.25);
    const child = new Group();
    loaded.object.add(child);

    expect(loaded.placementId).toBe('placement:adventurer:knight');
    expect(loaded.assetId).toBe('adventurer:knight');
    expect(loadedUrls).toEqual(['/models/Knight.glb', '/animations/movement.glb']);
    expect(loaded.modelUrl).toBe('/models/Knight.glb');
    expect(loaded.animationUrl).toBe('/animations/movement.glb');
    expect(loaded.activeClip?.name).toBe('Walking_A');
    expect(loaded.mixer).toBeDefined();
    expect(loaded.animationAction).toBeDefined();
    expect(loaded.object.position.toArray()).toEqual([1.25, 0.5, -2]);
    expect(loaded.object.rotation.y).toBeCloseTo(Math.PI / 3);
    expect(loaded.object.scale.x).toBeCloseTo(0.7);
    expect(readGameboardPlacementObjectUserData(loaded.object)).toMatchObject({
      placementId: 'placement:adventurer:knight',
      tileKey: '0,0',
      assetId: 'adventurer:knight',
      kind: 'prop',
      layer: 'feature',
      requiresExtra: true,
      actorId: 'hero',
      actorKind: 'player',
      sourcePack: 'KayKit Adventurers 2.0 FREE',
    });
    expect(findGameboardPlacementObjectUserData(child)?.placementId).toBe('placement:adventurer:knight');
    expect(gameboardInteractionTargetForObject(child)).toEqual({
      placementId: 'placement:adventurer:knight',
      actorId: 'hero',
      tileKey: '0,0',
    });
  });

  it('syncs placement objects for a Three scene graph', async () => {
    const loadedUrls: string[] = [];
    const loader = {
      async loadAsync(url: string) {
        loadedUrls.push(url);
        const scene = new Group();
        scene.name = `object:${url}`;
        return {
          scene,
          animations: url.endsWith('movement.glb') ? [new AnimationClip('Walking_A', 1, [])] : [],
        };
      },
    };
    const parent = new Group();
    const records = new Map();
    const tree = placement({
      id: 'tree',
      assetId: 'kenney:tree-large',
      position: { x: 0, y: 0, z: 0 },
      metadata: { sourceUrl: '/models/tree-large.glb' },
    });
    const knight = placement({
      id: 'knight',
      assetId: 'adventurer:knight',
      metadata: {
        sourceUrl: '/models/Knight.glb',
        animationSourceUrl: '/animations/movement.glb',
        animationDefaultClip: 'Walking_A',
      },
    });

    const first = await syncGameboardPlacementObjects([tree, knight], {
      loader,
      parent,
      records,
      deltaSeconds: 0.1,
    });

    expect(first.errors).toEqual([]);
    expect(first.loaded).toHaveLength(2);
    expect(first.updated).toHaveLength(0);
    expect(parent.children).toHaveLength(2);
    expect(records.size).toBe(2);

    const movedTree = placement({
      id: 'tree',
      assetId: 'kenney:tree-large',
      position: { x: 2, y: 0.25, z: -1 },
      scale: 0.8,
      metadata: { sourceUrl: '/models/tree-large.glb' },
    });
    const tower = placement({
      id: 'tower',
      assetId: 'kenney:tower',
      metadata: { sourceUrl: '/models/tower.glb' },
    });
    const second = await syncGameboardPlacementObjects([movedTree, tower], {
      loader,
      parent,
      records,
      deltaSeconds: 0.1,
    });

    expect(second.errors).toEqual([]);
    expect(second.loaded.map((item) => item.placementId)).toEqual(['tower']);
    expect(second.updated.map((item) => item.placementId)).toEqual(['tree']);
    expect(second.removed.map((item) => item.placementId)).toEqual(['knight']);
    expect(parent.children).toHaveLength(2);
    expect(records.size).toBe(2);
    expect(records.get('tree')?.object.position.toArray()).toEqual([2, 0.25, -1]);
    expect(records.get('tree')?.object.scale.x).toBeCloseTo(0.8);
    const towerChild = new Group();
    records.get('tower')?.object.add(towerChild);
    expect(findLoadedGameboardPlacementObjectForObject(towerChild, records)?.placementId).toBe('tower');
    expect(loadedUrls).toEqual([
      '/models/tree-large.glb',
      '/models/Knight.glb',
      '/animations/movement.glb',
      '/models/tower.glb',
    ]);
  });

  it('reloads synced placement objects when animation URLs change', async () => {
    const loadedUrls: string[] = [];
    const loader = {
      async loadAsync(url: string) {
        loadedUrls.push(url);
        return {
          scene: new Group(),
          animations: url.includes('/animations/') ? [new AnimationClip(`clip:${url}`, 1, [])] : [],
        };
      },
    };
    const parent = new Group();
    const records = new Map();
    const firstPlacement = placement({
      id: 'unit',
      assetId: 'adventurer:knight',
      metadata: {
        sourceUrl: '/models/Knight.glb',
        animationSourceUrl: '/animations/walk-a.glb',
      },
    });
    const secondPlacement = placement({
      id: 'unit',
      assetId: 'adventurer:knight',
      metadata: {
        sourceUrl: '/models/Knight.glb',
        animationSourceUrl: '/animations/walk-b.glb',
      },
    });

    await syncGameboardPlacementObjects([firstPlacement], { loader, parent, records });
    const second = await syncGameboardPlacementObjects([secondPlacement], { loader, parent, records });

    expect(second.loaded.map((item) => item.animationUrl)).toEqual(['/animations/walk-b.glb']);
    expect(second.updated).toHaveLength(0);
    expect(second.removed.map((item) => item.animationUrl)).toEqual(['/animations/walk-a.glb']);
    expect(parent.children).toHaveLength(1);
    expect(records.get('unit')?.animationUrl).toBe('/animations/walk-b.glb');
    expect(loadedUrls).toEqual([
      '/models/Knight.glb',
      '/animations/walk-a.glb',
      '/models/Knight.glb',
      '/animations/walk-b.glb',
    ]);
  });
});

function placement(input: {
  id?: string;
  assetId: string;
  position?: GameboardPlacementSpec['position'];
  rotationRadians?: number;
  scale?: number;
  metadata?: GameboardPlacementSpec['metadata'];
}): GameboardPlacementSpec {
  return {
    id: input.id ?? `placement:${input.assetId}`,
    tileKey: '0,0',
    coordinates: { q: 0, r: 0 },
    position: input.position ?? { x: 0, y: 0, z: 0 },
    assetId: input.assetId,
    kind: 'prop',
    layer: 'feature',
    textureSet: 'default',
    elevation: 0,
    elevationOffset: 0,
    rotationSteps: 0,
    rotationRadians: input.rotationRadians ?? 0,
    scale: input.scale ?? 1,
    order: 0,
    requiresExtra: input.assetId.includes(':'),
    metadata: input.metadata ?? {},
  };
}
