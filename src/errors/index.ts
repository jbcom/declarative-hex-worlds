/**
 * `src/errors/` — typed error hierarchy.
 *
 * Currently a placeholder home: Epic D2 lands the full
 * `GameboardError` base + `GameboardValidationError`,
 * `GameboardManifestError`, `GameboardScenarioError`,
 * `GameboardRuntimeError`, and `GameboardCliError` subclasses, and
 * migrates the ~130 `throw new Error()` sites across src/ to throw the
 * typed variants. The base class lives here so consumers can `instanceof
 * GameboardError` to discriminate library failures from arbitrary other
 * `Error` instances.
 *
 * @module
 */

/**
 * Base class for every error this library throws.
 *
 * Catch this to filter library failures from everything else:
 *
 * ```ts
 * import { GameboardError } from '@jbcom/medieval-hexagon-gameboard';
 *
 * try {
 *   runSimulation(scenario, script);
 * } catch (error) {
 *   if (error instanceof GameboardError) {
 *     // library failure — inspect `error.code` and re-throw or recover
 *   } else {
 *     throw error;
 *   }
 * }
 * ```
 *
 * Subclasses set `name` to their constructor and may attach a stable
 * `code` (e.g. `'MANIFEST_SCHEMA_MISMATCH'`) for programmatic
 * discrimination separate from the human-readable message. Epic D2
 * lays out the full code taxonomy in `docs/api/errors.md`.
 */
export class GameboardError extends Error {
  /** Programmatic discriminator. Subclasses set this to a stable string. */
  readonly code: string;
  constructor(message: string, options?: { code?: string; cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = options?.code ?? 'GAMEBOARD_ERROR';
  }
}
