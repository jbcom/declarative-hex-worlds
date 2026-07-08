import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KAYKIT_MEDIEVAL_EXTRA_LAYOUT,
  KAYKIT_MEDIEVAL_FREE_LAYOUT,
  KAYKIT_UPSTREAM_LAYOUTS,
  characterPackLayout,
  detectKayKitLayout,
  detectLayoutFrom,
  expectedTexturePaths,
  kayKitLayoutForEdition,
} from '../upstream-layout';

const FREE_REFERENCE = join(
  process.cwd(),
  'references',
  KAYKIT_MEDIEVAL_FREE_LAYOUT.packFolderName
);
const EXTRA_REFERENCE = join(
  process.cwd(),
  'references',
  KAYKIT_MEDIEVAL_EXTRA_LAYOUT.packFolderName
);

describe('KayKit upstream layouts', () => {
  it('exposes both editions in declaration order', () => {
    expect(KAYKIT_UPSTREAM_LAYOUTS).toHaveLength(2);
    expect(KAYKIT_UPSTREAM_LAYOUTS[0]).toBe(KAYKIT_MEDIEVAL_FREE_LAYOUT);
    expect(KAYKIT_UPSTREAM_LAYOUTS[1]).toBe(KAYKIT_MEDIEVAL_EXTRA_LAYOUT);
  });

  it('resolves the layout for each edition name', () => {
    expect(kayKitLayoutForEdition('free')).toBe(KAYKIT_MEDIEVAL_FREE_LAYOUT);
    expect(kayKitLayoutForEdition('extra')).toBe(KAYKIT_MEDIEVAL_EXTRA_LAYOUT);
  });

  it('pins expected GLTF counts against PRD documented numbers', () => {
    expect(KAYKIT_MEDIEVAL_FREE_LAYOUT.expectedGltfCount).toBe(221);
    expect(KAYKIT_MEDIEVAL_EXTRA_LAYOUT.expectedGltfCount).toBe(404);
  });

  it('expectedTexturePaths returns absolute paths under the texture root', () => {
    const paths = expectedTexturePaths('/tmp/example', KAYKIT_MEDIEVAL_FREE_LAYOUT);
    expect(paths).toEqual(['/tmp/example/Textures/hexagons_medieval.png']);
  });

  it('returns undefined for a non-existent root', () => {
    expect(detectKayKitLayout('/path/that/does/not/exist')).toBeUndefined();
  });

  it('returns undefined for a directory with no KayKit markers', () => {
    const root = mkdtempSync(join(tmpdir(), 'kaykit-layout-empty-'));
    try {
      expect(detectKayKitLayout(root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('detects a synthetic FREE-shape pack root', () => {
    const root = mkdtempSync(join(tmpdir(), 'kaykit-layout-free-'));
    try {
      seedLayout(root, KAYKIT_MEDIEVAL_FREE_LAYOUT);
      const detected = detectKayKitLayout(root);
      expect(detected).toBe(KAYKIT_MEDIEVAL_FREE_LAYOUT);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('detects a synthetic EXTRA-shape pack root by its richer marker set', () => {
    const root = mkdtempSync(join(tmpdir(), 'kaykit-layout-extra-'));
    try {
      seedLayout(root, KAYKIT_MEDIEVAL_EXTRA_LAYOUT);
      const detected = detectKayKitLayout(root);
      expect(detected).toBe(KAYKIT_MEDIEVAL_EXTRA_LAYOUT);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.skipIf(!existsSync(FREE_REFERENCE))(
    'detects the locally extracted FREE reference pack',
    () => {
      expect(detectKayKitLayout(FREE_REFERENCE)).toBe(KAYKIT_MEDIEVAL_FREE_LAYOUT);
    }
  );

  it.skipIf(!existsSync(EXTRA_REFERENCE))(
    'detects the locally extracted EXTRA reference pack',
    () => {
      expect(detectKayKitLayout(EXTRA_REFERENCE)).toBe(KAYKIT_MEDIEVAL_EXTRA_LAYOUT);
    }
  );

  it('returns undefined when a required asset category directory is missing (E0b)', () => {
    // Covers upstream-layout.ts line 170 — asset category dir missing under gltf root.
    const root = mkdtempSync(join(tmpdir(), 'kaykit-missing-category-'));
    try {
      const layout = KAYKIT_MEDIEVAL_FREE_LAYOUT;
      for (const marker of layout.markerFiles) {
        writeFileSync(join(root, marker), 'marker');
      }
      mkdirSync(join(root, layout.relativeGltfRoot), { recursive: true });
      // Intentionally do NOT create any of the asset categories.
      expect(detectKayKitLayout(root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns undefined for a synthetic free root that includes a units/ directory (E0h)', () => {
    // FREE layout must NOT have units/ — detector rejects.
    const root = mkdtempSync(join(tmpdir(), 'medieval-hexagon-fake-free-with-units-'));
    try {
      seedLayout(root, KAYKIT_MEDIEVAL_FREE_LAYOUT);
      rmSync(join(root, KAYKIT_MEDIEVAL_FREE_LAYOUT.relativeTextureRoot), {
        recursive: true,
        force: true,
      });
      const gltfRoot = join(root, KAYKIT_MEDIEVAL_FREE_LAYOUT.relativeGltfRoot);
      // Add the disqualifying units/ directory.
      mkdirSync(join(gltfRoot, 'units'), { recursive: true });
      expect(detectKayKitLayout(root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns undefined for an extra root missing the units/ directory (E0h)', () => {
    // EXTRA layout requires units/ — without it, detection fails.
    const root = mkdtempSync(join(tmpdir(), 'medieval-hexagon-fake-extra-no-units-'));
    try {
      const gltfRoot = join(root, 'Assets', 'gltf');
      mkdirSync(gltfRoot, { recursive: true });
      for (const category of KAYKIT_MEDIEVAL_EXTRA_LAYOUT.assetCategories) {
        if (category !== 'units') {
          mkdirSync(join(gltfRoot, category), { recursive: true });
        }
      }
      // No units/ directory.
      expect(detectKayKitLayout(root)).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('detects a GitHub-archive layout (no marker files, texture present)', () => {
    // The GitHub archive omits License.txt / PDFs / contents_*.jpg but ships
    // the GLTF tree + Textures/hexagons_medieval.png. Detection must succeed.
    const root = mkdtempSync(join(tmpdir(), 'medieval-hexagon-github-archive-'));
    try {
      const gltfRoot = join(root, 'Assets', 'gltf');
      mkdirSync(gltfRoot, { recursive: true });
      for (const category of KAYKIT_MEDIEVAL_FREE_LAYOUT.assetCategories) {
        mkdirSync(join(gltfRoot, category), { recursive: true });
      }
      // Texture file present (as in the real GitHub archive zip).
      const textureDir = join(root, KAYKIT_MEDIEVAL_FREE_LAYOUT.relativeTextureRoot);
      mkdirSync(textureDir, { recursive: true });
      writeFileSync(join(textureDir, KAYKIT_MEDIEVAL_FREE_LAYOUT.textureFiles[0] ?? ''), 'png');
      // No marker files at all.
      for (const marker of KAYKIT_MEDIEVAL_FREE_LAYOUT.markerFiles) {
        expect(existsSync(join(root, marker))).toBe(false);
      }
      expect(detectKayKitLayout(root)).toBe(KAYKIT_MEDIEVAL_FREE_LAYOUT);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('detects a character pack whose Assets/gltf holds a .gltf model', () => {
    const layout = characterPackLayout('kaykit_character_pack_adventures');
    const root = mkdtempSync(join(tmpdir(), 'character-gltf-'));
    try {
      const gltfRoot = join(root, layout.relativeGltfRoot);
      mkdirSync(gltfRoot, { recursive: true });
      writeFileSync(join(gltfRoot, 'sword.gltf'), '{}');
      expect(detectLayoutFrom(root, [layout])).toBe(layout);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('detects a character pack whose Assets/gltf holds a .glb model (bodies)', () => {
    // The character bodies (Knight.glb, …) are .glb — detection must accept .glb
    // in the gltf root, not just .gltf (upstream-layout.ts:206 branch).
    const layout = characterPackLayout('kaykit_character_pack_skeletons');
    const root = mkdtempSync(join(tmpdir(), 'character-glb-'));
    try {
      const gltfRoot = join(root, layout.relativeGltfRoot);
      mkdirSync(gltfRoot, { recursive: true });
      writeFileSync(join(gltfRoot, 'Skeleton_Warrior.glb'), 'glb-bytes');
      expect(detectLayoutFrom(root, [layout])).toBe(layout);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does NOT detect a character pack whose Assets/gltf holds only a non-model file', () => {
    // A gltf root that exists but contains only a stray .txt (no .gltf/.glb) must
    // fail character detection — covers the `false` side of the .glb/.gltf test.
    const layout = characterPackLayout('kaykit_character_pack_adventures');
    const root = mkdtempSync(join(tmpdir(), 'character-empty-'));
    try {
      const gltfRoot = join(root, layout.relativeGltfRoot);
      mkdirSync(gltfRoot, { recursive: true });
      writeFileSync(join(gltfRoot, 'readme.txt'), 'not a model');
      expect(detectLayoutFrom(root, [layout])).toBeUndefined();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

function seedLayout(root: string, layout: typeof KAYKIT_MEDIEVAL_FREE_LAYOUT): void {
  for (const marker of layout.markerFiles) {
    writeFileSync(join(root, marker), 'marker');
  }
  mkdirSync(join(root, layout.relativeGltfRoot), { recursive: true });
  for (const category of layout.assetCategories) {
    mkdirSync(join(root, layout.relativeGltfRoot, category), { recursive: true });
  }
  mkdirSync(join(root, layout.relativeTextureRoot), { recursive: true });
  for (const texture of layout.textureFiles) {
    writeFileSync(join(root, layout.relativeTextureRoot, texture), 'png-bytes');
  }
}
