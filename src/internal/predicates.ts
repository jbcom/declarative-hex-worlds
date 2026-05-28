/**
 * Generic runtime predicates + helpers shared across domains.
 *
 * These are cross-cutting internal utilities (no game-domain meaning of their
 * own). They live here — not in any one domain barrel — so multiple domains can
 * import them without widening the public API. `src/internal/` is deliberately
 * absent from `package.json#exports`: nothing here is published.
 *
 * @module
 * @internal
 */

/** Narrow `value` to one of `values` (string literal union membership). */
export function includesString<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

/** True when `value` is a non-empty, non-whitespace string. */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** True when `value` is a non-array object (a plain record). */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Extract a human-readable message from an unknown thrown value. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** True when `value` is a record carrying finite numeric `q` + `r` fields. */
export function isHexCoordinatesInput(value: unknown): value is { q: number; r: number } {
  return isRecord(value) && Number.isFinite(value.q) && Number.isFinite(value.r);
}
