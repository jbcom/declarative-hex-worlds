import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import generatedPieceScenario from '../../examples/generated-piece-scenario.recipe.json';
import { createMedievalHarborBoard } from '../../src/gameboard';
import { freeManifest } from '../../src/manifest/free';
import { createGameboardPlanFromRecipe, type GameboardRecipe } from '../../src/recipe';
import { createSeededGameboardPlan } from '../../src/rules';
import {
  listCoastGuidePermutations,
  listRiverCrossingGuidePermutations,
  listRiverCurvyGuidePermutations,
  listRiverGuidePermutations,
  listRoadGuidePermutations,
} from '../../src/selectors';
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

  it('captures all road guide permutations by label and rotation', async () => {
    await page.viewport(1900, 1050);
    const requests = listRoadGuidePermutations().map(requestForPermutation);
    expect(requests).toHaveLength(78);

    const canvas = await renderContactSheet(requests, {
      title: 'free-guide-roads-all-labels-rotations',
      width: 1800,
      height: 950,
      columns: 13,
      cellSize: 2.7,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-guide-roads-all-labels-rotations.png',
    });
    expect(screenshot).toContain('free-guide-roads-all-labels-rotations.png');
  });

  it('captures all river guide permutations by label, rotation, and water mode', async () => {
    await page.viewport(1900, 1300);
    const waterRequests = listRiverGuidePermutations({ waterless: false }).map(requestForPermutation);
    const waterlessRequests = listRiverGuidePermutations({ waterless: true }).map(requestForPermutation);
    const requests = [...waterRequests, ...waterlessRequests];
    expect(requests).toHaveLength(144);

    const canvas = await renderContactSheet(
      requests,
      {
        title: 'free-guide-rivers-all-labels-rotations-water-waterless',
        width: 1800,
        height: 1200,
        columns: 12,
        cellSize: 2.7,
      }
    );
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png',
    });
    expect(screenshot).toContain('free-guide-rivers-all-labels-rotations-water-waterless.png');
  });

  it('captures all curvy river and river crossing guide permutations', async () => {
    await page.viewport(1300, 620);
    const requests = [
      ...listRiverCurvyGuidePermutations().map(requestForPermutation),
      ...listRiverCrossingGuidePermutations().map(requestForPermutation),
    ];
    expect(requests).toHaveLength(16);

    const canvas = await renderContactSheet(requests, {
      title: 'free-guide-river-curvy-crossings-all-modes',
      width: 1200,
      height: 520,
      columns: 8,
      cellSize: 2.6,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-guide-river-curvy-crossings-all-modes.png',
    });
    expect(screenshot).toContain('free-guide-river-curvy-crossings-all-modes.png');
  });

  it('captures all coast guide permutations by label, rotation, and water mode', async () => {
    await page.viewport(1700, 1050);
    const requests = [
      ...listCoastGuidePermutations({ waterless: false }).map(requestForPermutation),
      ...listCoastGuidePermutations({ waterless: true }).map(requestForPermutation),
    ];
    expect(requests).toHaveLength(60);

    const canvas = await renderContactSheet(requests, {
      title: 'free-guide-coasts-all-labels-rotations-water-waterless',
      width: 1600,
      height: 950,
      columns: 10,
      cellSize: 2.7,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-guide-coasts-all-labels-rotations-water-waterless.png',
    });
    expect(screenshot).toContain('free-guide-coasts-all-labels-rotations-water-waterless.png');
  });

  it('captures guide page terrain, stack, nature, building, and prop treatments', async () => {
    await page.viewport(1700, 1050);
    const requests = [
      'hex_grass',
      'hex_grass_bottom',
      'hex_grass_sloped_high',
      'hex_grass_sloped_low',
      'hex_water',
      'mountain_A',
      'mountain_A_grass',
      'mountain_A_grass_trees',
      'mountain_B_grass_trees',
      'mountain_C_grass_trees',
      'hills_A',
      'hills_A_trees',
      'trees_A_large',
      'tree_single_A',
      'waterlily_A',
      'building_castle_blue',
      'building_home_A_blue',
      'building_watermill_blue',
      'building_bridge_A',
      'wall_straight_gate',
      'crate_A_big',
      'resource_lumber',
      'flag_blue',
      'wheelbarrow',
    ].map((id) => {
      const asset = freeManifest.assetsById[id];
      return { asset, url: assetUrl(asset), label: id, caption: asset.sourcePath };
    });

    const canvas = await renderContactSheet(requests, {
      title: 'free-guide-page-nature-stacks-buildings-props',
      width: 1600,
      height: 950,
      columns: 8,
      cellSize: 2.9,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
    });
    expect(screenshot).toContain('free-guide-page-nature-stacks-buildings-props.png');
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
  return {
    asset,
    url: assetUrl(asset),
    rotationY: permutation.rotationRadians,
    label: `${permutation.kind}:${permutation.label}:r${permutation.rotationSteps}`,
    caption: `${permutation.waterless ? 'waterless' : 'water'} mask=${permutation.inputMask.toString(2).padStart(6, '0')}`,
  };
}
