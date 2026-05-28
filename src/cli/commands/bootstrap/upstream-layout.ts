/**
 * Typed description of the KayKit Medieval Hexagon Pack upstream layouts.
 *
 * @remarks
 * The library bootstraps assets at install time by mirroring the upstream
 * GitHub source tree (or a user-supplied zip with identical layout) into the
 * consumer's asset root. Both editions share the same shape: a top-level pack
 * directory containing `Assets/`, `Textures/`, `Samples/`, marker files
 * (`License.txt`, `Medieval_Hexagon_UserGuide_v1.pdf`, `contents_*.jpg`), and
 * social `.url` shortcuts. Asset binaries live under `Assets/<format>/...`
 * where format is one of `gltf`, `fbx`, `fbx(unity)`, or `obj`.
 *
 * Only the `gltf` tree is mirrored by the bootstrap step. Source-format dirs
 * (`fbx`, `obj`) are filtered out unless `includeSourceFormats` is set.
 *
 * @module
 */
import {
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
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
}

/**
 * KayKit Medieval Hexagon Pack — FREE edition layout (CC0).
 *
 * Mirrors `https://github.com/KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0`.
 */
export const KAYKIT_MEDIEVAL_FREE_LAYOUT: KayKitUpstreamLayout = {
  editionName: 'free',
  displayName: 'FREE',
  packFolderName: 'KayKit_Medieval_Hexagon_Pack_1.0_FREE',
  relativeGltfRoot: 'Assets/gltf',
  relativeTextureRoot: 'Textures',
  assetCategories: ['buildings', 'decoration', 'tiles'],
  markerFiles: [
    'License.txt',
    'Medieval_Hexagon_UserGuide_v1.pdf',
    'contents_buildings.jpg',
    'contents_nature.jpg',
    'contents_tiles.jpg',
  ],
  expectedGltfCount: 221,
  expectedBinCount: 221,
  textureFiles: ['hexagons_medieval.png'],
} as const;

/**
 * KayKit Medieval Hexagon Pack — EXTRA edition layout (purchased on itch.io).
 *
 * Adds the `units/` category, three seasonal texture variants, and a
 * `contents_units.jpg` + `contents_textures.jpg` marker pair. Otherwise
 * structurally identical to the FREE edition.
 */
export const KAYKIT_MEDIEVAL_EXTRA_LAYOUT: KayKitUpstreamLayout = {
  editionName: 'extra',
  displayName: 'EXTRA',
  packFolderName: 'KayKit_Medieval_Hexagon_Pack_1.0_EXTRA',
  relativeGltfRoot: 'Assets/gltf',
  relativeTextureRoot: 'Textures',
  assetCategories: ['buildings', 'decoration', 'tiles', 'units'],
  markerFiles: [
    'License.txt',
    'Medieval_Hexagon_UserGuide_v1.pdf',
    'contents_buildings.jpg',
    'contents_nature.jpg',
    'contents_tiles.jpg',
    'contents_units.jpg',
    'contents_textures.jpg',
  ],
  expectedGltfCount: 404,
  expectedBinCount: 404,
  textureFiles: [
    'hexagons_medieval.png',
    'hexagons_medieval_Fall.png',
    'hexagons_medieval_Summer.png',
    'hexagons_medieval_Winter.png',
  ],
} as const;

/**
 * All supported KayKit upstream layouts, in declaration order.
 */
export const KAYKIT_UPSTREAM_LAYOUTS: readonly KayKitUpstreamLayout[] = [
  KAYKIT_MEDIEVAL_FREE_LAYOUT,
  KAYKIT_MEDIEVAL_EXTRA_LAYOUT,
] as const;

/**
 * Resolve the canonical layout descriptor for a known pack edition.
 */
export function kayKitLayoutForEdition(edition: PackEdition): KayKitUpstreamLayout {
  return edition === 'free' ? KAYKIT_MEDIEVAL_FREE_LAYOUT : KAYKIT_MEDIEVAL_EXTRA_LAYOUT;
}

/**
 * Inspect a candidate pack root and return its matching layout descriptor.
 *
 * Detection rule: a candidate matches a layout when every {@link
 * KayKitUpstreamLayout.markerFiles} entry is present and the
 * {@link KayKitUpstreamLayout.relativeGltfRoot} directory exists. The EXTRA
 * layout's marker set is a superset of FREE's, so EXTRA is tested first.
 */
export function detectKayKitLayout(rootPath: string): KayKitUpstreamLayout | undefined {
  if (!isDirectory(rootPath)) {
    return undefined;
  }
  const ordered = [KAYKIT_MEDIEVAL_EXTRA_LAYOUT, KAYKIT_MEDIEVAL_FREE_LAYOUT];
  for (const layout of ordered) {
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
  for (const marker of layout.markerFiles) {
    if (!existsSync(join(rootPath, marker))) {
      return false;
    }
  }
  for (const category of layout.assetCategories) {
    if (!isDirectory(join(gltfRoot, category))) {
      return false;
    }
  }
  if (layout.editionName === 'extra' && !isDirectory(join(gltfRoot, 'units'))) {
    return false;
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
