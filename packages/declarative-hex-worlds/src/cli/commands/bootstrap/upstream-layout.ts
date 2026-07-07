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
 *   the Adventurers/Skeletons shape. Verified against the real cloned repos
 *   (2026-07): a character pack ships TWO renderable gltf trees —
 *   `Assets/gltf/` (weapons/shields/accessories, `.gltf`+`.bin`+inline `.png`)
 *   AND `Characters/gltf/` (the character BODIES: `Barbarian.glb`, `Knight.glb`,
 *   `Mage.glb`, `Rogue.glb`, … as self-contained `.glb` with embedded textures,
 *   plus sibling `*_texture.png`). Because a single hardcoded `relativeGltfRoot`
 *   silently DROPPED every character body, a character layout sets
 *   `mirrorAllGltfDirs: true`: the mirror SCANS the pack root and mirrors every
 *   directory that contains a renderable `.gltf`/`.glb`, deriving the shape from
 *   the actual tree rather than a guessed constant. Detected by the presence of
 *   any `.gltf`/`.glb` under {@link relativeGltfRoot}.
 *
 * Renderable trees (`.gltf`/`.glb` + `.bin` + inline `.png`) are mirrored;
 * source-format trees (`fbx`, `fbx(unity)`, `obj`) and `Samples/` are filtered
 * out unless `includeSourceFormats` is set.
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
  /**
   * When `true`, the mirror ignores {@link relativeGltfRoot} as a single source
   * and instead SCANS the pack root for every directory containing a renderable
   * `.gltf`/`.glb`, mirroring each (path preserved relative to the pack root).
   * This is how a character pack captures BOTH `Assets/gltf/` (weapons) and
   * `Characters/gltf/` (bodies) — the layout is derived from the real tree, not a
   * declared constant. Source-format dirs (`fbx`, `obj`, `Samples`) are excluded
   * by extension/name during the walk.
   */
  readonly mirrorAllGltfDirs?: boolean;
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
 * RFC0-10). Verified against the cloned repos: a character pack has TWO
 * renderable gltf trees under `addons/<packFolderName>/` — `Assets/gltf/`
 * (weapons/accessories) and `Characters/gltf/` (the `.glb` character bodies with
 * embedded textures). `detection: 'character'` matches on "the `Assets/gltf`
 * root exists with ≥1 `.gltf`/`.glb`"; `mirrorAllGltfDirs: true` then makes the
 * mirror SCAN for every renderable-gltf directory (so `Characters/gltf/` is
 * captured too — a single hardcoded root dropped the bodies). Counts are 0
 * (irrelevant for character packs); the mirror walks recursively regardless.
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
    mirrorAllGltfDirs: true,
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
  // Character packs (RFC0-10): the Assets/gltf tree with ≥1 renderable model, no
  // markers or category dirs. Match on any .gltf/.glb under the gltf root (the
  // Characters/gltf bodies are captured later by the mirrorAllGltfDirs scan).
  if (layout.detection === 'character') {
    return readdirSync(gltfRoot, { withFileTypes: true }).some((entry) => {
      if (!entry.isFile()) {
        return false;
      }
      const lower = entry.name.toLowerCase();
      return lower.endsWith('.gltf') || lower.endsWith('.glb');
    });
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
