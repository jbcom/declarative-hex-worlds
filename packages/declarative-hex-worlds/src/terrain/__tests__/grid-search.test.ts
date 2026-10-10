import seedrandom from 'seedrandom';
import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { createHeightField } from '../field';
import {
  SamplePriorityQueue,
  validateSearchField,
  validateSmoothing,
  validateTolerance,
} from '../grid-search';

const bounds = { minX: 0, minZ: 0, maxX: 10, maxZ: 10 };

describe('SamplePriorityQueue', () => {
  it('pops by key, then tie, growing past its initial capacity', () => {
    const queue = new SamplePriorityQueue(0);
    const rng = seedrandom('queue');
    const entries: { key: number; tie: number; item: number }[] = [];
    for (let item = 0; item < 500; item += 1) {
      const entry = { key: Math.floor(rng() * 20), tie: Math.floor(rng() * 1000), item };
      entries.push(entry);
      queue.push(entry.key, entry.tie, entry.item);
    }
    expect(queue.size).toBe(500);
    entries.sort((a, b) => a.key - b.key || a.tie - b.tie || a.item - b.item);
    const popped: { key: number; tie: number }[] = [];
    while (queue.size > 0) {
      const item = queue.pop();
      const entry = entries.find((e) => e.item === item);
      if (!entry) throw new Error('unknown item');
      popped.push({ key: entry.key, tie: entry.tie });
    }
    expect(popped).toEqual(entries.map(({ key, tie }) => ({ key, tie })));
    expect(queue.pop()).toBe(-1);
  });

  it('breaks equal keys by tie whatever the push order', () => {
    const queue = new SamplePriorityQueue();
    for (const tie of [5, 3, 9, 1, 7]) queue.push(2, tie, tie * 10);
    queue.push(1, 99, 990);
    expect([1, 2, 3, 4, 5, 6].map(() => queue.pop())).toEqual([990, 10, 30, 50, 70, 90]);
  });
});

describe('search validation', () => {
  it('accepts sound fields and rejects bad shapes, oversized grids and bad heights', () => {
    const field = createHeightField({ bounds, width: 3, height: 3 });
    expect(() => validateSearchField(field, 9, 'test field')).not.toThrow();
    expect(() => validateSearchField({ ...field, width: 1 }, 9, 'test field')).toThrow(
      GameboardValidationError
    );
    expect(() => validateSearchField(field, 8, 'test field')).toThrow(/exceeds 8 samples/);
    expect(() =>
      validateSearchField({ ...field, heights: new Float32Array(4) }, 9, 'test field')
    ).toThrow(/expects 9 heights; got 4/);
    const holed = createHeightField({ bounds, width: 3, height: 3 });
    holed.heights[4] = Number.NaN;
    expect(() => validateSearchField(holed, 9, 'test field')).toThrow(/finite heights/);
  });

  it('bounds smoothing passes and tolerances', () => {
    expect(() => validateSmoothing(0, 'x')).not.toThrow();
    expect(() => validateSmoothing(8, 'x')).not.toThrow();
    for (const bad of [-1, 9, 1.5, Number.NaN]) {
      expect(() => validateSmoothing(bad, 'x')).toThrow(GameboardValidationError);
    }
    expect(() => validateTolerance(0, 'x')).not.toThrow();
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => validateTolerance(bad, 'x')).toThrow(/simplifyTolerance/);
    }
  });
});
