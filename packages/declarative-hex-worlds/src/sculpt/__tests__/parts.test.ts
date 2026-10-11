import { type Box3, BoxGeometry, BufferGeometry, Float32BufferAttribute, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { ball, box, cone, cyl, disc, lathe, part, plane, ring } from '../parts';

function bounds(geometry: BufferGeometry): Box3 {
  geometry.computeBoundingBox();
  const box3 = geometry.boundingBox;
  if (!box3) {
    throw new Error('geometry has no bounding box');
  }
  return box3;
}

function vertices(geometry: BufferGeometry): Array<[number, number, number]> {
  const position = geometry.getAttribute('position');
  return Array.from({ length: position.count }, (_, i) => [
    position.getX(i),
    position.getY(i),
    position.getZ(i),
  ]);
}

describe('part', () => {
  it('keeps triangle winding aligned with normals when a part is mirrored', () => {
    for (const scale of [[-1, 1, 1], [-1, -1, 1], [-1, -1, -1]] as const) {
      const geometry = box(1, 2, 3, { tone: 'wood', scale }).geometry;
      const positions = geometry.getAttribute('position');
      const normals = geometry.getAttribute('normal');
      for (let i = 0; i < positions.count; i += 3) {
        const a = new Vector3().fromBufferAttribute(positions, i);
        const b = new Vector3().fromBufferAttribute(positions, i + 1);
        const c = new Vector3().fromBufferAttribute(positions, i + 2);
        const face = b.sub(a).cross(c.sub(a)).normalize();
        const normal = new Vector3().fromBufferAttribute(normals, i);
        expect(face.dot(normal)).toBeGreaterThan(0.99);
      }
      geometry.dispose();
    }
  });

  it('rejects malformed transform triples before changing or disposing a source geometry', () => {
    for (const key of ['at', 'rot', 'scale']) {
      for (const value of [[], [0, 0], [0, 0, 0, 0], null]) {
        const source = new BoxGeometry(1, 1, 1);
        const before = Array.from(source.getAttribute('position').array);
        const disposed = vi.fn();
        source.addEventListener('dispose', disposed);
        expect(() => part(source, { tone: 'wood', [key]: value })).toThrow(GameboardValidationError);
        expect(Array.from(source.getAttribute('position').array)).toEqual(before);
        expect(source.getAttribute('uv')).toBeDefined();
        expect(disposed).not.toHaveBeenCalled();
        source.dispose();
      }
    }
  });

  it('defaults to the identity transform, matte finish and unit shade', () => {
    const built = part(new BoxGeometry(2, 4, 6), { tone: 'wood' });
    const size = bounds(built.geometry).getSize(new Vector3());
    expect([size.x, size.y, size.z]).toEqual([2, 4, 6]);
    expect(built.tone).toBe('wood');
    expect(built.finish).toBe('matte');
    expect(built.shade).toBe(1);
  });

  it('keeps the tone, finish and shade it is given', () => {
    const built = part(new BoxGeometry(1, 1, 1), { tone: 'gold', finish: 'metal', shade: 0.4 });
    expect(built.tone).toBe('gold');
    expect(built.finish).toBe('metal');
    expect(built.shade).toBe(0.4);
  });

  it('applies scale, then rotation, then position to every vertex', () => {
    // A 2 m cube scaled (1, 2, 3) is 2 x 4 x 6; a quarter turn about y swaps x and z; then it moves to (1, 2, 3).
    const built = box(2, 2, 2, {
      at: [1, 2, 3],
      rot: [0, Math.PI / 2, 0],
      scale: [1, 2, 3],
      tone: 'wood',
    });
    const b = bounds(built.geometry);
    expect(b.min.x).toBeCloseTo(1 - 3, 5);
    expect(b.max.x).toBeCloseTo(1 + 3, 5);
    expect(b.min.y).toBeCloseTo(2 - 2, 5);
    expect(b.max.y).toBeCloseTo(2 + 2, 5);
    expect(b.min.z).toBeCloseTo(3 - 1, 5);
    expect(b.max.z).toBeCloseTo(3 + 1, 5);
  });

  it('transforms the normals with the vertices', () => {
    // A plane faces +z; turned -90 degrees about x it faces +y.
    const built = plane(1, 1, { rot: [-Math.PI / 2, 0, 0], tone: 'cloth' });
    const normal = built.geometry.getAttribute('normal');
    for (let i = 0; i < normal.count; i++) {
      expect(normal.getX(i)).toBeCloseTo(0, 5);
      expect(normal.getY(i)).toBeCloseTo(1, 5);
      expect(normal.getZ(i)).toBeCloseTo(0, 5);
    }
  });

  it('returns a non-indexed geometry holding only position and normal', () => {
    const source = new BoxGeometry(1, 1, 1);
    expect(source.index).not.toBeNull();
    expect(source.getAttribute('uv')).toBeDefined();
    const built = part(source, { tone: 'wood' });
    expect(built.geometry.index).toBeNull();
    expect(Object.keys(built.geometry.attributes).sort()).toEqual(['normal', 'position']);
  });

  it('disposes an indexed source it replaces', () => {
    const source = new BoxGeometry(1, 1, 1);
    const onDispose = vi.fn();
    source.addEventListener('dispose', onDispose);
    part(source, { tone: 'wood' });
    expect(onDispose).toHaveBeenCalledTimes(1);
  });

  it('keeps an already non-indexed source as the part geometry', () => {
    const source = new BufferGeometry();
    source.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    const onDispose = vi.fn();
    source.addEventListener('dispose', onDispose);
    const built = part(source, { at: [0, 0, 5], tone: 'wood' });
    expect(built.geometry).toBe(source);
    expect(onDispose).not.toHaveBeenCalled();
    expect(vertices(built.geometry)).toEqual([
      [0, 0, 5],
      [1, 0, 5],
      [0, 1, 5],
    ]);
  });

  it('computes flat normals for a source that has none', () => {
    const source = new BufferGeometry();
    source.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    const built = part(source, { tone: 'wood' });
    const normal = built.geometry.getAttribute('normal');
    expect(normal.count).toBe(3);
    expect(normal.getZ(0)).toBeCloseTo(1, 5);
  });

  it('rejects a non-finite position, rotation or scale', () => {
    const make = (o: object) => () => part(new BoxGeometry(1, 1, 1), { tone: 'wood', ...o });
    expect(make({ at: [0, Number.NaN, 0] })).toThrow(GameboardValidationError);
    expect(make({ rot: [0, 0, Number.POSITIVE_INFINITY] })).toThrow(GameboardValidationError);
    expect(make({ scale: [1, Number.NEGATIVE_INFINITY, 1] })).toThrow(GameboardValidationError);
  });

  it('rejects a shade that is negative or not finite', () => {
    expect(() => box(1, 1, 1, { tone: 'wood', shade: -0.1 })).toThrow(GameboardValidationError);
    expect(() => box(1, 1, 1, { tone: 'wood', shade: Number.NaN })).toThrow(
      GameboardValidationError
    );
  });

  it('rejects a geometry without positions', () => {
    expect(() => part(new BufferGeometry(), { tone: 'wood' })).toThrow(GameboardValidationError);
  });

  it('rejects an empty finish name', () => {
    expect(() => box(1, 1, 1, { tone: 'wood', finish: '' })).toThrow(GameboardValidationError);
  });

  it('does not dispose the source when the options are invalid', () => {
    const source = new BoxGeometry(1, 1, 1);
    const onDispose = vi.fn();
    source.addEventListener('dispose', onDispose);
    expect(() => part(source, { tone: 'wood', shade: -1 })).toThrow(GameboardValidationError);
    expect(onDispose).not.toHaveBeenCalled();
  });
});

describe('primitives', () => {
  it('box spans its width, height and depth, centred on the origin', () => {
    const b = bounds(box(2, 3, 4, { tone: 'wood' }).geometry);
    expect([b.min.x, b.max.x]).toEqual([-1, 1]);
    expect([b.min.y, b.max.y]).toEqual([-1.5, 1.5]);
    expect([b.min.z, b.max.z]).toEqual([-2, 2]);
  });

  it('cyl runs from -h/2 to h/2 with the top and bottom radii at the ends', () => {
    const { geometry } = cyl(0.2, 0.5, 2, { tone: 'wood' });
    const b = bounds(geometry);
    expect(b.max.y).toBeCloseTo(1, 5);
    expect(b.min.y).toBeCloseTo(-1, 5);
    for (const [x, y, z] of vertices(geometry)) {
      const radius = Math.hypot(x, z);
      if (y > 0.999) {
        expect(radius).toBeLessThanOrEqual(0.2 + 1e-5);
      }
      if (y < -0.999) {
        expect(radius).toBeLessThanOrEqual(0.5 + 1e-5);
      }
    }
    expect(Math.max(...vertices(geometry).map(([x, , z]) => Math.hypot(x, z)))).toBeCloseTo(0.5, 5);
  });

  it('cyl takes its radial segment count', () => {
    const coarse = cyl(1, 1, 1, { tone: 'wood' }, 3).geometry.getAttribute('position').count;
    const fine = cyl(1, 1, 1, { tone: 'wood' }, 24).geometry.getAttribute('position').count;
    expect(fine).toBeGreaterThan(coarse);
  });

  it('cone has its base radius r and its apex h above the base', () => {
    const { geometry } = cone(0.5, 2, { tone: 'wood' });
    const b = bounds(geometry);
    expect(b.max.y - b.min.y).toBeCloseTo(2, 5);
    expect(Math.max(...vertices(geometry).map(([x, , z]) => Math.hypot(x, z)))).toBeCloseTo(0.5, 5);
  });

  it('ball stays within its radius and reaches it', () => {
    const { geometry } = ball(0.75, { tone: 'wood' });
    const radii = vertices(geometry).map(([x, y, z]) => Math.hypot(x, y, z));
    expect(Math.max(...radii)).toBeCloseTo(0.75, 5);
    expect(Math.min(...radii)).toBeGreaterThan(0.7);
  });

  it('ball floors its latitude rings at four however few segments it has', () => {
    // A non-indexed sphere has 3 vertices for each of w * (2h - 2) triangles; h = max(4, round(0.6 w)).
    const sphereVertices = (w: number, h: number) => 3 * w * (2 * h - 2);
    const tiny = ball(1, { tone: 'wood' }, 3).geometry.getAttribute('position').count;
    const small = ball(1, { tone: 'wood' }, 5).geometry.getAttribute('position').count;
    expect(tiny).toBe(sphereVertices(3, 4));
    expect(small).toBe(sphereVertices(5, 4));
  });

  it('ball adds latitude rings in proportion to its segments once past the floor', () => {
    const fine = ball(1, { tone: 'wood' }, 20).geometry.getAttribute('position').count;
    expect(fine).toBe(3 * 20 * (2 * 12 - 2));
  });

  it('ring is a torus of the ring radius, thickened by the tube', () => {
    const { geometry } = ring(1, 0.1, { tone: 'wood' });
    const b = bounds(geometry);
    expect(b.max.x).toBeCloseTo(1.1, 5);
    // The tube has five facets, so it reaches 0.1 sin(72 degrees) off the ring's plane.
    expect(b.max.z).toBeCloseTo(0.1 * Math.sin((2 * Math.PI) / 5), 5);
  });

  it('plane spans its width and height in the xy plane', () => {
    const b = bounds(plane(2, 6, { tone: 'wood' }).geometry);
    expect([b.min.x, b.max.x, b.min.y, b.max.y, b.min.z, b.max.z]).toEqual([-1, 1, -3, 3, 0, 0]);
  });

  it('disc fills a circle of its radius in the xy plane', () => {
    const { geometry } = disc(0.4, { tone: 'wood' });
    expect(Math.max(...vertices(geometry).map(([x, y]) => Math.hypot(x, y)))).toBeCloseTo(0.4, 5);
    expect(bounds(geometry).max.z).toBe(0);
  });

  it('places a primitive with its options', () => {
    const b = bounds(disc(1, { at: [0, 5, 0], tone: 'wood' }).geometry);
    expect(b.min.y).toBeCloseTo(4, 5);
    expect(b.max.y).toBeCloseTo(6, 5);
  });
});

describe('lathe', () => {
  const profile = [
    [0, 0],
    [0.5, 0.2],
    [0.2, 1],
  ] as const;

  it('turns a [radius, height] profile: every vertex sits at a profile radius and height', () => {
    const { geometry } = lathe(profile, { tone: 'clay' }, 8);
    const radii = new Set(profile.map(([r]) => Math.round(r * 1e4)));
    const heights = new Set(profile.map(([, y]) => Math.round(y * 1e4)));
    for (const [x, y, z] of vertices(geometry)) {
      expect(radii.has(Math.round(Math.hypot(x, z) * 1e4))).toBe(true);
      expect(heights.has(Math.round(y * 1e4))).toBe(true);
    }
    expect(Math.max(...vertices(geometry).map(([x, , z]) => Math.hypot(x, z)))).toBeCloseTo(0.5, 4);
  });

  it('stands on y = 0 and reaches the profile top', () => {
    const b = bounds(lathe(profile, { tone: 'clay' }).geometry);
    expect(b.min.y).toBeCloseTo(0, 5);
    expect(b.max.y).toBeCloseTo(1, 5);
  });

  it('takes its segment count', () => {
    const coarse = lathe(profile, { tone: 'clay' }, 3).geometry.getAttribute('position').count;
    const fine = lathe(profile, { tone: 'clay' }, 16).geometry.getAttribute('position').count;
    expect(fine).toBeGreaterThan(coarse);
  });

  it('rejects a profile with fewer than two points', () => {
    expect(() => lathe([[0.5, 0]], { tone: 'clay' })).toThrow(GameboardValidationError);
    expect(() => lathe([], { tone: 'clay' })).toThrow(GameboardValidationError);
  });

  it('rejects a negative or non-finite profile coordinate', () => {
    expect(() =>
      lathe(
        [
          [-0.1, 0],
          [0.2, 1],
        ],
        { tone: 'clay' }
      )
    ).toThrow(GameboardValidationError);
    expect(() =>
      lathe(
        [
          [0.1, Number.NaN],
          [0.2, 1],
        ],
        { tone: 'clay' }
      )
    ).toThrow(GameboardValidationError);
  });
});

describe('primitive input validation', () => {
  const bad = [Number.NaN, Number.POSITIVE_INFINITY, -1];

  it('rejects a size that is negative or not finite', () => {
    for (const value of bad) {
      expect(() => box(value, 1, 1, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => box(1, value, 1, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => box(1, 1, value, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => cyl(value, 1, 1, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => cyl(1, value, 1, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => cyl(1, 1, value, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => cone(value, 1, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => cone(1, value, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => ball(value, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => ring(value, 0.1, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => ring(1, value, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => plane(value, 1, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => plane(1, value, { tone: 'wood' })).toThrow(GameboardValidationError);
      expect(() => disc(value, { tone: 'wood' })).toThrow(GameboardValidationError);
    }
  });

  it('names the offending argument', () => {
    expect(() => box(1, Number.NaN, 1, { tone: 'wood' })).toThrow(/height/);
    expect(() => ball(-2, { tone: 'wood' })).toThrow(/radius/);
  });

  it('rejects a segment count that is not an integer of at least three', () => {
    for (const seg of [2, 3.5, Number.NaN]) {
      expect(() => cyl(1, 1, 1, { tone: 'wood' }, seg)).toThrow(GameboardValidationError);
      expect(() => cone(1, 1, { tone: 'wood' }, seg)).toThrow(GameboardValidationError);
      expect(() => ball(1, { tone: 'wood' }, seg)).toThrow(GameboardValidationError);
      expect(() => ring(1, 0.1, { tone: 'wood' }, seg)).toThrow(GameboardValidationError);
      expect(() => disc(1, { tone: 'wood' }, seg)).toThrow(GameboardValidationError);
      expect(() =>
        lathe(
          [
            [0, 0],
            [1, 1],
          ],
          { tone: 'wood' },
          seg
        )
      ).toThrow(GameboardValidationError);
    }
  });

  it('accepts a zero radius (a cone apex, a point)', () => {
    expect(() => cyl(0, 1, 1, { tone: 'wood' })).not.toThrow();
  });
});
