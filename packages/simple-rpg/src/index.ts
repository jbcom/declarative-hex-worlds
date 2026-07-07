/**
 * `@declarative-hex-worlds/simple-rpg` — the in-repo reference game that
 * exercises every declarative-hex-worlds capability as a REAL consumer.
 *
 * It consumes the library by package name through the public subpaths (never
 * reaching into internals), compiles a JSON scenario into a live runtime, and
 * renders it through the declarative element surface. SimpleRPG is the library's
 * real-world exerciser + e2e + the source of the docs-site live island and
 * visual-verification showcases.
 *
 * @module
 */
export {
  assertSimpleRpgScenarioValid,
  createSimpleRpgRuntime,
  simpleRpgScenario,
} from './game/scenario';
export { type SimpleRpgBoardProps, SimpleRpgBoard } from './board';
