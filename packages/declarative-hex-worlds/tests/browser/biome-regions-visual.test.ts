/** Isolated visual review of seeded biome regions, without assets or a renderer. @module */

import { expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { axialToWorld } from '../../src/coordinates/grid';
import { createGameboardBuilder } from '../../src/gameboard';
import { generateGameboardBiomeRegions } from '../../src/rules/biome-regions';

const COLORS: Record<string, string> = {
  pasture: '#819754',
  wheat: '#cba65a',
  corn: '#859444',
  woodland: '#405542',
  rock: '#8a8376',
  wetMeadow: '#5f8070',
  orchard: '#749051',
};
const GEOMETRY = { width: 14, depth: 28 / Math.sqrt(3), elevationStep: 1 };

function country(seed: string) {
  const builder = createGameboardBuilder({
    seed,
    shape: { kind: 'rectangle', width: 28, height: 24 },
  });
  for (const tile of builder.build().tiles) {
    const x = tile.coordinates.q + tile.coordinates.r / 2;
    const water = Math.abs(x - 10 - Math.sin(tile.coordinates.r / 5) * 2);
    builder.setFields(tile.coordinates, {
      water,
      wetness: Math.max(0, 1 - water / 4),
      slope: Math.max(0, (x - 17) / 30),
      rock: Math.max(0, (x - 21) / 8),
    });
  }
  builder.setBiome({ q: 5, r: 4 }, 'orchard').pinTile({ q: 5, r: 4 });
  return generateGameboardBiomeRegions(builder.build(), {
    seed: `${seed}:biomes`,
    fill: 'pasture',
    edgeNoise: 0.12,
    biomes: [
      {
        biome: 'wetMeadow',
        target: 0.08,
        sources: { count: 3, spacing: 5 },
        requires: [{ field: 'water', max: 2 }],
        suits: [{ field: 'wetness', from: 0, to: 1, weight: 2 }],
      },
      {
        biome: 'rock',
        target: 0.03,
        sources: { count: 2 },
        requires: [{ field: 'rock', min: 0.2 }],
        suits: [{ field: 'rock', from: 0, to: 1, weight: 2 }],
      },
      {
        biome: 'woodland',
        target: 0.2,
        sources: { count: 3, spacing: 7 },
        requires: [{ field: 'slope', min: 0.08 }],
        suits: [{ field: 'slope', from: 0, to: 0.4, weight: 2 }],
        minRegion: 4,
      },
      {
        biome: 'wheat',
        target: 0.22,
        sources: {
          tiles: [
            { q: 5, r: 4 },
            { q: 5, r: 16 },
          ],
        },
        requires: [
          { field: 'slope', max: 0.12 },
          { field: 'water', min: 2 },
        ],
        minRegion: 4,
      },
      {
        biome: 'corn',
        target: 0.14,
        sources: {
          tiles: [
            { q: 5, r: 4 },
            { q: 5, r: 16 },
          ],
        },
        requires: [
          { field: 'slope', max: 0.12 },
          { field: 'water', min: 2 },
        ],
        minRegion: 4,
      },
    ],
    affinity: [
      { a: 'wheat', b: 'wheat', weight: 0.4 },
      { a: 'corn', b: 'corn', weight: 0.4 },
      { a: 'woodland', b: 'woodland', weight: 0.3 },
      { a: 'wheat', b: 'corn', weight: 0.15 },
    ],
  });
}

it('captures farm-country region topology under two buried seeds', async () => {
  await page.viewport(1200, 500);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 500;
  document.body.append(canvas);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No canvas context');
  try {
    context.fillStyle = '#eee4c9';
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const [index, seed] of ['farm-one', 'farm-two'].entries()) {
      const result = country(seed);
      expect(result.report.biomes.wheat?.actual).toBeGreaterThan(50);
      context.fillStyle = '#302c27';
      context.font = '20px serif';
      context.fillText(seed, 30 + index * 600, 35);
      for (const tile of result.plan.tiles) {
        const position = axialToWorld(tile.coordinates, 0, GEOMETRY);
        const x = 36 + index * 600 + position.x;
        const y = 75 + position.z;
        context.beginPath();
        for (let corner = 0; corner < 6; corner += 1) {
          const angle = (corner * Math.PI) / 3 - Math.PI / 2;
          const px = x + (Math.cos(angle) * GEOMETRY.depth) / 2;
          const py = y + (Math.sin(angle) * GEOMETRY.depth) / 2;
          if (corner === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
        context.fillStyle = COLORS[tile.biome ?? 'pasture'] ?? '#000';
        context.fill();
        context.strokeStyle = '#eee4c933';
        context.stroke();
      }
    }
    let column = 0;
    for (const [biome, color] of Object.entries(COLORS)) {
      context.fillStyle = color;
      context.fillRect(30 + column * 165, 450, 20, 20);
      context.fillStyle = '#302c27';
      context.font = '16px serif';
      context.fillText(biome, 56 + column * 165, 467);
      column += 1;
    }
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/biome-regions-country.png',
    });
    expect(screenshot).toContain('biome-regions-country.png');
    // The pool collects the workspace's test-results directory, while the
    // package-local capture above remains the canonical release-ledger image.
    await page.screenshot({
      element: canvas,
      path: '../../../../test-results/biome-regions-country.png',
    });
  } finally {
    canvas.remove();
  }
});
