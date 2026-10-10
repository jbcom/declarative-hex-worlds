/**
 * `src/terrain/drainage.ts` — streams traced from a height field.
 *
 * Water runs downhill, gathers in valleys and joins into a branching
 * (dendritic) network. `traceDrainage` reproduces that from any height field:
 *
 * 1. **Flow routing** (`./flow`): depressions are filled by priority-flood,
 *    so every sample drains to the field's edge; each sample sends its flow
 *    to one neighbour — on slopes by D8-LTD, which follows the true downhill
 *    direction on average instead of snapping to 45°, and across flats
 *    (filled lakes, levelled ground) along the flat's middle to its outlet.
 * 2. **Flow accumulation**: every sample contributes one cell of area
 *    (`spacing.x × spacing.z`) to itself and everything downstream.
 * 3. **Channels**: samples whose contributing area reaches
 *    `minContributingArea` are stream. Each channel runs from its source (or
 *    the confluence where its Strahler order rose) down to the confluence
 *    where it joins a larger stream, or to the field's edge. A stream keeps
 *    flowing through confluences with smaller tributaries, so main stems
 *    come out as single long polylines. Polylines are simplified
 *    (Douglas–Peucker) to remove grid stair-steps, split into pieces of at
 *    most two sample spacings and smoothed (Chaikin), so bends round off
 *    locally rather than cutting across valley sides, and a tributary's
 *    mouth is snapped onto the finished stem it joins.
 *
 * `carveDrainage` cuts beds for the channels into a field, deepening and
 * widening with contributing area. To carve through composition instead,
 * map each channel to a `channel` layer of {@link composeHeightField}.
 *
 * Only arithmetic, comparisons and Math.sqrt touch the data, so output is
 * byte-identical everywhere. No randomness is involved.
 *
 * @module
 */
import { GameboardValidationError } from '../errors';
import { type TerrainProfile, terrainProfileWeight } from './compose';
import { gridSpacing, type HeightField, validateGroundGrid } from './field';
import { routeSurfaceFlow } from './flow';
import {
  closestPointOnPolyline,
  type GroundPoint,
  simplifyPolylineIndices,
  smoothPolyline,
  smoothPolylineValues,
  subdividePolyline,
} from './geometry2d';
import { validateSearchField, validateSmoothing, validateTolerance } from './grid-search';

/** Largest field `traceDrainage` accepts (4096 × 4096 samples). */
export const MAX_DRAINAGE_SAMPLES = 16_777_216;

/** Options for {@link traceDrainage}. */
export interface TraceDrainageOptions {
  /** Contributing area (world units²) at which a stream begins. */
  readonly minContributingArea: number;
  /**
   * Douglas–Peucker tolerance in world units (default: the larger sample
   * spacing). 0 keeps every non-collinear sample.
   */
  readonly simplifyTolerance?: number;
  /** Chaikin smoothing passes, 0–8 (default 2). */
  readonly smoothing?: number;
}

/** One stream channel, from upstream to downstream. */
export interface DrainageChannel {
  /** Source (or confluence) first, mouth last. */
  readonly points: readonly GroundPoint[];
  /** Contributing area (world units²) at each point, non-decreasing downstream. */
  readonly areas: readonly number[];
  /** Strahler order: 1 for headwater streams, +1 where two of equal order meet. */
  readonly order: number;
}

/** The result of {@link traceDrainage}. */
export interface Drainage {
  /** Contributing area (world units²) per sample, row-major like the field. */
  readonly accumulation: Float32Array;
  /** The depression-filled surface the flow was routed over. */
  readonly filled: Float32Array;
  /** Channels ordered by descending Strahler order, then source position. */
  readonly channels: readonly DrainageChannel[];
}

/** Options for {@link carveDrainage}. */
export interface CarveDrainageOptions {
  /** Bed depth for a point with this contributing area and order. */
  readonly depthFor: (area: number, order: number) => number;
  /** Distance from the centreline at which the bed meets the ground. */
  readonly halfWidthFor: (area: number, order: number) => number;
  /** Bank profile (default `smooth`). */
  readonly profile?: TerrainProfile;
}

/** A channel as the samples it passes through, before shaping. */
interface Chain {
  readonly cells: number[];
  readonly order: number;
  readonly head: number;
}
/** Traces streams over a height field. See the module documentation. */
export function traceDrainage(field: HeightField, options: TraceDrainageOptions): Drainage {
  validateSearchField(field, MAX_DRAINAGE_SAMPLES, 'drainage field');
  const threshold = options.minContributingArea;
  if (!(threshold > 0) || !Number.isFinite(threshold)) {
    throw new GameboardValidationError(
      `drainage minContributingArea must be positive; got ${threshold}`
    );
  }
  const spacing = gridSpacing(field);
  const tolerance = options.simplifyTolerance ?? Math.max(spacing.x, spacing.z);
  validateTolerance(tolerance, 'drainage');
  const smoothing = options.smoothing ?? 2;
  validateSmoothing(smoothing, 'drainage');
  const maxSegment = 2 * Math.max(spacing.x, spacing.z);

  const { width } = field;
  const count = width * field.height;
  const { filled, order, receivers, area } = routeSurfaceFlow(field);

  // Strahler orders, upstream before downstream: every donor precedes its
  // receiver in reverse flow order.
  const strahler = new Int32Array(count);
  const donorOrder = new Int32Array(count);
  const donorsAtOrder = new Int32Array(count);
  const mainDonor = new Int32Array(count).fill(-1);
  const continues = new Int32Array(count).fill(-1);
  for (let p = count - 1; p >= 0; p -= 1) {
    const cell = order[p] as number;
    const receiver = receivers[cell] as number;
    if ((area[cell] as number) >= threshold) {
      const top = donorOrder[cell] as number;
      if (top === 0) strahler[cell] = 1;
      else if ((donorsAtOrder[cell] as number) >= 2) strahler[cell] = top + 1;
      else {
        strahler[cell] = top;
        continues[cell] = mainDonor[cell] as number;
      }
      if (receiver >= 0) {
        const own = strahler[cell] as number;
        if (own > (donorOrder[receiver] as number)) {
          donorOrder[receiver] = own;
          donorsAtOrder[receiver] = 1;
          mainDonor[receiver] = cell;
        } else if (own === donorOrder[receiver]) {
          donorsAtOrder[receiver] = (donorsAtOrder[receiver] as number) + 1;
        }
      }
    }
  }

  // Walk each channel from its head down to the next confluence it ends at.
  const chains: Chain[] = [];
  for (let head = 0; head < count; head += 1) {
    if (strahler[head] === 0 || continues[head] !== -1) continue;
    const cells = [head];
    let cell = head;
    for (;;) {
      const next = receivers[cell] as number;
      if (next < 0) break;
      cells.push(next);
      if (continues[next] !== cell) break;
      cell = next;
    }
    if (cells.length >= 2) chains.push({ cells, order: strahler[head] as number, head });
  }
  // Larger streams first, so a tributary's stem is finished before it snaps on.
  chains.sort((a, b) => b.order - a.order || a.head - b.head);

  const chainOf = new Int32Array(count).fill(-1);
  chains.forEach((chain, index) => {
    const last = chain.cells.length - 1;
    chain.cells.forEach((cell, k) => {
      // A chain owns its cells except its mouth, which belongs to the stem it joins.
      if (k < last || chainOf[cell] === -1) chainOf[cell] = index;
    });
  });

  const position = (cell: number): GroundPoint => {
    const column = cell % width;
    const row = (cell - column) / width;
    return { x: field.bounds.minX + column * spacing.x, z: field.bounds.minZ + row * spacing.z };
  };
  const channels: DrainageChannel[] = [];
  for (const chain of chains) {
    const raw = chain.cells.map(position);
    const kept = simplifyPolylineIndices(raw, tolerance);
    // Subdivide before smoothing so bends round off locally instead of
    // cutting across the valley side.
    const dense = subdividePolyline(
      kept.map((k) => raw[k] as GroundPoint),
      maxSegment,
      kept.map((k) => area[chain.cells[k] as number] as number)
    );
    const points = smoothPolyline(dense.points, smoothing);
    const areas = smoothPolylineValues(dense.values, smoothing);
    const mouth = chain.cells[chain.cells.length - 1] as number;
    const stem = chainOf[mouth] as number;
    const stemChannel = channels[stem];
    // A mouth that heads its stem is that stem's fixed first point already.
    if (stemChannel !== undefined && (chains[stem] as Chain).head !== mouth) {
      points[points.length - 1] = closestPointOnPolyline(
        points[points.length - 1] as GroundPoint,
        stemChannel.points
      );
    }
    channels.push({ points, areas, order: chain.order });
  }
  return { accumulation: Float32Array.from(area), filled, channels };
}

/**
 * Cuts stream beds into a copy of `field`: around every channel segment the
 * ground is lowered by the interpolated `depthFor` over the interpolated
 * `halfWidthFor`, shaped by `profile`. Where beds overlap the deepest cut
 * wins, so confluences are not dug twice.
 */
export function carveDrainage(
  field: HeightField,
  channels: readonly DrainageChannel[],
  options: CarveDrainageOptions
): HeightField {
  validateGroundGrid(field, 'carved field');
  const profile = options.profile ?? 'smooth';
  const { width, height, bounds } = field;
  const spacing = gridSpacing(field);
  const cut = new Float32Array(width * height);
  const measure = (
    fn: (a: number, o: number) => number,
    area: number,
    order: number,
    what: string
  ) => {
    const value = fn(area, order);
    if (!(value >= 0) || !Number.isFinite(value)) {
      throw new GameboardValidationError(
        `carveDrainage ${what} must be a non-negative number; got ${value}`
      );
    }
    return value;
  };
  for (const channel of channels) {
    const depths = channel.areas.map((a) => measure(options.depthFor, a, channel.order, 'depth'));
    const halfWidths = channel.areas.map((a) =>
      measure(options.halfWidthFor, a, channel.order, 'halfWidth')
    );
    for (let i = 1; i < channel.points.length; i += 1) {
      const a = channel.points[i - 1] as GroundPoint;
      const b = channel.points[i] as GroundPoint;
      const wa = halfWidths[i - 1] as number;
      const wb = halfWidths[i] as number;
      const reach = Math.max(wa, wb);
      if (!(reach > 0)) continue;
      const da = depths[i - 1] as number;
      const db = depths[i] as number;
      const c0 = Math.max(0, Math.ceil((Math.min(a.x, b.x) - reach - bounds.minX) / spacing.x));
      const c1 = Math.min(
        width - 1,
        Math.floor((Math.max(a.x, b.x) + reach - bounds.minX) / spacing.x)
      );
      const r0 = Math.max(0, Math.ceil((Math.min(a.z, b.z) - reach - bounds.minZ) / spacing.z));
      const r1 = Math.min(
        height - 1,
        Math.floor((Math.max(a.z, b.z) + reach - bounds.minZ) / spacing.z)
      );
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const lengthSq = abx * abx + abz * abz;
      for (let row = r0; row <= r1; row += 1) {
        const z = bounds.minZ + row * spacing.z;
        for (let column = c0; column <= c1; column += 1) {
          const x = bounds.minX + column * spacing.x;
          let t = lengthSq > 0 ? ((x - a.x) * abx + (z - a.z) * abz) / lengthSq : 0;
          if (t < 0) t = 0;
          else if (t > 1) t = 1;
          const dx = x - (a.x + abx * t);
          const dz = z - (a.z + abz * t);
          const halfWidth = wa + (wb - wa) * t;
          if (!(halfWidth > 0)) continue;
          const weight = terrainProfileWeight(profile, Math.sqrt(dx * dx + dz * dz) / halfWidth);
          const depth = (da + (db - da) * t) * weight;
          const index = row * width + column;
          if (depth > (cut[index] as number)) cut[index] = depth;
        }
      }
    }
  }
  const heights = new Float32Array(field.heights);
  for (let i = 0; i < heights.length; i += 1) {
    heights[i] = (heights[i] as number) - (cut[i] as number);
  }
  return { bounds, width, height, heights };
}
