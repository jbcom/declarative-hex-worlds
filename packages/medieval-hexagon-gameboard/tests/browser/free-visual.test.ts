import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import generatedPieceScenario from '../../examples/generated-piece-scenario.recipe.json';
import {
  listKayKitGuideAssetCoverages,
  listKayKitGuideRoleCoverages,
  listKayKitGuideScenarios,
} from '../../src/catalog';
import { createMedievalGameboardBlueprintPlan } from '../../src/blueprint';
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

declare const __WORKSPACE_ROOT__: string;

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

  it('captures a contact sheet grouped by public asset and role coverage', async () => {
    await page.viewport(1900, 1300);
    const roleCoverages = listKayKitGuideRoleCoverages();
    const roleNames = new Set(roleCoverages.map((coverage) => coverage.role));
    const coverages = listKayKitGuideAssetCoverages()
      .filter((coverage) => coverage.minimumEdition === 'free')
      .sort((left, right) =>
        left.role === right.role ? left.assetId.localeCompare(right.assetId) : left.role.localeCompare(right.role)
      );

    expect(coverages).toHaveLength(freeManifest.assets.length);
    for (const coverage of coverages) {
      expect(roleNames.has(coverage.role), coverage.assetId).toBe(true);
      expect(coverage.pages.length, coverage.assetId).toBeGreaterThan(0);
      expect(coverage.publicApi.length, coverage.assetId).toBeGreaterThan(0);
    }

    const requests = coverages.map((coverage) => {
      const asset = freeManifest.assetsById[coverage.assetId];
      if (!asset) {
        throw new Error(`FREE guide asset coverage references missing asset ${coverage.assetId}`);
      }
      return {
        asset,
        url: assetUrl(asset),
        label: `${coverage.role}:${coverage.assetId}`,
        caption: `p${coverage.pages.join(',')} api=${coverage.publicApi.length}`,
      };
    });

    const canvas = await renderContactSheet(requests, {
      title: 'free-guide-assets-by-public-role',
      width: 1800,
      height: 1300,
      columns: 17,
      cellSize: 2.7,
    });
    assertCanvasHasRenderableContent(canvas, { minDrawCalls: requests.length });
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-guide-assets-by-public-role.png',
    });
    expect(screenshot).toContain('free-guide-assets-by-public-role.png');
  });

  it('captures extracted guide pages and scenario-scoped FREE treatments', async () => {
    await page.viewport(2000, 2300);
    const scenarios = listKayKitGuideScenarios();
    expect(scenarios).toHaveLength(19);

    const guideMatrix = await renderGuidePageMatrix(scenarios);
    const guideScreenshot = await page.screenshot({
      element: guideMatrix,
      path: '__screenshots__/free-guide-source-pages.png',
    });
    expect(guideScreenshot).toContain('free-guide-source-pages.png');

    const requests = scenarios.flatMap((scenario) =>
      scenario.assetIds.flatMap((assetId) => {
        const asset = freeManifest.assetsById[assetId];
        if (!asset) {
          return [];
        }
        return [
          {
            asset,
            url: assetUrl(asset),
            label: `p${String(scenario.page).padStart(2, '0')}:${asset.id}`,
            caption: scenario.id,
          },
        ];
      })
    );
    expect(requests).toHaveLength(471);

    const assetMatrix = await renderContactSheet(requests, {
      title: 'free-guide-scenarios-by-extracted-page',
      width: 1900,
      height: 2200,
      columns: 17,
      cellSize: 2.65,
    });
    assertCanvasHasRenderableContent(assetMatrix, { minDrawCalls: requests.length });
    const assetScreenshot = await page.screenshot({
      element: assetMatrix,
      path: '__screenshots__/free-guide-scenarios-by-extracted-page.png',
    });
    expect(assetScreenshot).toContain('free-guide-scenarios-by-extracted-page.png');
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

  it('captures a blueprint builder board with vertical ranges, towns, roads, and a harbor', async () => {
    await page.viewport(1700, 1050);
    const plan = createMedievalGameboardBlueprintPlan({
      seed: 'visual-free-blueprint-builder',
      shape: { kind: 'rectangle', width: 10, height: 7 },
      faction: 'blue',
      waterFill: 0.14,
      maxElevation: 3,
      mountainRanges: [
        {
          id: 'free-ridge',
          path: [
            { q: 1, r: 0 },
            { q: 3, r: 1 },
            { q: 5, r: 1 },
          ],
          width: 1,
          height: 3,
          variant: 'cycle',
        },
      ],
      towns: [
        {
          id: 'free-town',
          center: { q: 4, r: 3 },
          includeWalls: true,
          buildings: ['market', 'home_A', 'home_B', 'well', 'blacksmith'],
        },
      ],
      harbors: [{ id: 'free-harbor', at: { q: 5, r: 5 }, facing: 1, kind: 'watermill', roadTo: { q: 4, r: 3 } }],
      roads: [
        {
          id: 'free-king-road',
          path: [
            { q: 2, r: 2 },
            { q: 4, r: 3 },
            { q: 7, r: 4 },
          ],
        },
      ],
      transitionPolicy: { biomeTransitions: false, elevationRamps: true, roadSlopes: true, bridges: true },
    });

    expect(plan.placements.some((placement) => placement.metadata.feature === 'mountain-stack')).toBe(true);
    expect(plan.placements.some((placement) => placement.assetId === 'building_watermill_blue')).toBe(true);
    expect(plan.placements.some((placement) => placement.kind === 'road')).toBe(true);

    const canvas = await renderGameboardPlan(plan, {
      title: 'free-blueprint-builder-showcase',
      width: 1600,
      height: 1000,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/free-blueprint-builder-showcase.png',
    });
    expect(screenshot).toContain('free-blueprint-builder-showcase.png');
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

async function renderGuidePageMatrix(scenarios: ReturnType<typeof listKayKitGuideScenarios>): Promise<HTMLElement> {
  const matrix = document.createElement('section');
  matrix.dataset.testid = 'free-guide-source-pages';
  matrix.style.boxSizing = 'border-box';
  matrix.style.width = '1900px';
  matrix.style.padding = '20px';
  matrix.style.background = '#20251f';
  matrix.style.color = '#f8f7e9';
  matrix.style.display = 'grid';
  matrix.style.gridTemplateColumns = 'repeat(5, 1fr)';
  matrix.style.gap = '14px';
  matrix.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  document.body.innerHTML = '';
  document.body.style.margin = '0';
  document.body.style.background = '#20251f';
  document.body.append(matrix);

  const imageLoads: Promise<void>[] = [];
  for (const scenario of scenarios) {
    const card = document.createElement('article');
    card.style.background = '#2b3029';
    card.style.border = '1px solid rgba(255, 255, 255, 0.16)';
    card.style.padding = '10px';
    card.style.minHeight = '290px';
    card.style.display = 'grid';
    card.style.gridTemplateRows = 'auto 1fr auto';
    card.style.gap = '8px';

    const title = document.createElement('div');
    title.textContent = `page-${String(scenario.page).padStart(2, '0')} ${scenario.title}`;
    title.style.fontSize = '13px';
    title.style.fontWeight = '700';

    const image = document.createElement('img');
    image.src = guideSourceImageUrl(scenario.sourceImage);
    image.alt = scenario.title;
    image.style.width = '100%';
    image.style.height = '220px';
    image.style.objectFit = 'contain';
    image.style.background = '#11140f';

    const caption = document.createElement('div');
    caption.textContent = `${scenario.edition} assets=${scenario.assetIds.length} api=${scenario.publicApi.length}`;
    caption.style.fontSize = '11px';
    caption.style.color = '#c9f3b1';

    card.append(title, image, caption);
    matrix.append(card);
    imageLoads.push(
      new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Unable to load guide source image ${scenario.sourceImage}`));
      })
    );
  }

  await Promise.all(imageLoads);
  return matrix;
}

function guideSourceImageUrl(sourceImage: string): string {
  return `/@fs/${__WORKSPACE_ROOT__}/${sourceImage}`;
}
