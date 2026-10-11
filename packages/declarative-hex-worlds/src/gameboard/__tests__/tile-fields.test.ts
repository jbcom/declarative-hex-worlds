import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { validateGameboardPlan } from '../../rules/validation';
import {
  assertGameboardTileFields,
  createGameboardBuilder,
  normalizeGameboardTileFields,
  type GameboardPlan,
  type GameboardTileSpec,
} from '../index';

const SHAPE = { kind: 'rectangle', width: 5, height: 5 } as const;

function builder() {
  return createGameboardBuilder({ seed: 'tile-fields', shape: SHAPE });
}

function tileAt(plan: GameboardPlan, key: string): GameboardTileSpec {
  const tile = plan.tiles.find((candidate) => candidate.key === key);
  if (!tile) {
    throw new Error(`missing tile ${key}`);
  }
  return tile;
}

describe('numeric tile fields on the builder', () => {
  it('leaves fields absent on tiles that were never given any', () => {
    expect(
      builder()
        .build()
        .tiles.every((tile) => !('fields' in tile))
    ).toBe(true);
  });

  it('stores named finite numbers, including zero and negatives, with sorted keys', () => {
    const plan = builder()
      .setFields({ q: 1, r: 1 }, { wetness: 0.7, slope: -0.25, soil: 0 })
      .build();
    const fields = tileAt(plan, '1,1').fields;
    expect(fields).toEqual({ slope: -0.25, soil: 0, wetness: 0.7 });
    expect(Object.keys(fields ?? {})).toEqual(['slope', 'soil', 'wetness']);
  });

  it('merges into existing fields by default and replaces on request', () => {
    const merged = builder()
      .setFields({ q: 1, r: 1 }, { slope: 0.1, wetness: 0.2 })
      .setFields({ q: 1, r: 1 }, { wetness: 0.9, soil: 3 })
      .build();
    expect(tileAt(merged, '1,1').fields).toEqual({ slope: 0.1, soil: 3, wetness: 0.9 });

    const replaced = builder()
      .setFields({ q: 1, r: 1 }, { slope: 0.1, wetness: 0.2 })
      .setFields({ q: 1, r: 1 }, { soil: 3 }, { replace: true })
      .build();
    expect(tileAt(replaced, '1,1').fields).toEqual({ soil: 3 });
  });

  it('rejects non-finite values, blank names and non-record input with the library error', () => {
    const at = { q: 1, r: 1 };
    expect(() => builder().setFields(at, { slope: Number.NaN })).toThrow(GameboardValidationError);
    expect(() => builder().setFields(at, { slope: Number.POSITIVE_INFINITY })).toThrow(
      GameboardValidationError
    );
    expect(() => builder().setFields(at, { slope: Number.NEGATIVE_INFINITY })).toThrow(/slope/);
    expect(() => builder().setFields(at, { slope: '1' as unknown as number })).toThrow(
      GameboardValidationError
    );
    expect(() => builder().setFields(at, { '': 1 })).toThrow(GameboardValidationError);
    expect(() => builder().setFields(at, null as unknown as Record<string, number>)).toThrow(
      GameboardValidationError
    );
    expect(() => builder().setFields(at, [1] as unknown as Record<string, number>)).toThrow(
      GameboardValidationError
    );
  });

  it('rejects names that would pollute prototypes', () => {
    const hostile = JSON.parse('{"__proto__": 1}') as Record<string, number>;
    expect(() => builder().setFields({ q: 1, r: 1 }, hostile)).toThrow(GameboardValidationError);
  });

  it('does not change fields when validation fails', () => {
    const b = builder().setFields({ q: 1, r: 1 }, { slope: 0.5 });
    expect(() => b.setFields({ q: 1, r: 1 }, { wetness: 1, bad: Number.NaN })).toThrow(
      GameboardValidationError
    );
    expect(tileAt(b.build(), '1,1').fields).toEqual({ slope: 0.5 });
  });

  it('reports a missing tile', () => {
    expect(() => builder().setFields({ q: 50, r: 50 }, { slope: 1 })).toThrow(/No tile exists/);
  });

  it('survives terrain, tag, elevation and connectivity changes', () => {
    const plan = builder()
      .setFields({ q: 1, r: 1 }, { slope: 0.3 })
      .setFields({ q: 2, r: 1 }, { slope: 0.3 })
      .addRoadPath([
        { q: 1, r: 1 },
        { q: 2, r: 1 },
      ])
      .addRiverPath([
        { q: 2, r: 1 },
        { q: 3, r: 1 },
      ])
      .setElevation({ q: 1, r: 1 }, 2)
      .addHill({ q: 2, r: 1 })
      .build();
    expect(tileAt(plan, '1,1').fields).toEqual({ slope: 0.3 });
    expect(tileAt(plan, '2,1').fields).toEqual({ slope: 0.3 });
  });

  it('is set by setTileAsset when given (replacing), and kept when omitted', () => {
    const plan = builder()
      .setFields({ q: 1, r: 1 }, { slope: 0.3, wetness: 0.4 })
      .setTileAsset({ at: { q: 1, r: 1 }, assetId: 'hex_grass', fields: { soil: 2 } })
      .setFields({ q: 2, r: 1 }, { slope: 0.3 })
      .setTileAsset({ at: { q: 2, r: 1 }, assetId: 'hex_grass', terrain: 'road' })
      .build();
    expect(tileAt(plan, '1,1').fields).toEqual({ soil: 2 });
    expect(tileAt(plan, '2,1').fields).toEqual({ slope: 0.3 });
    expect(() =>
      builder().setTileAsset({
        at: { q: 1, r: 1 },
        assetId: 'hex_grass',
        fields: { a: Number.NaN },
      })
    ).toThrow(GameboardValidationError);
  });

  it('copies caller input and built plans so later edits cannot leak', () => {
    const input = { slope: 0.5 };
    const b = builder().setFields({ q: 1, r: 1 }, input);
    input.slope = 99;
    const first = b.build();
    b.setFields({ q: 1, r: 1 }, { slope: 0.6 });
    expect(tileAt(first, '1,1').fields).toEqual({ slope: 0.5 });
    expect(tileAt(b.build(), '1,1').fields).toEqual({ slope: 0.6 });
  });
});

describe('tile field validators', () => {
  it('rejects non-record containers and accepts null-prototype records', () => {
    class FieldContainer {
      slope = 0.5;
    }
    for (const fields of [
      new Date(),
      new Map([['slope', 0.5]]),
      new Set([1]),
      new FieldContainer(),
    ]) {
      expect(() => assertGameboardTileFields(fields)).toThrow(GameboardValidationError);
    }
    const record = Object.assign(Object.create(null), { slope: 0.5 });
    expect(normalizeGameboardTileFields(record)).toEqual({ slope: 0.5 });
  });

  it('normalize returns a sorted copy and names the tile in errors', () => {
    const source = { b: 2, a: 1 };
    const normalized = normalizeGameboardTileFields(source, '3,4');
    expect(normalized).toEqual({ a: 1, b: 2 });
    expect(Object.keys(normalized)).toEqual(['a', 'b']);
    expect(normalized).not.toBe(source);
    expect(() => normalizeGameboardTileFields({ a: Number.NaN }, '3,4')).toThrow(/3,4/);
    expect(() => assertGameboardTileFields({ a: 1 })).not.toThrow();
    expect(() => assertGameboardTileFields(undefined)).toThrow(GameboardValidationError);
  });
});

describe('plan validation of tile fields', () => {
  it('reports tile.invalid_field for non-finite values and malformed stores from untrusted JSON', () => {
    const plan = builder().build();
    const [first, second, third, ...rest] = plan.tiles as [
      GameboardTileSpec,
      GameboardTileSpec,
      GameboardTileSpec,
      ...GameboardTileSpec[],
    ];
    const tampered: GameboardPlan = {
      ...plan,
      tiles: [
        { ...first, fields: { slope: Number.NaN } },
        { ...second, fields: [1] as unknown as Record<string, number> },
        { ...third, fields: { ok: 1 } },
        ...rest,
      ],
    };
    const violations = validateGameboardPlan(tampered).filter(
      (v) => v.code === 'tile.invalid_field'
    );
    expect(violations.map((v) => v.tileKey)).toEqual([first.key, second.key]);
    expect(violations.every((v) => v.severity === 'error')).toBe(true);
  });
});
