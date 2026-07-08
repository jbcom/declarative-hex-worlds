/**
 * Coverage for src/coordinates/coordinates.ts gaps (PRD E0h).
 *
 * Covers hexRing radius branches, hexLine zero-distance shortcut, and
 * the few stmt-coverage lines uncovered by the existing layout/grid
 * tests.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import { createGameboardWorld, spawnGameboardPlacement } from '../../koota/index';
import {
  findHexPath,
  hexKey,
  hexLine,
  hexRing,
  minHeapCreate,
  minHeapPop,
  selectSpawnCoordinates,
  tryParseHexKey,
} from '../coordinates';
import { projectWorldToGameboardPlan } from '../projection';

describe('hexRing (PRD E0h)', () => {
  it('returns the center alone for radius 0', () => {
    const ring = hexRing({ q: 2, r: 3 }, 0);
    expect(ring).toEqual([{ q: 2, r: 3 }]);
  });

  it('returns a 6-tile ring at radius 1', () => {
    const ring = hexRing({ q: 0, r: 0 }, 1);
    expect(ring).toHaveLength(6);
    // every ring entry is distance 1 from center
    const keys = new Set(ring.map((c) => hexKey(c)));
    expect(keys.size).toBe(6);
  });

  it('clamps negative radius to 0 (returns center)', () => {
    const ring = hexRing({ q: 1, r: 1 }, -5);
    expect(ring).toEqual([{ q: 1, r: 1 }]);
  });

  it('floors fractional radius', () => {
    // radius 2.7 -> 2 (perimeter = 6*2 = 12 entries)
    const ring = hexRing({ q: 0, r: 0 }, 2.7);
    expect(ring).toHaveLength(12);
  });
});

describe('hexLine zero-distance branch (PRD E0h)', () => {
  it('returns a single coordinate when start and end are identical', () => {
    const line = hexLine({ q: 4, r: -2 }, { q: 4, r: -2 });
    expect(line).toEqual([{ q: 4, r: -2 }]);
  });
});

describe('projectWorldToGameboardPlan empty-world throw (PRD E0a)', () => {
  it('throws when the world has no GameboardState', async () => {
    const { createWorld } = await import('koota');
    const { projectWorldToGameboardPlan, readValidationGameboardPlanFromWorld } = await import(
      '../projection'
    );
    const empty = createWorld();
    expect(() => projectWorldToGameboardPlan(empty)).toThrow(
      /World does not contain GameboardState/
    );
    expect(() => readValidationGameboardPlanFromWorld(empty)).toThrow(
      /World does not contain GameboardState/
    );
  });

  it('rebuilds sloped road and crossing overlays from decomposed Koota tile state', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'projection-connectivity',
        shape: { kind: 'rectangle', width: 3, height: 2 },
      })
        .addRoadPath(
          [
            { q: 0, r: 0 },
            { q: 1, r: 0 },
            { q: 2, r: 0 },
          ],
          { slope: 'high' }
        )
        .addRiverPath(
          [
            { q: 0, r: 1 },
            { q: 1, r: 1 },
          ],
          { crossing: 'A', waterless: true }
        )
        .build()
    );
    spawnGameboardPlacement(world, {
      id: 'custom:b',
      at: { q: 0, r: 0 },
      assetId: 'crate_A_small',
      kind: 'prop',
      order: 200_000,
    });
    spawnGameboardPlacement(world, {
      id: 'custom:a',
      at: { q: 0, r: 0 },
      assetId: 'barrel',
      kind: 'prop',
      order: 200_000,
    });

    const projected = projectWorldToGameboardPlan(world);
    const road = projected.placements.find((placement) => placement.id === 'road:1,0');
    const river = projected.placements.find((placement) => placement.id === 'river:0,1');

    expect(road).toMatchObject({
      assetId: 'hex_road_A_sloped_high',
      kind: 'road',
      metadata: { slope: 'high' },
    });
    expect(river).toMatchObject({
      assetId: 'hex_river_crossing_A_waterless',
      kind: 'river',
      metadata: { edgeMask: expect.any(Number) },
    });
    expect(
      projected.placements
        .filter((placement) => placement.id.startsWith('custom:'))
        .map((placement) => placement.id)
    ).toEqual(['custom:a', 'custom:b']);
  });

  it('places tiles using a supplied geometry override (custom row spacing)', () => {
    const world = createGameboardWorld(
      createGameboardBuilder({
        seed: 'projection-geometry-override',
        shape: { kind: 'rectangle', width: 1, height: 2 },
      }).build()
    );

    // A geometry whose depth (and thus rowSpacing = 1.5·depth/2) differs from the
    // default: the r=1 row's world Z must scale to the override, not the default.
    const geometry = { width: 2, depth: 20, elevationStep: 1 };
    const projected = projectWorldToGameboardPlan(world, { geometry });
    const defaultProjected = projectWorldToGameboardPlan(world);

    const terrainAt = (plan: typeof projected, r: number) =>
      plan.placements.find(
        (placement) => placement.layer === 'terrain' && placement.coordinates.r === r
      );

    const overrideRow1 = terrainAt(projected, 1);
    const defaultRow1 = terrainAt(defaultProjected, 1);
    expect(overrideRow1).toBeDefined();
    expect(defaultRow1).toBeDefined();

    // rowSpacing = 1.5·(depth/2): override 15 vs default 1.5·(2.3094/2) ≈ 1.732.
    expect(overrideRow1?.position.z).toBeCloseTo(1.5 * (20 / 2));
    // The override moved the row: its Z is not the default row spacing.
    expect(overrideRow1?.position.z).not.toBeCloseTo(defaultRow1?.position.z ?? 0);
  });
});

describe('findHexPath maxVisited limit (PRD E0a)', () => {
  it('breaks out of search when visited count exceeds maxVisited', () => {
    // Path far enough that A* visits >1 tile; maxVisited=1 trips early-exit.
    const result = findHexPath({ q: 0, r: 0 }, { q: 5, r: 5 }, { maxVisited: 1 });
    expect(result.found).toBe(false);
  });
});

describe('selectSpawnCoordinates predicate filtering (PRD E0a)', () => {
  it('rejects candidates through a supplied passable predicate', () => {
    const selected = selectSpawnCoordinates({
      shape: { kind: 'rectangle', width: 3, height: 1 },
      count: 2,
      seed: 'passable-filter',
      passable: (coordinates) => coordinates.q !== 1,
    });

    expect(selected).toHaveLength(2);
    expect(selected.map(hexKey)).not.toContain('1,0');
  });
});

describe('minHeapPop exported boundary cases (PRD E0a)', () => {
  it('returns undefined for empty or sparse heaps', () => {
    const empty = minHeapCreate<number>((left, right) => left - right);
    expect(minHeapPop(empty)).toBeUndefined();

    const sparse = minHeapCreate<number>((left, right) => left - right);
    sparse.length = 1;
    expect(minHeapPop(sparse)).toBeUndefined();
  });
});

describe('tryParseHexKey defensive branches (PRD E0a)', () => {
  it('returns undefined for malformed (non-2-part) keys', () => {
    expect(tryParseHexKey('only-one')).toBeUndefined();
    expect(tryParseHexKey('1,2,3')).toBeUndefined();
  });

  it('returns undefined when a part is not a finite number', () => {
    expect(tryParseHexKey('not-a-number,2')).toBeUndefined();
    expect(tryParseHexKey('1,Infinity')).toBeUndefined();
  });
});
