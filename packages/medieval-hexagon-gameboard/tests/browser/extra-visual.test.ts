import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { describeKayKitAssetTreatment, listKayKitAssetPublicTreatments } from '../../src/catalog';
import { createMedievalHarborBoard, type GameboardPlacementSpec } from '../../src/gameboard';
import { freeManifest } from '../../src/manifest/free';
import type { AssetCategory, MedievalHexagonAsset } from '../../src/types';
import { assertCanvasHasRenderableContent, referenceExtraUrl, renderContactSheet, renderGameboardPlan } from './rendering';

declare const __EXTRA_TEXTURE_ROOT__: string;

const extraTreatments = listKayKitAssetPublicTreatments();

describe('EXTRA local visual coverage', () => {
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
    const plan = createMedievalHarborBoard({ seed: 'visual-extra-harbor', faction: 'blue' });
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
