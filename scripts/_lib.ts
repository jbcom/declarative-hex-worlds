/**
 * `scripts/_lib.ts` — shared helpers for the audit + smoke scripts.
 *
 * Before this module existed, every script in `scripts/` reimplemented the
 * same four primitives (`workspaceRoot`, `packageRoot`, `readRequired`,
 * `readJson`) with subtle drift between implementations (Phase 1 review
 * M-1). One canonical definition prevents the drift; the script files
 * that consume them go from ~10 lines of boilerplate to a single import.
 *
 * @module
 */

import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

/** Repository root, resolved from this file's own `import.meta.dirname`. */
export const workspaceRoot = resolve(import.meta.dirname, '..');

/**
 * The single package's filesystem root.
 *
 * After PRD R1 (de-monorepo) the workspace and the package are the same
 * directory; this alias exists so callers can express which concept they
 * mean (workspace-wide audit vs. package-only assertion) without losing
 * that distinction the next time the layout shifts.
 */
export const packageRoot = workspaceRoot;

/**
 * Read a file that MUST exist at `<relativePath>` under the workspace root.
 *
 * Throws (via `Error`) when the file is missing — the audit scripts use
 * this on inputs whose absence is a contract violation, not a recoverable
 * state. Pass an absolute path through unchanged; relative paths are
 * resolved against the workspace root.
 */
export function readRequired(relativePath: string): string {
  const resolved = isAbsolute(relativePath) ? relativePath : join(workspaceRoot, relativePath);
  if (!existsSync(resolved)) {
    throw new Error(`Missing required file: ${relativePath}`);
  }
  return readFileSync(resolved, 'utf8');
}

/**
 * Read JSON from a workspace-relative path with no schema validation.
 *
 * The caller's generic parameter declares the expected shape; the
 * runtime check is deliberately absent — that's the responsibility of
 * each audit's own assertions (the schema is asserted explicitly in
 * each script, not implicitly here, so a drift surfaces as a typed
 * field mismatch rather than a silent parse).
 */
export function readJson<T>(relativePath: string): T {
  return JSON.parse(readRequired(relativePath)) as T;
}
