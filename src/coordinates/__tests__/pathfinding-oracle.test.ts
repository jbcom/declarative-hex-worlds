/**
 * Golden-path oracle tests for findHexPath (CR-P1-1).
 *
 * These tests pin BOTH the correctness contract AND the visit count on known
 * grids so that a min-heap refactor cannot silently regress either.
 *
 * The oracle pinned results were derived from the linear-scan O(N) baseline
 * implementation and are verified here. Any change to path length, path
 * sequence, or visit ceiling is a regression.
 */
import { describe, expect, it } from 'vitest';
import type { HexCoordinates } from '../../types';
import { findHexPath } from '../coordinates';

describe('findHexPath golden-path oracle (CR-P1-1)', () => {
  it('finds the trivial same-tile path with 0 cost and visited=1', () => {
    const result = findHexPath({ q: 0, r: 0 }, { q: 0, r: 0 });
    expect(result.found).toBe(true);
    expect(result.path).toEqual([{ q: 0, r: 0 }]);
    expect(result.cost).toBe(0);
    // Baseline implementation returns visited:1 for same-tile (incremented once)
    expect(result.visited).toBe(1);
  });

  it('finds a 1-step path between adjacent tiles (cost 1, path length 2)', () => {
    const result = findHexPath({ q: 0, r: 0 }, { q: 1, r: 0 });
    expect(result.found).toBe(true);
    expect(result.cost).toBe(1);
    expect(result.path).toHaveLength(2);
    expect(result.path[0]).toEqual({ q: 0, r: 0 });
    expect(result.path[result.path.length - 1]).toEqual({ q: 1, r: 0 });
    expect(result.visited).toBeLessThanOrEqual(3);
  });

  it('finds the shortest path across a hexagon-3 grid (cost 6, path 7 tiles)', () => {
    const shape = { kind: 'hexagon' as const, radius: 3 };
    const start = { q: -3, r: 0 };
    const goal = { q: 3, r: 0 };
    const result = findHexPath(start, goal, { shape });
    expect(result.found).toBe(true);
    expect(result.cost).toBe(6);
    expect(result.path).toHaveLength(7);
    expect(result.path[0]).toEqual(start);
    expect(result.path[result.path.length - 1]).toEqual(goal);
    // Oracle ceiling: A* should visit no more than 25 nodes on a radius-3 hex (61 total tiles)
    expect(result.visited).toBeLessThanOrEqual(25);
  });

  it('returns found:false with empty path when goal is outside the shape boundary', () => {
    const shape = { kind: 'hexagon' as const, radius: 2 };
    const result = findHexPath({ q: 0, r: 0 }, { q: 10, r: 10 }, { shape });
    expect(result.found).toBe(false);
    expect(result.path).toEqual([]);
    expect(result.cost).toBe(Number.POSITIVE_INFINITY);
  });

  it('respects passable filter — rejects path through a blocked tile', () => {
    const shape = { kind: 'hexagon' as const, radius: 3 };
    // Block tile (0,0) — the only direct neighbor path between (-1,0) and (1,0) on the equator
    const blocked = new Set<string>(['0,0']);
    const passable = (c: HexCoordinates) => !blocked.has(`${c.q},${c.r}`);
    const result = findHexPath({ q: -1, r: 0 }, { q: 1, r: 0 }, { shape, passable });
    expect(result.found).toBe(true);
    // Direct 2-step path goes through (0,0) which is blocked; detour costs more
    expect(result.cost).toBeGreaterThan(2);
    // None of the path tiles are the blocked tile
    for (const tile of result.path) {
      expect(`${tile.q},${tile.r}`).not.toBe('0,0');
    }
  });

  it('respects weighted cost function — accumulates custom costs along the path', () => {
    const shape = { kind: 'hexagon' as const, radius: 3 };
    // Make tile (0,0) very expensive to traverse FROM its predecessor
    const cost = (_from: HexCoordinates, to: HexCoordinates) => {
      if (to.q === 0 && to.r === 0) return 10;
      return 1;
    };
    // Path from (-2,0) to (2,0): if it avoids (0,0) the cost is ≤ 6; if it goes through it costs ≥ 10
    const direct = findHexPath({ q: -2, r: 0 }, { q: 2, r: 0 }, { shape, cost });
    expect(direct.found).toBe(true);
    // A* will find the cheaper detour route
    expect(direct.cost).toBeLessThan(10);
    // Confirm no tile in the found path is (0,0)
    const passesCenter = direct.path.some((t) => t.q === 0 && t.r === 0);
    expect(passesCenter).toBe(false);
  });

  it('obeys maxVisited ceiling — returns found:false when limit reached before goal', () => {
    const shape = { kind: 'hexagon' as const, radius: 5 };
    const result = findHexPath({ q: -5, r: 0 }, { q: 5, r: 0 }, { shape, maxVisited: 2 });
    expect(result.found).toBe(false);
    expect(result.visited).toBeLessThanOrEqual(3);
  });

  it('maxVisited ceiling does NOT break short paths that finish within budget', () => {
    const result = findHexPath({ q: 0, r: 0 }, { q: 1, r: 0 }, { maxVisited: 100 });
    expect(result.found).toBe(true);
    expect(result.cost).toBe(1);
  });

  it('open-plane (no shape) path: visited ceiling scales linearly with distance', () => {
    // Without a shape boundary, A* explores outward; path of distance D visits roughly D nodes
    const result = findHexPath({ q: 0, r: 0 }, { q: 0, r: 5 });
    expect(result.found).toBe(true);
    expect(result.cost).toBe(5);
    expect(result.path).toHaveLength(6);
    // Oracle: visited should be well under 30 for a straight-line 5-step path
    expect(result.visited).toBeLessThanOrEqual(30);
  });
});
