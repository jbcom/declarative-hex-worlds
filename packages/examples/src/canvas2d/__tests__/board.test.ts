import type { Canvas2dSheetImages } from "declarative-hex-worlds/canvas2d";
import { describe, expect, it } from "vitest";
import {
	CANVAS2D_EXAMPLE_SHEET_URLS,
	createCanvas2dExamplePlan,
	createCanvas2dExampleSource,
	renderCanvas2dExample,
} from "../board";

/** A stub 2D context recording drawImage calls (the binding is DOM-context-agnostic). */
function stubContext(
	width = 800,
	height = 600,
): {
	ctx: CanvasRenderingContext2D;
	drawCount: () => number;
} {
	let calls = 0;
	const ctx = {
		canvas: { width, height },
		drawImage: () => {
			calls += 1;
		},
	} as unknown as CanvasRenderingContext2D;
	return { ctx, drawCount: () => calls };
}

// The example's per-terrain Kenney tile sheets, "loaded" as stub images.
const sheets: Canvas2dSheetImages = new Map(
	CANVAS2D_EXAMPLE_SHEET_URLS.map((url) => [url, {} as CanvasImageSource]),
);

describe("canvas-2D example — the SAME game rendered in 2D", () => {
	it("projects the fixed example game to a plan with placements", () => {
		const plan = createCanvas2dExamplePlan();
		expect(plan.placements.length).toBeGreaterThan(0);
		expect(plan.tiles.length).toBeGreaterThan(0);
	});

	it("resolves base-tile placements to 2D tileset-cell requests through the source", () => {
		const source = createCanvas2dExampleSource();
		const plan = createCanvas2dExamplePlan();
		const baseTiles = plan.placements.filter((p) =>
			p.assetId.startsWith("hex_"),
		);
		const resolvedAs2d = baseTiles
			.map((p) => source.resolve(p))
			.filter((r) => r?.type === "tileset-cell");
		// The tileset source turns base hex tiles into 2D sprite-cell requests.
		expect(resolvedAs2d.length).toBeGreaterThan(0);
	});

	it("draws the game board onto a 2D context through the canvas-2D binding", () => {
		const { ctx, drawCount } = stubContext();
		const result = renderCanvas2dExample(ctx, sheets);
		// The same game that the three example renders in 3D draws here as 2D sprites.
		expect(result.drawn.length).toBeGreaterThan(0);
		expect(drawCount()).toBe(result.drawn.length);
	});
});
