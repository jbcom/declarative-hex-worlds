/**
 * Visual review of the `./terrain` tier. Each capability is rendered in
 * isolation and captured, so a human (or agent) can look at relief, biome
 * edges, scatter spacing, hex summaries and the lit 3D surface — numbers
 * alone cannot say whether terrain reads as natural.
 */
import {
  BufferAttribute,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { axialToWorld, type HexGeometry } from '../../src/coordinates/grid';
import {
  type BiomeField,
  carveDrainage,
  classifyBiomes,
  composeHeightField,
  type Drainage,
  generateParcels,
  type HeightField,
  heightFieldRange,
  hexesCoveringBounds,
  parcelBoundaries,
  projectTerrainToHexes,
  sampleBiomeWeights,
  sampleHeight,
  sampleNormal,
  scatterPoints,
  traceDrainage,
} from '../../src/terrain/index';

const SIZE = 640;
const bounds = { minX: -1600, minZ: -1600, maxX: 1600, maxZ: 1600 };
const geometry: HexGeometry = { width: 100, depth: 200 / Math.sqrt(3), elevationStep: 1 };

/** A compact rolling-farmland board: two ridges, a rocky knob, a creek, a village. */
const terrain = composeHeightField({
  bounds,
  spacing: 20,
  seed: 'visual',
  base: 150,
  layers: [
    { kind: 'noise', amplitude: 10, wavelength: 1400, octaves: 5 },
    {
      kind: 'ridge',
      line: [
        { x: -1100, z: -1500 },
        { x: -900, z: 0 },
        { x: -1000, z: 1500 },
      ],
      halfWidth: 450,
      height: 22,
    },
    {
      kind: 'ridge',
      line: [
        { x: 300, z: -1300 },
        { x: 400, z: 300 },
        { x: 200, z: 900 },
      ],
      halfWidth: 380,
      height: 18,
    },
    { kind: 'hill', center: { x: 350, z: 1150 }, radius: 420, height: 70, profile: 'sharp' },
    { kind: 'noise', amplitude: 1.5, wavelength: 180, octaves: 3, seed: 'swales' },
    {
      kind: 'channel',
      line: [
        { x: -400, z: -1600 },
        { x: -300, z: -400 },
        { x: -500, z: 600 },
        { x: -250, z: 1600 },
      ],
      halfWidth: 90,
      depth: 6,
    },
    {
      kind: 'flatten',
      polygon: [
        { x: -350, z: -1450 },
        { x: 100, z: -1450 },
        { x: 100, z: -1050 },
        { x: -350, z: -1050 },
      ],
      feather: 160,
      strength: 0.85,
    },
  ],
});

const BIOMES = ['pasture', 'wheat', 'woods', 'rock', 'creek', 'road', 'town'] as const;
const BIOME_COLOURS: Record<(typeof BIOMES)[number], readonly [number, number, number]> = {
  pasture: [118, 142, 74],
  wheat: [205, 175, 98],
  woods: [52, 84, 46],
  rock: [138, 134, 122],
  creek: [86, 112, 120],
  road: [176, 152, 118],
  town: [150, 92, 74],
};
const road = [
  { x: -1600, z: 600 },
  { x: -200, z: -200 },
  { x: 900, z: -800 },
  { x: 1600, z: -900 },
];

const biomes = classifyBiomes({
  terrain,
  seed: 'visual',
  biomes: BIOMES,
  base: 'pasture',
  paints: [
    {
      biome: 'wheat',
      where: [{ kind: 'noise', wavelength: 700, threshold: 0.15, feather: 0.12 }],
      warp: { amplitude: 60, wavelength: 300 },
    },
    {
      biome: 'woods',
      where: [{ kind: 'noise', wavelength: 900, threshold: 0.25, feather: 0.1, seed: 'woods' }],
      warp: { amplitude: 80, wavelength: 250 },
    },
    {
      biome: 'woods',
      where: [
        {
          kind: 'area',
          polygon: [
            { x: 600, z: -200 },
            { x: 1200, z: -100 },
            { x: 1150, z: 500 },
            { x: 650, z: 450 },
          ],
          feather: 120,
        },
      ],
      warp: { amplitude: 90, wavelength: 220 },
    },
    { biome: 'rock', where: [{ kind: 'slope', min: 0.22, feather: 0.06 }] },
    {
      biome: 'creek',
      where: [
        {
          kind: 'line',
          line: [
            { x: -400, z: -1600 },
            { x: -300, z: -400 },
            { x: -500, z: 600 },
            { x: -250, z: 1600 },
          ],
          halfWidth: 22,
          feather: 16,
        },
      ],
      warp: { amplitude: 12, wavelength: 140 },
    },
    { biome: 'road', where: [{ kind: 'line', line: road, halfWidth: 9, feather: 6 }] },
    {
      biome: 'town',
      where: [
        {
          kind: 'area',
          polygon: [
            { x: -300, z: -1400 },
            { x: 50, z: -1400 },
            { x: 50, z: -1100 },
            { x: -300, z: -1100 },
          ],
          feather: 60,
        },
      ],
      warp: { amplitude: 30, wavelength: 160 },
    },
  ],
});

function makeCanvas(width = SIZE, height = SIZE): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.display = 'block';
  document.body.replaceChildren(canvas);
  return canvas;
}

const toWorld = (px: number, py: number) => ({
  x: bounds.minX + (px / (SIZE - 1)) * (bounds.maxX - bounds.minX),
  z: bounds.minZ + (py / (SIZE - 1)) * (bounds.maxZ - bounds.minZ),
});
const toPixel = (x: number, z: number) => ({
  px: ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (SIZE - 1),
  py: ((z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * (SIZE - 1),
});

/** Lambertian hillshade with the light from the north-west, as on survey maps. */
function shade(field: HeightField, x: number, z: number): number {
  const n = sampleNormal(field, x, z);
  const light = { x: -0.5, y: 0.7, z: -0.5 };
  const len = Math.hypot(light.x, light.y, light.z);
  return Math.max(0, (n.x * light.x + n.y * light.y + n.z * light.z) / len);
}

function biomeRgb(field: BiomeField, x: number, z: number): [number, number, number] {
  const weights = sampleBiomeWeights(field, x, z);
  const rgb: [number, number, number] = [0, 0, 0];
  BIOMES.forEach((id, k) => {
    const w = weights[k] as number;
    const c = BIOME_COLOURS[id];
    rgb[0] += c[0] * w;
    rgb[1] += c[1] * w;
    rgb[2] += c[2] * w;
  });
  return rgb;
}

function paint(
  canvas: HTMLCanvasElement,
  pixel: (x: number, z: number) => [number, number, number]
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  const image = ctx.createImageData(SIZE, SIZE);
  for (let py = 0; py < SIZE; py += 1) {
    for (let px = 0; px < SIZE; px += 1) {
      const { x, z } = toWorld(px, py);
      const [r, g, b] = pixel(x, z);
      const i = (py * SIZE + px) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** Contributing area at which the review terrain's streams begin (200 samples). */
const DRAINAGE_AREA = 80_000;

/**
 * Muted hypsometric tint with hillshade and 5-unit contours, as a map base.
 * With a drainage result, ponds — where depression filling raised the
 * surface more than 0.3 units — are tinted as standing water.
 */
function paintRelief(canvas: HTMLCanvasElement, field: HeightField, drainage?: Drainage): void {
  const { min, max } = heightFieldRange(field);
  const filled = drainage ? { ...terrain, heights: drainage.filled } : null;
  paint(canvas, (x, z) => {
    const h = sampleHeight(field, x, z);
    const t = (h - min) / (max - min);
    const s = 0.45 + 0.6 * shade(field, x, z);
    const contour = Math.abs(((h - min) % 5) - 2.5) > 2.3 ? 0.85 : 1;
    const k = s * contour;
    if (filled && sampleHeight(filled, x, z) - sampleHeight(terrain, x, z) > 0.3) {
      return [104 * s, 140 * s, 168 * s];
    }
    return [(150 + 70 * t) * k, (160 + 50 * t) * k, (120 + 50 * t) * k];
  });
}

function strokeLine(
  ctx: CanvasRenderingContext2D,
  line: readonly { readonly x: number; readonly z: number }[],
  colour: string,
  width: number
): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.beginPath();
  line.forEach((point, i) => {
    const { px, py } = toPixel(point.x, point.z);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

async function capture(canvas: HTMLCanvasElement, name: string): Promise<void> {
  await page.viewport(canvas.width + 20, canvas.height + 20);
  const path = await page.screenshot({ element: canvas, path: `__screenshots__/${name}.png` });
  expect(path).toContain(`${name}.png`);
}

describe('terrain visual review', () => {
  it('renders relief as hypsometric tint, hillshade and contours', async () => {
    const canvas = makeCanvas();
    const { min, max } = heightFieldRange(terrain);
    paint(canvas, (x, z) => {
      const h = sampleHeight(terrain, x, z);
      const t = (h - min) / (max - min);
      const s = 0.35 + 0.75 * shade(terrain, x, z);
      const contour = Math.abs(((h - min) % 5) - 2.5) > 2.3 ? 0.78 : 1;
      const k = s * contour;
      return [(96 + 120 * t) * k, (128 + 70 * t) * k, (80 + 60 * t) * k];
    });
    await capture(canvas, 'terrain-relief');
  });

  it('renders painted biomes over the hillshade', async () => {
    const canvas = makeCanvas();
    paint(canvas, (x, z) => {
      const s = 0.45 + 0.65 * shade(terrain, x, z);
      const [r, g, b] = biomeRgb(biomes, x, z);
      return [r * s, g * s, b * s];
    });
    await capture(canvas, 'terrain-biomes');
  });

  it('renders biome-driven blue-noise scatter', async () => {
    const canvas = makeCanvas();
    paint(canvas, (x, z) => {
      const s = 0.5 + 0.6 * shade(terrain, x, z);
      const [r, g, b] = biomeRgb(biomes, x, z);
      return [r * s, g * s, b * s];
    });
    const woods = BIOMES.indexOf('woods');
    const trees = scatterPoints({
      bounds,
      minSpacing: 18,
      seed: 'trees',
      density: (x, z) => {
        const w = sampleBiomeWeights(biomes, x, z)[woods] as number;
        return w * w;
      },
    });
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    for (const tree of trees) {
      const { px, py } = toPixel(tree.x, tree.z);
      ctx.fillStyle = `rgb(${28 + tree.variant * 20}, ${54 + tree.variant * 30}, 30)`;
      ctx.beginPath();
      ctx.arc(px, py, 1.6 + tree.variant * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    expect(trees.length).toBeGreaterThan(500);
    await capture(canvas, 'terrain-scatter');
  });

  it('renders per-hex summaries over the terrain', async () => {
    const canvas = makeCanvas();
    paint(canvas, (x, z) => {
      const s = 0.5 + 0.6 * shade(terrain, x, z);
      const [r, g, b] = biomeRgb(biomes, x, z);
      return [r * s, g * s, b * s];
    });
    const hexes = projectTerrainToHexes({
      terrain,
      biomes,
      geometry,
      coordinates: hexesCoveringBounds({ minX: -800, minZ: -800, maxX: 800, maxZ: 800 }, geometry),
    });
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    const radius = (geometry.depth / 2 / (bounds.maxX - bounds.minX)) * SIZE;
    for (const hex of hexes) {
      const centre = axialToWorld(hex.coordinates, 0, geometry);
      const { px, py } = toPixel(centre.x, centre.z);
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i - Math.PI / 2;
        const vx = px + radius * Math.cos(angle);
        const vy = py + radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      }
      ctx.closePath();
      const [r, g, b] = BIOME_COLOURS[hex.dominantBiome as (typeof BIOMES)[number]];
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.45)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(20, 16, 10, ${0.25 + Math.min(0.6, hex.meanSlope * 3)})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    expect(hexes.length).toBeGreaterThan(200);
    await capture(canvas, 'terrain-hexes');
  });

  it('renders field parcels with their fence network', async () => {
    const canvas = makeCanvas();
    const parcels = generateParcels({
      area: bounds,
      seed: 'farms',
      meanArea: 90_000,
      sizeVariation: 0.6,
      skew: 0.3,
    });
    const crops: readonly (readonly [number, number, number])[] = [
      [205, 175, 98], // wheat
      [176, 160, 74], // oats
      [126, 150, 70], // corn
      [118, 142, 74], // pasture
      [104, 128, 66], // meadow
      [52, 84, 46], // woodlot
    ];
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    for (const parcel of parcels) {
      const [r, g, b] = crops[Math.floor(parcel.variant * crops.length)] as readonly [
        number,
        number,
        number,
      ];
      ctx.beginPath();
      parcel.polygon.forEach((corner, i) => {
        const { px, py } = toPixel(corner.x, corner.z);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fill();
    }
    const net = parcelBoundaries(parcels, 0.01);
    ctx.strokeStyle = 'rgba(70, 52, 34, 0.9)';
    ctx.lineWidth = 1.2;
    for (const [a, b] of net.edges) {
      const p = net.vertices[a];
      const q = net.vertices[b];
      if (!p || !q) continue;
      const from = toPixel(p.x, p.z);
      const to = toPixel(q.x, q.z);
      ctx.beginPath();
      ctx.moveTo(from.px, from.py);
      ctx.lineTo(to.px, to.py);
      ctx.stroke();
    }
    expect(parcels.length).toBeGreaterThan(60);
    await capture(canvas, 'terrain-parcels');
  });

  it('renders traced drainage over carved relief, wider by Strahler order', async () => {
    const canvas = makeCanvas();
    const drainage = traceDrainage(terrain, { minContributingArea: DRAINAGE_AREA });
    const carved = carveDrainage(terrain, drainage.channels, {
      depthFor: (area) => Math.min(4, 0.6 + Math.sqrt(area) / 400),
      halfWidthFor: (_area, order) => 16 + 10 * order,
    });
    paintRelief(canvas, carved, drainage);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Smallest first so main stems draw over the tributaries joining them.
    const ordered = [...drainage.channels].sort((a, b) => a.order - b.order);
    for (const channel of ordered) {
      strokeLine(ctx, channel.points, 'rgb(46, 92, 150)', 0.6 + 0.9 * channel.order);
    }
    expect(Math.max(...drainage.channels.map((c) => c.order))).toBeGreaterThanOrEqual(3);
    await capture(canvas, 'terrain-drainage');
  });

  it('renders the composed surface lit in perspective', async () => {
    const canvas = makeCanvas(960, 540);
    const renderer = new WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(960, 540, false);
    const scene = new Scene();
    scene.background = new Color(0xb9c9d6);
    const segments = 320;
    const plane = new PlaneGeometry(
      bounds.maxX - bounds.minX,
      bounds.maxZ - bounds.minZ,
      segments,
      segments
    );
    plane.rotateX(-Math.PI / 2);
    const positions = plane.getAttribute('position');
    const colours = new Float32Array(positions.count * 3);
    const { min } = heightFieldRange(terrain);
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      positions.setY(i, (sampleHeight(terrain, x, z) - min) * 2);
      const [r, g, b] = biomeRgb(biomes, x, z);
      colours.set([r / 255, g / 255, b / 255], i * 3);
    }
    plane.setAttribute('color', new BufferAttribute(colours, 3));
    plane.computeVertexNormals();
    scene.add(new Mesh(plane, new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
    const sun = new DirectionalLight(0xfff1d6, 2.6);
    sun.position.set(-1200, 900, -600);
    scene.add(sun, new HemisphereLight(0xcfe0f0, 0x4a3e2c, 0.9));
    const camera = new PerspectiveCamera(36, 960 / 540, 10, 20000);
    camera.position.set(0, 1500, 2600);
    camera.lookAt(0, 0, -200);
    renderer.render(scene, camera);
    await capture(canvas, 'terrain-perspective');
    renderer.dispose();
  });
});
