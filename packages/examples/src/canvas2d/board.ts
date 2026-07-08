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

import { projectWorldToGameboardPlan } from "declarative-hex-worlds";
import { createTilesetSource } from "declarative-hex-worlds/asset-source";
import {
	type Canvas2dSheetImages,
	type Canvas2dSyncResult,
	syncCanvas2dPlacements,
} from "declarative-hex-worlds/canvas2d";
import type { GameboardPlan } from "declarative-hex-worlds/gameboard";
import { createFixedSimpleRpgGame } from "../game/quest-game";

/** Public URL root for the baked Kenney 2D hexagon tiles (served from examples assets). */
export const CANVAS2D_EXAMPLE_TILE_ROOT = "/assets/2d-hexagon/tiles";

/** The example's per-terrain sheet names (each a baked Kenney hex tile). */
export const CANVAS2D_EXAMPLE_TILE_NAMES = [
	"grass",
	"water",
	"sand",
	"dirt",
	"stone",
] as const;

/**
 * Every sheet URL the example manifest references, in a stable order. A host that
 * can't serve the baked PNGs (e.g. the docs-site island, which draws a procedural
 * sheet so it needs zero downloaded art) maps each of these to its own image.
 */
export const CANVAS2D_EXAMPLE_SHEET_URLS: readonly string[] =
	CANVAS2D_EXAMPLE_TILE_NAMES.map(
		(name) => `${CANVAS2D_EXAMPLE_TILE_ROOT}/${name}.png`,
	);

/**
 * The example tileset manifest, backed by the REAL Kenney 2DLowPoly Hexagon Pack
 * (CC0). This is the 2D binding's asset story: a 2D canvas cannot consume the
 * library's 3D GLB defaults, so the 2D/2.5D examples bake 2D SPRITES from a
 * separate CC0 source (see the repo's RFC0-ASSETS-BINDING-SPLIT decision). The
 * tileset schema maps a biome → a sheet, so each terrain is its own single-cell
 * sheet (a baked 120×140 Kenney hex PNG); each base hex assetId the board
 * produces maps to the matching terrain sheet.
 */
function exampleTilesetManifest() {
	const tile = (name: string) => ({
		url: `${CANVAS2D_EXAMPLE_TILE_ROOT}/${name}.png`,
		grid: { cols: 1, rows: 1, cellWidth: 120, cellHeight: 140 },
		role: "fill" as const,
		variants: [0],
	});
	return {
		schemaVersion: "1",
		kind: "tileset" as const,
		sheets: Object.fromEntries(
			CANVAS2D_EXAMPLE_TILE_NAMES.map((name) => [name, tile(name)]),
		),
		// The projected game tiles carry no metadata.biome, so the tileset source keys
		// on the placement assetId (hex_grass, hex_water, hex_road_A, …). Map each base
		// hex assetId this example's board produces to the matching terrain sheet.
		biomes: {
			hex_grass: { sheet: "grass", select: "first" as const },
			hex_grass_bottom: { sheet: "grass", select: "first" as const },
			hex_grass_sloped_high: { sheet: "grass", select: "first" as const },
			hex_water: { sheet: "water", select: "first" as const },
			hex_coast_A: { sheet: "sand", select: "first" as const },
			hex_road_A: { sheet: "dirt", select: "first" as const },
			hex_road_C: { sheet: "dirt", select: "first" as const },
			hex_road_E: { sheet: "dirt", select: "first" as const },
			hex_road_M: { sheet: "dirt", select: "first" as const },
			hex_river_A_curvy_waterless: { sheet: "water", select: "first" as const },
			hex_river_C_waterless: { sheet: "water", select: "first" as const },
			hex_transition: { sheet: "stone", select: "first" as const },
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
	sheets: Canvas2dSheetImages,
): Canvas2dSyncResult {
	const plan = createCanvas2dExamplePlan();
	return syncCanvas2dPlacements(ctx, plan.placements, {
		source: createCanvas2dExampleSource(),
		sheets,
	});
}
