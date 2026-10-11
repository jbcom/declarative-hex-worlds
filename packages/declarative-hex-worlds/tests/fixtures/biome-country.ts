/** Shared seeded country for isolated biome generation and projection captures. @module */
import { createGameboardBuilder } from '../../src/gameboard';
import { generateGameboardBiomeRegions } from '../../src/rules/biome-regions';
export function createBiomeCountry(seed: string) {
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
