import { describe, expect, it } from 'vitest';
import { tileKeyFromTargetInput } from '../internal';

describe('simulation internal helpers', () => {
  it('tileKeyFromTargetInput handles axial-string + {q,r} object inputs', () => {
    // Strings go through parseHexKey/hexKey, so the canonical axial format
    // round-trips. Invalid strings return undefined (caught from parse).
    expect(tileKeyFromTargetInput('0,0')).toBe('0,0');
    expect(tileKeyFromTargetInput({ q: 1, r: 2 })).toBe('1,2');
    expect(tileKeyFromTargetInput('not-a-hex-coord')).toBeUndefined();
    expect(tileKeyFromTargetInput(42)).toBeUndefined();
  });
});
