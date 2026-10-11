import { describe, expect, it } from 'vitest';
import { forEachSegmentCell } from '../segment-cover';

describe('forEachSegmentCell', () => {
  it('visits every cell within reach of the segment, offset by the origin', () => {
    const visited: string[] = [];
    forEachSegmentCell({ x: 15, z: 5 }, { x: 25, z: 5 }, 1, 10, 0, 0, (r, c) => {
      visited.push(`${r},${c}`);
    });
    expect(visited).toEqual(['0,1', '0,2']);

    const offset: string[] = [];
    forEachSegmentCell({ x: 15, z: 5 }, { x: 25, z: 5 }, 1, 10, 10, 0, (r, c) => {
      offset.push(`${r},${c}`);
    });
    expect(offset).toEqual(['0,0', '0,1']);
  });

  it('rejects a cell size that is not positive', () => {
    const noop = () => undefined;
    expect(() => forEachSegmentCell({ x: 0, z: 0 }, { x: 1, z: 0 }, 1, 0, 0, 0, noop)).toThrow(
      RangeError
    );
    expect(() =>
      forEachSegmentCell({ x: 0, z: 0 }, { x: 1, z: 0 }, 1, Number.NaN, 0, 0, noop)
    ).toThrow(RangeError);
  });
});
