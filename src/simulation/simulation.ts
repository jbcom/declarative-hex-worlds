/**
 * Headless scenario simulation scripts and deterministic reports for movement,
 * patrols, commands, quest progression, and integration-test evidence.
 *
 * This file is a thin re-export shim. The implementation lives in the
 * per-concern sibling modules:
 *
 * - `./script` — script + step types, schema constants, authored-script
 *   validators, and shared scenario-index helpers.
 * - `./engine` — runtime step dispatch, the `runGameboardScenarioSimulation*`
 *   entry points, and patrol route-to-step helpers.
 * - `./report` — report DTOs, result/record shapes, and the
 *   `createGameboardScenarioSimulationReport` renderer.
 * - `./assertions` — expectation primitives and the
 *   evaluate/assert helpers consumed by the report layer.
 *
 * The split landed in PRD D3 (H-3). Public surface is unchanged.
 *
 * @module
 */
export * from './script';
export * from './engine';
export {
  assertGameboardScenarioSimulationExpectations,
  evaluateGameboardScenarioSimulationExpectations,
} from './assertions';
// `./report` is re-exported by its PUBLIC surface only — the `@internal` record
// builders (actorRecord, placementRecord, simulationResult,
// actorTargetsRecordFromReport, emptyActorTargetsRecord) stay reachable by
// sibling modules (engine.ts) via direct `./report` import but are NOT part of
// the published API, so they are deliberately omitted here.
export { createGameboardScenarioSimulationReport } from './report';
export type {
  GameboardScenarioSimulationActorRecord,
  GameboardScenarioSimulationCommandRecord,
  GameboardScenarioSimulationMovementRecord,
  GameboardScenarioSimulationPatrolRecord,
  GameboardScenarioSimulationPlacementRecord,
  GameboardScenarioSimulationQuestRecord,
  GameboardScenarioSimulationReport,
  GameboardScenarioSimulationResult,
  GameboardScenarioSimulationStepReport,
} from './report';
