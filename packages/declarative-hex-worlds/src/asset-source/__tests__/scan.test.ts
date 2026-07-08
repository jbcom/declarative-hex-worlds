import { describe, expect, it } from 'vitest';
import { assetIdFromPath, buildAssetSourceSpec, guessTileBiome, scanAssetFiles } from '../scan';
import { safeParseAssetSourceSpec } from '../spec';

describe('asset-directory scan → AssetSourceSpec (RFC0-CLI)', () => {
  describe('assetIdFromPath', () => {
    it('is the extensionless basename, slug-safe', () => {
      expect(assetIdFromPath('models/knight.glb')).toBe('knight');
      expect(assetIdFromPath('tiles/hex grass (A).png')).toBe('hex_grass_A_');
      // No extension in the basename → the whole basename is the stem.
      expect(assetIdFromPath('models/README')).toBe('README');
      // A dotfile (leading dot, no stem) → empty id (the scanner skips these).
      expect(assetIdFromPath('models/.glb')).toBe('');
    });
  });

  describe('scanAssetFiles', () => {
    it('infers role from the top dir + format from the extension', () => {
      const { assets } = scanAssetFiles([
        { path: 'tiles/hex_grass.png' },
        { path: 'tiles/hex_hill.glb' },
        { path: 'models/knight.glb' },
        { path: 'sprites/coin.png' },
      ]);
      // scanAssetFiles returns the raw classification (role/format/id/path); biome is
      // added by buildAssetSourceSpec.
      expect(assets).toEqual([
        { id: 'hex_grass', role: 'tile', format: 'png', path: 'tiles/hex_grass.png' },
        { id: 'hex_hill', role: 'tile', format: 'glb', path: 'tiles/hex_hill.glb' },
        { id: 'knight', role: 'model', format: 'glb', path: 'models/knight.glb' },
        { id: 'coin', role: 'sprite', format: 'png', path: 'sprites/coin.png' },
      ]);
    });

    it('skips unknown dirs, unsupported extensions, extensionless files, and role/format mismatches', () => {
      const { assets, skipped } = scanAssetFiles([
        { path: 'audio/theme.mp3' }, // unknown dir
        { path: 'tiles/readme.txt' }, // unsupported extension
        { path: 'models/LICENSE' }, // no extension at all
        { path: 'models/tile.png' }, // model role can't be png
        { path: 'models/ok.glb' }, // valid
      ]);
      expect(assets.map((a) => a.id)).toEqual(['ok']);
      expect(skipped).toEqual([
        'audio/theme.mp3',
        'tiles/readme.txt',
        'models/LICENSE',
        'models/tile.png',
      ]);
    });

    it('skips files under a dir named after an Object.prototype member (no proto lookup crash)', () => {
      // `DIR_ROLE['constructor']` on a plain object would return the inherited
      // Object constructor (truthy) and crash on ROLE_FORMATS[role].includes;
      // with Maps these are clean misses → the file is skipped, not a throw.
      const { assets, skipped } = scanAssetFiles([
        { path: 'constructor/thing.glb' },
        { path: 'toString/x.png' },
        { path: 'models/knight.glb' },
      ]);
      expect(assets.map((a) => a.id)).toEqual(['knight']);
      expect(skipped).toEqual(['constructor/thing.glb', 'toString/x.png']);
    });

    it('skips a dotfile with no stem (empty id would fail the spec schema)', () => {
      // `models/.glb` → extname '.glb' (valid model format) but stem '' → empty id.
      const { assets, skipped } = scanAssetFiles([
        { path: 'models/.glb' },
        { path: 'models/real.glb' },
      ]);
      expect(assets.map((a) => a.id)).toEqual(['real']);
      expect(skipped).toEqual(['models/.glb']);
    });

    it('flags tilesets as needing grid dimensions', () => {
      const { tilesetsNeedingGrid } = scanAssetFiles([{ path: 'tilesets/grassland.png' }]);
      expect(tilesetsNeedingGrid).toEqual(['grassland']);
    });

    it('flags tiles whose biome could not be guessed', () => {
      const { tilesNeedingBiome } = scanAssetFiles([
        { path: 'tiles/hex_grass.png' }, // grass keyword → not flagged
        { path: 'tiles/mystery_A.png' }, // no keyword → flagged
      ]);
      expect(tilesNeedingBiome).toEqual(['mystery_A']);
    });

    it('de-duplicates colliding ids (same basename in different subpaths)', () => {
      const { assets } = scanAssetFiles([
        { path: 'models/a/knight.glb' },
        { path: 'models/b/knight.glb' },
      ]);
      expect(assets.map((a) => a.id)).toEqual(['knight', 'knight_2']);
    });

    it('normalizes backslashes + leading ./', () => {
      const { assets } = scanAssetFiles([{ path: '.\\tiles\\hex_grass.png' }]);
      expect(assets[0]?.path).toBe('tiles/hex_grass.png');
    });
  });

  describe('guessTileBiome', () => {
    it('matches a known biome keyword in the filename, else unknown', () => {
      expect(guessTileBiome('tiles/hex_grass_A.png')).toBe('grass');
      expect(guessTileBiome('tiles/deep_water.glb')).toBe('water');
      // A keyword late in the list — forces iteration past the earlier non-matches.
      expect(guessTileBiome('tiles/murky_swamp.png')).toBe('swamp');
      expect(guessTileBiome('tiles/xyz.png')).toBe('unknown');
    });
  });

  describe('buildAssetSourceSpec', () => {
    it('produces a spec that validates against the schema', () => {
      const { spec } = buildAssetSourceSpec(
        [{ path: 'tiles/hex_grass.png' }, { path: 'models/knight.glb' }],
        { name: 'my-pack', assetRoot: 'public/assets' }
      );
      expect(spec.name).toBe('my-pack');
      expect(safeParseAssetSourceSpec(spec).success).toBe(true);
    });

    it('gives tilesets a placeholder grid (or the supplied one) so the spec stays valid', () => {
      const { spec } = buildAssetSourceSpec([{ path: 'tilesets/grassland.png' }], {
        name: 'p',
        assetRoot: 'assets',
        tilesetGrid: { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 },
      });
      expect(safeParseAssetSourceSpec(spec).success).toBe(true);
      const tileset = spec.assets.find((a) => a.role === 'tileset');
      expect(tileset && 'grid' in tileset && tileset.grid).toEqual({
        cols: 5,
        rows: 10,
        cellWidth: 96,
        cellHeight: 83,
      });
    });

    it('uses a per-tileset resolved grid over the fallback', () => {
      const { spec } = buildAssetSourceSpec([{ path: 'tilesets/grassland.png' }], {
        name: 'p',
        assetRoot: 'assets',
        tilesetGrid: { cols: 1, rows: 1, cellWidth: 1, cellHeight: 1 }, // fallback
        // The CLI supplies this (reading + measuring the PNG); here a stub.
        resolveTilesetGrid: (asset) =>
          asset.id === 'grassland'
            ? { cols: 5, rows: 10, cellWidth: 96, cellHeight: 83 }
            : undefined,
      });
      const tileset = spec.assets.find((a) => a.role === 'tileset');
      expect(tileset && 'grid' in tileset && tileset.grid).toEqual({
        cols: 5,
        rows: 10,
        cellWidth: 96,
        cellHeight: 83,
      });
    });

    it('falls back to the placeholder grid when the resolver returns undefined', () => {
      const { spec } = buildAssetSourceSpec([{ path: 'tilesets/grassland.png' }], {
        name: 'p',
        assetRoot: 'assets',
        resolveTilesetGrid: () => undefined,
      });
      const tileset = spec.assets.find((a) => a.role === 'tileset');
      expect(tileset && 'grid' in tileset && tileset.grid).toEqual({
        cols: 1,
        rows: 1,
        cellWidth: 1,
        cellHeight: 1,
      });
    });
  });
});
