/**
 * SimpleRPG game entry (PRD RS1).
 *
 * The actual game implementation lives at
 * `tests/integration/simple-rpg/simple-rpg.ts` — that file was migrated from
 * `examples/simple-rpg-usage.ts` in PRD R4 and exercises 80+ public APIs
 * synchronously for the coverage gate.
 *
 * This barrel re-exports that driver from the `tests/simple-rpg/game/`
 * canonical home defined by the PRD. As RS3 grows the matrix (scenarios,
 * pieces, systems, render layers), the implementation decomposes into
 * sibling files in this directory and the existing driver becomes a thin
 * orchestrator.
 *
 * Tests + the bootstrap-target convention live at the directory siblings:
 *   tests/simple-rpg/assets-embedded/        (local EXTRA-pack pieces)
 *   tests/simple-rpg/assets-bootstrap-target/  (RB bootstrap destination)
 *
 * @module
 */

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
