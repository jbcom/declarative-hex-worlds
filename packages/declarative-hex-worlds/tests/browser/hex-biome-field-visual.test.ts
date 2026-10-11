/** Compare hard and seamless render weights derived from the same tile biomes. @module */
import { expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { projectHexBiomesToField } from '../../src/terrain/hex-biome-field';
import { createBiomeCountry } from '../fixtures/biome-country';

const COLORS = ['#819754', '#cba65a', '#859444', '#405542', '#8a8376', '#5f8070', '#749051'];
const BIOMES = ['pasture', 'wheat', 'corn', 'woodland', 'rock', 'wetMeadow', 'orchard'];
const geometry = { width: 14, depth: 28 / Math.sqrt(3), elevationStep: 1 };
const grid = {
  width: 550,
  height: 300,
  bounds: {
    minX: -7,
    maxX: 546,
    minZ: -geometry.depth / 2,
    maxZ: 23 * geometry.depth * 0.75 + geometry.depth / 2,
  },
};

it('captures hard and softened material boundaries without reclassifying the country', async () => {
  await page.viewport(1200, 480);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 480;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No canvas context');
  document.body.append(canvas);
  try {
    context.fillStyle = '#eee4c9';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const tiles = createBiomeCountry('farm-one').plan.tiles;
    const palette = COLORS.map((color) => {
      const value = Number.parseInt(color.slice(1), 16);
      return [value >> 16, (value >> 8) & 255, value & 255];
    });
    for (const [panel, feather] of [0, 1.7].entries()) {
      const field = projectHexBiomesToField({
        tiles,
        grid,
        biomes: BIOMES,
        base: 'pasture',
        geometry,
        feather,
      });
      const image = new ImageData(field.width, field.height);
      let largestNormalizationError = 0;
      for (let pixel = 0; pixel < field.width * field.height; pixel += 1) {
        const channels = [0, 0, 0];
        let sum = 0;
        for (let biome = 0; biome < field.biomes.length; biome += 1) {
          const weight = field.weights[pixel * field.biomes.length + biome] as number;
          sum += weight;
          for (let channel = 0; channel < 3; channel += 1) {
            channels[channel] =
              (channels[channel] as number) + weight * (palette[biome]?.[channel] as number);
          }
        }
        largestNormalizationError = Math.max(largestNormalizationError, Math.abs(sum - 1));
        image.data.set([...channels, 255], pixel * 4);
      }
      expect(largestNormalizationError).toBeLessThan(0.00001);
      const bitmap = document.createElement('canvas');
      bitmap.width = field.width;
      bitmap.height = field.height;
      const bitmapContext = bitmap.getContext('2d');
      if (!bitmapContext) throw new Error('No bitmap context');
      bitmapContext.putImageData(image, 0, 0);
      context.drawImage(bitmap, 20 + panel * 600, 70);
      context.fillStyle = '#302c27';
      context.font = '20px serif';
      context.fillText(
        feather === 0 ? 'Hard boundaries' : 'Softened boundaries',
        20 + panel * 600,
        35
      );
    }
    const path = await page.screenshot({
      element: canvas,
      path: '__screenshots__/hex-biome-field.png',
    });
    expect(path).toContain('hex-biome-field.png');
    await page.screenshot({
      element: canvas,
      path: '../../../../test-results/hex-biome-field.png',
    });
  } finally {
    canvas.remove();
  }
});
