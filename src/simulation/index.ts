/**
 * `src/simulation/` — scenario simulation engine.
 *
 * The public `./simulation` shim composes the concern-specific implementation
 * modules:
 *
 * - `./engine.ts` — runtime step dispatch
 * - `./script.ts` — stable public script re-export path
 * - `./script-types.ts` — script DTOs, schema constants, and result records
 * - `./script-validators.ts` — authored-script validators
 * - `./report.ts` — report DTO + renderers
 * - `./assertions.ts` — expectation checks
 *
 * @module
 */

export * from './simulation';
