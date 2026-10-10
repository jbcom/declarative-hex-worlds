import { describe, expect, it } from 'vitest';
import { axialToWorld, DEFAULT_HEX_GEOMETRY, type HexGeometry } from '../../coordinates/grid';
import { classifyBiomes } from '../biomes';
import { composeHeightField } from '../compose';
import { hexesCoveringBounds, projectTerrainToHexes } from '../hexes';

/** 100 m hexes, pointy-top, as a battlefield game would use. */
const geometry: HexGeometry = { width: 100, depth: 200 / Math.sqrt(3), elevationStep: 1 };
const bounds = { minX: -500, minZ: -500, maxX: 500, maxZ: 500 };
const terrain = composeHeightField({
  bounds,
  spacing: 20,
  seed: 'hexes',
  base: 100,
  layers: [{ kind: 'hill', center: { x: 0, z: 0 }, radius: 300, height: 60 }],
});

describe('hexesCoveringBounds', () => {
  it('returns every hex whose centre is inside, in row order', () => {
    const hexes = hexesCoveringBounds({ minX: -100, minZ: -100, maxX: 100, maxZ: 100 }, geometry);
    for (const hex of hexes) {
      const p = axialToWorld(hex, 0, geometry);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(100);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(100);
    }
    expect(hexes).toContainEqual({ q: 0, r: 0 });
    const rows = hexes.map((h) => h.r);
    expect([...rows].sort((a, b) => a - b)).toEqual(rows);
  });

  it('defaults to the package geometry', () => {
    const hexes = hexesCoveringBounds({ minX: 0, minZ: 0, maxX: 4, maxZ: 4 });
    for (const hex of hexes) {
      const p = axialToWorld(hex, 0, DEFAULT_HEX_GEOMETRY);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.z).toBeLessThanOrEqual(4);
    }
    expect(hexes.length).toBeGreaterThan(0);
  });

  it('grows or shrinks the covered area by a margin', () => {
    const box = { minX: -300, minZ: -300, maxX: 300, maxZ: 300 };
    const plain = hexesCoveringBounds(box, geometry);
    expect(hexesCoveringBounds(box, geometry, 100).length).toBeGreaterThan(plain.length);
    expect(hexesCoveringBounds(box, geometry, -100).length).toBeLessThan(plain.length);
  });
});

describe('projectTerrainToHexes', () => {
  it('samples out to the rim, catching a crest along a hex edge', () => {
    const edge = axialToWorld({ q: 0, r: 0 }, 0, geometry).x + geometry.width / 2;
    const ridged = composeHeightField({
      bounds,
      // Fine enough to represent a 40 m-wide crest.
      spacing: 5,
      seed: 'rim',
      layers: [
        {
          kind: 'ridge',
          line: [
            { x: edge, z: -500 },
            { x: edge, z: 500 },
          ],
          halfWidth: 20,
          height: 10,
        },
      ],
    });
    const [hex] = projectTerrainToHexes({
      terrain: ridged,
      coordinates: [{ q: 0, r: 0 }],
      geometry,
    });
    // The old pattern stopped at two-thirds of the radius and saw none of it.
    expect(hex?.maxHeight).toBeGreaterThan(8);
  });

  it('summarises height and slope under each hex', () => {
    const [peak, flank] = projectTerrainToHexes({
      terrain,
      coordinates: [
        { q: 0, r: 0 },
        { q: 2, r: 0 },
      ],
      geometry,
    });
    expect(peak?.key).toBe('0,0');
    expect(peak?.center).toEqual({ x: 0, z: 0 });
    expect(peak?.maxHeight).toBeCloseTo(160, 0);
    expect(peak?.minHeight).toBeLessThan(peak?.maxHeight as number);
    expect(peak?.meanHeight).toBeGreaterThan(flank?.meanHeight as number);
    expect(flank?.meanSlope).toBeGreaterThan(peak?.meanSlope as number);
    expect(peak?.biomeShares).toBeUndefined();
  });

  it('reports biome shares and the dominant biome', () => {
    const biomes = classifyBiomes({
      terrain,
      seed: 1,
      biomes: ['pasture', 'summit', 'unused'],
      base: 'pasture',
      paints: [{ biome: 'summit', where: [{ kind: 'height', min: 150 }] }],
    });
    const [peak, edge] = projectTerrainToHexes({
      terrain,
      biomes,
      coordinates: [
        { q: 0, r: 0 },
        { q: 4, r: 0 },
      ],
      geometry,
    });
    expect(peak?.dominantBiome).toBe('summit');
    expect(edge?.dominantBiome).toBe('pasture');
    const total = Object.values(peak?.biomeShares ?? {}).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 5);
    expect(peak?.biomeShares?.unused).toBe(0);
  });

  it('uses the default geometry when none is given', () => {
    const [hex] = projectTerrainToHexes({ terrain, coordinates: [{ q: 0, r: 0 }] });
    expect(hex?.meanHeight).toBeCloseTo(160, 0);
  });
});
