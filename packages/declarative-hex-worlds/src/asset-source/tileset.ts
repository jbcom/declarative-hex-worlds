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

import type { GameboardPlacementSpec } from '../gameboard';
import type { AssetRenderRequest, AssetSource, CellRect, HexDims, ResolveContext } from './source';
import type { TilesetGrid, TilesetManifest, TilesetSheet } from './tileset-manifest';

/** Options for a tileset source. */
export interface TilesetSourceOptions {
  /** The validated tileset manifest to resolve against. */
  manifest: TilesetManifest;
  /**
   * The rendered hex's world-space footprint. Defaults to a unit hex scaled to
   * the sheet cell's aspect ratio (width 1, height = cellHeight/cellWidth).
   */
  hex?: HexDims;
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

  const hexDimsForSheet = (grid: TilesetGrid): HexDims =>
    options.hex ?? { width: 1, height: grid.cellHeight / grid.cellWidth };

  const sheetUrl = (sheet: TilesetSheet, ctx?: ResolveContext): string => {
    if (ctx?.baseUrl === undefined) {
      return sheet.url;
    }
    return new URL(sheet.url, ctx.baseUrl).toString();
  };

  const requestForCell = (
    sheet: TilesetSheet,
    cellIndex: number,
    ctx?: ResolveContext
  ): AssetRenderRequest => ({
    type: 'tileset-cell',
    dimension: '2d',
    sheetUrl: sheetUrl(sheet, ctx),
    cell: cellRect(sheet.grid, cellIndex),
    hex: hexDimsForSheet(sheet.grid),
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
      return requestForCell(sheet, cellIndex as number, ctx);
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
