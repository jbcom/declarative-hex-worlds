import { describe, expect, it } from 'vitest';
import type { AssetSourceSpec } from '../../../../asset-source';
import type { MeasuredGrid } from '../../_scan-fs';
import type { Prompter, PrompterChoice } from '../prompter';
import { runInitWizard } from '../wizard';

/**
 * A scripted `Prompter`: `selects`/`texts`/`confirms` are consumed in order. Each
 * `select` answer is the VALUE to return; each `text` answer the raw string. Records
 * every prompt message for assertions. Throws if the script runs dry (a missing answer
 * is a test bug, not a silent default).
 */
function scripted(script: {
  selects?: string[];
  texts?: string[];
  confirms?: boolean[];
}): Prompter & { notes: string[] } {
  const selects = [...(script.selects ?? [])];
  const texts = [...(script.texts ?? [])];
  const confirms = [...(script.confirms ?? [])];
  const notes: string[] = [];
  return {
    notes,
    note: (m) => {
      notes.push(m);
    },
    text: async (message) => {
      if (texts.length === 0) throw new Error(`no scripted text for: ${message}`);
      return texts.shift() as string;
    },
    confirm: async (message) => {
      if (confirms.length === 0) throw new Error(`no scripted confirm for: ${message}`);
      return confirms.shift() as boolean;
    },
    select: async <T extends string>(
      message: string,
      _choices: ReadonlyArray<PrompterChoice<T>>
    ) => {
      if (selects.length === 0) throw new Error(`no scripted select for: ${message}`);
      return selects.shift() as T;
    },
  };
}

const measureOk = (_p: string, cols: number, rows: number): MeasuredGrid => ({
  cols,
  rows,
  cellWidth: 96,
  cellHeight: 83,
});

function specWith(assets: AssetSourceSpec['assets']): AssetSourceSpec {
  return { specVersion: 1, name: 'p', assetRoot: 'assets', assets } as AssetSourceSpec;
}

describe('runInitWizard (RFC0-CLI interactive authoring)', () => {
  it('keeps a tile biome when the "keep" sentinel is chosen', async () => {
    const spec = specWith([
      { id: 't', role: 'tile', format: 'png', path: 'tiles/t.png', biome: 'grass' },
    ]);
    const p = scripted({ selects: ['__keep__'] });
    const out = await runInitWizard(p, { spec, measureGrid: measureOk });
    expect((out.assets[0] as { biome: string }).biome).toBe('grass');
  });

  it('overrides a tile biome with the chosen value', async () => {
    const spec = specWith([
      { id: 't', role: 'tile', format: 'png', path: 'tiles/t.png', biome: 'unknown' },
    ]);
    const p = scripted({ selects: ['forest'] });
    const out = await runInitWizard(p, { spec, measureGrid: measureOk });
    expect((out.assets[0] as { biome: string }).biome).toBe('forest');
  });

  it('measures a tileset grid from the chosen cols/rows', async () => {
    const spec = specWith([
      {
        id: 'sheet',
        role: 'tileset',
        format: 'png',
        path: 'tilesets/sheet.png',
        grid: { cols: 1, rows: 1, cellWidth: 1, cellHeight: 1 },
      },
    ]);
    const p = scripted({ texts: ['5', '10'] });
    const out = await runInitWizard(p, { spec, measureGrid: measureOk });
    expect((out.assets[0] as { grid: MeasuredGrid }).grid).toEqual({
      cols: 5,
      rows: 10,
      cellWidth: 96,
      cellHeight: 83,
    });
  });

  it('re-prompts for a non-positive cols/rows entry, then accepts a valid one', async () => {
    const spec = specWith([
      {
        id: 'sheet',
        role: 'tileset',
        format: 'png',
        path: 'tilesets/sheet.png',
        grid: { cols: 1, rows: 1, cellWidth: 1, cellHeight: 1 },
      },
    ]);
    // 'x' (NaN) then '0' (non-positive) then '4' for cols; '2' for rows.
    const p = scripted({ texts: ['x', '0', '4', '2'] });
    const out = await runInitWizard(p, { spec, measureGrid: measureOk });
    expect((out.assets[0] as { grid: MeasuredGrid }).grid).toMatchObject({ cols: 4, rows: 2 });
    expect(p.notes.some((n) => n.includes('positive whole number'))).toBe(true);
  });

  it('keeps the SUGGESTED grid (still valid) when the PNG cannot be measured', async () => {
    // A measurement failure must NOT emit a zero-size cell (which fails schema validation
    // and aborts the whole write) — it keeps the placeholder grid + flags the tileset.
    const suggested = { cols: 1, rows: 1, cellWidth: 1, cellHeight: 1 };
    const spec = specWith([
      { id: 'sheet', role: 'tileset', format: 'png', path: 'tilesets/sheet.png', grid: suggested },
    ]);
    const p = scripted({ texts: ['3', '3'] });
    const out = await runInitWizard(p, { spec, measureGrid: () => undefined });
    expect((out.assets[0] as { grid: MeasuredGrid }).grid).toEqual(suggested);
    expect(p.notes.some((n) => n.includes('Could not measure'))).toBe(true);
  });

  it('keeps a model category on "keep", overrides on a category, and strips on "none"', async () => {
    const spec = specWith([
      { id: 'a', role: 'model', format: 'glb', path: 'models/a.glb', category: 'pc' },
      { id: 'b', role: 'model', format: 'glb', path: 'models/b.glb', category: 'pc' },
      { id: 'c', role: 'sprite', format: 'png', path: 'sprites/c.png', category: 'npc' },
    ]);
    const p = scripted({ selects: ['__keep__', 'enemy', 'none'] });
    const out = await runInitWizard(p, { spec, measureGrid: measureOk });
    expect((out.assets[0] as { category?: string }).category).toBe('pc');
    expect((out.assets[1] as { category?: string }).category).toBe('enemy');
    const third = out.assets[2];
    expect(third && 'category' in third).toBe(false);
  });

  it('offers no pre-filled default when a tileset placeholder grid is zero', async () => {
    // A grid of {0,0} → askPositiveInt gets fallback 0 → no suggested pre-fill (the
    // `fallback > 0 ? ... : undefined` false arm). The human types both dims.
    const spec = specWith([
      {
        id: 'sheet',
        role: 'tileset',
        format: 'png',
        path: 'tilesets/sheet.png',
        grid: { cols: 0, rows: 0, cellWidth: 0, cellHeight: 0 },
      },
    ]);
    const p = scripted({ texts: ['6', '4'] });
    const out = await runInitWizard(p, { spec, measureGrid: measureOk });
    expect((out.assets[0] as { grid: MeasuredGrid }).grid).toMatchObject({ cols: 6, rows: 4 });
  });

  it('keeps a model with no suggested category untouched on "keep"', async () => {
    const spec = specWith([{ id: 'a', role: 'model', format: 'glb', path: 'models/a.glb' }]);
    const p = scripted({ selects: ['__keep__'] });
    const out = await runInitWizard(p, { spec, measureGrid: measureOk });
    const first = out.assets[0];
    expect(first && 'category' in first).toBe(false);
  });
});
