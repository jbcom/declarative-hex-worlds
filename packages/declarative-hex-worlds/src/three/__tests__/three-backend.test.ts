import { Group } from 'three';
import { describe, expect, it } from 'vitest';
import type { AssetRenderRequest } from '../../asset-source';
import type { GameboardPlacementSpec } from '../../gameboard';
import { createThreeRenderBackend } from '../three-backend';

function placement(assetId: string, sourceUrl?: string): GameboardPlacementSpec {
  return {
    id: `p:${assetId}`,
    tileKey: '0,0',
    coordinates: { q: 0, r: 0 },
    position: { x: 1, y: 0, z: 2 },
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
    metadata: sourceUrl ? { sourceUrl } : {},
  };
}

const gltfLoader = {
  async loadAsync() {
    return { scene: new Group(), animations: [] };
  },
};

const gltfRequest: AssetRenderRequest = { type: 'gltf', dimension: '3d', url: '/m.glb' };

describe('three RenderBackend', () => {
  it('identifies as three and supports both 2D + 3D (2.5D)', () => {
    const backend = createThreeRenderBackend({ loader: gltfLoader });
    expect(backend.id).toBe('three');
    expect([...backend.dimensions].sort()).toEqual(['2d', '3d']);
  });

  it('mounts a placement into the parent and tags the rendered node', async () => {
    const backend = createThreeRenderBackend({ loader: gltfLoader });
    const parent = new Group();
    const rendered = await backend.mount(
      placement('castle', '/models/castle.glb'),
      gltfRequest,
      parent
    );
    expect(rendered).toBeDefined();
    expect(rendered?.placementId).toBe('p:castle');
    expect(rendered?.assetId).toBe('castle');
    expect(parent.children).toContain(rendered?.node);
  });

  it('applies a transform to a mounted node', async () => {
    const backend = createThreeRenderBackend({ loader: gltfLoader });
    const parent = new Group();
    const rendered = await backend.mount(placement('a', '/a.glb'), gltfRequest, parent);
    if (!rendered) throw new Error('mount returned undefined');
    backend.applyTransform(rendered, {
      position: { x: 5, y: 1, z: 3 },
      rotationY: Math.PI / 2,
      scale: 2,
    });
    expect(rendered.node.position.x).toBe(5);
    expect(rendered.node.scale.x).toBe(2);
    expect(rendered.transform?.rotationY).toBeCloseTo(Math.PI / 2);
  });

  it('threads source, textureLoader, and baseUrl into the bridge (mount option spreads)', async () => {
    // Exercises the conditional-spread branches: a backend configured with all
    // optional loaders/source, resolving a mapped GLTF url.
    const source = {
      kind: 'gltf-pack' as const,
      resolve: () => gltfRequest,
    };
    const backend = createThreeRenderBackend({
      loader: gltfLoader,
      source,
      textureLoader: { async loadAsync() { return { texture: {}, sheetWidth: 1, sheetHeight: 1 } as never; } },
      baseUrl: 'https://cdn.example.com/',
    });
    const parent = new Group();
    const rendered = await backend.mount(placement('c', '/c.glb'), gltfRequest, parent);
    expect(rendered?.node).toBeDefined();
    expect(parent.children).toContain(rendered?.node);
  });

  it('unmounts a node from the parent', async () => {
    const backend = createThreeRenderBackend({ loader: gltfLoader });
    const parent = new Group();
    const rendered = await backend.mount(placement('b', '/b.glb'), gltfRequest, parent);
    if (!rendered) throw new Error('mount returned undefined');
    expect(parent.children).toContain(rendered.node);
    backend.unmount(rendered, parent);
    expect(parent.children).not.toContain(rendered.node);
  });
});
