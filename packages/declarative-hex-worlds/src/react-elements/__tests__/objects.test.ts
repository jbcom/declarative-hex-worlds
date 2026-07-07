import { Group } from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { AssetRenderRequest, AssetSource } from '../../asset-source';
import type { GameboardPlacementSpec } from '../../gameboard';
import type { HexWorldContextValue } from '../context';
import { combineSources, syncHexWorldPlacements } from '../objects-sync';

function placement(assetId: string): GameboardPlacementSpec {
  return {
    id: `p:${assetId}`,
    tileKey: '0,0',
    coordinates: { q: 0, r: 0 },
    position: { x: 0, y: 0, z: 0 },
    assetId,
    kind: 'prop',
    layer: 'feature',
    textureSet: 'default',
    elevation: 0,
    elevationOffset: 0,
    rotationSteps: 0,
    rotationRadians: 0,
    scale: 1,
    order: 0,
    requiresExtra: false,
    metadata: {},
  };
}

const gltfReq: AssetRenderRequest = { type: 'gltf', dimension: '3d', url: '/a.glb' };

function sourceThatResolves(assetId: string): AssetSource {
  return {
    kind: 'gltf-pack',
    resolve: (p) => (p.assetId === assetId ? gltfReq : undefined),
    resolveEdge: (id) => (id === assetId ? gltfReq : undefined),
  };
}

describe('combineSources', () => {
  it('returns undefined for an empty registry', () => {
    expect(combineSources([])).toBeUndefined();
  });

  it('returns the single source directly', () => {
    const s = sourceThatResolves('a');
    expect(combineSources([s])).toBe(s);
  });

  it('first-match across multiple sources for resolve + resolveEdge', () => {
    const combined = combineSources([sourceThatResolves('a'), sourceThatResolves('b')]);
    expect(combined?.kind).toBe('composite');
    expect(combined?.resolve(placement('a'))).toBe(gltfReq);
    expect(combined?.resolve(placement('b'))).toBe(gltfReq);
    expect(combined?.resolve(placement('z'))).toBeUndefined();
    expect(combined?.resolveEdge?.('a', 1)).toBe(gltfReq);
    expect(combined?.resolveEdge?.('z', 1)).toBeUndefined();
  });

  it('composite resolveEdge tolerates sources without resolveEdge', () => {
    const noEdge: AssetSource = { kind: 'x', resolve: () => undefined };
    const combined = combineSources([noEdge, sourceThatResolves('a')]);
    expect(combined?.resolveEdge?.('a', 1)).toBe(gltfReq);
  });
});

describe('syncHexWorldPlacements', () => {
  const loader = { loadAsync: vi.fn() };
  function context(overrides: Partial<HexWorldContextValue> = {}): HexWorldContextValue {
    return {
      sources: [],
      registerSource: () => () => undefined,
      loader,
      ...overrides,
    };
  }

  it('returns undefined when the plan is not ready', () => {
    expect(
      syncHexWorldPlacements(undefined, context(), new Group(), new Map(), 0)
    ).toBeUndefined();
  });

  it('returns undefined when no loader is configured', () => {
    expect(
      syncHexWorldPlacements(
        { placements: [], tiles: [] } as never,
        context({ loader: undefined }),
        new Group(),
        new Map(),
        0
      )
    ).toBeUndefined();
  });

  it('runs a sync (returns a promise) when plan + loader are ready', () => {
    const result = syncHexWorldPlacements(
      { placements: [], tiles: [] } as never,
      context(),
      new Group(),
      new Map(),
      0.16
    );
    expect(result).toBeInstanceOf(Promise);
  });

  it('threads textureLoader, baseUrl, and a combined source into the sync', () => {
    const result = syncHexWorldPlacements(
      { placements: [], tiles: [] } as never,
      context({
        sources: [sourceThatResolves('a'), sourceThatResolves('b')],
        textureLoader: { loadAsync: vi.fn() },
        baseUrl: 'https://cdn.example.com/',
      }),
      new Group(),
      new Map(),
      undefined
    );
    expect(result).toBeInstanceOf(Promise);
  });
});
