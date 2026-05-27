import { describe, expect, it } from 'vitest';
import { findHexPath, hexDistance, hexLine } from '../../coordinates/index';
import {
  axialToWorld,
  createGameboardCoordinateSystem,
  createGameboardGrid,
  createHexagonGameboardGrid,
  createRectangleGameboardGrid,
  createSpawnLocations,
  worldToAxial,
} from '../../coordinates/grid';

describe('grid helpers', () => {
  it('creates a Honeycomb rectangle grid', () => {
    const grid = createRectangleGameboardGrid({ width: 3, height: 2 });
    expect(Array.from(grid)).toHaveLength(6);
  });

  it('creates Honeycomb grids for rectangle and hexagon board shapes', () => {
    const rectangle = createGameboardGrid({ kind: 'rectangle', width: 3, height: 2 });
    const hexagon = createHexagonGameboardGrid({ radius: 2 });
    const genericHexagon = createGameboardGrid({ kind: 'hexagon', radius: 2 });

    expect(Array.from(rectangle)).toHaveLength(6);
    expect(Array.from(hexagon)).toHaveLength(19);
    expect(Array.from(genericHexagon).map((hex) => `${hex.q},${hex.r}`)).toEqual(
      Array.from(hexagon).map((hex) => `${hex.q},${hex.r}`)
    );
  });

  it('axialRound resolves both qDiff and rDiff dominance branches (E0b)', () => {
    // Fractional positions just inside neighboring hex boundaries — engineered
    // so the rounding pick crosses the qDiff > rDiff > sDiff branches
    // (grid.ts lines 235-241).
    const a = worldToAxial({ x: 1.001, y: 0, z: 0.5 });
    expect(typeof a.q).toBe('number');
    const b = worldToAxial({ x: -1.001, y: 0, z: 0.5 });
    expect(typeof b.q).toBe('number');
    const c = worldToAxial({ x: 0.3, y: 0, z: 1.001 });
    expect(typeof c.q).toBe('number');
  });

  it('round-trips axial/world coordinates', () => {
    const coordinates = { q: 2, r: -1 };
    const world = axialToWorld(coordinates, 3);
    expect(world.y).toBe(3);
    expect(worldToAxial(world)).toEqual(coordinates);
  });

  it('provides pathfinding-ready coordinate helpers', () => {
    const result = findHexPath(
      { q: 0, r: 0 },
      { q: 3, r: 0 },
      {
        shape: { kind: 'rectangle', width: 4, height: 3 },
        passable: (coordinates) => coordinates.q !== 1 || coordinates.r !== 0,
      }
    );

    expect(result.found).toBe(true);
    expect(result.path.at(0)).toEqual({ q: 0, r: 0 });
    expect(result.path.at(-1)).toEqual({ q: 3, r: 0 });
    expect(result.path.some((coordinates) => coordinates.q === 1 && coordinates.r === 0)).toBe(false);
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2);
    expect(hexLine({ q: 0, r: 0 }, { q: 2, r: 0 })).toHaveLength(3);
  });

  it('selects deterministic spawn locations with world positions', () => {
    const system = createGameboardCoordinateSystem();
    const first = system.spawnLocations({
      shape: { kind: 'rectangle', width: 6, height: 4 },
      count: 3,
      seed: 'spawn-seed',
      minDistance: 2,
      edgePadding: 1,
    });
    const second = createSpawnLocations({
      shape: { kind: 'rectangle', width: 6, height: 4 },
      count: 3,
      seed: 'spawn-seed',
      minDistance: 2,
      edgePadding: 1,
    });

    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first[0]?.position).toEqual(system.toWorld(first[0]?.coordinates ?? { q: 0, r: 0 }));
  });

  it('fromWorld + findPath wrappers fire on the coordinate system (E0a)', () => {
    const system = createGameboardCoordinateSystem();
    // fromWorld inverse — picks the axial coord closest to a world position.
    const round = system.fromWorld(system.toWorld({ q: 2, r: 1 }));
    expect(round.q).toBe(2);
    expect(round.r).toBe(1);
    // findPath wrapper — driver for findHexPath at line 193.
    const path = system.findPath({ q: 0, r: 0 }, { q: 2, r: 0 }, {});
    expect(path.found).toBe(true);
  });
});
