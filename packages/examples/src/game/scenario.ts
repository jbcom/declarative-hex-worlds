/**
 * SimpleRPG scenario — the in-repo reference game's data + runtime.
 *
 * SimpleRPG is the exhaustive exerciser of `declarative-hex-worlds`: it consumes
 * the library as a real game (by package name, through the public subpaths),
 * compiling a JSON scenario into a live koota runtime and rendering it through the
 * declarative element surface. This module owns the game's data + runtime; the
 * render surface lives in `../board`.
 *
 * @module
 */
import { createGameboardRuntimeFromScenario } from 'declarative-hex-worlds/runtime';
import {
  type GameboardScenario,
  validateGameboardScenario,
} from 'declarative-hex-worlds/scenario';
import scenarioJson from './fixtures/scenario.json' with { type: 'json' };

/** The SimpleRPG scenario, loaded from its bundled JSON. */
export const simpleRpgScenario = scenarioJson as unknown as GameboardScenario;

/** Validate the SimpleRPG scenario (schema, actor/quest refs). Throws on invalid. */
export function assertSimpleRpgScenarioValid(): void {
  const violations = validateGameboardScenario(simpleRpgScenario);
  if (violations.length > 0) {
    throw new Error(
      `SimpleRPG scenario is invalid: ${violations.map((v) => v.message).join('; ')}`
    );
  }
}

/**
 * Compile the SimpleRPG scenario into a live runtime facade (koota world + bound
 * actor/quest/command/system actions). This is what the render surface mounts.
 */
export function createSimpleRpgRuntime(): ReturnType<typeof createGameboardRuntimeFromScenario> {
  return createGameboardRuntimeFromScenario(simpleRpgScenario);
}
