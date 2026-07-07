/**
 * Proves packages/simple-rpg resolves declarative-hex-worlds through the
 * workspace as a real consumer — the foundation of the whole gap-finding
 * approach. As SimpleRPG grows a render surface + run states, its tests here
 * become the library's real-world e2e (RFC §D-test-topology).
 */
import { createHexagonGameboardGrid, hexDistance } from 'declarative-hex-worlds';
import { describe, expect, it } from 'vitest';

describe('SimpleRPG consumes declarative-hex-worlds', () => {
  it('resolves the library and its coordinate math through the workspace', () => {
    // A basic capability smoke: hex distance from the library.
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(2);
  });

  it('builds a Honeycomb-backed hex gameboard grid from the library', () => {
    // createHexagonGameboardGrid returns a Honeycomb Grid (dhw wraps honeycomb).
    // A radius-2 hexagonal spiral has 19 cells (1 + 6 + 12).
    const grid = createHexagonGameboardGrid({ radius: 2 });
    expect(grid.size).toBe(19);
  });
});
