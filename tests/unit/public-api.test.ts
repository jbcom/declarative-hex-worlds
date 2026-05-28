/**
 * Public API snapshot gate (PRD E2).
 *
 * `import * as lib` against the umbrella, snapshot the sorted list of
 * exported keys + their `typeof`. Catches accidental removals, accidental
 * additions, accidental type-shape changes of exported values.
 *
 * Updating the snapshot is a public-API-change decision. Reviewers should
 * scrutinize any PR whose diff touches this snapshot — it's not a test
 * about implementation, it's a test about contract.
 *
 * @module
 */

import { describe, expect, it } from 'vitest';
// Import via package name so the test exercises the same alias resolution
// consumers use. vitest.config.ts aliases this to src/index.ts.
import * as lib from 'medieval-hexagon-gameboard';

describe('public API surface (PRD E2)', () => {
  it('snapshot of every umbrella export name + typeof', () => {
    const surface = Object.keys(lib as Record<string, unknown>)
      .sort()
      .map((key) => ({
        name: key,
        kind: typeof (lib as Record<string, unknown>)[key],
      }));
    expect(surface).toMatchSnapshot();
  });

  it('umbrella does not accidentally re-export internal selectors', () => {
    const keys = Object.keys(lib as Record<string, unknown>);
    // Internal selectors live behind `/selectors`. They're @internal-tagged
    // and re-exported there for advanced consumers, but the umbrella should
    // not flatten them in — too much surface area.
    for (const key of keys) {
      expect(key).not.toMatch(/^_/); // no underscore-prefix internals
    }
  });
});
