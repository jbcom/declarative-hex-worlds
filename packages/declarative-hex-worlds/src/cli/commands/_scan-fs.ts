/**
 * `src/cli/commands/_scan-fs.ts` — the fs bits shared by the three AssetSourceSpec
 * authoring commands (`bind`, `init`, `web`): the recursive asset-directory walk and the
 * per-tileset PNG grid measurer. The scan/build heuristics stay pure in
 * `src/asset-source/scan`; this is the one place the CLI touches the filesystem to feed
 * them, so a change (e.g. the symlink policy) lives in exactly one spot.
 *
 * @module
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { inferTilesetGrid, readPngDimensions } from '../../asset-source';

/** A measured tileset grid — cols/rows chosen by the author, cell size derived from pixels. */
export interface MeasuredGrid {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
}

/**
 * Recursively collect every file path under `root`, relative to `root` (forward slashes).
 * Symlinks are skipped deliberately: `Dirent.isDirectory()` is false for a symlinked dir
 * (Node doesn't follow links for the type flag), so following them would risk cycles and
 * escapes outside the scanned root. An assets tree is expected to be plain files/dirs.
 */
export function collectFiles(root: string, current: string = root): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const full = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...collectFiles(root, full));
    } else {
      files.push(relative(root, full).replace(/\\/g, '/'));
    }
  }
  return files;
}

/**
 * Measure a tileset's cell grid: read the atlas PNG at `<dir>/<assetPath>`, derive the
 * exact cell size for the chosen `cols × rows` (no image decode — just the IHDR chunk).
 * Returns `undefined` when the PNG can't be read/measured (missing, truncated, or not
 * dividing evenly) so callers can fall back rather than emit a bad grid.
 */
export function measureTilesetGrid(
  dir: string,
  assetPath: string,
  cols: number,
  rows: number
): MeasuredGrid | undefined {
  try {
    const bytes = readFileSync(join(dir, assetPath));
    return inferTilesetGrid(readPngDimensions(bytes), cols, rows);
  } catch {
    return undefined;
  }
}
