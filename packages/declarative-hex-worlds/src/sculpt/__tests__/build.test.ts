import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { DEFAULT_FINISHES, buildPiece, type FinishSpec } from '../build';
import { ball, box, part, plane } from '../parts';
import { sheet } from '../sheet';

const palette = {
  wood: '#8a5a2b',
  gold: 0xffcc33,
  lamp: new Color(0.9, 0.7, 0.2),
} as const;

function expected(value: string | number | Color): Color {
  return new Color(value);
}

function colorAt(
  geometry: {
    getAttribute(name: string): {
      getX(i: number): number;
      getY(i: number): number;
      getZ(i: number): number;
    };
  },
  i: number
): [number, number, number] {
  const color = geometry.getAttribute('color');
  return [color.getX(i), color.getY(i), color.getZ(i)];
}

describe('buildPiece', () => {
  it('rejects malformed finish definitions with the sculpt validation error', () => {
    for (const value of [
      null,
      undefined,
      7,
      'finish',
      true,
      [],
      {},
      { gain: 1, shadowed: 'yes' },
    ]) {
      expect(() =>
        buildPiece([], palette, {
          finishes: { foil: value as unknown as FinishSpec },
        })
      ).toThrow(GameboardValidationError);
    }
  });
  it('merges the parts of one finish into one geometry, vertex counts summed', () => {
    const a = box(1, 1, 1, { tone: 'wood' });
    const b = ball(0.5, { at: [2, 0, 0], tone: 'wood' });
    const total =
      a.geometry.getAttribute('position').count + b.geometry.getAttribute('position').count;
    const built = buildPiece([a, b], palette);
    expect([...built.keys()]).toEqual(['matte']);
    const merged = built.get('matte');
    expect(merged?.getAttribute('position').count).toBe(total);
    expect(merged?.getAttribute('normal').count).toBe(total);
    expect(merged?.getAttribute('color').count).toBe(total);
    expect(merged?.index).toBeNull();
  });

  it('makes one geometry per finish, in the order each finish first appears', () => {
    const built = buildPiece(
      [
        box(1, 1, 1, { tone: 'wood' }),
        box(1, 1, 1, { tone: 'gold', finish: 'metal' }),
        box(1, 1, 1, { tone: 'lamp', finish: 'glow' }),
        box(1, 1, 1, { tone: 'wood' }),
      ],
      palette
    );
    expect([...built.keys()]).toEqual(['matte', 'metal', 'glow']);
    expect(built.get('matte')?.getAttribute('position').count).toBe(72);
    expect(built.get('metal')?.getAttribute('position').count).toBe(36);
  });

  it('colours each vertex with the palette tone times the part shade', () => {
    const built = buildPiece([box(1, 1, 1, { tone: 'wood', shade: 0.5 })], palette);
    const wood = expected(palette.wood);
    const geometry = built.get('matte');
    expect(geometry).toBeDefined();
    if (!geometry) {
      return;
    }
    for (let i = 0; i < geometry.getAttribute('color').count; i++) {
      const [r, g, b] = colorAt(geometry, i);
      expect(r).toBeCloseTo(wood.r * 0.5, 5);
      expect(g).toBeCloseTo(wood.g * 0.5, 5);
      expect(b).toBeCloseTo(wood.b * 0.5, 5);
    }
  });

  it('takes any colour representation a palette can hold', () => {
    const built = buildPiece(
      [
        box(1, 1, 1, { tone: 'wood' }),
        box(1, 1, 1, { tone: 'gold', finish: 'metal' }),
        box(1, 1, 1, { tone: 'lamp', finish: 'metal' }),
      ],
      palette
    );
    const metal = built.get('metal');
    const gold = expected(palette.gold);
    const lamp = expected(palette.lamp);
    expect(metal && colorAt(metal, 0)[0]).toBeCloseTo(gold.r, 5);
    expect(metal && colorAt(metal, 36)[0]).toBeCloseTo(lamp.r, 5);
    expect(metal && colorAt(metal, 36)[2]).toBeCloseTo(lamp.b, 5);
  });

  it('leaves the colour unchanged near the ground when not grounded', () => {
    const built = buildPiece([box(1, 1, 1, { at: [0, 0.5, 0], tone: 'wood' })], palette);
    const geometry = built.get('matte');
    const wood = expected(palette.wood);
    const position = geometry?.getAttribute('position');
    for (let i = 0; geometry && position && i < position.count; i++) {
      expect(colorAt(geometry, i)[0]).toBeCloseTo(wood.r, 5);
    }
  });

  it('darkens toward the ground when grounded: 0.62 at y = 0 rising to 1 at 0.5 m', () => {
    const built = buildPiece([box(1, 1, 1, { at: [0, 0.5, 0], tone: 'wood' })], palette, {
      grounded: true,
    });
    const geometry = built.get('matte');
    const position = geometry?.getAttribute('position');
    const wood = expected(palette.wood);
    expect(geometry).toBeDefined();
    const seen = new Set<number>();
    for (let i = 0; geometry && position && i < position.count; i++) {
      const y = position.getY(i);
      const factor = 0.62 + 0.38 * Math.min(1, Math.max(0, y / 0.5));
      expect(colorAt(geometry, i)[0]).toBeCloseTo(wood.r * factor, 5);
      seen.add(Math.round(y * 1000));
    }
    // The box really does reach the foot (y = 0) and past the contact height (y = 1).
    expect(seen.has(0)).toBe(true);
    expect(seen.has(1000)).toBe(true);
  });

  it('clamps the contact factor below the floor of the piece', () => {
    const built = buildPiece([box(1, 1, 1, { at: [0, 0, 0], tone: 'wood' })], palette, {
      grounded: true,
    });
    const geometry = built.get('matte');
    const position = geometry?.getAttribute('position');
    const wood = expected(palette.wood);
    for (let i = 0; geometry && position && i < position.count; i++) {
      if (position.getY(i) < 0) {
        // y = -0.5 is below the ground: the factor floors at 0.62, it does not go lower.
        expect(colorAt(geometry, i)[0]).toBeCloseTo(wood.r * 0.62, 5);
      }
    }
  });

  it('honours a custom contact height and floor', () => {
    const built = buildPiece([box(1, 1, 1, { at: [0, 0.5, 0], tone: 'wood' })], palette, {
      grounded: true,
      contactHeight: 1,
      contactFloor: 0.2,
    });
    const geometry = built.get('matte');
    const position = geometry?.getAttribute('position');
    const wood = expected(palette.wood);
    for (let i = 0; geometry && position && i < position.count; i++) {
      const factor = 0.2 + 0.8 * Math.min(1, Math.max(0, position.getY(i) / 1));
      expect(colorAt(geometry, i)[0]).toBeCloseTo(wood.r * factor, 5);
    }
  });

  it('brightens glow by its gain and never casts the contact shadow on it', () => {
    const built = buildPiece(
      [box(1, 1, 1, { at: [0, 0.5, 0], tone: 'lamp', finish: 'glow' })],
      palette,
      {
        grounded: true,
      }
    );
    const geometry = built.get('glow');
    const lamp = expected(palette.lamp);
    const gain = DEFAULT_FINISHES.glow.gain;
    expect(gain).toBeGreaterThan(1);
    expect(geometry).toBeDefined();
    for (let i = 0; geometry && i < geometry.getAttribute('color').count; i++) {
      expect(colorAt(geometry, i)[0]).toBeCloseTo(lamp.r * gain, 4);
    }
  });

  it('multiplies shade and finish gain together', () => {
    const built = buildPiece([box(1, 1, 1, { tone: 'lamp', finish: 'glow', shade: 0.5 })], palette);
    const geometry = built.get('glow');
    const lamp = expected(palette.lamp);
    expect(geometry && colorAt(geometry, 0)[1]).toBeCloseTo(
      lamp.g * 0.5 * DEFAULT_FINISHES.glow.gain,
      4
    );
  });

  it('lets the consumer add finishes and retune the built-in ones', () => {
    const built = buildPiece(
      [
        box(1, 1, 1, { at: [0, 0.5, 0], tone: 'gold', finish: 'foil' }),
        box(1, 1, 1, { at: [0, 0.5, 0], tone: 'lamp', finish: 'glow' }),
      ],
      palette,
      {
        grounded: true,
        finishes: { foil: { gain: 1.5, shadowed: false }, glow: { gain: 2, shadowed: false } },
      }
    );
    const gold = expected(palette.gold);
    const lamp = expected(palette.lamp);
    const foil = built.get('foil');
    const glow = built.get('glow');
    expect(foil && colorAt(foil, 0)[0]).toBeCloseTo(gold.r * 1.5, 4);
    expect(glow && colorAt(glow, 0)[0]).toBeCloseTo(lamp.r * 2, 4);
  });

  it('a custom finish can opt in to the contact shadow', () => {
    const built = buildPiece([box(1, 1, 1, { tone: 'wood', finish: 'clay' })], palette, {
      grounded: true,
      finishes: { clay: { gain: 1, shadowed: true } },
    });
    const geometry = built.get('clay');
    const position = geometry?.getAttribute('position');
    const wood = expected(palette.wood);
    for (let i = 0; geometry && position && i < position.count; i++) {
      if (position.getY(i) < 0) {
        expect(colorAt(geometry, i)[0]).toBeCloseTo(wood.r * 0.62, 5);
      }
    }
  });

  it('does not change the shared default finish table when options retune a finish', () => {
    const before = { ...DEFAULT_FINISHES.glow };
    buildPiece([box(1, 1, 1, { tone: 'lamp', finish: 'glow' })], palette, {
      finishes: { glow: { gain: 9, shadowed: true } },
    });
    expect(DEFAULT_FINISHES.glow).toEqual(before);
  });

  it('computes each merged geometry its bounding sphere', () => {
    const merged = buildPiece([box(2, 2, 2, { tone: 'wood' })], palette).get('matte');
    expect(merged?.boundingSphere?.radius).toBeGreaterThan(0);
  });

  it('builds a part that came from a sheet, which had no normals of its own', () => {
    const grid = [
      [
        [0, 0, 0],
        [1, 0, 0],
      ],
      [
        [0, 0, 1],
        [1, 0, 1],
      ],
    ] as const;
    const merged = buildPiece(
      [part(sheet(grid), { tone: 'wood' }), plane(1, 1, { tone: 'wood' })],
      palette
    ).get('matte');
    expect(merged?.getAttribute('normal').count).toBe(merged?.getAttribute('position').count);
  });

  it('returns an empty map for no parts', () => {
    expect(buildPiece([], palette).size).toBe(0);
  });

  it('consumes the parts: their geometries are disposed after the merge', () => {
    const a = box(1, 1, 1, { tone: 'wood' });
    const onDispose = vi.fn();
    a.geometry.addEventListener('dispose', onDispose);
    buildPiece([a], palette);
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('is deterministic: building twice gives byte-identical buffers', () => {
    const build = () => {
      const merged = buildPiece(
        [
          box(1, 1, 1, { at: [0, 0.5, 0], tone: 'wood' }),
          ball(0.4, { at: [1, 0.4, 0], tone: 'gold', finish: 'metal' }),
        ],
        palette,
        { grounded: true }
      );
      return [...merged].map(([finish, geometry]) => [
        finish,
        Array.from(geometry.getAttribute('position').array),
        Array.from(geometry.getAttribute('color').array),
      ]);
    };
    expect(build()).toEqual(build());
  });

  it('rejects a tone the palette does not have', () => {
    const parts = [box(1, 1, 1, { tone: 'basalt' })];
    expect(() => buildPiece(parts, palette as never)).toThrow(GameboardValidationError);
    expect(() => buildPiece([box(1, 1, 1, { tone: 'basalt' })], palette as never)).toThrow(
      /basalt/
    );
  });

  it('checks a tone typo at compile time as well as at run time', () => {
    expect(() =>
      buildPiece(
        // @ts-expect-error 'basalt' is not a key of the palette
        [box(1, 1, 1, { tone: 'basalt' })],
        palette
      )
    ).toThrow(GameboardValidationError);
  });

  it('rejects a tone whose palette entry is undefined', () => {
    const broken = { wood: undefined } as unknown as { wood: string };
    expect(() => buildPiece([box(1, 1, 1, { tone: 'wood' })], broken)).toThrow(/wood/);
  });

  it('rejects a tone that only exists on the object prototype', () => {
    for (const tone of ['constructor', 'toString', '__proto__']) {
      expect(() => buildPiece([box(1, 1, 1, { tone })], palette as never)).toThrow(
        GameboardValidationError
      );
    }
  });

  it('rejects a finish with no definition, built in or supplied', () => {
    expect(() => buildPiece([box(1, 1, 1, { tone: 'wood', finish: 'plasma' })], palette)).toThrow(
      /plasma/
    );
    expect(() => buildPiece([box(1, 1, 1, { tone: 'wood', finish: 'plasma' })], palette)).toThrow(
      GameboardValidationError
    );
  });

  it('validates every part before consuming any of them', () => {
    const good = box(1, 1, 1, { tone: 'wood' });
    const onDispose = vi.fn();
    good.geometry.addEventListener('dispose', onDispose);
    expect(() => buildPiece([good, box(1, 1, 1, { tone: 'basalt' })], palette as never)).toThrow(
      GameboardValidationError
    );
    expect(onDispose).not.toHaveBeenCalled();
  });

  it('rejects contact options out of range', () => {
    const run = (options: object) => () =>
      buildPiece([box(1, 1, 1, { tone: 'wood' })], palette, { grounded: true, ...options });
    expect(run({ contactHeight: 0 })).toThrow(GameboardValidationError);
    expect(run({ contactHeight: Number.NaN })).toThrow(GameboardValidationError);
    expect(run({ contactFloor: -0.1 })).toThrow(GameboardValidationError);
    expect(run({ contactFloor: 1.1 })).toThrow(GameboardValidationError);
  });

  it('rejects a finish definition with a negative or non-finite gain', () => {
    const run = (gain: number) => () =>
      buildPiece([box(1, 1, 1, { tone: 'wood' })], palette, {
        finishes: { matte: { gain, shadowed: true } },
      });
    expect(run(-1)).toThrow(GameboardValidationError);
    expect(run(Number.NaN)).toThrow(GameboardValidationError);
  });

  it('rejects a hand-made part whose geometry skipped part()', () => {
    const handMade = (geometry: BufferGeometry) => ({
      geometry,
      tone: 'wood' as const,
      finish: 'matte',
      shade: 1,
    });
    expect(() => buildPiece([handMade(new BoxGeometry(1, 1, 1))], palette)).toThrow(/non-indexed/);

    const noNormal = new BufferGeometry();
    noNormal.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    expect(() => buildPiece([handMade(noNormal)], palette)).toThrow(GameboardValidationError);

    expect(() => buildPiece([handMade(new BufferGeometry())], palette)).toThrow(
      GameboardValidationError
    );
  });

  it('accepts a geometry built outside the kit through part()', () => {
    const merged = buildPiece([part(new BoxGeometry(1, 1, 1), { tone: 'wood' })], palette).get(
      'matte'
    );
    expect(merged?.getAttribute('position').count).toBe(36);
  });
});
