/**
 * `src/asset-source/tileset.ts` — the `tileset` AssetSource (RFC 0001 G2 /
 * RFC0-8).
 *
 * Resolves a placement's biome (or a transition edge mask) to a positional cell
 * on a sheet from a `TilesetManifest`, emitting a `{ type: 'tileset-cell' }`
 * render request the three bridge draws as a textured-hex mesh. This is the pure
 * cell-selection logic — no three/DOM here; the geometry lives in the bridge.
 *
 * See `docs/plans/declarative-render-surface.design.md` §"Tileset manifest" and
 * §"Transition resolution".
 *
 * @module
 */

import { DEFAULT_HEX_GEOMETRY } from '../coordinates';
import type { GameboardPlacementSpec } from '../gameboard';
import type {
  AssetRenderRequest,
  AssetSource,
  AssetTint,
  CellRect,
  HexDims,
  ResolveContext,
} from './source';
import type { TilesetGrid, TilesetManifest, TilesetSheet } from './tileset-manifest';

/**
 * Board hex WIDTH (flat-to-flat, world X) — the default quad's X-extent. The Z-extent
 * is derived per-sheet from the CELL ASPECT, not the regular-hex depth: painterly
 * atlases bake a vertically-foreshortened (isometric) hex into each cell — e.g. the
 * JackleEarth cells are pointy hexes squashed to a 96:83 aspect (wider than a regular
 * hex's 96:110). Sizing the quad's Z from the regular-hex depth (2.3094, taller than
 * wide) squishes that art into diamonds; sizing Z = width · cellHeight/cellWidth
 * matches the baked aspect so the quad shows the hex at its true proportions and
 * neighbours interlock. Data-driven width (DEFAULT_HEX_GEOMETRY, from JSON).
 */
const DEFAULT_TILESET_WIDTH = DEFAULT_HEX_GEOMETRY.width;

/**
 * Quad-overlap factor for the default cell footprint. The cutout hex a painterly
 * atlas paints inside its cell (transparent corners, `alphaTest` discard) is
 * inscribed with a soft/ragged edge, so a quad sized exactly to the grid PITCH
 * leaves hairline gaps at the shared edges. Oversizing the quad to `pitch ×
 * OVERLAP` makes neighbours overlap enough for the opaque bodies to meet, forming
 * continuous terrain. 1.3 closes the gaps for the JackleEarth atlas without the
 * overlap reading as tiles clipping through each other (verified in-app). The grid
 * PITCH itself (tile centres, via `tilesetHexGeometry`) is unchanged — only the
 * drawn quad grows.
 */
const DEFAULT_TILESET_OVERLAP = 1.3;

/**
 * Derive the board PLACEMENT geometry a tileset needs for seamless quad
 * tessellation, from the manifest's cell aspect. Pass the result to
 * `<HexWorld geometry>` (or `projectWorldToGameboardPlan({ geometry })`).
 *
 * Why row spacing must change: a full-cell quad's Z-extent is
 * `height = width · cellHeight/cellWidth` (the baked cell aspect). For pointy-top
 * quads to interlock, adjacent ROWS must be `height/2` apart. `rowSpacingForGeometry`
 * computes `1.5·(depth/2)`, so we invert: `depth = (height/2)/0.75 = (2/3)·height`.
 * The default regular-hex depth (≈2.3094) spreads rows ~3× too far in Z, leaving the
 * blue gaps between tiles. Width + elevationStep stay at the board defaults.
 *
 * Uses the first sheet's grid for the aspect (all sheets in a coherent pack share a
 * cell size); pass a specific `grid` to override.
 */
export function tilesetHexGeometry(
  manifest: TilesetManifest,
  grid?: TilesetGrid
): { width: number; depth: number; elevationStep: number } {
  const sheetGrid = grid ?? Object.values(manifest.sheets)[0]?.grid;
  const width = DEFAULT_TILESET_WIDTH;
  if (!sheetGrid) {
    return {
      width,
      depth: DEFAULT_HEX_GEOMETRY.depth,
      elevationStep: DEFAULT_HEX_GEOMETRY.elevationStep,
    };
  }
  const quadHeight = (width * sheetGrid.cellHeight) / sheetGrid.cellWidth;
  return {
    width,
    depth: (2 / 3) * quadHeight,
    elevationStep: DEFAULT_HEX_GEOMETRY.elevationStep,
  };
}

/** Options for a tileset source. */
export interface TilesetSourceOptions {
  /** The validated tileset manifest to resolve against. */
  manifest: TilesetManifest;
  /**
   * The rendered cell's world-space footprint. Defaults to the board's default hex
   * footprint (`DEFAULT_TILESET_HEX`), which tessellates seamlessly with the default
   * `'quad'` render shape. Override for a non-standard board geometry.
   */
  hex?: HexDims;
  /**
   * How each cell is drawn (see `AssetRenderRequest['shape']`). Defaults to `'quad'`
   * — the seamless path for painterly hex atlases whose cells have transparent
   * corners. Use `'hex'` only for sheets whose cells are opaque edge-to-edge.
   */
  shape?: 'quad' | 'hex';
}

/** The row-major pixel rect of a 0-based cell index within a grid. */
export function cellRect(grid: TilesetGrid, cellIndex: number): CellRect {
  const col = cellIndex % grid.cols;
  const row = Math.floor(cellIndex / grid.cols);
  return {
    x: col * grid.cellWidth,
    y: row * grid.cellHeight,
    width: grid.cellWidth,
    height: grid.cellHeight,
  };
}

/**
 * Deterministic 32-bit hash of a string (FNV-1a). Used to pick a stable fill
 * variant for a tile from its key, so the same tile always renders the same cell
 * across reloads without a seeded RNG facade.
 */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * The per-placement tint + opacity read off flat placement metadata, so a game can
 * drive fog-of-war / season / team shading over a shared atlas from the sim.
 * Metadata is flat (`Record<string, string|number|boolean|null>`), so the tint is
 * carried as three sibling keys:
 *   - `tintR` / `tintG` / `tintB` (channels `[0, 1]`) → `tint` — ONLY when ALL three
 *     are present AND finite numbers (a partial/typo'd tint is ignored, never a
 *     half-applied colour);
 *   - `opacity` (a number) → `opacity` — ONLY when it's a finite number in `[0, 1]`.
 * Anything else is omitted, leaving the request on its default opaque/untinted path.
 */
export function readTintOpacity(metadata: GameboardPlacementSpec['metadata']): {
  tint?: AssetTint;
  opacity?: number;
} {
  const result: { tint?: AssetTint; opacity?: number } = {};
  // Defensive: the type says metadata is always present, but a hand-built/mis-migrated
  // placement could pass null — return the empty result rather than throw on destructure.
  if (!metadata) {
    return result;
  }
  const { tintR, tintG, tintB, opacity } = metadata;
  // A channel is valid only when it's a finite number in the documented `[0, 1]` range —
  // an out-of-range value is a caller bug, not something to silently pass to setRGB.
  const channel = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  if (channel(tintR) && channel(tintG) && channel(tintB)) {
    result.tint = { r: tintR, g: tintG, b: tintB };
  }
  if (typeof opacity === 'number' && Number.isFinite(opacity) && opacity >= 0 && opacity <= 1) {
    result.opacity = opacity;
  }
  return result;
}

/** The biome key a placement represents: assetId, then a metadata biome hint. */
function biomeKeyForPlacement(placement: GameboardPlacementSpec): string {
  const metadataBiome = placement.metadata.biome;
  if (typeof metadataBiome === 'string' && metadataBiome.length > 0) {
    return metadataBiome;
  }
  return placement.assetId;
}

/** Usable fill cell indices for a sheet (explicit variants, or all cells). */
function fillCells(sheet: TilesetSheet): number[] {
  if (sheet.variants && sheet.variants.length > 0) {
    return sheet.variants;
  }
  const count = sheet.grid.cols * sheet.grid.rows;
  return Array.from({ length: count }, (_, i) => i);
}

/**
 * Create a `tileset` AssetSource over a validated manifest. `resolve` maps a
 * placement's biome to a fill cell (by hash of tileKey, or the first variant);
 * `resolveEdge` maps an edge mask to a transition cell via the sheet's edgeCells.
 * Both return `undefined` when the biome/sheet/mask isn't in the manifest.
 */
export function createTilesetSource(options: TilesetSourceOptions): AssetSource {
  const { manifest } = options;
  const shape = options.shape ?? 'quad';

  // The cell's world footprint. Defaults to the board hex WIDTH (flat-to-flat, world
  // X) with the HEIGHT derived from the CELL ASPECT (width · cellHeight/cellWidth) —
  // so a vertically-foreshortened painterly hex renders at its true baked proportions
  // instead of being squished by the regular-hex depth. A full-cell quad at this size
  // tessellates seamlessly on axialToWorld spacing; the old unit-hex fallback was HALF
  // the width and left blue gaps between every tile. Override via `options.hex`.
  const hexDimsForSheet = (grid: TilesetGrid): HexDims => {
    if (options.hex) {
      return options.hex;
    }
    // Oversize the quad past the grid pitch (× OVERLAP) so cutout hexes overlap into
    // seamless terrain; keep the cell's baked aspect (width : height = cellW : cellH).
    const width = DEFAULT_TILESET_WIDTH * DEFAULT_TILESET_OVERLAP;
    return { width, height: (width * grid.cellHeight) / grid.cellWidth };
  };

  const sheetUrl = (sheet: TilesetSheet, ctx?: ResolveContext): string => {
    if (ctx?.baseUrl === undefined) {
      return sheet.url;
    }
    return new URL(sheet.url, ctx.baseUrl).toString();
  };

  const requestForCell = (
    sheet: TilesetSheet,
    cellIndex: number,
    ctx?: ResolveContext,
    // Per-placement shading (fog/season/team). Only `resolve` supplies it (it has the
    // placement); `resolveEdge` has no placement, so its cells stay untinted/opaque.
    shading?: { tint?: AssetTint; opacity?: number }
  ): AssetRenderRequest => ({
    type: 'tileset-cell',
    dimension: '2d',
    shape,
    sheetUrl: sheetUrl(sheet, ctx),
    cell: cellRect(sheet.grid, cellIndex),
    hex: hexDimsForSheet(sheet.grid),
    ...shading,
  });

  return {
    kind: 'tileset',
    resolve(placement, ctx): AssetRenderRequest | undefined {
      const biome = manifest.biomes[biomeKeyForPlacement(placement)];
      if (!biome) {
        return undefined;
      }
      const sheet = manifest.sheets[biome.sheet];
      if (!sheet) {
        return undefined;
      }
      // fillCells always returns ≥1 cell (explicit non-empty variants, or every
      // grid cell as the fallback — the grid dims are positive-validated), so
      // there is no empty-cells branch to guard here.
      const cells = fillCells(sheet);
      const cellIndex =
        biome.select === 'first' ? cells[0] : cells[hashString(placement.tileKey) % cells.length];
      return requestForCell(sheet, cellIndex as number, ctx, readTintOpacity(placement.metadata));
    },
    resolveEdge(assetId, edgeMask, ctx): AssetRenderRequest | undefined {
      const biome = manifest.biomes[assetId];
      if (!biome) {
        return undefined;
      }
      const sheet = manifest.sheets[biome.sheet];
      if (!sheet || sheet.role !== 'transition' || !sheet.edgeCells) {
        return undefined;
      }
      const cellIndex = sheet.edgeCells[String(edgeMask)];
      if (cellIndex === undefined) {
        return undefined;
      }
      return requestForCell(sheet, cellIndex, ctx);
    },
  };
}
