/**
 * Vitest setup: enforces koota world cleanup after every test.
 *
 * koota's `createWorld` allocates from a per-process `universe.worldIndex`
 * pool with a hard limit of 16 entries. Tests that create a world without
 * destroying it accumulate slots; once a single file accrues 17+ live
 * worlds, the next allocation throws "Too many worlds created".
 *
 * After each test, walk the live worlds in koota's `universe` registry
 * and call `destroy()` on each, releasing its slot back to the pool.
 * Tests don't need to call `world.destroy()` themselves.
 *
 * @module
 */
import { afterEach } from 'vitest';
import { universe } from 'koota';

interface WorldLike {
  destroy: () => void;
}

interface WorldUniverse {
  worlds?: ReadonlyArray<WorldLike | null | undefined>;
  worldIndex?: { unsetWorld?: (id: number) => void };
}

afterEach(() => {
  const reg = universe as unknown as WorldUniverse;
  const worlds = reg.worlds ?? [];
  for (const world of [...worlds]) {
    if (world) {
      try {
        world.destroy();
      } catch {
        // World already destroyed or in an inconsistent state — ignore.
      }
    }
  }
});
