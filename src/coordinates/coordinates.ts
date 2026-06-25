/**
 * Axial coordinate utilities for hex keys, neighbors, ranges, rotations,
 * deterministic coordinate choice, and pathfinding over board-shaped regions.
 *
 * @module
 */
import seedrandom from 'seedrandom';
import { GameboardRuntimeError } from '../errors';
import type { GameboardShape, HexCoordinates, HexEdgeIndex } from '../types';

/** Axial neighbor offsets ordered clockwise for the library edge convention. */
export const HEX_DIRECTIONS: readonly [
  HexCoordinates,
  HexCoordinates,
  HexCoordinates,
  HexCoordinates,
  HexCoordinates,
  HexCoordinates,
] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

/** Options for A-star pathfinding over axial coordinates. */
export interface HexPathOptions {
  /** Optional shape boundary; omitted paths may explore outside an authored board. */
  shape?: GameboardShape;
  /** Predicate for rejecting blocked coordinates. */
  passable?: (coordinates: HexCoordinates, from?: HexCoordinates) => boolean;
  /** Movement cost callback for weighted paths. */
  cost?: (from: HexCoordinates, to: HexCoordinates) => number;
  /** Maximum visited nodes before aborting the search. */
  maxVisited?: number;
}

/** Result from a hex pathfinding request. */
export interface HexPathResult {
  /** Whether a complete path was found. */
  found: boolean;
  /** Ordered path from start to goal, empty when no path is found. */
  path: readonly HexCoordinates[];
  /** Total path cost, or positive infinity when no path is found. */
  cost: number;
  /** Number of nodes visited before the search stopped. */
  visited: number;
}

/** Options for deterministic spawn coordinate selection. */
export interface SpawnCoordinateOptions {
  /** Board shape that bounds spawn selection. */
  shape: GameboardShape;
  /** Number of coordinates to select. */
  count: number;
  /** Seed used to shuffle candidates deterministically. */
  seed?: string | number;
  /** Explicit candidate coordinates to choose from. */
  candidates?: readonly HexCoordinates[];
  /** Predicate for rejecting blocked coordinates. */
  passable?: (coordinates: HexCoordinates) => boolean;
  /** Minimum axial distance between selected coordinates. */
  minDistance?: number;
  /** Number of outer rows/rings to avoid. */
  edgePadding?: number;
}

/** Converts axial coordinates into a stable string key. */
export function hexKey(coordinates: HexCoordinates): string {
  return `${coordinates.q},${coordinates.r}`;
}

/**
 * Parses a string key produced by {@link hexKey}.
 *
 * Throws on invalid input. Prefer {@link tryParseHexKey} on lookup paths
 * where a miss is an expected outcome (returning `undefined` is ~100×
 * faster than throwing + catching in V8).
 */
export function parseHexKey(key: string): HexCoordinates {
  const parsed = tryParseHexKey(key);
  if (parsed === undefined) {
    throw new GameboardRuntimeError(`Invalid hex key: ${key}`);
  }
  return parsed;
}

/**
 * Non-throwing variant of {@link parseHexKey}. Returns `undefined` when the
 * key is malformed. Use this on lookup paths where a miss is expected; use
 * {@link parseHexKey} on assertion paths where a miss is a programming
 * error.
 */
export function tryParseHexKey(key: string): HexCoordinates | undefined {
  const parts = key.split(',');
  if (parts.length !== 2) {
    return undefined;
  }
  const q = Number(parts[0]);
  const r = Number(parts[1]);
  if (!Number.isFinite(q) || !Number.isFinite(r)) {
    return undefined;
  }
  return { q, r };
}

/** Returns the neighbor coordinate at a clockwise edge index. */
export function neighbor(coordinates: HexCoordinates, edge: HexEdgeIndex | number): HexCoordinates {
  const direction = HEX_DIRECTIONS[normalizeHexRotationSteps(edge)];
  return { q: coordinates.q + direction.q, r: coordinates.r + direction.r };
}

/** Returns all six neighboring axial coordinates. */
export function neighbors(coordinates: HexCoordinates): HexCoordinates[] {
  return HEX_DIRECTIONS.map((_, edge) => neighbor(coordinates, edge));
}

/** Returns the opposite edge index for a given edge. */
export function oppositeEdge(edge: HexEdgeIndex | number): HexEdgeIndex {
  return normalizeHexRotationSteps(edge + 3) as HexEdgeIndex;
}

/** Returns the edge index from one coordinate to an adjacent coordinate. */
export function edgeBetween(from: HexCoordinates, to: HexCoordinates): HexEdgeIndex | undefined {
  const dq = to.q - from.q;
  const dr = to.r - from.r;
  const index = HEX_DIRECTIONS.findIndex((direction) => direction.q === dq && direction.r === dr);
  return index === -1 ? undefined : (index as HexEdgeIndex);
}

/** Lists all axial coordinates inside a supported board shape. */
export function coordinatesForShape(shape: GameboardShape): HexCoordinates[] {
  if (shape.kind === 'rectangle') {
    return Array.from({ length: shape.width * shape.height }, (_value, index) => ({
      q: index % shape.width,
      r: Math.floor(index / shape.width),
    }));
  }

  const coordinates: HexCoordinates[] = [];
  for (let q = -shape.radius; q <= shape.radius; q += 1) {
    const rMin = Math.max(-shape.radius, -q - shape.radius);
    const rMax = Math.min(shape.radius, -q + shape.radius);
    for (let r = rMin; r <= rMax; r += 1) {
      coordinates.push({ q, r });
    }
  }
  return coordinates;
}

/** Checks whether an axial coordinate is inside a supported board shape. */
export function containsHex(shape: GameboardShape, coordinates: HexCoordinates): boolean {
  if (shape.kind === 'rectangle') {
    return (
      coordinates.q >= 0 &&
      coordinates.r >= 0 &&
      coordinates.q < shape.width &&
      coordinates.r < shape.height
    );
  }
  const s = -coordinates.q - coordinates.r;
  return Math.max(Math.abs(coordinates.q), Math.abs(coordinates.r), Math.abs(s)) <= shape.radius;
}

/** Computes axial hex distance between two coordinates. */
export function hexDistance(left: HexCoordinates, right: HexCoordinates): number {
  const dq = left.q - right.q;
  const dr = left.r - right.r;
  const ds = -dq - dr;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

/** Returns a rounded axial line between two coordinates, inclusive. */
export function hexLine(start: HexCoordinates, end: HexCoordinates): HexCoordinates[] {
  const distance = hexDistance(start, end);
  if (distance === 0) {
    return [{ ...start }];
  }
  return Array.from({ length: distance + 1 }, (_value, index) =>
    cubeRound(cubeLerp(start, end, index / distance))
  );
}

/** Returns coordinates exactly one radius away from a center. */
export function hexRing(center: HexCoordinates, radius: number): HexCoordinates[] {
  const normalizedRadius = Math.max(0, Math.floor(radius));
  if (normalizedRadius === 0) {
    return [{ ...center }];
  }

  const results: HexCoordinates[] = [];
  let current = {
    q: center.q + HEX_DIRECTIONS[4].q * normalizedRadius,
    r: center.r + HEX_DIRECTIONS[4].r * normalizedRadius,
  };
  for (let edge = 0; edge < 6; edge += 1) {
    for (let step = 0; step < normalizedRadius; step += 1) {
      results.push(current);
      current = neighbor(current, edge);
    }
  }
  return results;
}

/** Returns all coordinates within a radius of a center. */
export function hexRange(center: HexCoordinates, radius: number): HexCoordinates[] {
  const normalizedRadius = Math.max(0, Math.floor(radius));
  const results: HexCoordinates[] = [];
  for (let q = -normalizedRadius; q <= normalizedRadius; q += 1) {
    const rMin = Math.max(-normalizedRadius, -q - normalizedRadius);
    const rMax = Math.min(normalizedRadius, -q + normalizedRadius);
    for (let r = rMin; r <= rMax; r += 1) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

/**
 * Finds a weighted shortest path across axial neighbors.
 *
 * This is A*: `costByKey` is the known g-score from `start`, the heap priority
 * is `g + hexDistance(node, goal)`, and `closed` lets older duplicate heap
 * entries fall out cheaply after a better route to the same key was queued.
 * The hex-distance heuristic is admissible for the default unit-cost graph and
 * custom costs >= 1. Callers that provide cheaper or negative step costs may
 * still get a path, but they are opting out of the shortest-path guarantee.
 */
export function findHexPath(
  start: HexCoordinates,
  goal: HexCoordinates,
  options: HexPathOptions = {}
): HexPathResult {
  if (hexKey(start) === hexKey(goal)) {
    return { found: true, path: [{ ...start }], cost: 0, visited: 1 };
  }

  const startKey = hexKey(start);
  const goalKey = hexKey(goal);
  const cameFrom = new Map<string, string>();
  const costByKey = new Map<string, number>([[startKey, 0]]);
  const h0 = hexDistance(start, goal);
  const heap = minHeapCreate<[number, string]>((a, b) => a[0] - b[0]);
  minHeapPush(heap, [h0, startKey]);
  const closed = new Set<string>();
  let visited = 0;

  while (heap.length > 0) {
    const popped = minHeapPop(heap) as [number, string];
    const [, currentKey] = popped;
    if (closed.has(currentKey)) {
      continue;
    }
    const currentCost = costByKey.get(currentKey) as number;
    const current = parseHexKey(currentKey);

    if (currentKey === goalKey) {
      return {
        found: true,
        path: reconstructPath(cameFrom, currentKey),
        cost: currentCost,
        visited,
      };
    }

    closed.add(currentKey);
    visited += 1;
    if (options.maxVisited && visited > options.maxVisited) {
      break;
    }

    for (const adjacent of neighbors(current)) {
      if (options.shape && !containsHex(options.shape, adjacent)) {
        continue;
      }
      if (options.passable && !options.passable(adjacent, current)) {
        continue;
      }

      const adjacentKey = hexKey(adjacent);
      const nextCost = currentCost + (options.cost?.(current, adjacent) ?? 1);
      if (nextCost >= (costByKey.get(adjacentKey) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      cameFrom.set(adjacentKey, currentKey);
      costByKey.set(adjacentKey, nextCost);
      const fScore = nextCost + hexDistance(adjacent, goal);
      minHeapPush(heap, [fScore, adjacentKey]);
    }
  }

  return { found: false, path: [], cost: Number.POSITIVE_INFINITY, visited };
}

/** Selects deterministic spawn coordinates that satisfy spacing and passability rules. */
export function selectSpawnCoordinates(options: SpawnCoordinateOptions): HexCoordinates[] {
  const rng = seedrandom(String(options.seed ?? 'spawn'));
  const minDistance = Math.max(0, Math.floor(options.minDistance ?? 0));
  const candidates = (options.candidates ?? coordinatesForShape(options.shape))
    .filter((coordinates) => containsHex(options.shape, coordinates))
    .filter((coordinates) => !options.passable || options.passable(coordinates))
    .filter((coordinates) =>
      outsideEdgePadding(options.shape, coordinates, options.edgePadding ?? 0)
    );
  const pool = shuffle(candidates, rng);
  const selected: HexCoordinates[] = [];

  for (const candidate of pool) {
    if (selected.length >= options.count) {
      break;
    }
    if (selected.every((existing) => hexDistance(existing, candidate) >= minDistance)) {
      selected.push(candidate);
    }
  }

  return selected;
}

/** Normalizes any integer-ish rotation step value into the range 0 through 5. */
export function normalizeHexRotationSteps(steps: number): HexEdgeIndex {
  return (((Math.floor(steps) % 6) + 6) % 6) as HexEdgeIndex;
}

/** Binary min-heap — O(log N) push/pop. */
export function minHeapCreate<T>(
  compare: (a: T, b: T) => number
): T[] & { _compare: (a: T, b: T) => number } {
  const heap = [] as unknown as T[] & { _compare: (a: T, b: T) => number };
  heap._compare = compare;
  return heap;
}

export function minHeapPush<T>(heap: T[] & { _compare: (a: T, b: T) => number }, value: T): void {
  heap.push(value);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = (i - 1) >> 1;
    const child = heap[i];
    const par = heap[parent];
    if (child !== undefined && par !== undefined && heap._compare(child, par) < 0) {
      heap[i] = par;
      heap[parent] = child;
      i = parent;
    } else {
      break;
    }
  }
}

export function minHeapPop<T>(heap: T[] & { _compare: (a: T, b: T) => number }): T | undefined {
  if (heap.length === 0) return undefined;
  const top = heap[0];
  if (top === undefined) return undefined;
  const last = heap.pop();
  if (heap.length > 0 && last !== undefined) {
    heap[0] = last;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      const lv = heap[left];
      const sv = heap[smallest];
      if (left < heap.length && lv !== undefined && sv !== undefined && heap._compare(lv, sv) < 0)
        smallest = left;
      const rv = heap[right];
      const sv2 = heap[smallest];
      if (
        right < heap.length &&
        rv !== undefined &&
        sv2 !== undefined &&
        heap._compare(rv, sv2) < 0
      )
        smallest = right;
      if (smallest === i) break;
      const tmp = heap[i] as T;
      const sm = heap[smallest] as T;
      heap[i] = sm;
      heap[smallest] = tmp;
      i = smallest;
    }
  }
  return top;
}

function reconstructPath(
  cameFrom: ReadonlyMap<string, string>,
  currentKey: string
): HexCoordinates[] {
  const path: HexCoordinates[] = [];
  let key: string | undefined = currentKey;
  while (key) {
    path.push(parseHexKey(key));
    key = cameFrom.get(key);
  }
  return path.reverse();
}

function cubeLerp(start: HexCoordinates, end: HexCoordinates, amount: number): HexCoordinates {
  return {
    q: start.q + (end.q - start.q) * amount,
    r: start.r + (end.r - start.r) * amount,
  };
}

function cubeRound(coordinates: HexCoordinates): HexCoordinates {
  const cubeQ = coordinates.q;
  const cubeR = coordinates.r;
  const cubeS = -coordinates.q - coordinates.r;
  let roundedQ = Math.round(cubeQ);
  let roundedR = Math.round(cubeR);
  let roundedS = Math.round(cubeS);

  const qDiff = Math.abs(roundedQ - cubeQ);
  const rDiff = Math.abs(roundedR - cubeR);
  const sDiff = Math.abs(roundedS - cubeS);

  if (qDiff > rDiff && qDiff > sDiff) {
    roundedQ = -roundedR - roundedS;
  } else if (rDiff > sDiff) {
    roundedR = -roundedQ - roundedS;
  } else {
    roundedS = -roundedQ - roundedR;
  }

  return { q: roundedQ, r: roundedR };
}

function outsideEdgePadding(
  shape: GameboardShape,
  coordinates: HexCoordinates,
  padding: number
): boolean {
  if (padding <= 0) {
    return true;
  }
  if (shape.kind === 'rectangle') {
    return (
      coordinates.q >= padding &&
      coordinates.r >= padding &&
      coordinates.q < shape.width - padding &&
      coordinates.r < shape.height - padding
    );
  }
  return hexDistance({ q: 0, r: 0 }, coordinates) <= shape.radius - padding;
}

function shuffle<T>(items: readonly T[], rng: seedrandom.PRNG): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    // Both indices are in range: index ∈ [1, length-1], swapIndex ∈ [0, index].
    const a = result[index] as T;
    const b = result[swapIndex] as T;
    result[index] = b;
    result[swapIndex] = a;
  }
  return result;
}
