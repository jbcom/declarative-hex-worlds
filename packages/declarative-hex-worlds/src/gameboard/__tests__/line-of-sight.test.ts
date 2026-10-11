import { describe, expect, it } from 'vitest';
import { hexLine } from '../../coordinates';
import { GameboardRuntimeError } from '../../errors';
import { createGameboardBuilder } from '../index';
import { traceGameboardSight, type GameboardSightProfile } from '../navigation';

const start = { q: 0, r: 0 };
const end = { q: 4, r: 0 };
const profile: GameboardSightProfile = {
  maxRangeHexes: 6,
  eyeHeight: 2,
  targetHeight: 2,
  groundHeight: (tile) => tile.elevation,
};
const board = () =>
  createGameboardBuilder({
    seed: 'sight',
    shape: { kind: 'rectangle', width: 5, height: 3 },
  }).build();

describe('authored terrain sight', () => {
  it('reads a clear flat trace and detaches its coordinates', () => {
    const plan = board();
    const result = traceGameboardSight(plan, start, end, profile);
    expect(result).toEqual({ visible: true, reason: 'clear', line: hexLine(start, end) });
    expect(result.line[0]).not.toBe(start);
    expect(result.line[4]).not.toBe(end);
    expect(result.line[0]).not.toBe(plan.tiles[0]?.coordinates);
  });

  it('blocks at the first ridge, including grazing, and lets an elevated observer see over it', () => {
    const plan = board();
    const ridge = plan.tiles.find((tile) => tile.key === '2,0');
    if (!ridge) throw new Error('ridge');
    ridge.elevation = 2;
    expect(traceGameboardSight(plan, start, end, profile)).toMatchObject({
      visible: false,
      reason: 'occluded',
      blocker: { q: 2, r: 0 },
    });
    expect(traceGameboardSight(plan, start, end, { ...profile, eyeHeight: 6 }).visible).toBe(true);
    ridge.elevation = 1;
    expect(traceGameboardSight(plan, start, end, profile).visible).toBe(true);
    ridge.elevation = 3;
    const observer = plan.tiles.find((tile) => tile.key === '0,0');
    if (!observer) throw new Error('observer');
    observer.elevation = 6;
    expect(traceGameboardSight(plan, start, end, profile).visible).toBe(true);
    expect(traceGameboardSight(plan, end, start, profile).visible).toBe(true);
  });

  it('keeps below-sea-level ground distinct from nonnegative heights above ground', () => {
    const plan = board();
    for (const tile of plan.tiles) tile.elevation = -10;
    expect(traceGameboardSight(plan, start, end, profile).visible).toBe(true);
  });

  it('reads authored ground fields and opaque cover while excluding endpoint obstruction', () => {
    const plan = board();
    const groundHeight = (tile: (typeof plan.tiles)[number]) => (tile.key === '2,0' ? 1 : 0);
    const obstructionHeight = (tile: (typeof plan.tiles)[number]) => (tile.key === '2,0' ? 1 : 100);
    expect(
      traceGameboardSight(plan, start, end, {
        ...profile,
        groundHeight,
        obstructionHeight: (tile) => (tile.key === '2,0' ? 1 : 0),
      }).reason
    ).toBe('occluded');
    expect(
      traceGameboardSight(
        plan,
        start,
        { q: 1, r: 0 },
        {
          ...profile,
          groundHeight,
          obstructionHeight,
        }
      ).visible
    ).toBe(true);
  });

  it('handles same-cell, adjacent and missing cells, including intermediate holes', () => {
    const plan = board();
    expect(traceGameboardSight(plan, start, start, { ...profile, maxRangeHexes: 0 }).visible).toBe(
      true
    );
    expect(traceGameboardSight(plan, start, { q: 1, r: 0 }, profile).visible).toBe(true);
    expect(traceGameboardSight(plan, { q: -1, r: 0 }, end, profile)).toMatchObject({
      visible: false,
      reason: 'missing-tile',
      blocker: { q: -1, r: 0 },
    });
    expect(traceGameboardSight(plan, start, { q: 5, r: 0 }, profile).reason).toBe('missing-tile');
    const holed = { ...plan, tiles: plan.tiles.filter((tile) => tile.key !== '2,0') };
    expect(traceGameboardSight(holed, start, end, profile)).toMatchObject({
      reason: 'missing-tile',
      blocker: { q: 2, r: 0 },
    });
  });

  it('uses authored range before tracing and preserves the rounded-line boundary convention', () => {
    const plan = board();
    expect(traceGameboardSight(plan, start, end, { ...profile, maxRangeHexes: 3 })).toEqual({
      visible: false,
      reason: 'range',
      line: [],
    });
    const target = { q: 1, r: 1 };
    const line = hexLine(start, target);
    expect(traceGameboardSight(plan, start, target, profile).line).toEqual(line);
    // The ray touches the shared edge of 1,0 and 0,1. Rounded hexLine picks
    // 1,0 at the midpoint and deliberately does not supercover the other cell.
    expect(line).not.toContainEqual({ q: 0, r: 1 });
    const offLine = plan.tiles.find((tile) => tile.key === '0,1');
    if (!offLine) throw new Error('off-line cell');
    offLine.elevation = 100;
    expect(traceGameboardSight(plan, start, target, profile).visible).toBe(true);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
    'rejects invalid authored heights %s',
    (height) => {
      const plan = board();
      expect(() =>
        traceGameboardSight(plan, start, end, { ...profile, eyeHeight: height })
      ).toThrow(GameboardRuntimeError);
      expect(() =>
        traceGameboardSight(plan, start, end, { ...profile, targetHeight: height })
      ).toThrow(GameboardRuntimeError);
      expect(() =>
        traceGameboardSight(plan, start, end, { ...profile, obstructionHeight: () => height })
      ).toThrow(GameboardRuntimeError);
    }
  );

  it('rejects invalid coordinates, range, sampled ground and vertical overflow', () => {
    const plan = board();
    for (const maxRangeHexes of [-1, 0.5, Number.POSITIVE_INFINITY])
      expect(() => traceGameboardSight(plan, start, end, { ...profile, maxRangeHexes })).toThrow(
        GameboardRuntimeError
      );
    expect(() => traceGameboardSight(plan, { q: 0.5, r: 0 }, end, profile)).toThrow(
      GameboardRuntimeError
    );
    expect(() => traceGameboardSight(plan, start, { q: 0, r: Number.NaN }, profile)).toThrow(
      GameboardRuntimeError
    );
    expect(() =>
      traceGameboardSight(plan, start, end, { ...profile, groundHeight: () => Number.NaN })
    ).toThrow(GameboardRuntimeError);
    expect(() =>
      traceGameboardSight(plan, start, end, {
        ...profile,
        groundHeight: () => 1e308,
        eyeHeight: 1e308,
      })
    ).toThrow(GameboardRuntimeError);
    expect(() =>
      traceGameboardSight(plan, start, end, {
        ...profile,
        groundHeight: () => 1e308,
        obstructionHeight: () => 1e308,
      })
    ).toThrow(GameboardRuntimeError);
  });
});
