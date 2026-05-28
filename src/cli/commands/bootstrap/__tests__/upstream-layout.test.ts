import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  KAYKIT_MEDIEVAL_EXTRA_LAYOUT,
  KAYKIT_MEDIEVAL_FREE_LAYOUT,
  KAYKIT_UPSTREAM_LAYOUTS,
  detectKayKitLayout,
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
      const gltfRoot = join(root, 'Assets', 'gltf');
      mkdirSync(gltfRoot, { recursive: true });
      // Create every required asset category to pass the earlier checks.
      for (const category of KAYKIT_MEDIEVAL_FREE_LAYOUT.assetCategories) {
        mkdirSync(join(gltfRoot, category), { recursive: true });
      }
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
