/**
 * `bind` CLI command (RFC 0001 RFC0-CLI).
 *
 * Point it at ANY assets directory → it scans the tree, classifies each file by the
 * `tiles/`/`models/`/`sprites/`/`tilesets/` convention, and emits a Zod-validated
 * `AssetSourceSpec` JSON. Files it can't classify, tilesets missing grid dims, and tiles
 * whose biome it couldn't guess are reported so the author can fix them. The heuristics
 * are the pure `scanAssetFiles`/`buildAssetSourceSpec` (src/asset-source/scan); this
 * command is the fs + flag wrapper.
 *
 * Flags:
 *   --dir <path>       (required) the assets root to scan.
 *   --name <name>      source name (default: the dir's basename).
 *   --asset-root <p>   assetRoot recorded in the spec (default: the scanned --dir).
 *   --cols <n> --rows <n>  tileset atlas cell layout; each tileset PNG is measured
 *                      (readPngDimensions) and its cell size derived, replacing the
 *                      placeholder grid. Omit to leave tilesets needing a grid.
 *   --out <path>       write the JSON here (default: print to stdout).
 *
 * @module
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import {
  buildAssetSourceSpec,
  inferTilesetGrid,
  readPngDimensions,
  type ScannedAsset,
  safeParseAssetSourceSpec,
} from '../../asset-source';
import { GameboardCliError } from '../../errors';
import type { PackEdition } from '../../types';
import { type ParsedArgs, safeResolveOutput } from '../_shared';

/** Recursively collect every file path under `root`, relative to `root` (forward slashes). */
function collectFiles(root: string, current: string = root): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const full = join(current, entry.name);
    // Symlinks are skipped deliberately: `Dirent.isDirectory()` is false for a
    // symlinked dir (Node doesn't follow links for the type flag), so following
    // them would risk cycles and escapes outside the scanned root. An assets
    // tree is expected to be plain files/dirs.
    if (entry.isSymbolicLink()) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...collectFiles(root, full));
    } else {
      // Symlinks were already skipped above; anything else in a real assets tree
      // is a regular file. It becomes a scan candidate — scanAssetFiles filters
      // anything without a recognized role/extension.
      files.push(relative(root, full).replace(/\\/g, '/'));
    }
  }
  return files;
}

/** Read a positive-integer CLI flag, throwing on a present-but-invalid value. */
function readPositiveIntFlag(parsed: ParsedArgs, flag: string): number | undefined {
  const value = parsed.flags[flag];
  if (value === undefined) {
    return undefined;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new GameboardCliError(`--${flag} must be a positive integer (got "${String(value)}")`);
  }
  return n;
}

export function runBind(parsed: ParsedArgs): void {
  const dirFlag = parsed.flags.dir;
  if (typeof dirFlag !== 'string' || dirFlag.length === 0) {
    throw new GameboardCliError('bind requires --dir <assets path>');
  }
  const dir = resolve(String(dirFlag));
  const name = typeof parsed.flags.name === 'string' ? parsed.flags.name : basename(dir);
  const assetRoot =
    typeof parsed.flags['asset-root'] === 'string' ? String(parsed.flags['asset-root']) : dir;

  // Optional atlas grid: the author supplies the cols×rows a sheet tiles into, and
  // we MEASURE each tileset PNG's pixel dimensions (readPngDimensions — no image
  // decode, just the IHDR chunk) to derive the exact cell size. Replaces the
  // placeholder {1,1,1,1} grid. Absent the flags, tilesets keep the placeholder and
  // are reported for the author to fill in.
  const cols = readPositiveIntFlag(parsed, 'cols');
  const rows = readPositiveIntFlag(parsed, 'rows');
  const resolveTilesetGrid =
    cols !== undefined && rows !== undefined
      ? (asset: ScannedAsset) => {
          try {
            const bytes = readFileSync(join(dir, asset.path));
            return inferTilesetGrid(readPngDimensions(bytes), cols, rows);
          } catch (error) {
            console.error(
              `Could not measure tileset "${asset.id}" (${asset.path}): ${error instanceof Error ? error.message : String(error)}`
            );
            return undefined;
          }
        }
      : undefined;

  const files = collectFiles(dir).map((path) => ({ path }));
  const { spec, scan } = buildAssetSourceSpec(files, {
    name,
    assetRoot,
    ...(resolveTilesetGrid ? { resolveTilesetGrid } : {}),
  });

  const validation = safeParseAssetSourceSpec(spec);
  const json = `${JSON.stringify(spec, null, 2)}\n`;

  if (typeof parsed.flags.out === 'string') {
    const outPath = safeResolveOutput(parsed.flags.out);
    writeFileSync(outPath, json, 'utf8');
    console.log(`Wrote AssetSourceSpec "${name}" (${spec.assets.length} assets) to ${outPath}`);
  } else {
    process.stdout.write(json);
  }

  // Report what needs author attention (to stderr so piped JSON stays clean).
  if (scan.skipped.length > 0) {
    console.error(
      `Skipped ${scan.skipped.length} unclassifiable file(s): ${scan.skipped.join(', ')}`
    );
  }
  if (scan.tilesetsNeedingGrid.length > 0) {
    console.error(
      `Tilesets need a grid (placeholder emitted — edit the JSON): ${scan.tilesetsNeedingGrid.join(', ')}`
    );
  }
  if (scan.tilesNeedingBiome.length > 0) {
    console.error(
      `Tiles with an unrecognized biome (set to "unknown" — edit the JSON): ${scan.tilesNeedingBiome.join(', ')}`
    );
  }
  if (!validation.success) {
    /* v8 ignore next -- a failed parse always carries ≥1 issue; the ?? is defensive. */
    const firstIssue = validation.error.issues[0]?.message ?? 'unknown';
    throw new GameboardCliError(
      `The emitted spec did not validate — fix the reported assets. First issue: ${firstIssue}`
    );
  }
}

/** CLI entrypoint — delegates to runBind. */
export function run(parsed: ParsedArgs, _sourceRoot: string, _edition: PackEdition): void {
  runBind(parsed);
}
