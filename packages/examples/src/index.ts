/**
 * `@declarative-hex-worlds/examples` — reference examples exercising every
 * declarative-hex-worlds renderer binding.
 *
 * A single renderer-free GAME (`./game` — worldgen, scenario, quest line, all
 * public-API) is rendered by each binding example: `./three` renders it through
 * `declarative-hex-worlds/three`, `./canvas2d` through `declarative-hex-worlds/canvas2d`.
 * This proves each binding on the SAME game (apples-to-apples), gives each binding a
 * real render test, and is the source of the docs-site live islands. Not published.
 *
 * @module
 */

// Shared renderer-free game (public-API worldgen + quest line + scenario).
export {
  type SimpleRpgActor,
  type SimpleRpgActorKind,
  type SimpleRpgActorTargetCommandResult,
  type SimpleRpgGame,
  type SimpleRpgQuestObjective,
  type SimpleRpgQuestObjectiveStatus,
  type SimpleRpgQuestResult,
  SIMPLE_RPG_FIXED_SEED,
  SIMPLE_RPG_RANDOM_SEED,
  assertSimpleRpgGameValid,
  classifySimpleRpgPlacement,
  createFixedSimpleRpgGame,
  createSeededSimpleRpgGame,
  runSimpleRpgQuestLine,
} from './game/quest-game';
export {
  assertSimpleRpgScenarioValid,
  createSimpleRpgRuntime,
  simpleRpgScenario,
} from './game/scenario';

// three (3D) binding example.
export { type SimpleRpgBoardProps, SimpleRpgBoard } from './three/board';

// canvas-2D binding example — the SAME game rendered in 2D.
export {
  createCanvas2dExamplePlan,
  createCanvas2dExampleSource,
  renderCanvas2dExample,
} from './canvas2d/board';
