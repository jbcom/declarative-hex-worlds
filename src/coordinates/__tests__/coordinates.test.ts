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
import { hexLine, hexRing, hexKey, tryParseHexKey } from '../coordinates';

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
