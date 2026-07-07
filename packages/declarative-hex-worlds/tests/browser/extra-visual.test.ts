import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import {
  describeKayKitAssetTreatment,
  listKayKitAssetPublicTreatments,
  listKayKitGuideAssetCoverages,
  listKayKitGuideScenarioAssetRenderRequests,
} from '../../src/scenario/catalog';
import { createMedievalShowcaseBlueprintRecipe } from '../../src/scenario/blueprint';
import { createHarborBoard, type GameboardPlacementSpec } from '../../src/gameboard/index';
import { freeManifest } from '../../src/manifest/free';
import { createGameboardPlanFromRecipe } from '../../src/scenario/recipe';
import type { AssetCategory, MedievalHexagonAsset } from '../../src/types/index';
import { assertCanvasHasRenderableContent, referenceExtraUrl, renderContactSheet, renderGameboardPlan } from './rendering';

declare const __EXTRA_TEXTURE_ROOT__: string;
declare const __EXTRA_SOURCE_ROOT__: string;

const extraTreatments = listKayKitAssetPublicTreatments();

// EXTRA is a LICENSED itch.io pack resolved from the NAS asset library — never
// downloaded, never tracked. When its tree isn't reachable (CI without the NAS),
// skip the whole suite rather than fail or overwrite baselines with blank frames.
async function extraAssetsReachable(): Promise<boolean> {
  try {
    const [source, texture] = await Promise.all([
      fetch(`/@fs/${__EXTRA_SOURCE_ROOT__}/tiles/base/hex_grass.gltf`, { method: 'HEAD' }),
      fetch(`/@fs/${__EXTRA_TEXTURE_ROOT__}/hexagons_medieval.png`, { method: 'HEAD' }),
    ]);
    return source.ok && texture.ok;
  } catch {
    return false;
  }
}

const EXTRA_AVAILABLE = await extraAssetsReachable();

describe.skipIf(!EXTRA_AVAILABLE)('EXTRA local visual coverage', () => {
  it('captures every local EXTRA tile asset including FREE-compatible copies', async () => {
    await page.viewport(1700, 1050);
    const requests = requestsForCategory('tiles');
    expect(requests).toHaveLength(61);

    const canvas = await renderContactSheet(requests, {
      title: 'extra-local-all-tiles-guide-and-transitions',
      width: 1600,
      height: 950,
      columns: 10,
      cellSize: 2.7,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/extra-local-all-tiles-guide-and-transitions.png',
    });
    expect(screenshot).toContain('extra-local-all-tiles-guide-and-transitions.png');
  });

  it('captures every local EXTRA building asset including faction structures', async () => {
    await page.viewport(1900, 1300);
    const requests = requestsForCategory('buildings');
    expect(requests).toHaveLength(129);

    const canvas = await renderContactSheet(requests, {
      title: 'extra-local-all-buildings-factions-neutral-harbors',
      width: 1800,
      height: 1200,
      columns: 13,
      cellSize: 2.9,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png',
    });
    expect(screenshot).toContain('extra-local-all-buildings-factions-neutral-harbors.png');
  });

  it('captures every local EXTRA decoration asset including props and nature', async () => {
    await page.viewport(1700, 1050);
    const requests = requestsForCategory('decoration');
    expect(requests).toHaveLength(77);

    const canvas = await renderContactSheet(requests, {
      title: 'extra-local-all-decoration-nature-props',
      width: 1600,
      height: 950,
      columns: 11,
      cellSize: 2.9,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/extra-local-all-decoration-nature-props.png',
    });
    expect(screenshot).toContain('extra-local-all-decoration-nature-props.png');
  });

  it('captures every local EXTRA unit asset including full, accent, neutral, and siege parts', async () => {
    await page.viewport(1900, 1300);
    const requests = requestsForCategory('units');
    expect(requests).toHaveLength(137);

    const canvas = await renderContactSheet(requests, {
      title: 'extra-local-all-units-full-accent-neutral-siege',
      width: 1800,
      height: 1200,
      columns: 14,
      cellSize: 2.8,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/extra-local-all-units-full-accent-neutral-siege.png',
    });
    expect(screenshot).toContain('extra-local-all-units-full-accent-neutral-siege.png');
  });

  it('captures every local asset grouped by guide asset coverage role', async () => {
    await page.viewport(2000, 1800);
    const coverages = listKayKitGuideAssetCoverages().sort((left, right) =>
      left.role === right.role ? left.assetId.localeCompare(right.assetId) : left.role.localeCompare(right.role)
    );
    expect(coverages).toHaveLength(extraTreatments.length);

    const requests = coverages.map((coverage) => ({
      asset: minimalAsset(coverage.assetId, coverage.sourcePath, coverage.category, coverage.subcategory),
      url: referenceExtraUrl(coverage.sourcePath),
      label: `${coverage.role}:${coverage.assetId}`,
      caption: `${coverage.minimumEdition} p${coverage.pages.join(',')} api=${coverage.publicApi.length}`,
    }));

    const canvas = await renderContactSheet(requests, {
      title: 'extra-guide-assets-by-public-role',
      width: 1900,
      height: 1700,
      columns: 17,
      cellSize: 2.7,
    });
    assertCanvasHasRenderableContent(canvas, { minDrawCalls: requests.length });
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/extra-guide-assets-by-public-role.png',
    });
    expect(screenshot).toContain('extra-guide-assets-by-public-role.png');
  });

  it('captures mixed and EXTRA guide scenarios from pages 02 through 15', async () => {
    await page.viewport(1900, 1500);
    const requests = requestsForGuidePages([2, 11, 12, 13, 14, 15]);
    expect(requests).toHaveLength(329);

    const canvas = await renderContactSheet(requests, {
      title: 'extra-guide-scenarios-pages-02-15',
      width: 1800,
      height: 1400,
      columns: 14,
      cellSize: 2.75,
    });
    assertCanvasHasRenderableContent(canvas, { minDrawCalls: requests.length });
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/extra-guide-scenarios-pages-02-15.png',
    });
    expect(screenshot).toContain('extra-guide-scenarios-pages-02-15.png');
  });

  it('captures EXTRA guide scenarios for stable, workshop, and unit-combination pages', async () => {
    await page.viewport(1900, 1700);
    const requests = requestsForGuidePages([16, 17, 18]);
    expect(requests).toHaveLength(462);

    const canvas = await renderContactSheet(requests, {
      title: 'extra-guide-scenarios-pages-16-18',
      width: 1800,
      height: 1600,
      columns: 15,
      cellSize: 2.8,
    });
    assertCanvasHasRenderableContent(canvas, { minDrawCalls: requests.length });
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/extra-guide-scenarios-pages-16-18.png',
    });
    expect(screenshot).toContain('extra-guide-scenarios-pages-16-18.png');
  });

  it('captures EXTRA seasonal texture sheets', async () => {
    await page.viewport(1200, 520);
    const sheet = document.createElement('div');
    sheet.dataset.testid = 'extra-seasonal-textures';
    sheet.style.display = 'grid';
    sheet.style.gridTemplateColumns = 'repeat(4, 256px)';
    sheet.style.gap = '18px';
    sheet.style.padding = '24px';
    sheet.style.background = '#1f2320';
    document.body.innerHTML = '';
    document.body.style.margin = '0';
    document.body.append(sheet);

    const textureFiles = [
      'hexagons_medieval.png',
      'hexagons_medieval_Fall.png',
      'hexagons_medieval_Summer.png',
      'hexagons_medieval_Winter.png',
    ];
    await Promise.all(
      textureFiles.map(
        (file) =>
          new Promise<void>((resolve, reject) => {
            const image = document.createElement('img');
            image.src = `/@fs/${__EXTRA_TEXTURE_ROOT__}/${file}`;
            image.width = 256;
            image.height = 256;
            image.alt = file;
            image.onload = () => resolve();
            image.onerror = () => reject(new Error(`Unable to load ${file}`));
            sheet.append(image);
          })
      )
    );

    const screenshot = await page.screenshot({
      element: sheet,
      path: '__screenshots__/extra-seasonal-textures.png',
    });
    expect(screenshot).toContain('extra-seasonal-textures.png');
  });

  it('captures a composed EXTRA harbor board with local-only structures and props', async () => {
    await page.viewport(1600, 1000);
    const plan = createHarborBoard({ seed: 'visual-extra-harbor', faction: 'blue' });
    const canvas = await renderGameboardPlan(plan, {
      title: 'extra-harbor-gameboard',
      width: 1500,
      height: 950,
      includeExtra: true,
      resolvePlacementUrl: extraUrlForPlacement,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/extra-harbor-gameboard.png',
    });
    expect(screenshot).toContain('extra-harbor-gameboard.png');
  });

  it('captures the full blueprint biome, transition, harbor, town, unit, and density showcase', async () => {
    await page.viewport(1800, 1200);
    const plan = createGameboardPlanFromRecipe(createMedievalShowcaseBlueprintRecipe());
    expect(plan.placements.some((placement) => placement.assetId === 'hex_transition')).toBe(true);
    expect(plan.placements.some((placement) => placement.assetId === 'building_shipyard_blue')).toBe(true);
    expect(plan.placements.some((placement) => placement.metadata.densityPreset === 'units')).toBe(true);
    expect(plan.placements.some((placement) => placement.metadata.feature === 'prop-cluster')).toBe(true);
    expect(plan.placements.some((placement) => placement.assetId === 'cannonball_pallet')).toBe(true);
    expect(plan.placements.some((placement) => placement.assetId === 'haybale')).toBe(true);
    expect(plan.placements.some((placement) => placement.assetId === 'anchor')).toBe(true);
    expect(plan.tiles.some((tile) => tile.textureSet === 'fall')).toBe(true);
    expect(plan.tiles.some((tile) => tile.textureSet === 'winter')).toBe(true);
    expect(plan.tiles.some((tile) => tile.textureSet === 'summer')).toBe(true);

    const canvas = await renderGameboardPlan(plan, {
      title: 'extra-blueprint-biome-transition-showcase',
      width: 1700,
      height: 1120,
      includeExtra: true,
      resolvePlacementUrl: extraUrlForPlacement,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/extra-blueprint-biome-transition-showcase.png',
    });
    expect(screenshot).toContain('extra-blueprint-biome-transition-showcase.png');
  });
});

function extraUrlForPlacement(placement: GameboardPlacementSpec): string | undefined {
  const sourcePath = extraSourcePathForAssetId(placement.assetId);
  return sourcePath ? referenceExtraUrl(sourcePath) : undefined;
}

function extraSourcePathForAssetId(assetId: string): string | undefined {
  return describeKayKitAssetTreatment(assetId)?.sourcePath ?? freeManifest.assetsById[assetId]?.sourcePath;
}

function requestsForCategory(category: AssetCategory) {
  return extraTreatments
    .filter((treatment) => treatment.category === category)
    .map((treatment) => ({
      asset: minimalAsset(treatment.assetId, treatment.sourcePath, treatment.category, treatment.subcategory),
      url: referenceExtraUrl(treatment.sourcePath),
      label: treatment.assetId,
      caption: `${treatment.role} ${treatment.minimumEdition}`,
    }));
}

function requestsForGuidePages(pages: readonly number[]) {
  return listKayKitGuideScenarioAssetRenderRequests({
    pages,
    assetBaseUrl: `/@fs/${__EXTRA_SOURCE_ROOT__}`,
  }).map((request) => ({
    asset: minimalAsset(request.assetId, request.sourcePath, request.category, request.subcategory),
    url: request.url ?? referenceExtraUrl(request.sourcePath),
    label: request.label,
    caption: request.caption,
  }));
}

function minimalAsset(
  id: string,
  sourcePath: string,
  category: AssetCategory,
  subcategory: string
): MedievalHexagonAsset {
  return {
    id,
    edition: 'extra',
    category,
    subcategory,
    family: id,
    textureSet: 'default',
    modelPath: sourcePath,
    sourcePath,
    bufferPaths: [],
    texturePaths: [],
    materialSlots: [],
    bounds: {
      min: [0, 0, 0],
      max: [1, 1, 1],
      size: [1, 1, 1],
    },
    fileSizeBytes: 0,
  };
}
