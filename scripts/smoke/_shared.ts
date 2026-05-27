/**
 * Shared helpers for the packed-consumer smoke phases.
 *
 * Both {@link runPackInstallSmoke} and {@link runTypesAttestation} receive a
 * {@link SmokeContext} that pins the workspace + temp directory layout, so the
 * orchestrator owns the lifecycle (creation + cleanup) and each phase just
 * runs against the same shared tree.
 */

/**
 * Context shared between every smoke phase. The orchestrator owns the temp
 * tree and passes the resolved paths to each phase function.
 */
export interface SmokeContext {
  /** Repository root (where `package.json` lives). */
  readonly workspaceRoot: string;
  /** Package root (currently the same as the workspace root). */
  readonly packageRoot: string;
  /** Top-level temp directory; cleaned up by the orchestrator unless kept. */
  readonly tempRoot: string;
  /** Subdirectory the npm tarball is packed into. */
  readonly packRoot: string;
  /** Subdirectory the consumer fixture app is installed into. */
  readonly appRoot: string;
  /** When true, the orchestrator preserves {@link tempRoot} after the run. */
  readonly keepTemp: boolean;
}

/** Maximum buffer for `coverage` CLI invocations (64 MiB). */
export const COVERAGE_CLI_MAX_BUFFER_BYTES = 64 * 1024 * 1024;

/**
 * Narrowing assert helper used across all smoke phases. Throws a plain `Error`
 * on failure so the orchestrator's phase wrapper can surface the message.
 */
export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
