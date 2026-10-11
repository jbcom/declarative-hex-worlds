/**
 * `src/sculpt/validate.ts` — argument checks shared by the sculpt kit.
 *
 * Every rejection is a {@link GameboardValidationError} whose message starts with `sculpt:` and
 * names the argument, so a bad size in a prop recipe points at the line that wrote it. The kit
 * validates before it allocates or consumes a geometry, so a rejected call leaves its inputs
 * untouched.
 *
 * @internal
 */
import { GameboardValidationError } from '../errors';

/** A metres-or-radians triple: a position, an Euler rotation or a scale. */
export type SculptVec3 = readonly [number, number, number];

/** Rejects `value` unless it is a finite number; returns it. */
export function requireFinite(name: string, value: number): number {
  if (!Number.isFinite(value)) {
    throw new GameboardValidationError(`sculpt: ${name} must be a finite number, got ${value}`);
  }
  return value;
}

/** Rejects `value` unless it is finite and at least zero; returns it. */
export function requireNonNegative(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new GameboardValidationError(
      `sculpt: ${name} must be a finite number of at least 0, got ${value}`
    );
  }
  return value;
}

/** Rejects `value` unless it is an integer; returns it. */
export function requireInteger(name: string, value: number): number {
  if (!Number.isInteger(value)) {
    throw new GameboardValidationError(`sculpt: ${name} must be an integer, got ${value}`);
  }
  return value;
}

/** Rejects `value` unless it is finite and greater than zero; returns it. */
export function requirePositive(name: string, value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new GameboardValidationError(
      `sculpt: ${name} must be a finite number above 0, got ${value}`
    );
  }
  return value;
}

/** Rejects `value` unless it is a finite number from 0 to 1 inclusive; returns it. */
export function requireUnit(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new GameboardValidationError(
      `sculpt: ${name} must be a number from 0 to 1, got ${value}`
    );
  }
  return value;
}

/** Rejects `value` unless it is an integer of at least three (the fewest sides that close a ring). */
export function requireSegments(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 3) {
    throw new GameboardValidationError(
      `sculpt: ${name} must be an integer of at least 3, got ${value}`
    );
  }
  return value;
}

/** Rejects `value` unless all three components are finite; returns it. */
export function requireVec3(name: string, value: SculptVec3): SculptVec3 {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new GameboardValidationError(`sculpt: ${name} must be three finite numbers`);
  }
  for (const component of value) {
    if (!Number.isFinite(component)) {
      throw new GameboardValidationError(
        `sculpt: ${name} must be three finite numbers, got [${value.join(', ')}]`
      );
    }
  }
  return value;
}
