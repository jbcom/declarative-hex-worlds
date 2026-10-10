/**
 * `src/terrain/grid-search.ts` — plumbing shared by the drainage flood and
 * the route searches (internal; not part of the public barrel).
 *
 * `SamplePriorityQueue` is a binary min-heap of grid sample indices. Entries
 * order by `key`, then by `tie`, so two runs over the same input pop in
 * exactly the same order: the searches pass the sample index (or a push
 * counter) as the tie so equal keys never fall back to heap layout. Storage
 * is parallel typed arrays that double when full, so a search over a large
 * field allocates a handful of buffers rather than an object per entry.
 *
 * @module
 */
import { GameboardValidationError } from '../errors';
import { type HeightField, validateGroundGrid } from './field';

/** Most Chaikin passes accepted by the drainage and routing tiers. */
const MAX_SMOOTHING_PASSES = 8;

/** Validates a Chaikin pass count. */
export function validateSmoothing(smoothing: number, what: string): void {
  if (!Number.isInteger(smoothing) || smoothing < 0 || smoothing > MAX_SMOOTHING_PASSES) {
    throw new GameboardValidationError(
      `${what} smoothing must be an integer from 0 to ${MAX_SMOOTHING_PASSES}; got ${smoothing}`
    );
  }
}

/** Validates a non-negative simplification tolerance. */
export function validateTolerance(tolerance: number, what: string): void {
  if (!(tolerance >= 0) || !Number.isFinite(tolerance)) {
    throw new GameboardValidationError(
      `${what} simplifyTolerance must be a non-negative number; got ${tolerance}`
    );
  }
}

/** Validates a field's shape, size cap and heights before a search over it. */
export function validateSearchField(field: HeightField, maxSamples: number, what: string): void {
  validateGroundGrid(field, what);
  const count = field.width * field.height;
  if (count > maxSamples) {
    throw new GameboardValidationError(
      `${what} of ${field.width}×${field.height} exceeds ${maxSamples} samples`
    );
  }
  if (field.heights.length !== count) {
    throw new GameboardValidationError(
      `${what} expects ${count} heights; got ${field.heights.length}`
    );
  }
  for (const value of field.heights) {
    if (!Number.isFinite(value)) {
      throw new GameboardValidationError(`${what} needs finite heights; got ${value}`);
    }
  }
}

/** Whether `(k1, t1)` orders strictly before `(k2, t2)`. */
function precedes(k1: number, t1: number, k2: number, t2: number): boolean {
  return k1 < k2 || (k1 === k2 && t1 < t2);
}

/** A min-heap of integer items ordered by `(key, tie)`. */
export class SamplePriorityQueue {
  private keys: Float64Array;
  private ties: Float64Array;
  private items: Int32Array;
  private count = 0;

  constructor(capacity = 64) {
    const size = capacity > 1 ? capacity : 1;
    this.keys = new Float64Array(size);
    this.ties = new Float64Array(size);
    this.items = new Int32Array(size);
  }

  /** Number of queued entries. */
  get size(): number {
    return this.count;
  }

  /** Queues `item` under `(key, tie)`. */
  push(key: number, tie: number, item: number): void {
    if (this.count === this.items.length) this.grow();
    const { keys, ties, items } = this;
    let i = this.count;
    this.count += 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!precedes(key, tie, keys[parent] as number, ties[parent] as number)) break;
      keys[i] = keys[parent] as number;
      ties[i] = ties[parent] as number;
      items[i] = items[parent] as number;
      i = parent;
    }
    keys[i] = key;
    ties[i] = tie;
    items[i] = item;
  }

  /** Removes and returns the item with the smallest `(key, tie)`; -1 when empty. */
  pop(): number {
    if (this.count === 0) return -1;
    const { keys, ties, items } = this;
    const top = items[0] as number;
    this.count -= 1;
    const last = this.count;
    const key = keys[last] as number;
    const tie = ties[last] as number;
    const item = items[last] as number;
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= last) break;
      const right = child + 1;
      if (
        right < last &&
        precedes(
          keys[right] as number,
          ties[right] as number,
          keys[child] as number,
          ties[child] as number
        )
      ) {
        child = right;
      }
      if (!precedes(keys[child] as number, ties[child] as number, key, tie)) break;
      keys[i] = keys[child] as number;
      ties[i] = ties[child] as number;
      items[i] = items[child] as number;
      i = child;
    }
    keys[i] = key;
    ties[i] = tie;
    items[i] = item;
    return top;
  }

  private grow(): void {
    const size = this.items.length * 2;
    const keys = new Float64Array(size);
    const ties = new Float64Array(size);
    const items = new Int32Array(size);
    keys.set(this.keys);
    ties.set(this.ties);
    items.set(this.items);
    this.keys = keys;
    this.ties = ties;
    this.items = items;
  }
}
