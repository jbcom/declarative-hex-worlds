/**
 * Typed description of the KayKit pack upstream layouts (RFC0-10).
 *
 * @remarks
 * The library bootstraps assets at install time by mirroring the upstream
 * GitHub source tree (or a user-supplied zip with identical layout) into the
 * consumer's asset root. Two layout SHAPES are supported:
 *
 * - **Medieval Hexagon** (`detection: 'medieval'`, the default): a top-level pack
 *   directory containing `Assets/`, `Textures/`, `Samples/`, marker files
 *   (`License.txt`, PDFs, `contents_*.jpg`), category subdirs under
 *   `Assets/gltf/` (tiles/buildings/decoration, +units/ for EXTRA), and textures
 *   in a separate `Textures/`. Detected via markers OR the primary texture.
 * - **Character pack** (`detection: 'character'`, via {@link characterPackLayout}):
 *   the Adventurers/Skeletons shape — a flat `Assets/gltf/` with `.gltf`/`.bin`
 *   and textures inline, no category dirs, no edition markers. Detected by the
 *   presence of any `.gltf` under the gltf root.
 *
 * Only the `gltf` tree is mirrored by the bootstrap step. Source-format dirs
 * (`fbx`, `obj`) are filtered out unless `includeSourceFormats` is set.
 *
 * @module
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { UPSTREAM_LAYOUTS } from '../../../config';
import type { PackEdition } from '../../../types';

/**
 * Structural description of a single KayKit Medieval Hexagon pack edition as
 * it appears on disk after extraction.
 */
export interface KayKitUpstreamLayout {
  /** Edition this layout describes. */
  readonly editionName: PackEdition;
  /** Human-readable edition label (e.g. `FREE`, `EXTRA`). */
  readonly displayName: string;
  /** Top-level pack folder name as published by KayKit. */
  readonly packFolderName: string;
  /** Relative path under the pack root where `.gltf` assets live. */
  readonly relativeGltfRoot: string;
  /** Relative path under the pack root where shared `.png` textures live. */
  readonly relativeTextureRoot: string;
  /** Asset category subdirectory names found directly under {@link relativeGltfRoot}. */
  readonly assetCategories: readonly string[];
  /** Files used as markers when detecting which edition a pack root belongs to. */
  readonly markerFiles: readonly string[];
  /** Expected total number of `.gltf` files under {@link relativeGltfRoot}. */
  readonly expectedGltfCount: number;
  /** Expected total number of `.bin` companions under {@link relativeGltfRoot}. */
  readonly expectedBinCount: number;
  /** Texture filenames published with this edition's `Textures/` directory. */
  readonly textureFiles: readonly string[];
  /**
   * Detection strategy (RFC0-10). `'medieval'` (default) uses the marker/texture +
   * required-category rules below — the Medieval Hexagon shape. `'character'`
   * matches a flat `Assets/gltf/` with ≥1 `.gltf` and no category/marker
   * requirements — the KayKit character packs (Adventurers/Skeletons), which ship
   * textures inline in `Assets/gltf/` and carry no edition markers.
   */
  readonly detection?: 'medieval' | 'character';
}

/**
 * KayKit Medieval Hexagon Pack — FREE edition layout (CC0).
 *
 * Mirrors `https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0`.
 * Values are sourced from `src/config/upstream-layouts.json`.
 */
export const KAYKIT_MEDIEVAL_FREE_LAYOUT: KayKitUpstreamLayout = UPSTREAM_LAYOUTS.free;

/**
 * KayKit Medieval Hexagon Pack — EXTRA edition layout (purchased on itch.io).
 *
 * Adds the `units/` category, three seasonal texture variants, and a
 * `contents_units.jpg` + `contents_textures.jpg` marker pair. Otherwise
 * structurally identical to the FREE edition. Sourced from
 * `src/config/upstream-layouts.json`.
 */
export const KAYKIT_MEDIEVAL_EXTRA_LAYOUT: KayKitUpstreamLayout = UPSTREAM_LAYOUTS.extra;

/**
 * All supported KayKit upstream layouts, in declaration order.
 */
export const KAYKIT_UPSTREAM_LAYOUTS: readonly KayKitUpstreamLayout[] = [
  KAYKIT_MEDIEVAL_FREE_LAYOUT,
  KAYKIT_MEDIEVAL_EXTRA_LAYOUT,
] as const;

/**
 * Build an upstream layout for a KayKit CHARACTER pack (Adventurers, Skeletons —
 * RFC0-10). These ship a flat `addons/<packFolderName>/Assets/gltf/` tree with
 * textures inline (no separate `Textures/`), no category subdirs, and no edition
 * markers — so `detection: 'character'` matches on "gltf root exists with ≥1
 * `.gltf`" alone. Counts are 0 (unknown/irrelevant for character packs); the
 * mirror walks the tree recursively regardless.
 */
export function characterPackLayout(packFolderName: string): KayKitUpstreamLayout {
  return {
    editionName: 'free',
    displayName: 'CHARACTER',
    packFolderName,
    relativeGltfRoot: 'Assets/gltf',
    relativeTextureRoot: 'Assets/gltf',
    assetCategories: [],
    markerFiles: [],
    expectedGltfCount: 0,
    expectedBinCount: 0,
    textureFiles: [],
    detection: 'character',
  };
}

/**
 * Resolve the canonical layout descriptor for a known pack edition.
 */
export function kayKitLayoutForEdition(edition: PackEdition): KayKitUpstreamLayout {
  return edition === 'free' ? KAYKIT_MEDIEVAL_FREE_LAYOUT : KAYKIT_MEDIEVAL_EXTRA_LAYOUT;
}

/**
 * Inspect a candidate pack root and return its matching layout descriptor.
 *
 * Detection rule: a candidate matches a layout when the GLTF category
 * directories exist AND at least one of two provenance signals is present:
 *   A) All {@link KayKitUpstreamLayout.markerFiles} exist (itch.io zip).
 *   B) The primary texture file exists under
 *      {@link KayKitUpstreamLayout.relativeTextureRoot} (GitHub archive — omits
 *      `License.txt`, PDFs, and `contents_*.jpg` but includes the texture).
 * EXTRA is tested before FREE (EXTRA categories are a superset of FREE's).
 */
export function detectKayKitLayout(rootPath: string): KayKitUpstreamLayout | undefined {
  return detectLayoutFrom(rootPath, [KAYKIT_MEDIEVAL_EXTRA_LAYOUT, KAYKIT_MEDIEVAL_FREE_LAYOUT]);
}

/**
 * Detect which of the given candidate layouts a pack root matches (RFC0-10).
 * `detectKayKitLayout` is the medieval-hexagon-only default; the pack bootstrap
 * passes its specific target layout (e.g. a character-pack layout) so a
 * non-medieval pack is detected against the right shape.
 */
export function detectLayoutFrom(
  rootPath: string,
  candidates: readonly KayKitUpstreamLayout[]
): KayKitUpstreamLayout | undefined {
  if (!isDirectory(rootPath)) {
    return undefined;
  }
  for (const layout of candidates) {
    if (matchesLayout(rootPath, layout)) {
      return layout;
    }
  }
  return undefined;
}

/**
 * List the texture files that should appear under
 * `<root>/<relativeTextureRoot>` for a given layout. Returns the absolute
 * paths so callers can verify presence + checksum.
 */
export function expectedTexturePaths(
  rootPath: string,
  layout: KayKitUpstreamLayout
): readonly string[] {
  return layout.textureFiles.map((name) => join(rootPath, layout.relativeTextureRoot, name));
}

function matchesLayout(rootPath: string, layout: KayKitUpstreamLayout): boolean {
  const gltfRoot = join(rootPath, layout.relativeGltfRoot);
  if (!isDirectory(gltfRoot)) {
    return false;
  }
  // Character packs (RFC0-10): a flat gltf tree with ≥1 .gltf, no markers or
  // category dirs. Match on the presence of any .gltf under the gltf root.
  if (layout.detection === 'character') {
    return readdirSync(gltfRoot, { withFileTypes: true }).some(
      (entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.gltf')
    );
  }
  // Two verification strategies:
  //   A) itch.io zip — includes all marker files (License.txt, PDFs, etc.)
  //   B) GitHub archive — omits markers but always includes Textures/<textureFile>
  // Accept a root when it passes at least one of the two strategies.
  const allMarkersPresent =
    layout.markerFiles.length > 0 && layout.markerFiles.every((m) => existsSync(join(rootPath, m)));
  const primaryTexturePresent =
    layout.textureFiles.length > 0 &&
    existsSync(join(rootPath, layout.relativeTextureRoot, layout.textureFiles[0] as string));
  if (!allMarkersPresent && !primaryTexturePresent) {
    return false;
  }
  for (const category of layout.assetCategories) {
    if (!isDirectory(join(gltfRoot, category))) {
      return false;
    }
  }
  if (layout.editionName === 'free') {
    const entries = readdirSync(gltfRoot, { withFileTypes: true });
    const hasUnits = entries.some((entry) => entry.isDirectory() && entry.name === 'units');
    if (hasUnits) {
      return false;
    }
  }
  return true;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
