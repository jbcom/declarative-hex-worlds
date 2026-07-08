/**
 * `src/cli/commands/init/wizard.ts` — the PURE interactive-authoring logic for the
 * `init` command (RFC 0001 RFC0-CLI authoring path 2: "CLI generates the spec from the
 * scan + heuristics, with interactive terminal prompts to confirm/adjust the suggested
 * bindings").
 *
 * It drives a {@link Prompter} (never a real TTY) over a scan's SUGGESTED
 * `AssetSourceSpec` and lets the human confirm or override, per asset:
 *   - a tile's biome (the heuristic's guess is pre-selected);
 *   - a model/sprite's gameplay category (playable/enemy/npc/… — a suggestion);
 *   - a tileset's atlas grid (cols × rows; the cell size is measured from the PNG via the
 *     injected `measureGrid`, keeping this module free of fs/image-decode).
 *
 * The heuristics are only DEFAULTS — every prompt pre-selects the guess and the developer
 * accepts (enter) or overrides. This is the human half of the dual-audience mandate; the
 * agent half is the non-interactive `bind` command (flags + JSON, same scan core).
 *
 * @module
 */
import {
  type AssetSourceSpec,
  type AssetSpec,
  BIOME_KEYWORDS,
  GAMEPLAY_CATEGORIES,
  type GameplayCategory,
  stripAssetCategory,
} from '../../../asset-source';
import type { MeasuredGrid } from '../_scan-fs';
import type { Prompter } from './prompter';

/** Options for {@link runInitWizard}. */
export interface InitWizardOptions {
  /** The suggested spec from the scan (biomes/categories pre-guessed). */
  readonly spec: AssetSourceSpec;
  /**
   * Measure a tileset's cell grid from a chosen cols×rows by reading the atlas PNG. The
   * command injects this (it reads bytes + calls `readPngDimensions`/`inferTilesetGrid`);
   * returns `undefined` when the PNG can't be measured (missing/oversized/etc.), in which
   * case the wizard keeps the tileset's SUGGESTED (placeholder) grid — which still
   * validates — and flags the failure, rather than emitting a zero-size cell that would
   * abort the whole spec write.
   */
  readonly measureGrid: (assetPath: string, cols: number, rows: number) => MeasuredGrid | undefined;
}

/** The "keep the heuristic's guess" sentinel value in the biome/category pickers. */
const KEEP = '__keep__';

/**
 * Walk the suggested spec interactively, returning a NEW spec with the human's
 * confirmations/overrides applied. Pure: all IO is via `prompter` + `options.measureGrid`.
 */
export async function runInitWizard(
  prompter: Prompter,
  options: InitWizardOptions
): Promise<AssetSourceSpec> {
  const { spec } = options;
  prompter.note(
    `\nBinding "${spec.name}" — ${spec.assets.length} asset(s). Press enter to accept each suggestion, or pick an override.\n`
  );

  const assets: AssetSpec[] = [];
  for (const asset of spec.assets) {
    assets.push(await refineAsset(prompter, asset, options));
  }
  return { ...spec, assets };
}

/** Apply the human's decision to a single asset, dispatched by role. */
async function refineAsset(
  prompter: Prompter,
  asset: AssetSpec,
  options: InitWizardOptions
): Promise<AssetSpec> {
  if (asset.role === 'tile') {
    const biome = await pickBiome(prompter, asset.id, asset.biome);
    return { ...asset, biome };
  }
  if (asset.role === 'tileset') {
    const grid = await pickTilesetGrid(prompter, asset, options);
    return { ...asset, grid };
  }
  // Only model + sprite remain (tile + tileset returned above) — both carry an optional
  // gameplay category the developer confirms/overrides/clears.
  const category = await pickCategory(prompter, asset.id, asset.category);
  return category === undefined ? stripAssetCategory(asset) : { ...asset, category };
}

/** Prompt for a tile's biome, pre-selecting the heuristic's guess. */
async function pickBiome(prompter: Prompter, id: string, suggested: string): Promise<string> {
  const choices = [
    { value: KEEP, label: `keep "${suggested}"`, hint: 'the suggestion' },
    ...BIOME_KEYWORDS.map((b) => ({ value: b, label: b })),
    { value: 'unknown', label: 'unknown', hint: 'fill in later' },
  ];
  const picked = await prompter.select(`Tile "${id}" biome`, choices, KEEP);
  return picked === KEEP ? suggested : picked;
}

/**
 * Prompt for a model/sprite's gameplay category. `undefined` (no category) is a valid
 * outcome — "none" removes any suggested category; the heuristic's guess is pre-selected.
 */
async function pickCategory(
  prompter: Prompter,
  id: string,
  suggested: GameplayCategory | undefined
): Promise<GameplayCategory | undefined> {
  const keepLabel = suggested ? `keep "${suggested}"` : 'keep (none)';
  const choices: ReadonlyArray<{ value: string; label: string; hint?: string }> = [
    { value: KEEP, label: keepLabel, hint: 'the suggestion' },
    { value: 'none', label: 'none', hint: 'no gameplay category' },
    ...GAMEPLAY_CATEGORIES.map((c) => ({ value: c, label: c })),
  ];
  const picked = await prompter.select(`Model/sprite "${id}" category`, choices, KEEP);
  if (picked === KEEP) {
    return suggested;
  }
  // Every non-KEEP, non-'none' value came from GAMEPLAY_CATEGORIES.
  return picked === 'none' ? undefined : (picked as GameplayCategory);
}

/**
 * Prompt for a tileset's atlas grid: ask cols/rows, measure the cell size from the PNG.
 * A non-positive or non-integer entry re-prompts. When the PNG can't be measured the
 * tileset keeps its SUGGESTED (placeholder) grid — which still validates — and the
 * failure is surfaced, rather than a zero-size cell that would abort the spec write.
 */
async function pickTilesetGrid(
  prompter: Prompter,
  asset: Extract<AssetSpec, { role: 'tileset' }>,
  options: InitWizardOptions
): Promise<Extract<AssetSpec, { role: 'tileset' }>['grid']> {
  prompter.note(`Tileset "${asset.id}" (${asset.path}) — how many cells across × down?`);
  const cols = await askPositiveInt(prompter, 'Columns', asset.grid.cols);
  const rows = await askPositiveInt(prompter, 'Rows', asset.grid.rows);
  const measured = options.measureGrid(asset.path, cols, rows);
  if (measured) {
    prompter.note(
      `  → ${measured.cols}×${measured.rows} cells of ${measured.cellWidth}×${measured.cellHeight}px`
    );
    return measured;
  }
  prompter.note(
    `  ! Could not measure "${asset.path}" — kept the suggested grid (edit the JSON to fix "${asset.id}").`
  );
  return asset.grid;
}

/** Ask for a positive integer, re-prompting until one is entered (default pre-filled). */
async function askPositiveInt(
  prompter: Prompter,
  label: string,
  fallback: number
): Promise<number> {
  const suggested = fallback > 0 ? String(fallback) : undefined;
  for (;;) {
    const raw = await prompter.text(label, suggested);
    const n = Number(raw);
    if (Number.isInteger(n) && n > 0) {
      return n;
    }
    prompter.note(`  Enter a positive whole number for ${label}.`);
  }
}
