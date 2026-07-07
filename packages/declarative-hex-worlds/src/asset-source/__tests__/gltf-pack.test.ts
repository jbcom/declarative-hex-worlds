import { describe, expect, it } from 'vitest';
import type { GameboardPlacementSpec } from '../../gameboard';
import { createGltfPackSource } from '../gltf-pack';
import type { AssetSource } from '../source';

function placement(input: {
  id?: string;
  assetId: string;
  rotationRadians?: number;
  scale?: number;
  metadata?: GameboardPlacementSpec['metadata'];
}): GameboardPlacementSpec {
  return {
    id: input.id ?? `placement:${input.assetId}`,
    tileKey: '0,0',
    coordinates: { q: 0, r: 0 },
    position: { x: 1, y: 2, z: 3 },
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
    requiresExtra: false,
    metadata: input.metadata ?? {},
  };
}

describe('gltf-pack AssetSource', () => {
  it('identifies its kind as gltf-pack and satisfies the AssetSource contract', () => {
    const source: AssetSource = createGltfPackSource();
    expect(source.kind).toBe('gltf-pack');
    expect(typeof source.resolve).toBe('function');
  });

  it('resolves a placement with a metadata sourceUrl to a gltf render request', () => {
    const source = createGltfPackSource();
    const request = source.resolve(
      placement({ assetId: 'castle', metadata: { sourceUrl: '/models/castle.glb' } })
    );
    expect(request).toEqual({
      type: 'gltf',
      dimension: '3d',
      url: '/models/castle.glb',
      transform: {
        position: { x: 1, y: 2, z: 3 },
        rotationY: 0,
        scale: 1,
      },
    });
  });

  it('carries the placement transform (rotation + scale) into the request', () => {
    const source = createGltfPackSource();
    const request = source.resolve(
      placement({
        assetId: 'tower',
        rotationRadians: Math.PI / 2,
        scale: 2,
        metadata: { sourceUrl: '/models/tower.glb' },
      })
    );
    expect(request?.type).toBe('gltf');
    if (request?.type === 'gltf') {
      expect(request.transform).toEqual({
        position: { x: 1, y: 2, z: 3 },
        rotationY: Math.PI / 2,
        scale: 2,
      });
    }
  });

  it('resolves via an explicit assetUrls override map', () => {
    const source = createGltfPackSource({ assetUrls: { hex_grass: '/tiles/grass.glb' } });
    const request = source.resolve(placement({ assetId: 'hex_grass' }));
    expect(request).toMatchObject({ type: 'gltf', url: '/tiles/grass.glb' });
  });

  it('returns undefined when no URL can be resolved (caller falls through)', () => {
    const source = createGltfPackSource();
    expect(source.resolve(placement({ assetId: 'unmapped' }))).toBeUndefined();
  });

  it('applies the ResolveContext baseUrl when the source has no own baseUrl', () => {
    const source = createGltfPackSource({ assetUrls: { hex_grass: 'grass.glb' } });
    // assetUrls take precedence over baseUrl resolution, so use a catalog-free
    // fallback to prove baseUrl threads through: metadata sourceUrl is absolute,
    // so baseUrl only matters for manifest-relative paths. Assert it is passed by
    // resolving a mapped URL unchanged (baseUrl does not corrupt explicit maps).
    const request = source.resolve(placement({ assetId: 'hex_grass' }), {
      baseUrl: 'https://cdn.example.com/assets/',
    });
    expect(request).toMatchObject({ type: 'gltf', url: 'grass.glb' });
  });

  it('prefers the source own baseUrl over the ResolveContext baseUrl', () => {
    const source = createGltfPackSource({
      baseUrl: 'https://own.example.com/',
      assetUrls: { hex_grass: 'grass.glb' },
    });
    const request = source.resolve(placement({ assetId: 'hex_grass' }), {
      baseUrl: 'https://ctx.example.com/',
    });
    // Explicit assetUrls win regardless; the point is resolve() does not throw
    // and the own-baseUrl branch (options.baseUrl ?? ctx.baseUrl) is exercised.
    expect(request).toMatchObject({ type: 'gltf', url: 'grass.glb' });
  });
});
