import { describe, expect, it } from 'vitest';
import { GameboardValidationError } from '../../errors';
import { composeHeightField } from '../compose';
import {
  carveDrainage,
  type DrainageChannel,
  MAX_DRAINAGE_SAMPLES,
  traceDrainage,
} from '../drainage';
import { createHeightField, fillHeightField, type HeightField, sampleHeight } from '../field';
import { distanceToPolyline, type GroundPoint } from '../geometry2d';

/** A 1-unit grid from a function of column and row. */
function fieldOf(width: number, height: number, fn: (c: number, r: number) => number): HeightField {
  const field = createHeightField({
    bounds: { minX: 0, minZ: 0, maxX: width - 1, maxZ: height - 1 },
    width,
    height,
  });
  fillHeightField(field, (x, z) => fn(x, z));
  return field;
}

/**
 * A valley falling towards row 0 that forks above row 15 into two branches,
 * each collecting its own side slopes.
 */
const forked = fieldOf(41, 41, (c, r) => {
  const spread = Math.max(0, r - 15) * 0.6;
  return 0.3 * r + Math.min(Math.abs(c - (20 - spread)), Math.abs(c - (20 + spread)));
});

const relief = composeHeightField({
  bounds: { minX: 0, minZ: 0, maxX: 1200, maxZ: 900 },
  spacing: 10,
  seed: 'drainage',
  base: 80,
  layers: [
    { kind: 'noise', amplitude: 14, wavelength: 500, octaves: 5 },
    {
      kind: 'ridge',
      line: [
        { x: 600, z: 0 },
        { x: 650, z: 900 },
      ],
      halfWidth: 300,
      height: 25,
    },
  ],
});

function filledAt(field: HeightField, filled: Float32Array, point: GroundPoint): number {
  const column = Math.round((point.x - field.bounds.minX) / 10);
  const row = Math.round((point.z - field.bounds.minZ) / 10);
  return filled[row * field.width + column] as number;
}

describe('traceDrainage', () => {
  it('validates its inputs', () => {
    const tiny = fieldOf(4, 4, (c) => c);
    expect(() => traceDrainage(tiny, { minContributingArea: 0 })).toThrow(
      /minContributingArea must be positive/
    );
    expect(() => traceDrainage(tiny, { minContributingArea: Number.POSITIVE_INFINITY })).toThrow(
      GameboardValidationError
    );
    expect(() => traceDrainage(tiny, { minContributingArea: 1, simplifyTolerance: -1 })).toThrow(
      /simplifyTolerance/
    );
    expect(() => traceDrainage(tiny, { minContributingArea: 1, smoothing: 9 })).toThrow(
      /smoothing/
    );
    const huge = { ...tiny, width: 4097, height: 4097 };
    expect(() => traceDrainage(huge, { minContributingArea: 1 })).toThrow(
      new RegExp(`exceeds ${MAX_DRAINAGE_SAMPLES} samples`)
    );
  });

  it('orders a forked valley: two first-order branches join a second-order stem', () => {
    const drainage = traceDrainage(forked, { minContributingArea: 60, smoothing: 0 });
    const branches = drainage.channels.filter((c) => c.order === 1);
    const stem = drainage.channels.find((c) => c.order === 2);
    expect(stem).toBeDefined();
    const head = (stem as DrainageChannel).points[0] as GroundPoint;
    const feeding = branches.filter((b) => {
      const mouth = b.points.at(-1) as GroundPoint;
      return mouth.x === head.x && mouth.z === head.z;
    });
    expect(feeding).toHaveLength(2);
    // The stem runs down the valley floor to the field's edge.
    expect((stem as DrainageChannel).points.at(-1)).toEqual({ x: 20, z: 0 });
    expect(head.z).toBeGreaterThan(10);
    // Channels come out largest order first.
    expect(drainage.channels[0]?.order).toBe(2);
  });

  it('runs every channel downhill on the filled surface with growing area', () => {
    const drainage = traceDrainage(relief, {
      minContributingArea: 8000,
      simplifyTolerance: 0,
      smoothing: 0,
    });
    expect(drainage.channels.length).toBeGreaterThan(5);
    for (const channel of drainage.channels) {
      expect(channel.points.length).toBe(channel.areas.length);
      expect(channel.points.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < channel.points.length; i += 1) {
        const before = filledAt(relief, drainage.filled, channel.points[i - 1] as GroundPoint);
        const after = filledAt(relief, drainage.filled, channel.points[i] as GroundPoint);
        expect(after).toBeLessThanOrEqual(before);
        expect(channel.areas[i] as number).toBeGreaterThanOrEqual(channel.areas[i - 1] as number);
      }
      expect(channel.areas[0] as number).toBeGreaterThanOrEqual(8000);
    }
  });

  it('keeps main stems whole through smaller confluences and snaps tributaries onto them', () => {
    const drainage = traceDrainage(relief, { minContributingArea: 8000 });
    const top = Math.max(...drainage.channels.map((c) => c.order));
    expect(top).toBeGreaterThanOrEqual(3);
    let joined = 0;
    for (const channel of drainage.channels) {
      const mouth = channel.points.at(-1) as GroundPoint;
      const stems = drainage.channels.filter((c) => c !== channel && c.order > channel.order);
      const onStem = stems.some((s) => distanceToPolyline(mouth, s.points) < 1e-9);
      const onEdge = mouth.x === 0 || mouth.z === 0 || mouth.x === 1200 || mouth.z === 900;
      // Every channel ends exactly on a larger stream, or leaves the field.
      expect(onStem || onEdge).toBe(true);
      if (onStem) joined += 1;
    }
    expect(joined).toBeGreaterThan(drainage.channels.length / 2);
    // A first-order stream joining a third-order one does not split it:
    // some stem receives more than one tributary along its length.
    const stem = drainage.channels.find((c) => c.order === top) as DrainageChannel;
    const tributaries = drainage.channels.filter(
      (c) => c.order < top && distanceToPolyline(c.points.at(-1) as GroundPoint, stem.points) < 1e-9
    );
    expect(tributaries.length).toBeGreaterThanOrEqual(2);
  });

  it('simplifies and smooths away grid stair-steps', () => {
    const raw = traceDrainage(relief, {
      minContributingArea: 8000,
      simplifyTolerance: 0,
      smoothing: 0,
    });
    const shaped = traceDrainage(relief, { minContributingArea: 8000 });
    expect(shaped.channels.length).toBe(raw.channels.length);
    const turns = (channels: readonly DrainageChannel[]) => {
      let sharp = 0;
      for (const { points } of channels) {
        for (let i = 2; i < points.length; i += 1) {
          const a = points[i - 2] as GroundPoint;
          const b = points[i - 1] as GroundPoint;
          const c = points[i] as GroundPoint;
          const ux = b.x - a.x;
          const uz = b.z - a.z;
          const vx = c.x - b.x;
          const vz = c.z - b.z;
          const cos = (ux * vx + uz * vz) / Math.sqrt((ux * ux + uz * uz) * (vx * vx + vz * vz));
          if (cos < Math.cos(Math.PI / 5)) sharp += 1;
        }
      }
      return sharp;
    };
    expect(turns(shaped.channels)).toBeLessThan(turns(raw.channels) / 4);
  });

  it('treats a sample-sized threshold as every sample being stream', () => {
    const drainage = traceDrainage(
      fieldOf(6, 6, (c, r) => c + r * 0.5),
      {
        minContributingArea: 1,
      }
    );
    expect(drainage.accumulation.every((a) => a >= 1)).toBe(true);
    expect(drainage.channels.length).toBeGreaterThan(0);
  });

  it('is deterministic down to the byte', () => {
    const a = traceDrainage(relief, { minContributingArea: 8000 });
    const b = traceDrainage(relief, { minContributingArea: 8000 });
    expect(Buffer.from(a.accumulation.buffer)).toEqual(Buffer.from(b.accumulation.buffer));
    expect(Buffer.from(a.filled.buffer)).toEqual(Buffer.from(b.filled.buffer));
    expect(a.channels).toEqual(b.channels);
    let fingerprint = 0;
    for (const channel of a.channels) {
      for (const point of channel.points)
        fingerprint = (fingerprint * 31 + point.x * 7 + point.z) % 1e9;
    }
    expect(fingerprint).toMatchInlineSnapshot(`454947770.4113159`);
  });
});

describe('carveDrainage', () => {
  const flat = createHeightField({
    bounds: { minX: 0, minZ: 0, maxX: 100, maxZ: 100 },
    width: 101,
    height: 101,
    heights: new Float32Array(101 * 101).fill(10),
  });
  const stream: DrainageChannel = {
    points: [
      { x: 10, z: 50 },
      { x: 90, z: 50 },
    ],
    areas: [100, 500],
    order: 1,
  };

  it('cuts a bed that deepens and widens downstream and leaves the input alone', () => {
    const carved = carveDrainage(flat, [stream], {
      depthFor: (area) => area / 100,
      halfWidthFor: (area) => area / 50,
    });
    expect(flat.heights.every((h) => h === 10)).toBe(true);
    expect(sampleHeight(carved, 10, 50)).toBeCloseTo(9, 6);
    expect(sampleHeight(carved, 90, 50)).toBeCloseTo(5, 6);
    expect(sampleHeight(carved, 50, 50)).toBeCloseTo(7, 6);
    // The bed is 2 wide upstream and 10 wide downstream.
    expect(sampleHeight(carved, 10, 53)).toBe(10);
    expect(sampleHeight(carved, 90, 53)).toBeLessThan(10);
    expect(sampleHeight(carved, 50, 0)).toBe(10);
    // Beyond the ends the cut clamps to the end's width and depth.
    expect(sampleHeight(carved, 9, 50)).toBeLessThan(10);
    expect(sampleHeight(carved, 95, 50)).toBeGreaterThan(5);
  });

  it('takes the deepest cut where beds overlap rather than summing them', () => {
    const options = { depthFor: () => 2, halfWidthFor: () => 6 };
    const once = carveDrainage(flat, [stream], options);
    const twice = carveDrainage(flat, [stream, stream], options);
    expect(twice.heights).toEqual(once.heights);
  });

  it('honours the profile, zero widths and degenerate segments', () => {
    const sharp = carveDrainage(flat, [stream], {
      depthFor: () => 4,
      halfWidthFor: () => 8,
      profile: 'sharp',
    });
    const smooth = carveDrainage(flat, [stream], { depthFor: () => 4, halfWidthFor: () => 8 });
    expect(sampleHeight(sharp, 50, 54)).toBeGreaterThan(sampleHeight(smooth, 50, 54));
    const none = carveDrainage(flat, [stream], { depthFor: () => 4, halfWidthFor: () => 0 });
    expect(none.heights).toEqual(flat.heights);
    // Width growing from zero cuts only where it is positive.
    const wedge = carveDrainage(flat, [stream], {
      depthFor: () => 4,
      halfWidthFor: (area) => (area < 200 ? 0 : 6),
    });
    expect(sampleHeight(wedge, 10, 50)).toBe(10);
    expect(sampleHeight(wedge, 90, 50)).toBe(6);
    const point: DrainageChannel = {
      points: [
        { x: 50, z: 50 },
        { x: 50, z: 50 },
      ],
      areas: [1, 1],
      order: 1,
    };
    const pit = carveDrainage(flat, [point], { depthFor: () => 3, halfWidthFor: () => 5 });
    expect(sampleHeight(pit, 50, 50)).toBe(7);
    expect(sampleHeight(pit, 56, 50)).toBe(10);
  });

  it('rejects bad fields and bad callback results', () => {
    expect(() =>
      carveDrainage({ ...flat, width: 1 }, [stream], { depthFor: () => 1, halfWidthFor: () => 1 })
    ).toThrow(GameboardValidationError);
    expect(() =>
      carveDrainage(flat, [stream], { depthFor: () => -1, halfWidthFor: () => 1 })
    ).toThrow(/depth must be a non-negative number/);
    expect(() =>
      carveDrainage(flat, [stream], { depthFor: () => 1, halfWidthFor: () => Number.NaN })
    ).toThrow(/halfWidth must be a non-negative number/);
  });

  it('feeds traced channels into carved beds that the streams sit in', () => {
    const drainage = traceDrainage(relief, { minContributingArea: 8000 });
    const carved = carveDrainage(relief, drainage.channels, {
      depthFor: (area) => 1 + Math.sqrt(area) / 200,
      halfWidthFor: (_area, order) => 10 + 8 * order,
    });
    for (const channel of drainage.channels) {
      for (const point of channel.points) {
        expect(sampleHeight(carved, point.x, point.z)).toBeLessThan(
          sampleHeight(relief, point.x, point.z)
        );
      }
    }
  });
});
