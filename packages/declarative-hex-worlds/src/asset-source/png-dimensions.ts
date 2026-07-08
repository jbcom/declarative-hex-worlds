/**
 * `src/asset-source/png-dimensions.ts` — read a PNG's pixel dimensions from its
 * IHDR chunk, with NO image-decode dependency.
 *
 * A PNG is an 8-byte signature followed by chunks; the first chunk is always IHDR,
 * whose data begins with the 32-bit big-endian width and height. Reading those 8
 * bytes is enough to size a tileset atlas — we don't decode pixels here (the CLI's
 * grid inference layers on top). Keeping this dependency-free preserves the library's
 * agnostic, thin footprint (no `sharp`/`pngjs`).
 *
 * @module
 */

/** The 8-byte PNG file signature. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A PNG's pixel dimensions. */
export interface PngDimensions {
  width: number;
  height: number;
}

/**
 * Read the pixel width + height from a PNG's IHDR chunk. Accepts the raw file bytes
 * (a `Uint8Array`/`Buffer`). Throws if the data isn't a PNG or is too short to hold
 * an IHDR — a caller feeding a non-PNG should fail loudly, not silently mis-size.
 */
export function readPngDimensions(bytes: Uint8Array): PngDimensions {
  // Signature (8) + chunk length (4) + "IHDR" (4) + width (4) + height (4) = 24.
  if (bytes.length < 24) {
    throw new Error('not a PNG: fewer than 24 bytes');
  }
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error('not a PNG: bad signature');
    }
  }
  // Bytes 12–15 are the first chunk's type; it must be IHDR.
  if (
    bytes[12] !== 0x49 || // I
    bytes[13] !== 0x48 || // H
    bytes[14] !== 0x44 || // D
    bytes[15] !== 0x52 // R
  ) {
    throw new Error('not a PNG: first chunk is not IHDR');
  }
  // Big-endian u32 width @16, height @20. A DataView reads them directly — no
  // per-byte `?? 0` fallbacks (whose branches are unreachable given the length
  // check above, and would leave the coverage gate short).
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

/**
 * Infer a tileset grid from the atlas dimensions + a known column/row count. The
 * common case: the author knows the sheet is `cols × rows` cells (the CLI takes
 * `--cols`/`--rows`), and the cell size is the exact integer division of the atlas.
 * Throws if the dimensions don't divide evenly — a mismatch means the cols/rows are
 * wrong and the emitted grid would mis-slice every cell.
 */
export function inferTilesetGrid(
  dimensions: PngDimensions,
  cols: number,
  rows: number
): { cols: number; rows: number; cellWidth: number; cellHeight: number } {
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols <= 0 || rows <= 0) {
    throw new Error(`invalid grid: cols=${cols} rows=${rows} must be positive integers`);
  }
  if (dimensions.width % cols !== 0 || dimensions.height % rows !== 0) {
    throw new Error(
      `atlas ${dimensions.width}×${dimensions.height} does not divide evenly into ${cols}×${rows} cells`
    );
  }
  return {
    cols,
    rows,
    cellWidth: dimensions.width / cols,
    cellHeight: dimensions.height / rows,
  };
}
