/** Authored discrete terrain visibility over the canonical board plan. @module */
import { hexDistance, hexKey, hexLine } from '../coordinates';
import { GameboardRuntimeError } from '../errors';
import type { HexCoordinates } from '../types';
import { gameboardPlanIndex, type GameboardPlan, type GameboardTileSpec } from './plan';

/** All vertical quantities share the caller's units; range is in hex steps. */
export interface GameboardSightProfile {
  /** Maximum axial distance, a nonnegative safe integer. */
  maxRangeHexes: number;
  /** Observer eye height above its tile's ground. */
  eyeHeight: number;
  /** Target's visible height above its tile's ground. */
  targetHeight: number;
  /** Ground height, for example a continuous terrain field or stacked elevation. */
  groundHeight: (tile: GameboardTileSpec) => number;
  /** Nonnegative opaque height above intermediate ground; omitted means bare ground. */
  obstructionHeight?: (tile: GameboardTileSpec) => number;
}

/** Detached result of a rounded centre trace, not a supercover ray. */
export interface GameboardSightResult {
  visible: boolean;
  reason: 'clear' | 'range' | 'missing-tile' | 'occluded';
  line: HexCoordinates[];
  blocker?: HexCoordinates;
}

function finiteHeight(value: number): number {
  if (!Number.isFinite(value)) throw new GameboardRuntimeError('Sight heights must be finite');
  return value;
}

function aboveGroundHeight(value: number): number {
  finiteHeight(value);
  if (value < 0) throw new GameboardRuntimeError('Sight heights above ground cannot be negative');
  return value;
}

function requireCoordinate(at: HexCoordinates): void {
  if (!Number.isSafeInteger(at.q) || !Number.isSafeInteger(at.r))
    throw new GameboardRuntimeError('Sight coordinates must be safe integers');
}

/**
 * Trace {@link hexLine} through the current plan. Missing cells fail closed;
 * intermediate terrain touching the eye-to-target line blocks sight. Endpoints
 * do not obstruct themselves. This discrete query does not test edge-touching
 * cells, continuous meshes or partial opacity.
 */
export function traceGameboardSight(
  plan: GameboardPlan,
  start: HexCoordinates,
  end: HexCoordinates,
  profile: GameboardSightProfile
): GameboardSightResult {
  requireCoordinate(start);
  requireCoordinate(end);
  aboveGroundHeight(profile.eyeHeight);
  aboveGroundHeight(profile.targetHeight);
  if (!Number.isSafeInteger(profile.maxRangeHexes) || profile.maxRangeHexes < 0)
    throw new GameboardRuntimeError('Sight range must be a nonnegative safe integer');
  if (hexDistance(start, end) > profile.maxRangeHexes)
    return { visible: false, reason: 'range', line: [] };
  const { tilesByKey } = gameboardPlanIndex(plan);
  const first = tilesByKey.get(hexKey(start));
  const last = tilesByKey.get(hexKey(end));
  if (!first || !last)
    return {
      visible: false,
      reason: 'missing-tile',
      line: [],
      blocker: { ...(!first ? start : end) },
    };
  const eye = finiteHeight(finiteHeight(profile.groundHeight(first)) + profile.eyeHeight);
  const target = finiteHeight(finiteHeight(profile.groundHeight(last)) + profile.targetHeight);
  const line = hexLine(start, end);
  for (const [index, at] of line.entries()) {
    if (index === 0 || index === line.length - 1) continue;
    const tile = tilesByKey.get(hexKey(at));
    if (!tile) return { visible: false, reason: 'missing-tile', line, blocker: { ...at } };
    const ground = finiteHeight(profile.groundHeight(tile));
    const obstruction = aboveGroundHeight(
      profile.obstructionHeight === undefined ? 0 : profile.obstructionHeight(tile)
    );
    const top = finiteHeight(ground + obstruction);
    const fraction = index / (line.length - 1);
    const ray = eye * (1 - fraction) + target * fraction;
    if (top >= ray) return { visible: false, reason: 'occluded', line, blocker: { ...at } };
  }
  return { visible: true, reason: 'clear', line };
}
