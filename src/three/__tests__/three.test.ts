import { describe, expect, it } from 'vitest';
import { AnimationClip, Group } from 'three';
import type { GameboardPlacementSpec } from '../../gameboard/index';
import { freeManifest } from '../../manifest/free';
import {
  createGameboardPlacementAssetUrlResolver,
  findGameboardPlacementObjectUserData,
  findLoadedGameboardPlacementObjectForObject,
  frameObjectPosition,
  gameboardInteractionTargetForObject,
  type LoadedGameboardPlacementObject,
  loadGameboardPlacementObject,
  placeObjectOnHex,
  readGameboardPlacementObjectUserData,
  resolveAssetUrl,
  resolveGameboardPlacementAssetUrl,
  resolveGameboardPlacementAnimationUrl,
  syncGameboardPlacementObjects,
  syncGameboardPlacementObject,
  tagGameboardPlacementObject,
  transformForHex,
  transformForPlacement,
  transformForVariant,
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
    const grass = freeAsset('hex_grass');

    expect(resolveAssetUrl(grass)).toBe('tiles/base/hex_grass.gltf');
    expect(resolveAssetUrl(grass, 'https://assets.example/game/')).toBe(
      'https://assets.example/game/tiles/base/hex_grass.gltf'
    );
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
    expect(resolveGameboardPlacementAssetUrl(placement({ assetId: 'missing' }))).toBeUndefined();
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
    expect(resolveGameboardPlacementAnimationUrl(actor, {
      animationUrls: { 'adventurer:knight': '/animations/mapped.glb' },
    })).toBe('/animations/mapped.glb');
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

  it('covers transform helpers, preview framing, and user-data miss paths', () => {
    const object = new Group();
    const child = new Group();
    const tagged = new Group();
    const taggedChild = new Group();
    tagged.add(taggedChild);
    const testPlacement = placement({ assetId: 'flag_blue' });

    const hexTransform = transformForHex({ q: 1, r: -1 }, {
      elevation: 2,
      positionOffset: { x: 0.5, y: 0.25, z: -0.5 },
      rotationY: Math.PI / 2,
      scale: 0.6,
    });
    const variantTransform = transformForVariant(
      { q: 0, r: 0 },
      {
        family: 'road',
        label: 'A',
        assetId: 'road_A',
        inputMask: 3,
        canonicalMask: 3,
        rotationSteps: 1,
        rotationRadians: Math.PI / 3,
      }
    );

    placeObjectOnHex(object, { q: 1, r: 0 });
    placeObjectOnHex(child, { q: 0, r: 1 }, { scale: 1.25, positionOffset: { x: 1, y: 2, z: 3 } });
    tagGameboardPlacementObject(tagged, testPlacement, { recursive: true });

    expect(hexTransform.position).toMatchObject({ y: 2.25 });
    expect(hexTransform.rotationY).toBe(Math.PI / 2);
    expect(hexTransform.scale).toBe(0.6);
    expect(variantTransform.rotationY).toBeCloseTo(Math.PI / 3);
    expect(object.scale.x).toBe(1);
    expect(child.scale.x).toBe(1.25);
    expect(readGameboardPlacementObjectUserData(taggedChild)?.placementId).toBe(testPlacement.id);
    expect(findGameboardPlacementObjectUserData(new Group())).toBeUndefined();
    expect(findLoadedGameboardPlacementObjectForObject(new Group(), new Map())).toBeUndefined();
    expect(findLoadedGameboardPlacementObjectForObject(taggedChild, new Map())).toBeUndefined();
    expect(gameboardInteractionTargetForObject(new Group())).toBeUndefined();
    const grassFrame = frameObjectPosition(freeAsset('hex_grass'));
    expect(grassFrame.x).toBeGreaterThan(2.5);
    expect(grassFrame.y).toBeCloseTo(grassFrame.x * 0.75);
    expect(grassFrame.z).toBe(grassFrame.x);
    expect(frameObjectPosition(freeAsset('hex_grass'), 2).x).toBeGreaterThan(grassFrame.x);
  });

  it('reports missing model URLs and falls back to model clips when requested clips are absent', async () => {
    const loadedUrls: string[] = [];
    const loader = {
      async loadAsync(url: string) {
        loadedUrls.push(url);
        return {
          scene: new Group(),
          animations: [new AnimationClip('Idle', 1, [])],
        };
      },
    };
    const idlePlacement = placement({
      assetId: 'flag_blue',
      metadata: { sourceUrl: '/models/flag-blue.glb' },
    });

    await expect(loadGameboardPlacementObject(placement({ assetId: 'missing' }), { loader })).rejects.toThrow(
      'No model URL resolved'
    );
    const loaded = await loadGameboardPlacementObject(idlePlacement, {
      loader,
      clipName: 'Missing',
      playAnimation: false,
    });
    const noClipLoaded = await loadGameboardPlacementObject(idlePlacement, {
      loader: {
        async loadAsync() {
          return { scene: new Group() };
        },
      },
    });

    expect(loadedUrls).toEqual(['/models/flag-blue.glb']);
    expect(loaded.activeClip?.name).toBe('Idle');
    expect(loaded.animationUrl).toBeUndefined();
    expect(noClipLoaded.clips).toEqual([]);
    expect(noClipLoaded.activeClip).toBeUndefined();
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
      '/animations/walk-b.glb',
    ]);
  });

  it('collects sync load errors, can rethrow them, and controls stale removal without a parent', async () => {
    const failingLoader = {
      async loadAsync(url: string) {
        throw new Error(`load failed: ${url}`);
      },
    };
    const idleLoader = {
      async loadAsync() {
        return { scene: new Group(), animations: [] };
      },
    };
    const bad = placement({ id: 'bad', assetId: 'bad-model', metadata: { sourceUrl: '/models/missing.glb' } });
    const stalePlacement = placement({ id: 'stale', assetId: 'flag_blue', metadata: { sourceUrl: '/models/stale.glb' } });
    const staleRecord: LoadedGameboardPlacementObject = {
      placementId: 'stale',
      assetId: 'flag_blue',
      object: new Group(),
      modelUrl: '/models/stale.glb',
      transform: transformForPlacement(stalePlacement),
      clips: [],
    };
    const records = new Map<string, LoadedGameboardPlacementObject>([['stale', staleRecord]]);

    syncGameboardPlacementObject(staleRecord, stalePlacement);
    const kept = await syncGameboardPlacementObjects([], { loader: idleLoader, records, removeStale: false });
    expect(kept.removed).toHaveLength(0);
    expect(kept.records.has('stale')).toBe(true);

    const removed = await syncGameboardPlacementObjects([], { loader: idleLoader, records });
    const noParentLoaded = await syncGameboardPlacementObjects([
      placement({ id: 'solo', assetId: 'solo-model', metadata: { sourceUrl: '/models/solo.glb' } }),
    ], { loader: idleLoader });
    const collected = await syncGameboardPlacementObjects([bad], { loader: failingLoader });

    expect(removed.removed.map((item) => item.placementId)).toEqual(['stale']);
    expect(noParentLoaded.loaded.map((item) => item.placementId)).toEqual(['solo']);
    expect(records.size).toBe(0);
    expect(collected.errors).toHaveLength(1);
    expect(collected.errors[0]?.placement.id).toBe('bad');
    await expect(syncGameboardPlacementObjects([bad], {
      loader: failingLoader,
      throwOnError: true,
    })).rejects.toThrow('load failed: /models/missing.glb');
  });
});

describe('three GLTF load caching', () => {
  it('dedupes concurrent loadAsync calls for placements sharing a URL', async () => {
    let callCount = 0;
    const loader = {
      async loadAsync(_url: string) {
        callCount += 1;
        return { scene: new Group(), animations: [] };
      },
    };
    const first = placement({ id: 'a', assetId: 'hex_grass', metadata: { sourceUrl: '/models/shared.glb' } });
    const second = placement({ id: 'b', assetId: 'hex_grass', metadata: { sourceUrl: '/models/shared.glb' } });

    const [loadedA, loadedB] = await Promise.all([
      loadGameboardPlacementObject(first, { loader }),
      loadGameboardPlacementObject(second, { loader }),
    ]);

    expect(callCount).toBe(1);
    expect(loadedA.object).not.toBe(loadedB.object);
  });

  it('issues one loadAsync call per unique URL across a placement sync', async () => {
    const loadedUrls: string[] = [];
    const loader = {
      async loadAsync(url: string) {
        loadedUrls.push(url);
        return { scene: new Group(), animations: [] };
      },
    };
    const placements = [
      placement({ id: 'a', assetId: 'hex_grass', metadata: { sourceUrl: '/models/shared.glb' } }),
      placement({ id: 'b', assetId: 'hex_grass', metadata: { sourceUrl: '/models/shared.glb' } }),
      placement({ id: 'c', assetId: 'flag_blue', metadata: { sourceUrl: '/models/other.glb' } }),
    ];

    const result = await syncGameboardPlacementObjects(placements, { loader });

    expect(loadedUrls).toEqual(['/models/shared.glb', '/models/other.glb']);
    expect(result.loaded).toHaveLength(3);
    expect(result.loaded[0]?.object).not.toBe(result.loaded[1]?.object);
  });

  it('evicts a rejected load so the next sync retries instead of permanently failing', async () => {
    const loadedUrls: string[] = [];
    let shouldFail = true;
    const loader = {
      async loadAsync(url: string) {
        loadedUrls.push(url);
        if (shouldFail) {
          throw new Error(`load failed: ${url}`);
        }
        return { scene: new Group(), animations: [] };
      },
    };
    const flaky = placement({ id: 'flaky', assetId: 'flag_blue', metadata: { sourceUrl: '/models/flaky.glb' } });

    const failed = await syncGameboardPlacementObjects([flaky], { loader });
    expect(failed.errors).toHaveLength(1);

    shouldFail = false;
    const retried = await syncGameboardPlacementObjects([flaky], { loader });

    expect(loadedUrls).toEqual(['/models/flaky.glb', '/models/flaky.glb']);
    expect(retried.errors).toEqual([]);
    expect(retried.loaded.map((item) => item.placementId)).toEqual(['flaky']);
  });

  it('does not share cached loads between distinct loader instances', async () => {
    let firstLoaderCalls = 0;
    let secondLoaderCalls = 0;
    const firstLoader = {
      async loadAsync(_url: string) {
        firstLoaderCalls += 1;
        return { scene: new Group(), animations: [] };
      },
    };
    const secondLoader = {
      async loadAsync(_url: string) {
        secondLoaderCalls += 1;
        return { scene: new Group(), animations: [] };
      },
    };
    const shared = placement({ assetId: 'flag_blue', metadata: { sourceUrl: '/models/cross-loader.glb' } });

    await loadGameboardPlacementObject(shared, { loader: firstLoader });
    await loadGameboardPlacementObject(shared, { loader: secondLoader });

    expect(firstLoaderCalls).toBe(1);
    expect(secondLoaderCalls).toBe(1);
  });

  it('bypasses the cache entirely when cacheLoads is set to false', async () => {
    let callCount = 0;
    const loader = {
      async loadAsync() {
        callCount += 1;
        return { scene: new Group(), animations: [] };
      },
    };
    const first = placement({ id: 'a', assetId: 'hex_grass', metadata: { sourceUrl: '/models/uncached.glb' } });
    const second = placement({ id: 'b', assetId: 'hex_grass', metadata: { sourceUrl: '/models/uncached.glb' } });

    await syncGameboardPlacementObjects([first, second], { loader, cacheLoads: false });

    expect(callCount).toBe(2);
  });
});

function freeAsset(assetId: string) {
  const asset = freeManifest.assetsById[assetId];
  if (!asset) {
    throw new Error(`Expected FREE manifest fixture asset: ${assetId}`);
  }
  return asset;
}

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
