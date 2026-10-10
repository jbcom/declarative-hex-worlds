/**
 * `src/terrain/flow.ts` — surface-flow routing over a height field: where
 * water at every sample goes and how much arrives (internal; the public
 * surface is `traceDrainage` in `./drainage`).
 *
 * 1. **Depression filling** by priority-flood (Barnes, Lehman & Mulla 2014a):
 *    every edge sample is an outlet; samples are flooded inward lowest
 *    first, and a pit is raised to the level of its spill point. Equal
 *    heights pop in push order, so the flood is identical on every run.
 * 2. **Flats** — filled lakes and level ground, where no neighbour is lower —
 *    drain down a combined gradient (Barnes, Lehman & Mulla 2014b): towards
 *    the flat's outlet and away from the higher ground around it, so flow
 *    gathers along the flat's middle and leaves by its outlet instead of
 *    running across it in parallel straight lines.
 * 3. **Slopes** route by D8-LTD (Orlandini et al. 2003): each sample takes
 *    the steepest D∞ facet (Tarboton 1997) and sends its flow to whichever of
 *    that facet's two neighbours keeps the path's accumulated sideways
 *    deviation from the true downhill direction smallest. Paths alternate
 *    between the two and follow the gradient on average, where plain D8
 *    would run every path on a slope facing 30° at exactly 45°.
 * 4. **Accumulation**: every sample contributes one cell of area
 *    (`spacing.x × spacing.z`) to itself and to everything downstream.
 *
 * Only arithmetic, comparisons and Math.sqrt touch the data.
 *
 * @module
 */
import { gridSpacing, type HeightField } from './field';
import { SamplePriorityQueue } from './grid-search';

/** Routed surface flow. */
export interface SurfaceFlow {
  /** Depression-filled heights. */
  readonly filled: Float32Array;
  /** Every sample, each after all of its downstream samples (upstream last). */
  readonly order: Int32Array;
  /** The sample each sample drains to; -1 for edge samples (outlets). */
  readonly receivers: Int32Array;
  /** Contributing area per sample, in world units². */
  readonly area: Float64Array;
}

/** The eight neighbours as column and row offsets, cardinals first. */
const NEIGHBOUR_COLUMNS = [1, 0, -1, 0, 1, -1, -1, 1] as const;
const NEIGHBOUR_ROWS = [0, 1, 0, -1, 1, 1, -1, -1] as const;

/**
 * A triangular facet of the D∞ stencil: the sample, one cardinal neighbour
 * and the diagonal neighbour beside it. Offsets are sample-index deltas;
 * `x1, z1` and `x2, z2` are the world offsets of the two neighbours.
 */
interface Facet {
  readonly cardinal: number;
  readonly diagonal: number;
  readonly x1: number;
  readonly z1: number;
  readonly x2: number;
  readonly z2: number;
  /** Cardinal distance, cardinal-to-diagonal distance, diagonal distance. */
  readonly d1: number;
  readonly dp: number;
  readonly d2: number;
}

/** The eight facets as (cardinal column, row, diagonal column, row). */
const FACET_STEPS = [
  [1, 0, 1, 1],
  [1, 0, 1, -1],
  [0, 1, 1, 1],
  [0, 1, -1, 1],
  [-1, 0, -1, 1],
  [-1, 0, -1, -1],
  [0, -1, 1, -1],
  [0, -1, -1, -1],
] as const;

/** Grid geometry shared by the passes below. */
interface Grid {
  readonly width: number;
  readonly height: number;
  /** Index offset and world distance of each neighbour, in NEIGHBOUR order. */
  readonly offsets: readonly number[];
  readonly distances: readonly number[];
}

function isEdge(grid: Grid, cell: number): boolean {
  const column = cell % grid.width;
  const row = (cell - column) / grid.width;
  return column === 0 || row === 0 || column === grid.width - 1 || row === grid.height - 1;
}

/** Index of neighbour `k` of `cell`, or -1 beyond the grid. */
function neighbour(grid: Grid, cell: number, k: number): number {
  const column = (cell % grid.width) + (NEIGHBOUR_COLUMNS[k] as number);
  const row = (cell - (cell % grid.width)) / grid.width + (NEIGHBOUR_ROWS[k] as number);
  if (column < 0 || row < 0 || column >= grid.width || row >= grid.height) return -1;
  return row * grid.width + column;
}

/** Priority-flood: filled heights and the flood order (non-decreasing filled height). */
function floodFill(field: HeightField, grid: Grid): { filled: Float32Array; order: Int32Array } {
  const count = grid.width * grid.height;
  const filled = new Float32Array(field.heights);
  const order = new Int32Array(count);
  const seen = new Uint8Array(count);
  const queue = new SamplePriorityQueue(2 * (grid.width + grid.height));
  let pushes = 0;
  for (let i = 0; i < count; i += 1) {
    if (!isEdge(grid, i)) continue;
    seen[i] = 1;
    queue.push(filled[i] as number, pushes, i);
    pushes += 1;
  }
  let popped = 0;
  while (queue.size > 0) {
    const cell = queue.pop();
    order[popped] = cell;
    popped += 1;
    const level = filled[cell] as number;
    for (let k = 0; k < 8; k += 1) {
      const next = neighbour(grid, cell, k);
      if (next < 0 || seen[next] === 1) continue;
      seen[next] = 1;
      if ((filled[next] as number) < level) filled[next] = level;
      queue.push(filled[next] as number, pushes, next);
      pushes += 1;
    }
  }
  return { filled, order };
}

/**
 * Breadth-first distances (from 1) through flat samples, from `seeds`.
 * Neighbouring flat samples always share a height — neither may be lower
 * than the other — so this never leaves the seed's flat.
 */
function flatDistances(grid: Grid, flat: Uint8Array, seeds: readonly number[]): Int32Array {
  const distance = new Int32Array(flat.length);
  const queue = new Int32Array(flat.length);
  let tail = 0;
  for (const seed of seeds) {
    distance[seed] = 1;
    queue[tail] = seed;
    tail += 1;
  }
  for (let head = 0; head < tail; head += 1) {
    const cell = queue[head] as number;
    for (let k = 0; k < 8; k += 1) {
      const next = cell + (grid.offsets[k] as number);
      if (flat[next] === 0 || distance[next] !== 0) continue;
      distance[next] = (distance[cell] as number) + 1;
      queue[tail] = next;
      tail += 1;
    }
  }
  return distance;
}

/**
 * Receivers for flat samples (interior samples with no lower neighbour) and
 * a key that orders each flat upstream-to-downstream. Samples on a flat's
 * outlet edge drain to the adjacent same-height sample that is not flat;
 * the rest descend `2 × towards + (awayMax − away)`, which falls by at least
 * one per step towards the outlet, so every flat sample has a lower
 * same-flat neighbour and the routing cannot cycle.
 */
function resolveFlats(
  grid: Grid,
  filled: Float32Array
): { flat: Uint8Array; receivers: Int32Array; key: Int32Array } {
  const count = filled.length;
  const flat = new Uint8Array(count);
  for (let cell = 0; cell < count; cell += 1) {
    if (isEdge(grid, cell)) continue;
    let lower = false;
    for (let k = 0; k < 8; k += 1) {
      if ((filled[cell + (grid.offsets[k] as number)] as number) < (filled[cell] as number)) {
        lower = true;
      }
    }
    if (!lower) flat[cell] = 1;
  }
  const receivers = new Int32Array(count).fill(-1);
  const lowEdges: number[] = [];
  const highEdges: number[] = [];
  for (let cell = 0; cell < count; cell += 1) {
    if (flat[cell] === 0) continue;
    let drain = -1;
    let higher = false;
    for (let k = 0; k < 8; k += 1) {
      const next = cell + (grid.offsets[k] as number);
      if ((filled[next] as number) > (filled[cell] as number)) higher = true;
      else if (drain < 0 && flat[next] === 0) drain = next;
    }
    if (drain >= 0) {
      receivers[cell] = drain;
      lowEdges.push(cell);
    } else if (higher) highEdges.push(cell);
  }
  const towards = flatDistances(grid, flat, lowEdges);
  const away = flatDistances(grid, flat, highEdges);

  // The largest `away` on each flat, gathered by walking each flat once.
  const awayMax = new Int32Array(count);
  const visited = new Uint8Array(count);
  const members: number[] = [];
  for (let start = 0; start < count; start += 1) {
    if (flat[start] === 0 || visited[start] === 1) continue;
    members.length = 0;
    members.push(start);
    visited[start] = 1;
    let largest = 0;
    for (let m = 0; m < members.length; m += 1) {
      const cell = members[m] as number;
      if ((away[cell] as number) > largest) largest = away[cell] as number;
      for (let k = 0; k < 8; k += 1) {
        const next = cell + (grid.offsets[k] as number);
        if (flat[next] === 0 || visited[next] === 1) continue;
        visited[next] = 1;
        members.push(next);
      }
    }
    for (const cell of members) awayMax[cell] = largest;
  }

  const key = new Int32Array(count);
  for (let cell = 0; cell < count; cell += 1) {
    if (flat[cell] === 1) {
      const fromHigh = away[cell] === 0 ? 0 : (awayMax[cell] as number) - (away[cell] as number);
      key[cell] = 2 * (towards[cell] as number) + fromHigh;
    }
  }
  for (let cell = 0; cell < count; cell += 1) {
    if (flat[cell] === 0 || receivers[cell] !== -1) continue;
    let best = -1;
    let bestSlope = 0;
    for (let k = 0; k < 8; k += 1) {
      const next = cell + (grid.offsets[k] as number);
      if (flat[next] === 0) continue;
      const slope = ((key[cell] as number) - (key[next] as number)) / (grid.distances[k] as number);
      if (slope > bestSlope) {
        bestSlope = slope;
        best = next;
      }
    }
    receivers[cell] = best;
  }
  return { flat, receivers, key };
}

/**
 * Reorders the flood order so every receiver comes before its donors:
 * within each run of equal filled height, non-flat samples (which only
 * drain to lower ground or are outlets) go first, then flat samples by
 * ascending key.
 */
function topologicalOrder(
  floodOrder: Int32Array,
  filled: Float32Array,
  flat: Uint8Array,
  key: Int32Array
): Int32Array {
  const order = new Int32Array(floodOrder.length);
  let written = 0;
  let start = 0;
  while (start < floodOrder.length) {
    const level = filled[floodOrder[start] as number] as number;
    let end = start;
    const flats: number[] = [];
    while (end < floodOrder.length && filled[floodOrder[end] as number] === level) {
      const cell = floodOrder[end] as number;
      if (flat[cell] === 1) flats.push(cell);
      else {
        order[written] = cell;
        written += 1;
      }
      end += 1;
    }
    flats.sort((a, b) => (key[a] as number) - (key[b] as number) || a - b);
    for (const cell of flats) {
      order[written] = cell;
      written += 1;
    }
    start = end;
  }
  return order;
}

function buildFacets(width: number, spacingX: number, spacingZ: number): Facet[] {
  return FACET_STEPS.map(([c1, r1, c2, r2]) => {
    const x1 = c1 * spacingX;
    const z1 = r1 * spacingZ;
    const x2 = c2 * spacingX;
    const z2 = r2 * spacingZ;
    return {
      cardinal: r1 * width + c1,
      diagonal: r2 * width + c2,
      x1,
      z1,
      x2,
      z2,
      d1: Math.sqrt(x1 * x1 + z1 * z1),
      dp: Math.sqrt((x2 - x1) * (x2 - x1) + (z2 - z1) * (z2 - z1)),
      d2: Math.sqrt(x2 * x2 + z2 * z2),
    };
  });
}

/**
 * The D8-LTD receiver of a sloping sample, given the sideways deviation its
 * main donor's path has accumulated; writes the deviation the chosen step
 * leaves into `out`.
 */
function slopeReceiver(
  filled: Float32Array,
  facets: readonly Facet[],
  cell: number,
  inherited: number,
  out: { deviation: number }
): number {
  const e0 = filled[cell] as number;
  let best = facets[0] as Facet;
  let bestSlope = 0;
  let kind = 0; // 0: towards the cardinal, 1: the diagonal, 2: between them
  let s1Best = 0;
  let s2Best = 0;
  for (const facet of facets) {
    const e1 = filled[cell + facet.cardinal] as number;
    const e2 = filled[cell + facet.diagonal] as number;
    const s1 = (e0 - e1) / facet.d1;
    const s2 = (e1 - e2) / facet.dp;
    let slope = s1;
    let facetKind = 0;
    if (s2 > 0) {
      if (s2 * facet.d1 >= s1 * facet.dp) {
        slope = (e0 - e2) / facet.d2;
        facetKind = 1;
      } else {
        slope = Math.sqrt(s1 * s1 + s2 * s2);
        facetKind = 2;
      }
    }
    if (slope > bestSlope) {
      bestSlope = slope;
      best = facet;
      kind = facetKind;
      s1Best = s1;
      s2Best = s2;
    }
  }
  out.deviation = inherited;
  if (kind === 0) return cell + best.cardinal;
  if (kind === 1) return cell + best.diagonal;
  // The downhill vector in world units, then each choice's signed sideways offset.
  const a = s1Best / best.d1;
  const b = s2Best / best.dp;
  const vx = a * best.x1 + b * (best.x2 - best.x1);
  const vz = a * best.z1 + b * (best.z2 - best.z1);
  const toCardinal = inherited + (vx * best.z1 - vz * best.x1) / bestSlope;
  const toDiagonal = inherited + (vx * best.z2 - vz * best.x2) / bestSlope;
  if (Math.abs(toDiagonal) < Math.abs(toCardinal)) {
    out.deviation = toDiagonal;
    return cell + best.diagonal;
  }
  out.deviation = toCardinal;
  return cell + best.cardinal;
}

/** Routes flow over a validated field. See the module documentation. */
export function routeSurfaceFlow(field: HeightField): SurfaceFlow {
  const { width, height } = field;
  const count = width * height;
  const spacing = gridSpacing(field);
  const diagonal = Math.sqrt(spacing.x * spacing.x + spacing.z * spacing.z);
  const grid: Grid = {
    width,
    height,
    offsets: NEIGHBOUR_COLUMNS.map((c, k) => (NEIGHBOUR_ROWS[k] as number) * width + c),
    distances: NEIGHBOUR_COLUMNS.map((c, k) =>
      c === 0 ? spacing.z : NEIGHBOUR_ROWS[k] === 0 ? spacing.x : diagonal
    ),
  };
  const flood = floodFill(field, grid);
  const { filled } = flood;
  const flats = resolveFlats(grid, filled);
  const downstreamFirst = topologicalOrder(flood.order, filled, flats.flat, flats.key);

  const facets = buildFacets(width, spacing.x, spacing.z);
  const receivers = new Int32Array(count).fill(-1);
  const area = new Float64Array(count).fill(spacing.x * spacing.z);
  const deviation = new Float64Array(count);
  const inheritedArea = new Float64Array(count);
  const step = { deviation: 0 };
  for (let p = count - 1; p >= 0; p -= 1) {
    const cell = downstreamFirst[p] as number;
    if (isEdge(grid, cell)) continue;
    let receiver = flats.receivers[cell] as number;
    step.deviation = 0;
    if (flats.flat[cell] === 0) {
      receiver = slopeReceiver(filled, facets, cell, deviation[cell] as number, step);
    }
    receivers[cell] = receiver;
    const own = area[cell] as number;
    area[receiver] = (area[receiver] as number) + own;
    if (own > (inheritedArea[receiver] as number)) {
      inheritedArea[receiver] = own;
      deviation[receiver] = step.deviation;
    }
  }
  return { filled, order: downstreamFirst, receivers, area };
}
