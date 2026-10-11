/** Visual and draw-call proof for the optional procedural modelling subpath. @module */
import { expect, it } from 'vitest';
import { page } from 'vitest/browser';
import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';
import {
  box,
  buildPiece,
  createSculptMaterials,
  cyl,
  lathe,
  part,
  rock,
  rope,
  sheet,
  type Part,
} from '../../src/sculpt';

const palette = {
  oak: '#7a5230',
  iron: '#3a3a40',
  brass: '#c9a24b',
  lamp: '#ffd28a',
  clay: '#b8693d',
  stone: '#8d8678',
  canvas: '#d8cfb4',
  rope: '#a08a60',
};

type Tone = keyof typeof palette;

function crate(): Part<Tone>[] {
  const parts: Part<Tone>[] = [];
  for (let i = -2; i <= 2; i++) {
    parts.push(box(0.105, 0.035, 0.55, { at: [i * 0.11, 0.03, 0], tone: 'oak' }));
    for (const side of [-1, 1]) {
      parts.push(
        box(0.55, 0.075, 0.035, { at: [0, 0.1 + (i + 2) * 0.08, side * 0.26], tone: 'oak' })
      );
      parts.push(
        box(0.035, 0.075, 0.55, { at: [side * 0.26, 0.1 + (i + 2) * 0.08, 0], tone: 'oak' })
      );
    }
  }
  for (const x of [-0.25, 0.25])
    for (const z of [-0.25, 0.25]) {
      parts.push(box(0.05, 0.45, 0.05, { at: [x, 0.225, z], tone: 'oak', shade: 0.8 }));
    }
  return parts;
}

function lantern(): Part<Tone>[] {
  return [
    cyl(0.08, 0.1, 0.04, { at: [0, 0.02, 0], tone: 'iron' }),
    cyl(0.045, 0.06, 0.23, { at: [0, 0.165, 0], tone: 'lamp', finish: 'glow' }),
    cyl(0.025, 0.09, 0.055, { at: [0, 0.31, 0], tone: 'iron' }),
    ...[-1, 1].map((side) =>
      rope([side * 0.06, 0.05, 0], [side * 0.06, 0.31, 0], {
        tone: 'brass',
        finish: 'metal',
        radius: 0.006,
      })
    ),
    rope([-0.06, 0.31, 0], [0, 0.42, 0], { tone: 'brass', finish: 'metal', radius: 0.006 }),
    rope([0, 0.42, 0], [0.06, 0.31, 0], { tone: 'brass', finish: 'metal', radius: 0.006 }),
  ];
}

it('renders composed wood, metal, glowing glass, pottery, stone, cloth and rope', async () => {
  await page.viewport(1100, 650);
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(1100, 650);
  const canvas = renderer.domElement;
  document.body.append(canvas);
  const scene = new Scene();
  scene.background = new Color('#202529');
  scene.add(new AmbientLight('#fff4dc', 1.8));
  const sun = new DirectionalLight('#ffe3b3', 3);
  sun.position.set(-3, 5, 4);
  scene.add(sun);
  const materials = createSculptMaterials();
  const geometries = [] as ReturnType<typeof buildPiece>[];
  const floorMaterial = new MeshStandardMaterial({ color: '#464b43', roughness: 1 });
  const floorGeometry = new PlaneGeometry(5, 3);
  const floor = new Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.005;
  scene.add(floor);
  const models: readonly (readonly [readonly Part<Tone>[], number, number])[] = [
    [crate(), -0.9, 0],
    [lantern(), 0, 0],
    [
      [
        lathe(
          [
            [0, 0],
            [0.09, 0.02],
            [0.17, 0.15],
            [0.15, 0.3],
            [0.075, 0.4],
            [0.085, 0.44],
            [0, 0.44],
          ],
          { tone: 'clay' }
        ),
      ],
      0.8,
      0,
    ],
    [[rock(0.17, 7, { at: [0, 0.08, 0], tone: 'stone' })], 1.25, 0.45],
    [
      [
        part(
          sheet([
            [
              [-0.3, 0.7, 0],
              [0, 0.62, 0],
              [0.3, 0.7, 0],
            ],
            [
              [-0.3, 0.35, 0.12],
              [0, 0.26, 0.1],
              [0.3, 0.35, 0.12],
            ],
            [
              [-0.3, 0, 0.3],
              [0, 0.05, 0.32],
              [0.3, 0, 0.3],
            ],
          ]),
          { tone: 'canvas' }
        ),
        rope([-0.3, 0.7, 0], [-0.6, 0.01, 0.65], { tone: 'rope' }),
      ],
      -0.15,
      -0.5,
    ],
  ];
  try {
    for (const [parts, x, z] of models) {
      const merged = buildPiece(parts, palette, { grounded: true });
      geometries.push(merged);
      const group = new Group();
      group.position.set(x, 0, z);
      for (const [finish, geometry] of merged) {
        group.add(new Mesh(geometry, materials[finish as keyof typeof materials]));
      }
      scene.add(group);
    }
    const camera = new OrthographicCamera(-1.9, 1.9, 1.12, -1.12, 0.1, 20);
    camera.position.set(2.4, 2.7, 4);
    camera.lookAt(0, 0.28, 0);
    renderer.render(scene, camera);
    expect(renderer.info.render.calls).toBeLessThanOrEqual(8);
    const gl = renderer.getContext();
    const pixels = new Uint8Array(1100 * 650 * 4);
    gl.readPixels(0, 0, 1100, 650, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set<number>();
    for (let i = 0; i < pixels.length; i += 64) {
      colors.add((pixels[i] ?? 0) * 65536 + (pixels[i + 1] ?? 0) * 256 + (pixels[i + 2] ?? 0));
    }
    expect(colors.size).toBeGreaterThan(100);
    expect(
      await page.screenshot({ element: canvas, path: '__screenshots__/sculpt-camp.png' })
    ).toContain('sculpt-camp.png');
    await page.screenshot({ element: canvas, path: '../../../../test-results/sculpt-camp.png' });
  } finally {
    for (const merged of geometries) for (const geometry of merged.values()) geometry.dispose();
    for (const material of Object.values(materials)) material.dispose();
    floorGeometry.dispose();
    floorMaterial.dispose();
    renderer.dispose();
    canvas.remove();
  }
});
