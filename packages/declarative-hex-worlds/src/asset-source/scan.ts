/**
 * `src/asset-source/scan.ts` — heuristic asset-directory → AssetSourceSpec scanning
 * (RFC 0001 RFC0-CLI, core).
 *
 * The pure heuristics behind the `bind` CLI: given a flat list of asset file paths (found
 * under a source root), infer each file's role (from its top-level subdir — the
 * `tiles/`/`models/`/`sprites/`/`tilesets/` convention) and format (from its extension),
 * derive a stable id, and assemble a candidate `AssetSourceSpec`. Files that can't be
 * classified, or tilesets (which need author-supplied grid dims), are reported so the CLI
 * can prompt. Renderer-free; no fs (the CLI supplies the file list).
 *
 * @module
 */
import type { AssetRole, AssetSourceSpec, GameplayCategory } from './spec';

/** A discovered asset file, path relative to the source root (forward slashes). */
export interface ScannedFile {
  readonly path: string;
}

/** A candidate asset record the scanner produced (before spec validation). */
export interface ScannedAsset {
  readonly id: string;
  readonly role: AssetRole;
  readonly format: 'png' | 'glb' | 'gltf';
  readonly path: string;
}

/** The outcome of scanning a file list. */
export interface ScanResult {
  /** Classified assets (tilesets appear here but need a grid before the spec validates). */
  readonly assets: readonly ScannedAsset[];
  /** Paths that could not be classified (unknown subdir or unsupported extension). */
  readonly skipped: readonly string[];
  /** Ids of tileset assets that still need author-supplied grid dimensions. */
  readonly tilesetsNeedingGrid: readonly string[];
  /** Ids of tile assets whose biome was guessed as `'unknown'` (author should fix). */
  readonly tilesNeedingBiome: readonly string[];
}

// These lookups are `Map`s, not plain objects, so a directory or extension
// literally named after an `Object.prototype` member (`constructor`, `toString`,
// …) can't return an inherited value and crash the scan — a `Map` miss is a
// clean `undefined`, letting the file fall through to `skipped`.

/** Top-level subdir → asset role (the source-layout convention). */
const DIR_ROLE = new Map<string, AssetRole>([
  ['tiles', 'tile'],
  ['tilesets', 'tileset'],
  ['sprites', 'sprite'],
  ['models', 'model'],
]);

/** Extension → format. */
const EXT_FORMAT = new Map<string, 'png' | 'glb' | 'gltf'>([
  ['.png', 'png'],
  ['.glb', 'glb'],
  ['.gltf', 'gltf'],
]);

/** Formats each role accepts (mirrors the spec's per-role schema). */
const ROLE_FORMATS = new Map<AssetRole, readonly ('png' | 'glb' | 'gltf')[]>([
  ['tile', ['png', 'glb', 'gltf']],
  ['tileset', ['png']],
  ['sprite', ['png']],
  ['model', ['glb', 'gltf']],
]);

function extname(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot === -1 ? '' : path.slice(dot).toLowerCase();
}

/**
 * Derive a stable asset id from a path: the basename without extension, slug-safe.
 * Returns `''` when the basename has no stem (e.g. a dotfile like `.glb`, whose
 * only `.` starts the name) — the scanner treats an empty id as unclassifiable
 * and routes it to `skipped` rather than emitting an id the spec schema rejects.
 */
export function assetIdFromPath(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  // A leading dot (dot === 0) means the whole name is an extension → no stem.
  const stem = dot <= 0 ? (dot === 0 ? '' : base) : base.slice(0, dot);
  return stem.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

/** Known biome keywords the tile-biome heuristic looks for in a filename. */
const BIOME_KEYWORDS = [
  'grass',
  'water',
  'coast',
  'desert',
  'sand',
  'snow',
  'ice',
  'forest',
  'hill',
  'mountain',
  'rock',
  'road',
  'river',
  'lava',
  'swamp',
] as const;

/**
 * Guess a tile's biome from its filename (e.g. `hex_grass_A` → `grass`). Falls back to
 * `'unknown'` when no keyword matches — the CLI surfaces these for the author to fix.
 */
export function guessTileBiome(path: string): string {
  const lower = path.toLowerCase();
  return BIOME_KEYWORDS.find((biome) => lower.includes(biome)) ?? 'unknown';
}

/**
 * Filename keyword → suggested gameplay category, most-specific first. Downloadable
 * packs use recognizable names (KayKit Adventurers = knight/rogue/mage → `pc`;
 * Skeletons = skeleton/zombie → `enemy`), so a filename heuristic gives useful
 * DEFAULTS the developer can override. Order matters: `skeleton_mage` is an enemy,
 * not a pc, so enemy keywords are checked before the generic character ones.
 */
const CATEGORY_KEYWORDS: ReadonlyArray<readonly [string, GameplayCategory]> = [
  ['skeleton', 'enemy'],
  ['zombie', 'enemy'],
  ['enemy', 'enemy'],
  ['monster', 'enemy'],
  ['goblin', 'enemy'],
  ['orc', 'enemy'],
  ['knight', 'pc'],
  ['rogue', 'pc'],
  ['mage', 'pc'],
  ['barbarian', 'pc'],
  ['warrior', 'pc'],
  ['adventurer', 'pc'],
  ['hero', 'pc'],
  ['villager', 'npc'],
  ['merchant', 'npc'],
  ['npc', 'npc'],
  ['unit', 'unit'],
  ['soldier', 'unit'],
  ['tower', 'structure'],
  ['house', 'structure'],
  ['castle', 'structure'],
  ['building', 'structure'],
  ['wall', 'structure'],
  ['tree', 'prop'],
  ['rock', 'prop'],
  ['bush', 'prop'],
  ['barrel', 'prop'],
  ['crate', 'prop'],
];

/**
 * Guess a model/sprite asset's SUGGESTED gameplay category from its filename, or
 * `undefined` when no keyword matches (an uncategorized model). A default the dev
 * accepts or overrides — never authoritative.
 */
export function guessGameplayCategory(path: string): GameplayCategory | undefined {
  const lower = path.toLowerCase();
  return CATEGORY_KEYWORDS.find(([keyword]) => lower.includes(keyword))?.[1];
}

/**
 * Classify a scanned file list into candidate assets. A file's role comes from its
 * top-level directory; its format from its extension. Files under an unknown directory,
 * with an unsupported extension, or whose extension doesn't fit the role, are skipped.
 */
export function scanAssetFiles(files: readonly ScannedFile[]): ScanResult {
  const assets: ScannedAsset[] = [];
  const skipped: string[] = [];
  const tilesetsNeedingGrid: string[] = [];
  const tilesNeedingBiome: string[] = [];
  const seenIds = new Set<string>();

  for (const file of files) {
    const normalized = file.path.replace(/\\/g, '/').replace(/^\.?\//, '');
    /* v8 ignore next -- split always yields ≥1 element, so [0] is never undefined; defensive. */
    const topDir = normalized.split('/')[0] ?? '';
    const role = DIR_ROLE.get(topDir);
    const format = EXT_FORMAT.get(extname(normalized));
    if (!role || !format || !ROLE_FORMATS.get(role)?.includes(format)) {
      skipped.push(file.path);
      continue;
    }
    // An empty id (dotfile with no stem) can't satisfy the spec's id schema —
    // treat it as unclassifiable rather than emitting an invalid asset.
    const baseId = assetIdFromPath(normalized);
    if (baseId === '') {
      skipped.push(file.path);
      continue;
    }
    // Ensure a unique id (suffix on collision so the spec's uniqueness holds).
    let id = baseId;
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${baseId}_${suffix++}`;
    }
    seenIds.add(id);
    assets.push({ id, role, format, path: normalized });
    if (role === 'tileset') {
      tilesetsNeedingGrid.push(id);
    }
    if (role === 'tile' && guessTileBiome(normalized) === 'unknown') {
      tilesNeedingBiome.push(id);
    }
  }

  return { assets, skipped, tilesetsNeedingGrid, tilesNeedingBiome };
}

/**
 * Build a candidate `AssetSourceSpec` from a scan. Non-tileset assets are emitted as-is;
 * tilesets are given a placeholder grid (the CLI overwrites it with author input — a
 * placeholder keeps the spec shape valid for preview). Returns the spec plus the scan's
 * skipped/needs-grid info so the caller can surface it.
 */
export function buildAssetSourceSpec(
  files: readonly ScannedFile[],
  options: {
    name: string;
    assetRoot: string;
    /** Fallback grid for tilesets when no per-tileset grid is resolved. */
    tilesetGrid?: { cols: number; rows: number; cellWidth: number; cellHeight: number };
    /**
     * Per-tileset grid resolver (the CLI supplies this — it reads the PNG bytes and
     * derives the grid via `readPngDimensions` + `inferTilesetGrid`, keeping this
     * function pure of fs/image-decode). Return `undefined` to fall back to
     * `tilesetGrid`. When BOTH are absent a tileset keeps the placeholder grid and
     * is reported in `scan.tilesetsNeedingGrid` so the author can fix it.
     */
    resolveTilesetGrid?: (
      asset: ScannedAsset
    ) => { cols: number; rows: number; cellWidth: number; cellHeight: number } | undefined;
  }
): { spec: AssetSourceSpec; scan: ScanResult } {
  const scan = scanAssetFiles(files);
  const fallbackGrid = options.tilesetGrid ?? { cols: 1, rows: 1, cellWidth: 1, cellHeight: 1 };
  const assets = scan.assets.map((asset) => {
    if (asset.role === 'tileset') {
      return {
        id: asset.id,
        role: 'tileset' as const,
        format: 'png' as const,
        path: asset.path,
        grid: options.resolveTilesetGrid?.(asset) ?? fallbackGrid,
      };
    }
    if (asset.role === 'tile') {
      return {
        id: asset.id,
        role: 'tile' as const,
        format: asset.format,
        path: asset.path,
        biome: guessTileBiome(asset.path),
      };
    }
    // model + sprite: carry a SUGGESTED gameplay category when the filename hints one.
    const category = guessGameplayCategory(asset.path);
    return {
      id: asset.id,
      role: asset.role,
      format: asset.format,
      path: asset.path,
      ...(category ? { category } : {}),
    };
  });
  const spec = {
    specVersion: 1 as const,
    name: options.name,
    assetRoot: options.assetRoot,
    assets,
  } as AssetSourceSpec;
  return { spec, scan };
}
