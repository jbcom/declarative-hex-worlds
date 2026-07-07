/**
 * Cross-maker EXTENSION proof (RFC0-PACKS baked tier): a DIFFERENT asset maker
 * than KayKit — Kenney's Hexagon Kit (CC0) — composes through the SAME library
 * seams. The pack is baked, tracked, into `packages/examples/assets/kenney-hexagon/`;
 * its measured bounds drive pure-TS `normalizeAssetToCell` (size-norm across
 * makers) + `overlayTransform` (a Kenney building placed on a Kenney tile). No
 * browser, no renderer — the normalization/overlay math is renderer-free.
 *
 * Kenney's hexes are FLAT-TOP (2.0 wide × 1.732 deep) — a different orientation
 * AND aspect ratio than KayKit's pointy-top cell (2.0 × 2.3094) — so this is a
 * genuine cross-maker fit, not a same-shape copy.
 */
import {
	type AssetBounds,
	KAYKIT_HEX_DEPTH,
	KAYKIT_HEX_WIDTH,
	normalizeAssetToCell,
	normalizedFootprint,
	overlayTransform,
} from "declarative-hex-worlds";
import { describe, expect, it } from "vitest";

// Measured from packages/examples/assets/kenney-hexagon/ GLB accessor min/max
// (see the pack's License.txt — Kenney Hexagon Kit 2.0, CC0-1.0).
const KENNEY_GRASS_TILE_BOUNDS: AssetBounds = {
	min: [-1, -1, -0.86603],
	max: [1, 1, 0.86603],
	size: [2, 2, 1.73206],
};
const KENNEY_HOUSE_BOUNDS: AssetBounds = {
	min: [-1, -1, -1],
	max: [1, 1, 1],
	size: [2, 2, 2],
};

describe("Kenney Hexagon Kit → KayKit cell (cross-maker size-norm, RFC0-PACKS)", () => {
	it("a Kenney flat-top hex tile normalizes to fit a KayKit cell", () => {
		// `contain` fits the whole footprint inside the KayKit cell (2 × 2.3094).
		const norm = normalizeAssetToCell(KENNEY_GRASS_TILE_BOUNDS, {
			fit: "contain",
		});
		const footprint = normalizedFootprint(KENNEY_GRASS_TILE_BOUNDS, norm);
		// Kenney width (2) already == cell width (2) and is the limiting axis, so the
		// fit is uniform scale 1 and the footprint stays within the cell on both axes.
		expect(footprint.width).toBeLessThanOrEqual(KAYKIT_HEX_WIDTH + 1e-6);
		expect(footprint.depth).toBeLessThanOrEqual(KAYKIT_HEX_DEPTH + 1e-6);
		// The scale is positive and finite (a real fit, not a divide-by-zero).
		expect(norm.scale).toBeGreaterThan(0);
		expect(Number.isFinite(norm.scale)).toBe(true);
	});

	it("scales a differently-proportioned maker up to fill the cell width", () => {
		// A hypothetically-smaller Kenney-style tile (half size) scales UP to the cell.
		const halfTile: AssetBounds = {
			min: [-0.5, -0.5, -0.43301],
			max: [0.5, 0.5, 0.43301],
			size: [1, 1, 0.86603],
		};
		const norm = normalizeAssetToCell(halfTile, { fit: "width" });
		// width fit: scale = cellWidth / assetWidth = 2 / 1 = 2.
		expect(norm.scale).toBeCloseTo(2);
		const footprint = normalizedFootprint(halfTile, norm);
		expect(footprint.width).toBeCloseTo(KAYKIT_HEX_WIDTH);
	});
});

describe("Kenney building overlaid on a Kenney tile (cross-maker overlay, RFC0-PACKS)", () => {
	it("places a normalized Kenney house centered on a tile position", () => {
		const tilePosition = { x: 4, y: 0, z: 6 };
		const norm = normalizeAssetToCell(KENNEY_HOUSE_BOUNDS, {
			fit: "contain",
			rest: true,
		});
		const transform = overlayTransform(tilePosition, norm);
		// Centered on the tile in x/z (default anchor 0.5,0.5 → the tile position).
		expect(transform.position.x).toBeCloseTo(tilePosition.x);
		expect(transform.position.z).toBeCloseTo(tilePosition.z);
		// Rested on the surface: the scaled house sits at/above the tile's y.
		expect(transform.position.y).toBeGreaterThanOrEqual(tilePosition.y - 1e-6);
		expect(transform.scale).toBeGreaterThan(0);
	});

	it("honors an anchor + rotation nudging the overlay off-center", () => {
		const norm = normalizeAssetToCell(KENNEY_HOUSE_BOUNDS, { fit: "contain" });
		const centered = overlayTransform({ x: 0, y: 0, z: 0 }, norm);
		const nudged = overlayTransform({ x: 0, y: 0, z: 0 }, norm, {
			anchor: { x: 1, z: 1 },
			rotationY: Math.PI / 2,
		});
		// A corner anchor moves the object off the tile center.
		expect(nudged.position.x).not.toBeCloseTo(centered.position.x);
		expect(nudged.rotationY).toBeCloseTo(Math.PI / 2);
	});
});
