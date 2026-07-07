/**
 * The canvas-2D binding example — renders the SHARED example game in 2D
 * (RFC 0001 RFC0-2 / signals+bindings).
 *
 * This is the 2D counterpart to `../three/board.tsx`: it takes the SAME game
 * (`../game`) and draws it through `declarative-hex-worlds/canvas2d` onto a 2D
 * canvas context, using a tileset source to resolve each placement to a sprite
 * cell. Proving the same game renders through a second, non-three binding is the
 * whole point of the examples package — apples-to-apples, and each binding gets a
 * real render example the docs site can demonstrate.
 *
 * @module
 */
import {
  type Canvas2dSheetImages,
  type Canvas2dSyncResult,
  syncCanvas2dPlacements,
} from 'declarative-hex-worlds/canvas2d';
import type { GameboardPlan } from 'declarative-hex-worlds/gameboard';
import { createTilesetSource } from 'declarative-hex-worlds/asset-source';
import { createFixedSimpleRpgGame } from '../game/quest-game';
import { projectWorldToGameboardPlan } from 'declarative-hex-worlds';

/**
 * A minimal tileset manifest: one fill sheet, with each supported terrain mapped
 * to it. The 2D binding resolves every placement on a mapped terrain to a cell on
 * this sheet — enough to render the example board as a 2D sprite grid.
 */
function exampleTilesetManifest() {
  return {
    schemaVersion: '1',
    kind: 'tileset' as const,
    sheets: {
      base: {
        url: '/examples-sheet.png',
        grid: { cols: 4, rows: 4, cellWidth: 64, cellHeight: 64 },
        role: 'fill' as const,
        variants: [0, 1, 2, 3],
      },
    },
    // The projected game tiles carry no metadata.biome, so the tileset source keys
    // on the placement assetId (hex_grass, hex_water, hex_road_A, …). Map each base
    // hex assetId this example's board produces to the single fill sheet.
    biomes: {
      hex_grass: { sheet: 'base', select: 'hash' as const },
      hex_grass_bottom: { sheet: 'base', select: 'hash' as const },
      hex_grass_sloped_high: { sheet: 'base', select: 'hash' as const },
      hex_water: { sheet: 'base', select: 'first' as const },
      hex_coast_A: { sheet: 'base', select: 'first' as const },
      hex_road_A: { sheet: 'base', select: 'first' as const },
      hex_road_C: { sheet: 'base', select: 'first' as const },
      hex_road_E: { sheet: 'base', select: 'first' as const },
      hex_road_M: { sheet: 'base', select: 'first' as const },
      hex_river_A_curvy_waterless: { sheet: 'base', select: 'first' as const },
      hex_river_C_waterless: { sheet: 'base', select: 'first' as const },
      hex_transition: { sheet: 'base', select: 'first' as const },
    },
  };
}

/**
 * Build the fixed example game's plan (the same board the three example renders).
 * Renderer-free — usable headless to inspect what the 2D board will draw.
 */
export function createCanvas2dExamplePlan(): GameboardPlan {
  return projectWorldToGameboardPlan(createFixedSimpleRpgGame().world);
}

/** The example's tileset source (resolves each placement to a 2D sprite cell). */
export function createCanvas2dExampleSource() {
  return createTilesetSource({ manifest: exampleTilesetManifest() });
}

/**
 * Render the example game onto a 2D canvas context through the canvas-2D binding.
 * The host supplies the loaded sheet image(s); this draws the fixed game board.
 */
export function renderCanvas2dExample(
  ctx: CanvasRenderingContext2D,
  sheets: Canvas2dSheetImages
): Canvas2dSyncResult {
  const plan = createCanvas2dExamplePlan();
  return syncCanvas2dPlacements(ctx, plan.placements, {
    source: createCanvas2dExampleSource(),
    sheets,
  });
}
