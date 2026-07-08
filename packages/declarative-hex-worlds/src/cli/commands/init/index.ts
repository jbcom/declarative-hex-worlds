/**
 * `init` CLI command (RFC 0001 RFC0-CLI, authoring path 2 — the INTERACTIVE half).
 *
 * The human-facing companion to `bind`: point it at an assets directory and it walks you
 * through confirming/overriding the scanned bindings (tile biomes, model/sprite gameplay
 * categories, tileset atlas grids) with terminal prompts, then writes a Zod-validated
 * `AssetSourceSpec`. Where `bind` is the agent path (flags in, JSON out, no questions),
 * `init` is the developer path (a blocking wizard).
 *
 * It requires an interactive TTY. In a non-interactive context (a pipe, CI, an agent) it
 * refuses and points at `bind` — the correct tool there. Both commands share the same pure
 * scan/build core (`scanAssetFiles`/`buildAssetSourceSpec`), so the two audiences converge
 * on one validated spec shape.
 *
 * Flags:
 *   --dir <path>    (required) the assets root to scan.
 *   --name <name>   source name (default: the dir's basename).
 *   --asset-root <p> assetRoot recorded in the spec (default: the scanned --dir).
 *   --out <path>    write the JSON here (default: `<name>.assets.json` in the cwd).
 *
 * @module
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import {
  buildAssetSourceSpec,
  inferTilesetGrid,
  readPngDimensions,
  safeParseAssetSourceSpec,
} from '../../../asset-source';
import { GameboardCliError } from '../../../errors';
import type { PackEdition } from '../../../types';
import { type ParsedArgs, safeResolveOutput } from '../../_shared';
import { createReadlinePrompter, type Prompter } from './prompter';
import { type MeasuredGrid, runInitWizard } from './wizard';

/** Recursively collect every file path under `root`, relative to `root` (forward slashes). */
function collectFiles(root: string, current: string = root): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const full = join(current, entry.name);
    // Symlinks are skipped (see bind.ts) so the walk can't cycle or escape the root.
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
 * Run the interactive init flow against an already-constructed `Prompter`. Split from the
 * TTY-guarded entrypoint so tests can drive it with a scripted prompter. Returns the
 * validated JSON string; throws {@link GameboardCliError} on a bad `--dir` or an
 * invalid resulting spec.
 */
export async function runInitWith(prompter: Prompter, parsed: ParsedArgs): Promise<string> {
  const dirFlag = parsed.flags.dir;
  if (typeof dirFlag !== 'string' || dirFlag.length === 0) {
    throw new GameboardCliError('init requires --dir <assets path>');
  }
  const dir = resolve(String(dirFlag));
  const name = typeof parsed.flags.name === 'string' ? parsed.flags.name : basename(dir);
  const assetRoot =
    typeof parsed.flags['asset-root'] === 'string' ? String(parsed.flags['asset-root']) : dir;

  const files = collectFiles(dir).map((path) => ({ path }));
  // The wizard overwrites each tileset grid interactively; the initial build just needs a
  // valid placeholder so the suggested spec type-checks for the walk.
  const { spec } = buildAssetSourceSpec(files, { name, assetRoot });

  // Injected measurer: read the atlas PNG + derive the exact cell size for the human's
  // chosen cols/rows (keeps the pure wizard free of fs/image-decode).
  const measureGrid = (assetPath: string, cols: number, rows: number): MeasuredGrid | undefined => {
    try {
      const bytes = readFileSync(join(dir, assetPath));
      return inferTilesetGrid(readPngDimensions(bytes), cols, rows);
    } catch {
      return undefined;
    }
  };

  const refined = await runInitWizard(prompter, { spec, measureGrid });

  const validation = safeParseAssetSourceSpec(refined);
  if (!validation.success) {
    /* v8 ignore next -- a failed parse always carries ≥1 issue; the ?? is defensive. */
    const firstIssue = validation.error.issues[0]?.message ?? 'unknown';
    throw new GameboardCliError(
      `The spec did not validate after your choices. First issue: ${firstIssue}`
    );
  }
  return `${JSON.stringify(refined, null, 2)}\n`;
}

/** CLI entrypoint — TTY-gate, build the readline prompter, run the wizard, write the spec. */
export async function run(
  parsed: ParsedArgs,
  _sourceRoot: string,
  _edition: PackEdition
): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new GameboardCliError(
      'init is interactive and needs a TTY. In a non-interactive context (a pipe, CI, an agent), use `bind` — it takes the same --dir/--cols/--rows flags and emits the spec without prompting.'
    );
  }

  const prompter = createReadlinePrompter();
  let json: string;
  try {
    json = await runInitWith(prompter, parsed);
  } finally {
    prompter.close();
  }

  const name =
    typeof parsed.flags.name === 'string'
      ? parsed.flags.name
      : basename(resolve(String(parsed.flags.dir)));
  const outFlag = typeof parsed.flags.out === 'string' ? parsed.flags.out : `${name}.assets.json`;
  const outPath = safeResolveOutput(outFlag);
  writeFileSync(outPath, json, 'utf8');
  console.log(`\nWrote AssetSourceSpec to ${outPath}`);
}
