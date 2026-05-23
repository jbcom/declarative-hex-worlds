import seedrandom from 'seedrandom';
import type { GameboardShape, HexCoordinates, HexEdgeIndex } from './types';

export const HEX_DIRECTIONS: readonly HexCoordinates[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

export interface HexPathOptions {
  shape?: GameboardShape;
  passable?: (coordinates: HexCoordinates, from?: HexCoordinates) => boolean;
  cost?: (from: HexCoordinates, to: HexCoordinates) => number;
  maxVisited?: number;
}

export interface HexPathResult {
  found: boolean;
  path: readonly HexCoordinates[];
  cost: number;
  visited: number;
}

export interface SpawnCoordinateOptions {
  shape: GameboardShape;
  count: number;
  seed?: string | number;
  candidates?: readonly HexCoordinates[];
  passable?: (coordinates: HexCoordinates) => boolean;
  minDistance?: number;
  edgePadding?: number;
}

export function hexKey(coordinates: HexCoordinates): string {
  return `${coordinates.q},${coordinates.r}`;
}

export function parseHexKey(key: string): HexCoordinates {
  const [q, r] = key.split(',').map(Number);
  if (!Number.isFinite(q) || !Number.isFinite(r)) {
    throw new Error(`Invalid hex key: ${key}`);
  }
  return { q, r };
}

export function neighbor(coordinates: HexCoordinates, edge: HexEdgeIndex | number): HexCoordinates {
  const direction = HEX_DIRECTIONS[normalizeHexRotationSteps(edge)];
  return { q: coordinates.q + direction.q, r: coordinates.r + direction.r };
}

export function neighbors(coordinates: HexCoordinates): HexCoordinates[] {
  return HEX_DIRECTIONS.map((_, edge) => neighbor(coordinates, edge));
}

export function oppositeEdge(edge: HexEdgeIndex | number): HexEdgeIndex {
  return normalizeHexRotationSteps(edge + 3) as HexEdgeIndex;
}

export function edgeBetween(from: HexCoordinates, to: HexCoordinates): HexEdgeIndex | undefined {
  const dq = to.q - from.q;
  const dr = to.r - from.r;
  const index = HEX_DIRECTIONS.findIndex((direction) => direction.q === dq && direction.r === dr);
  return index === -1 ? undefined : (index as HexEdgeIndex);
}

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

export function containsHex(shape: GameboardShape, coordinates: HexCoordinates): boolean {
  if (shape.kind === 'rectangle') {
    return coordinates.q >= 0 && coordinates.r >= 0 && coordinates.q < shape.width && coordinates.r < shape.height;
  }
  const s = -coordinates.q - coordinates.r;
  return Math.max(Math.abs(coordinates.q), Math.abs(coordinates.r), Math.abs(s)) <= shape.radius;
}

export function hexDistance(left: HexCoordinates, right: HexCoordinates): number {
  const dq = left.q - right.q;
  const dr = left.r - right.r;
  const ds = -dq - dr;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

export function hexLine(start: HexCoordinates, end: HexCoordinates): HexCoordinates[] {
  const distance = hexDistance(start, end);
  if (distance === 0) {
    return [{ ...start }];
  }
  return Array.from({ length: distance + 1 }, (_value, index) => cubeRound(cubeLerp(start, end, index / distance)));
}

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

export function findHexPath(start: HexCoordinates, goal: HexCoordinates, options: HexPathOptions = {}): HexPathResult {
  if (hexKey(start) === hexKey(goal)) {
    return { found: true, path: [{ ...start }], cost: 0, visited: 1 };
  }

  const open = new Set<string>([hexKey(start)]);
  const cameFrom = new Map<string, string>();
  const coordinatesByKey = new Map<string, HexCoordinates>([[hexKey(start), start]]);
  const costByKey = new Map<string, number>([[hexKey(start), 0]]);
  let visited = 0;

  while (open.size > 0) {
    const currentKey = lowestScoreKey(open, costByKey, coordinatesByKey, goal);
    const current = coordinatesByKey.get(currentKey);
    if (!current) {
      break;
    }

    if (currentKey === hexKey(goal)) {
      return {
        found: true,
        path: reconstructPath(cameFrom, coordinatesByKey, currentKey),
        cost: costByKey.get(currentKey) ?? 0,
        visited,
      };
    }

    open.delete(currentKey);
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
      const nextCost = (costByKey.get(currentKey) ?? 0) + (options.cost?.(current, adjacent) ?? 1);
      if (nextCost >= (costByKey.get(adjacentKey) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      cameFrom.set(adjacentKey, currentKey);
      coordinatesByKey.set(adjacentKey, adjacent);
      costByKey.set(adjacentKey, nextCost);
      open.add(adjacentKey);
    }
  }

  return { found: false, path: [], cost: Number.POSITIVE_INFINITY, visited };
}

export function selectSpawnCoordinates(options: SpawnCoordinateOptions): HexCoordinates[] {
  const rng = seedrandom(String(options.seed ?? 'spawn'));
  const minDistance = Math.max(0, Math.floor(options.minDistance ?? 0));
  const candidates = (options.candidates ?? coordinatesForShape(options.shape))
    .filter((coordinates) => containsHex(options.shape, coordinates))
    .filter((coordinates) => !options.passable || options.passable(coordinates))
    .filter((coordinates) => outsideEdgePadding(options.shape, coordinates, options.edgePadding ?? 0));
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

export function normalizeHexRotationSteps(steps: number): number {
  return ((Math.floor(steps) % 6) + 6) % 6;
}

function lowestScoreKey(
  open: ReadonlySet<string>,
  costByKey: ReadonlyMap<string, number>,
  coordinatesByKey: ReadonlyMap<string, HexCoordinates>,
  goal: HexCoordinates
): string {
  let bestKey = '';
  let bestScore = Number.POSITIVE_INFINITY;
  for (const key of open) {
    const coordinates = coordinatesByKey.get(key);
    if (!coordinates) {
      continue;
    }
    const score = (costByKey.get(key) ?? Number.POSITIVE_INFINITY) + hexDistance(coordinates, goal);
    if (score < bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }
  return bestKey;
}

function reconstructPath(
  cameFrom: ReadonlyMap<string, string>,
  coordinatesByKey: ReadonlyMap<string, HexCoordinates>,
  currentKey: string
): HexCoordinates[] {
  const path: HexCoordinates[] = [];
  let key: string | undefined = currentKey;
  while (key) {
    const coordinates = coordinatesByKey.get(key);
    if (coordinates) {
      path.push(coordinates);
    }
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

function outsideEdgePadding(shape: GameboardShape, coordinates: HexCoordinates, padding: number): boolean {
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
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
