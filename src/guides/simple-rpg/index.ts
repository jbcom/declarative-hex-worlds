/**
 * SimpleRPG guide module — public API exercise catalog and executable smoke helpers.
 *
 * @module
 */
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
