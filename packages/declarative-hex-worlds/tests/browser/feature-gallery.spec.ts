/**
 * Feature gallery screenshot harness (PRD F-Gallery-1).
 *
 * Renders the SimpleRPG fixed scenario into a Chromium viewport via the
 * library's three.js bindings and writes screenshots to
 * `tests/browser/__screenshots__/feature-gallery/<scenario>.png`. The
 * docs-site reads the same path at build time so the screenshot embedded
 * in `features/<name>.md` always reflects live SimpleRPG output.
 *
 * Runs under `vitest.browser.free.config.ts`. The screenshot files are
 * committed; CI fails on byte-drift unless the snapshot is intentionally
 * updated (same model as `tests/browser/__screenshots__/*.png`).
 *
 * @module
 */

import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { createFixedSimpleRpgGame } from '../simple-rpg/game';
import { projectWorldToGameboardPlan } from '../../src/coordinates/projection';
import { assertCanvasHasRenderableContent, renderGameboardPlan } from './rendering';

interface GalleryScenario {
  /** Filename (without extension) under tests/browser/__screenshots__/feature-gallery/. */
  readonly id: string;
  /** Human-readable label rendered into the canvas title. */
  readonly title: string;
}

const SCENARIOS: readonly GalleryScenario[] = [
  { id: 'fixed-harbor', title: 'SimpleRPG — Fixed Harbor' },
];

describe('feature-gallery screenshot harness (PRD F-Gallery-1)', () => {
  for (const scenario of SCENARIOS) {
    it(`renders ${scenario.id} into feature-gallery/${scenario.id}.png`, async () => {
      await page.viewport(1200, 800);
      const game = createFixedSimpleRpgGame();
      const projected = projectWorldToGameboardPlan(game.world);

      const canvas = await renderGameboardPlan(projected, {
        title: scenario.title,
        width: 1200,
        height: 800,
      });
      assertCanvasHasRenderableContent(canvas);

      const screenshot = await page.screenshot({
        element: canvas,
        path: `__screenshots__/feature-gallery/${scenario.id}.png`,
      });
      expect(screenshot).toContain(`feature-gallery/${scenario.id}.png`);
    });
  }
});
