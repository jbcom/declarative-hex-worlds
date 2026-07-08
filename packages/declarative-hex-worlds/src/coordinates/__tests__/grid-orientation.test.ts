/**
 * Coverage for the data-driven `'flat'` orientation branches in
 * `src/coordinates/grid.ts` (`DEFAULT_HEX_ORIENTATION` and the `KayKitHex`
 * `defineHex` orientation). The shipped `hex-geometry.default.json` is `'pointy'`,
 * so the `'flat'` arm of each ternary is only reachable when the defaults data
 * declares a flat-top hex — which is exactly what a flat-top asset pack would ship.
 *
 * We prove the data-driven mapping honours a flat-top defaults JSON by mocking the
 * defaults module and re-importing `grid.ts` in isolation, so its module-level
 * constants re-evaluate against the flat data.
 *
 * @module
 */
import { Orientation } from 'honeycomb-grid';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('../hex-geometry.default.json');
});

describe('grid orientation is data-driven from the defaults JSON', () => {
  it('maps a flat-top defaults JSON to flat orientation constants', async () => {
    vi.resetModules();
    vi.doMock('../hex-geometry.default.json', () => ({
      default: { width: 2, depth: 2.3094, elevationStep: 1, orientation: 'flat' },
    }));

    const grid = await import('../grid');

    // Line-48 branch: DEFAULT_HEX_ORIENTATION derives 'flat' from the JSON.
    expect(grid.DEFAULT_HEX_ORIENTATION).toBe('flat');
    // Line-142 branch: KayKitHex's defineHex resolves to Orientation.FLAT.
    const hex = new grid.KayKitHex({ q: 0, r: 0 });
    expect(hex.orientation).toBe(Orientation.FLAT);
  });

  it('maps a pointy-top defaults JSON to pointy orientation constants', async () => {
    vi.resetModules();
    vi.doMock('../hex-geometry.default.json', () => ({
      default: { width: 2, depth: 2.3094, elevationStep: 1, orientation: 'pointy' },
    }));

    const grid = await import('../grid');

    expect(grid.DEFAULT_HEX_ORIENTATION).toBe('pointy');
    const hex = new grid.KayKitHex({ q: 0, r: 0 });
    expect(hex.orientation).toBe(Orientation.POINTY);
  });
});
