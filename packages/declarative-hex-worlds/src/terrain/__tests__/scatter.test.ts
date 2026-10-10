import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { scatterPoints } from '../scatter';

const bounds = { minX: 0, minZ: 0, maxX: 100, maxZ: 60 };

function minDistance(points: readonly { x: number; z: number }[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const a = points[i] as { x: number; z: number };
      const b = points[j] as { x: number; z: number };
      best = Math.min(best, Math.hypot(a.x - b.x, a.z - b.z));
    }
  }
  return best;
}

describe('scatterPoints', () => {
  it('fills the bounds with points no closer than the spacing', () => {
    const points = scatterPoints({ bounds, minSpacing: 5, seed: 'woods' });
    expect(points.length).toBeGreaterThan(100);
    expect(minDistance(points)).toBeGreaterThanOrEqual(5);
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(100);
      expect(p.z).toBeGreaterThanOrEqual(0);
      expect(p.z).toBeLessThan(60);
      expect(p.variant).toBeGreaterThanOrEqual(0);
      expect(p.variant).toBeLessThan(1);
    }
  });

  it('is deterministic per seed', () => {
    const a = scatterPoints({ bounds, minSpacing: 7, seed: 3 });
    expect(scatterPoints({ bounds, minSpacing: 7, seed: 3 })).toEqual(a);
    expect(scatterPoints({ bounds, minSpacing: 7, seed: 4 })).not.toEqual(a);
  });

  it('thins by density without reshuffling surviving variants', () => {
    const all = scatterPoints({ bounds, minSpacing: 5, seed: 'thin' });
    const west = scatterPoints({
      bounds,
      minSpacing: 5,
      seed: 'thin',
      density: (x) => (x < 50 ? 1 : 0),
    });
    expect(west.every((p) => p.x < 50)).toBe(true);
    expect(west).toEqual(all.filter((p) => p.x < 50));
  });

  it('honours the point cap and attempt count', () => {
    expect(scatterPoints({ bounds, minSpacing: 5, seed: 1, maxPoints: 10 })).toHaveLength(10);
    const sparse = scatterPoints({ bounds, minSpacing: 5, seed: 1, attempts: 1 });
    expect(sparse.length).toBeLessThan(scatterPoints({ bounds, minSpacing: 5, seed: 1 }).length);
  });

  it('rejects bad spacing and bounds', () => {
    expect(() => scatterPoints({ bounds, minSpacing: 0, seed: 1 })).toThrow(
      GameboardValidationError
    );
    expect(() => scatterPoints({ bounds: { ...bounds, maxX: 0 }, minSpacing: 1, seed: 1 })).toThrow(
      GameboardValidationError
    );
    expect(() =>
      scatterPoints({ bounds: { ...bounds, maxZ: -1 }, minSpacing: 1, seed: 1 })
    ).toThrow(GameboardValidationError);
  });
});
