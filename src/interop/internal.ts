/**
 * Interop-domain internal release/CI metadata.
 *
 * NOT public API — release-gate + visual-artifact tables consumed by the
 * coverage report builder and the CLI's `coverage`/`doctor` surfaces. Lives here
 * (not in `./coverage`) so the `../interop` barrel re-exports only the public
 * coverage surface; in-package callers import this sibling directly.
 *
 * @module
 * @internal
 */

/** Browser screenshot artifacts enforced by the visual test scripts. */
export const GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS = [
  'tests/browser/__screenshots__/free-catalog.png',
  'tests/browser/__screenshots__/free-guide-assets-by-public-role.png',
  'tests/browser/__screenshots__/free-guide-source-pages.png',
  'tests/browser/__screenshots__/free-guide-scenarios-by-extracted-page.png',
  'tests/browser/__screenshots__/free-guide-roads-all-labels-rotations.png',
  'tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png',
  'tests/browser/__screenshots__/free-guide-river-curvy-crossings-all-modes.png',
  'tests/browser/__screenshots__/free-guide-coasts-all-labels-rotations-water-waterless.png',
  'tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
  'tests/browser/__screenshots__/free-gameboard-recipe.png',
  'tests/browser/__screenshots__/free-blueprint-builder-showcase.png',
  'tests/browser/__screenshots__/free-seeded-gameboard.png',
  'tests/browser/__screenshots__/free-seeded-hex-gameboard.png',
  'tests/browser/__screenshots__/free-generated-piece-recipe.png',
  'tests/browser/__screenshots__/simple-rpg-fixed-completed.png',
  'tests/browser/__screenshots__/simple-rpg-seeded-completed.png',
  'tests/browser/__screenshots__/simple-rpg-packaged-scenario.png',
  'tests/browser/__screenshots__/simple-rpg-simulation-report.png',
  'tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png',
  'tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png',
  'tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png',
  'tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png',
  'tests/browser/__screenshots__/extra-guide-assets-by-public-role.png',
  'tests/browser/__screenshots__/extra-guide-scenarios-pages-02-15.png',
  'tests/browser/__screenshots__/extra-guide-scenarios-pages-16-18.png',
  'tests/browser/__screenshots__/extra-seasonal-textures.png',
  'tests/browser/__screenshots__/extra-harbor-gameboard.png',
  'tests/browser/__screenshots__/extra-blueprint-biome-transition-showcase.png',
  'tests/browser/__screenshots__/simple-rpg-local-third-party-assets.png',
] as const;
