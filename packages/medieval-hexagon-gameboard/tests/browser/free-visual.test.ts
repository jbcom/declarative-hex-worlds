import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import generatedPieceScenario from '../../examples/generated-piece-scenario.recipe.json';
import { createMedievalHarborBoard } from '../../src/gameboard';
import { freeManifest } from '../../src/manifest/free';
import { createGameboardPlanFromRecipe, type GameboardRecipe } from '../../src/recipe';
import { createSeededGameboardPlan } from '../../src/rules';
import { listGuideTilePermutations } from '../../src/selectors';
import type { GuideTilePermutation } from '../../src/selectors';
import { assertCanvasHasRenderableContent, assetUrl, renderContactSheet, renderGameboardPlan } from './rendering';

describe('FREE visual coverage', () => {
  it('captures a contact sheet for every FREE model', async () => {
    await page.viewport(1900, 1300);
    const canvas = await renderContactSheet(
      freeManifest.assets.map((asset) => ({ asset, url: assetUrl(asset) })),
      {
        title: 'free-catalog',
        width: 1800,
        height: 1300,
        columns: 17,
        cellSize: 3.1,
      }
    );
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-catalog.png',
    });
    expect(screenshot).toContain('free-catalog.png');
  });

  it('captures guide tile permutations', async () => {
    await page.viewport(1900, 1300);
    const guidePermutationRequests = listGuideTilePermutations().map(requestForPermutation);
    const terrainRequests = [
      'hex_grass',
      'hex_grass_bottom',
      'hex_grass_sloped_high',
      'hex_grass_sloped_low',
      'hex_water',
      'mountain_A_grass_trees',
      'hills_A_trees',
      'trees_A_large',
      'building_castle_blue',
      'building_home_A_blue',
      'crate_A_big',
      'flag_blue',
    ].map((id) => {
      const asset = freeManifest.assetsById[id];
      return { asset, url: assetUrl(asset) };
    });

    const guideRequests = [
      ...guidePermutationRequests,
      ...terrainRequests,
    ];
    expect(guidePermutationRequests).toHaveLength(298);
    expect(guideRequests).toHaveLength(310);

    const canvas = await renderContactSheet(
      guideRequests,
      {
        title: 'free-guide-permutations',
        width: 1800,
        height: 1300,
        columns: 20,
        cellSize: 3,
      }
    );
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-guide-permutations.png',
    });
    expect(screenshot).toContain('free-guide-permutations.png');
  });

  it('captures a composed gameboard recipe with stacks, paths, coasts, and harbor context', async () => {
    await page.viewport(1600, 1000);
    const plan = createMedievalHarborBoard({ seed: 'visual-free-harbor', faction: 'blue' });
    const canvas = await renderGameboardPlan(plan, {
      title: 'free-gameboard-recipe',
      width: 1500,
      height: 950,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-gameboard-recipe.png',
    });
    expect(screenshot).toContain('free-gameboard-recipe.png');
  });

  it('captures a seeded random gameboard projection', async () => {
    await page.viewport(1600, 1000);
    const plan = createSeededGameboardPlan({
      seed: 'visual-seeded-board',
      shape: { kind: 'rectangle', width: 10, height: 8 },
      faction: 'green',
    });
    const canvas = await renderGameboardPlan(plan, {
      title: 'free-seeded-gameboard',
      width: 1500,
      height: 950,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-seeded-gameboard.png',
    });
    expect(screenshot).toContain('free-seeded-gameboard.png');
  });

  it('captures a seeded hexagon gameboard projection', async () => {
    await page.viewport(1500, 950);
    const plan = createSeededGameboardPlan({
      seed: 'visual-seeded-hex-board',
      shape: { kind: 'hexagon', radius: 3 },
      faction: 'yellow',
    });
    const canvas = await renderGameboardPlan(plan, {
      title: 'free-seeded-hex-gameboard',
      width: 1450,
      height: 900,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-seeded-hex-gameboard.png',
    });
    expect(screenshot).toContain('free-seeded-hex-gameboard.png');
  });

  it('captures the packaged generated-piece recipe example', async () => {
    await page.viewport(1500, 950);
    const plan = createGameboardPlanFromRecipe(generatedPieceScenario as GameboardRecipe);
    const generatedPlacements = plan.placements.filter(
      (placement) => placement.metadata.example === 'generated-piece-scenario'
    );
    expect(generatedPlacements).toHaveLength(5);

    const canvas = await renderGameboardPlan(plan, {
      title: 'free-generated-piece-recipe',
      width: 1450,
      height: 900,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-generated-piece-recipe.png',
    });
    expect(screenshot).toContain('free-generated-piece-recipe.png');
  });
});

function requestForPermutation(permutation: GuideTilePermutation) {
  const asset = freeManifest.assetsById[permutation.assetId];
  return { asset, url: assetUrl(asset), rotationY: permutation.rotationRadians };
}
