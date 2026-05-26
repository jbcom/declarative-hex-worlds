/**
 * `src/simulation/` — scenario simulation engine.
 *
 * Currently a single-file home (`./simulation`) covering the engine, script
 * parser, report renderers, and expectation checks. PRD Epic D3 splits it
 * into:
 *
 * - `./engine.ts` — runtime step dispatch
 * - `./script.ts` — DSL parsing
 * - `./report.ts` — report DTO + renderers
 * - `./assertions.ts` — expectation checks
 *
 * That decomposition lands in a dedicated commit (D3) so the test surface
 * can be updated in lockstep.
 *
 * @module
 */

export * from './simulation';
