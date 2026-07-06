/**
 * Browser coverage for the RFC0-8 tileset-cell render path in `src/three`.
 *
 * `src/three` is browser-covered (WebGL/DOM), so the AssetSource dispatch added
 * to `loadGameboardPlacementObject` + `syncGameboardPlacementObjects` — the
 * tileset-cell → textured-hex-mesh branch — is exercised here against a real
 * WebGLRenderer with a real (canvas-backed) sheet texture. Asserts the tiles
 * produce renderable, non-empty canvas content.
 */
import {
  Box3,
  CanvasTexture,
  Color,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { describe, expect, it } from 'vitest';
import {
  createTilesetSource,
  type GameboardSheetTextureLoader,
  type GameboardPlacementSpec,
  type SheetTexture,
  syncGameboardPlacementObjects,
  type TilesetManifest,
} from '../../src';

const SHEET_W = 480;
const SHEET_H = 830;

/** A real, WebGL-uploadable sheet texture drawn on an offscreen canvas. */
function drawSheet(): SheetTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SHEET_W;
  canvas.height = SHEET_H;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Paint distinct colored cells so the render is non-empty.
    const colors = ['#3a7d34', '#2f6d2a', '#4a8d44', '#357a30', '#428841'];
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 5; col++) {
        ctx.fillStyle = colors[(row + col) % colors.length] as string;
        ctx.fillRect(col * 96, row * 83, 96, 83);
      }
    }
  }
  return { texture: new CanvasTexture(canvas), sheetWidth: SHEET_W, sheetHeight: SHEET_H };
}

function sheetLoader(): GameboardSheetTextureLoader {
  const sheet = drawSheet();
  return {
    async loadAsync() {
      return sheet;
    },
  };
}

const manifest: TilesetManifest = {
  schemaVersion: '1',
  kind: 'tileset',
  sheets: {
    grassland: {
      url: 'tiles/grassland.png',
      grid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
      role: 'fill',
    },
  },
  biomes: { grass: { sheet: 'grassland', select: 'hash' } },
};

function tilePlacement(q: number, r: number): GameboardPlacementSpec {
  return {
    id: `tile:${q},${r}`,
    tileKey: `${q},${r}`,
    coordinates: { q, r },
    position: { x: q * 2, y: 0, z: r * 2 },
    assetId: 'grass',
    kind: 'prop',
    layer: 'surface',
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

describe('tileset-cell render path (RFC0-8)', () => {
  it('renders a small tileset board of textured-hex meshes with non-empty content', async () => {
    const source = createTilesetSource({ manifest });
    const textureLoader = sheetLoader();
    const placements: GameboardPlacementSpec[] = [];
    for (let q = 0; q < 3; q++) {
      for (let r = 0; r < 3; r++) {
        placements.push(tilePlacement(q, r));
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    document.body.innerHTML = '';
    document.body.append(canvas);
    const renderer = new WebGLRenderer({ canvas, preserveDrawingBuffer: true });
    renderer.setSize(640, 480, false);
    renderer.setClearColor(new Color('#101410'), 1);

    const scene = new Scene();
    const result = await syncGameboardPlacementObjects(placements, {
      loader: { async loadAsync() {
        throw new Error('GLTF loader should not be called for tileset placements');
      } },
      source,
      textureLoader,
      parent: scene,
      throwOnError: true,
    });

    // Every placement rendered as a textured-hex mesh, no errors.
    expect(result.loaded).toHaveLength(9);
    expect(result.errors).toEqual([]);

    // Top-down camera over the board.
    const box = new Box3().setFromObject(scene);
    const center = new Vector3();
    const size = new Vector3();
    box.getCenter(center);
    box.getSize(size);
    const span = Math.max(size.x, size.z) * 1.2 || 8;
    const camera = new OrthographicCamera(-span, span, span, -span, 0.1, 100);
    camera.position.set(center.x, 20, center.z);
    camera.lookAt(center);
    renderer.render(scene, camera);

    // The rendered canvas is not blank (tiles drew colored pixels).
    const gl = renderer.getContext();
    const pixels = new Uint8Array(640 * 480 * 4);
    gl.readPixels(0, 0, 640, 480, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let nonBackground = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const red = pixels[i] ?? 0;
      const green = pixels[i + 1] ?? 0;
      // Background is ~ (16,20,16); count clearly-different pixels.
      if (Math.abs(red - 16) > 20 || Math.abs(green - 20) > 20) {
        nonBackground++;
      }
    }
    expect(nonBackground).toBeGreaterThan(0);

    renderer.dispose();
  });
});
