import { describe, expect, it } from 'vitest';
import type { AssetSourceSpec } from '../../../../asset-source';
import type { MeasuredGrid } from '../../_scan-fs';
import { applyWebChoices, buildWebConfigPayload, renderConfigPage } from '../config-page';

function specWith(assets: AssetSourceSpec['assets']): AssetSourceSpec {
  return { specVersion: 1, name: 'p', assetRoot: 'assets', assets } as AssetSourceSpec;
}

/** A stub measurer: derives a fixed 96×83 cell for any chosen cols/rows. */
const measureOk = (_p: string, cols: number, rows: number): MeasuredGrid => ({
  cols,
  rows,
  cellWidth: 96,
  cellHeight: 83,
});

const sample = specWith([
  { id: 't', role: 'tile', format: 'png', path: 'tiles/t.png', biome: 'grass' },
  {
    id: 'sheet',
    role: 'tileset',
    format: 'png',
    path: 'tilesets/sheet.png',
    grid: { cols: 1, rows: 1, cellWidth: 1, cellHeight: 1 },
  },
  { id: 'm', role: 'model', format: 'glb', path: 'models/m.glb', category: 'pc' },
]);

describe('web config-page (RFC0-CLI visual authoring)', () => {
  it('buildWebConfigPayload carries the spec + biome/category vocabularies', () => {
    const payload = buildWebConfigPayload(sample);
    expect(payload.spec).toBe(sample);
    expect(payload.biomes).toContain('grass');
    expect(payload.categories).toContain('enemy');
  });

  it('renderConfigPage embeds the payload + is self-contained (no external URLs)', () => {
    const html = renderConfigPage(buildWebConfigPayload(sample));
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('id="payload"');
    expect(html).toContain('/api/spec');
    // No external stylesheet/script/font/image — CSP-safe.
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('<link');
  });

  it('renderConfigPage escapes the source name (no HTML injection)', () => {
    const injected = specWith([]);
    const html = renderConfigPage(
      buildWebConfigPayload({ ...injected, name: '<script>x</script>' })
    );
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('applyWebChoices overrides a tile biome by id', () => {
    const out = applyWebChoices(sample, [{ id: 't', biome: 'forest' }], measureOk);
    expect((out.assets[0] as { biome: string }).biome).toBe('forest');
  });

  it('applyWebChoices measures a chosen tileset grid from its PNG (never a 0-size cell)', () => {
    // The browser only sends cols/rows; the cell size is MEASURED server-side.
    const out = applyWebChoices(sample, [{ id: 'sheet', grid: { cols: 5, rows: 10 } }], measureOk);
    expect((out.assets[1] as { grid: unknown }).grid).toEqual({
      cols: 5,
      rows: 10,
      cellWidth: 96,
      cellHeight: 83,
    });
  });

  it('applyWebChoices keeps the suggested grid when the PNG cannot be measured', () => {
    // A measurement failure keeps the placeholder grid (still valid), not a 0-size cell.
    const suggested = { cols: 1, rows: 1, cellWidth: 1, cellHeight: 1 };
    const out = applyWebChoices(
      sample,
      [{ id: 'sheet', grid: { cols: 5, rows: 10 } }],
      () => undefined
    );
    expect((out.assets[1] as { grid: unknown }).grid).toEqual(suggested);
  });

  it('applyWebChoices overrides a category, clears it on null, and leaves it on undefined', () => {
    const overridden = applyWebChoices(sample, [{ id: 'm', category: 'enemy' }], measureOk);
    expect((overridden.assets[2] as { category?: string }).category).toBe('enemy');

    const cleared = applyWebChoices(sample, [{ id: 'm', category: null }], measureOk);
    const clearedModel = cleared.assets[2];
    expect(clearedModel && 'category' in clearedModel).toBe(false);

    const unchanged = applyWebChoices(sample, [{ id: 'm' }], measureOk);
    expect((unchanged.assets[2] as { category?: string }).category).toBe('pc');
  });

  it('applyWebChoices leaves an asset with no matching choice as suggested', () => {
    const out = applyWebChoices(sample, [], measureOk);
    expect(out.assets).toEqual(sample.assets);
  });

  it('applyWebChoices clearing a category on a model that has none is a no-op', () => {
    // stripAssetCategory's `'category' in asset` false branch: the model carries no category.
    const noCategory = specWith([
      { id: 'plain', role: 'model', format: 'glb', path: 'models/plain.glb' },
    ]);
    const out = applyWebChoices(noCategory, [{ id: 'plain', category: null }], measureOk);
    const model = out.assets[0];
    expect(model && 'category' in model).toBe(false);
  });

  it('applyWebChoices ignores a tile choice with no biome + a tileset choice with no grid', () => {
    // A tile choice missing `biome` (undefined) leaves the tile; a tileset choice missing
    // `grid` leaves the grid — the role-branch guards fall through to the untouched asset.
    const out = applyWebChoices(sample, [{ id: 't' }, { id: 'sheet' }], measureOk);
    expect((out.assets[0] as { biome: string }).biome).toBe('grass');
    expect((out.assets[1] as { grid: { cols: number } }).grid.cols).toBe(1);
  });

  it('applyWebChoices ignores a role-mismatched field (a biome on a model)', () => {
    // A biome choice keyed to the model id does nothing (model has no biome field).
    const out = applyWebChoices(sample, [{ id: 'm', biome: 'forest' }], measureOk);
    const model = out.assets[2];
    expect(model && 'biome' in model).toBe(false);
    expect((model as { category?: string }).category).toBe('pc');
  });
});
