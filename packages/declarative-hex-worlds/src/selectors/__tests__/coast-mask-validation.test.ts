import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard';
import { GameboardRuntimeError } from '../../errors';
import { assertCoverableCoastMask, isCoverableCoastMask } from '../selectors';

describe('coast edge-mask validation (RFC0-9, the 010101 finding)', () => {
  it('accepts contiguous water-edge runs (the coast tile variants A-E)', () => {
    expect(isCoverableCoastMask([0])).toBe(true); // A
    expect(isCoverableCoastMask([0, 1])).toBe(true); // B
    expect(isCoverableCoastMask([0, 1, 2])).toBe(true); // C
    expect(isCoverableCoastMask([2, 3, 4, 5])).toBe(true); // D, rotated
    expect(isCoverableCoastMask([0, 1, 2, 3, 4])).toBe(true); // E
    expect(isCoverableCoastMask(0)).toBe(true); // no coast
  });

  it('rejects non-contiguous water-edge masks (no single coast tile covers them)', () => {
    expect(isCoverableCoastMask([0, 2, 4])).toBe(false); // 010101 — the finding
    expect(isCoverableCoastMask([0, 2])).toBe(false); // gap between edges
    expect(isCoverableCoastMask([0, 1, 3])).toBe(false); // run + island
    expect(isCoverableCoastMask([0, 1, 2, 3, 4, 5])).toBe(false); // fully enclosed — no coast tile
  });

  it('assertCoverableCoastMask throws a clear author-time error naming the mask + tile', () => {
    expect(() => assertCoverableCoastMask([0, 2, 4], { tileKey: '3,4' })).toThrow(
      GameboardRuntimeError
    );
    expect(() => assertCoverableCoastMask([0, 2, 4], { tileKey: '3,4' })).toThrow(/010101/);
    expect(() => assertCoverableCoastMask([0, 2, 4], { tileKey: '3,4' })).toThrow(/tile 3,4/);
    expect(() => assertCoverableCoastMask([0, 2, 4], { tileKey: '3,4' })).toThrow(/contiguous/);
    // A valid mask does not throw.
    expect(() => assertCoverableCoastMask([0, 1, 2])).not.toThrow();
  });

  it('setCoastEdges fails at the AUTHOR call for a non-contiguous mask (not deep in projection)', () => {
    const builder = createGameboardBuilder({
      seed: 'coast-validation',
      shape: { kind: 'rectangle', width: 4, height: 4 },
    });
    // The bad mask is caught HERE, at setCoastEdges — naming the tile — rather than
    // throwing an opaque "no coast variant covers 010101" later during projection.
    expect(() => builder.setCoastEdges({ q: 1, r: 1 }, [0, 2, 4])).toThrow(/non-contiguous/);
    // A contiguous mask is accepted and sets the tile to coast.
    expect(() => builder.setCoastEdges({ q: 2, r: 2 }, [0, 1])).not.toThrow();
  });
});
