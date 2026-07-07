/**
 * SimpleRPG guide module — public API exercise catalog and executable smoke helpers.
 *
 * This is the library's OWN instrumentation of its guide-facing public APIs (it
 * backs `doctor --coverage`). It owns its reference scenario fixture here so the
 * doctor gate is fully self-contained in `src/` — nothing in `src/` reaches into
 * a test tree, and the game package (which has its own scenario copy) is not a
 * dependency of the library's coverage gate.
 *
 * @module
 */
import type { GameboardScenario } from '../scenario';
import guideScenarioJson from './fixtures/scenario.json' with { type: 'json' };
import { runSimpleRpgExecutableGuideApiSmoke } from './smoke';
import type { SimpleRpgExecutableGuideApiSmokeSummary } from './types';

export type {
  SimpleRpgExecutableGuideApiSmokeSummary,
  SimpleRpgGuidePublicApiExercise,
  SimpleRpgGuidePublicApiExerciseCoverage,
  SimpleRpgGuidePublicApiExerciseMode,
} from './types';
export {
  listSimpleRpgGuidePublicApiExercises,
  summarizeSimpleRpgGuidePublicApiExercises,
} from './exercises';
export { runSimpleRpgExecutableGuideApiSmoke } from './smoke';

/** The library-owned SimpleRPG reference scenario backing the doctor coverage gate. */
export const guideCoverageScenario = guideScenarioJson as unknown as GameboardScenario;

/**
 * Run the guide-API smoke against the library's OWN reference scenario. The
 * self-contained no-arg form used by the doctor coverage gate — the scenario is
 * owned here (`./fixtures/scenario.json`), so callers need not thread a fixture.
 */
export function runSimpleRpgGuideApiSmoke(): SimpleRpgExecutableGuideApiSmokeSummary {
  return runSimpleRpgExecutableGuideApiSmoke(guideCoverageScenario);
}
