/**
 * `src/errors/` — typed error hierarchy.
 *
 * Every error this library throws extends {@link GameboardError}. Consumers
 * branch on `instanceof` to react programmatically without regexing message
 * strings:
 *
 * ```ts
 * import {
 *   GameboardValidationError,
 *   GameboardError,
 * } from 'declarative-hex-worlds';
 *
 * try {
 *   runSimulation(scenario, script);
 * } catch (error) {
 *   if (error instanceof GameboardValidationError) {
 *     // user-supplied data was malformed — surface to the user
 *   } else if (error instanceof GameboardError) {
 *     // library-originated, but not a validation issue — log + recover
 *   } else {
 *     throw error;
 *   }
 * }
 * ```
 *
 * Subclass selection follows the source domain that raised the error.
 * The mapping is documented in `docs/api/errors.md`.
 *
 * @module
 */

/**
 * Base for every error this library throws.
 *
 * Consumers can branch on `instanceof GameboardError` to handle anything
 * library-originated separately from genuine bugs (`TypeError`,
 * `ReferenceError`, etc.).
 */
export class GameboardError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Thrown when input data fails structural / domain validation. */
export class GameboardValidationError extends GameboardError {}

/** Thrown when the manifest is malformed, missing assets, or version-incompatible. */
export class GameboardManifestError extends GameboardError {}

/** Thrown when a scenario JSON / blueprint / recipe fails to compile or load. */
export class GameboardScenarioError extends GameboardError {}

/**
 * Thrown when the runtime hits a state it cannot recover from (missing
 * entity, broken trait shape, simulation invariant violated, etc.).
 */
export class GameboardRuntimeError extends GameboardError {}

/** Thrown when the CLI hits invalid flags / missing inputs / illegal output paths. */
export class GameboardCliError extends GameboardError {}

/** Thrown when ingest / bootstrap / file IO cannot proceed. */
export class GameboardIoError extends GameboardError {}
