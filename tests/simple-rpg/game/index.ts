/**
 * SimpleRPG game entry (PRD RS1 + RS3).
 *
 * The bulk of the SimpleRPG implementation lives at
 * `tests/integration/simple-rpg/simple-rpg.ts` — that file was migrated
 * from `examples/simple-rpg-usage.ts` in PRD R4 and exercises 80+ public
 * APIs synchronously for the coverage gate.
 *
 * This barrel re-exports that driver from the `tests/simple-rpg/game/`
 * canonical home defined by RS1. RS3 grows the matrix incrementally: as
 * scenarios / pieces / systems / render layers each warrant their own
 * sibling file, this barrel re-exports them.
 *
 * `createFixedSimpleRpgGame()` is the world-creation helper consumed by
 * `tests/e2e/local-assets/third-party-assets.test.ts` — it returns the
 * scenario runtime, which extends `GameboardRuntime` (so `.world` is the
 * koota `World` consumers spawn into).
 *
 * Tests + the bootstrap-target convention live at the directory siblings:
 *   tests/simple-rpg/assets-embedded/        (local EXTRA-pack pieces)
 *   tests/simple-rpg/assets-bootstrap-target/  (RB bootstrap destination)
 *
 * @module
 */

import {
  createGameboardRuntimeFromScenario,
  type GameboardScenario,
  type GameboardScenarioGameRuntime,
} from '../../../src';
import scenarioJson from '../../integration/simple-rpg/fixtures/simple-rpg-scenario.json';

export {
  listSimpleRpgGuidePublicApiExercises,
  runSimpleRpgExecutableGuideApiSmoke,
  runSimpleRpgUsageExample,
  summarizeSimpleRpgGuidePublicApiExercises,
} from '../../integration/simple-rpg/simple-rpg';

export type {
  SimpleRpgExecutableGuideApiSmokeSummary,
  SimpleRpgGuidePublicApiExercise,
  SimpleRpgGuidePublicApiExerciseCoverage,
  SimpleRpgUsageSummary,
} from '../../integration/simple-rpg/simple-rpg';

/**
 * Create the fixed-scenario SimpleRPG runtime — the canonical world used by
 * the local-third-party-assets e2e and the upcoming F-Gallery scenarios.
 *
 * Wraps `createGameboardWorldFromScenario` against the packaged SimpleRPG
 * fixture. Returns the full scenario runtime, which extends
 * `GameboardRuntime` (so `.world` is the koota `World` consumers spawn
 * into).
 */
export function createFixedSimpleRpgGame(): GameboardScenarioGameRuntime {
  return createGameboardRuntimeFromScenario(scenarioJson as GameboardScenario);
}
