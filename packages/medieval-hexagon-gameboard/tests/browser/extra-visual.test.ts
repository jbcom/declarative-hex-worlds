import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { createMedievalHarborBoard, type GameboardPlacementSpec } from '../../src/gameboard';
import { freeManifest } from '../../src/manifest/free';
import type { MedievalHexagonAsset } from '../../src/types';
import { assertCanvasHasRenderableContent, referenceExtraUrl, renderContactSheet, renderGameboardPlan } from './rendering';

declare const __EXTRA_TEXTURE_ROOT__: string;

const factionColors = ['blue', 'green', 'red', 'yellow'] as const;
const unitStyleFixtures = factionColors.flatMap((color) => [
  `units/${color}/unit_${color}_full.gltf`,
  `units/${color}/unit_${color}_accent.gltf`,
  `units/${color}/horse_${color}_full.gltf`,
  `units/${color}/horse_${color}_accent.gltf`,
  `units/${color}/ship_${color}_full.gltf`,
  `units/${color}/ship_${color}_accent.gltf`,
  `units/${color}/catapult_${color}_full.gltf`,
  `units/${color}/catapult_${color}_accent.gltf`,
]);

const extraFixtures = [
  'tiles/base/hex_transition.gltf',
  'units/neutral/helmet.gltf',
  'units/neutral/shovel.gltf',
  'units/neutral/sword.gltf',
  'units/neutral/spear.gltf',
  'units/neutral/bow.gltf',
  'units/neutral/shield.gltf',
  'buildings/blue/building_shipyard_blue.gltf',
  'buildings/blue/building_stables_blue.gltf',
  'buildings/blue/building_workshop_blue.gltf',
  'buildings/blue/building_tower_cannon_blue.gltf',
  'decoration/props/boat.gltf',
  'decoration/props/boatrack.gltf',
  'decoration/props/haybale.gltf',
  'decoration/props/icon_combat.gltf',
  ...unitStyleFixtures,
] as const;

describe('EXTRA local visual coverage', () => {
  it('captures EXTRA-only guide assets from local references', async () => {
    await page.viewport(1600, 1050);
    const requests = extraFixtures.map((sourcePath) => {
      const id = sourcePath.split('/').at(-1)?.replace('.gltf', '') ?? sourcePath;
      return {
        asset: minimalAsset(id, sourcePath),
        url: referenceExtraUrl(sourcePath),
      };
    });

    const canvas = await renderContactSheet(requests, {
      title: 'extra-local-guide-assets',
      width: 1500,
      height: 950,
      columns: 8,
      cellSize: 2.9,
    });
    assertCanvasHasRenderableContent(canvas);
    const screenshot = await page.screenshot({
      element: canvas,
      path: '__screenshots__/extra-local-guide-assets.png',
    });
    expect(screenshot).toContain('extra-local-guide-assets.png');
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
  const freeAsset = freeManifest.assetsById[assetId];
  if (freeAsset) {
    return freeAsset.sourcePath;
  }

  const faction = factionColors.find((color) => assetId.endsWith(`_${color}`));
  if (assetId.startsWith('building_') && faction) {
    return `buildings/${faction}/${assetId}.gltf`;
  }

  if (['anchor', 'boat', 'boatrack', 'haybale', 'trough', 'trough_long'].includes(assetId)) {
    return `decoration/props/${assetId}.gltf`;
  }

  return undefined;
}

function minimalAsset(id: string, sourcePath: string): MedievalHexagonAsset {
  return {
    id,
    edition: 'extra',
    category: sourcePath.split('/')[0] as MedievalHexagonAsset['category'],
    subcategory: sourcePath.split('/')[1] ?? 'root',
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
