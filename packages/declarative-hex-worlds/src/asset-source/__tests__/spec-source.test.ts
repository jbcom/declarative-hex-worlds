import { describe, expect, it } from 'vitest';
import type { GameboardPlacementSpec } from '../../gameboard';
import { createSourceFromSpec } from '../spec-source';
import { parseAssetSourceSpec } from '../spec';

function placement(assetId: string, extra: Partial<GameboardPlacementSpec> = {}): GameboardPlacementSpec {
  return {
    id: `p:${assetId}`,
    tileKey: '0,0',
    coordinates: { q: 0, r: 0 },
    position: { x: 0, y: 0, z: 0 },
    assetId,
    kind: 'terrain',
    layer: 'terrain',
    textureSet: 'default',
    elevation: 0,
    elevationOffset: 0,
    rotationSteps: 0,
    rotationRadians: 0,
    scale: 1,
    order: 0,
    requiresExtra: false,
    metadata: {},
    ...extra,
  };
}

describe('createSourceFromSpec', () => {
  it('round-trips a bind-style spec into a source that resolves its tileset + model assets', () => {
    // A spec exactly as `bind` would emit: one tileset (grass), one model (tree).
    const spec = parseAssetSourceSpec({
      specVersion: 1,
      name: 'my-pack',
      assetRoot: 'public/assets',
      assets: [
        {
          id: 'grassland',
          role: 'tileset',
          format: 'png',
          path: 'tilesets/grassland.png',
          biome: 'grass',
          grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
        },
        { id: 'tree', role: 'model', format: 'glb', path: 'models/tree.glb' },
      ],
    });
    const source = createSourceFromSpec(spec);
    expect(source).toBeDefined();

    // Tileset arm: a grass placement resolves to a tileset-cell of the grass sheet.
    const grass = source?.resolve(placement('x', { metadata: { biome: 'grass' } }));
    expect(grass?.type).toBe('tileset-cell');
    if (grass?.type === 'tileset-cell') {
      expect(grass.sheetUrl).toBe('tilesets/grassland.png');
    }

    // gltf arm: the model asset id resolves to its glb URL (baseUrl = assetRoot).
    const tree = source?.resolve(placement('tree'));
    expect(tree?.type).toBe('gltf');
    if (tree?.type === 'gltf') {
      expect(tree.url).toContain('models/tree.glb');
    }
  });

  it('resolves a tileset transition cell via resolveEdge from the spec', () => {
    const spec = parseAssetSourceSpec({
      specVersion: 1,
      name: 'coastal',
      assetRoot: 'assets',
      assets: [
        {
          id: 'coast',
          role: 'tileset',
          format: 'png',
          path: 'tilesets/coast.png',
          grid: { cols: 4, rows: 4, cellWidth: 64, cellHeight: 64 },
          transition: { edgeCells: { '5': 3 } },
        },
      ],
    });
    const source = createSourceFromSpec(spec);
    const req = source?.resolveEdge?.('coast', 5);
    expect(req?.type).toBe('tileset-cell');
    if (req?.type === 'tileset-cell') {
      // cell index 3 in a 4-col grid → col 3, row 0.
      expect(req.cell).toEqual({ x: 192, y: 0, width: 64, height: 64 });
    }
  });

  it('returns undefined for a spec with no resolvable assets', () => {
    // Sprite-only spec → no tileset/gltf arm yet → no source.
    const spec = parseAssetSourceSpec({
      specVersion: 1,
      name: 'sprites-only',
      assetRoot: 'assets',
      assets: [{ id: 'unit', role: 'sprite', format: 'png', path: 'sprites/unit.png' }],
    });
    expect(createSourceFromSpec(spec)).toBeUndefined();
  });
});
