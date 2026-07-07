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
 *   --out <path>       write the JSON here (default: print to stdout).
 *
 * @module
 */
import { readdirSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { buildAssetSourceSpec, safeParseAssetSourceSpec } from '../../asset-source';
import { GameboardCliError } from '../../errors';
import type { PackEdition } from '../../types';
import { type ParsedArgs, safeResolveOutput } from '../_shared';

/** Recursively collect every file path under `root`, relative to `root` (forward slashes). */
function collectFiles(root: string, current: string = root): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const full = join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(root, full));
    } else {
      // Regular files (and, harmlessly, any other non-dir entry) become scan candidates;
      // scanAssetFiles filters anything without a recognized role/extension.
      files.push(relative(root, full).replace(/\\/g, '/'));
    }
  }
  return files;
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

  const files = collectFiles(dir).map((path) => ({ path }));
  const { spec, scan } = buildAssetSourceSpec(files, { name, assetRoot });

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
