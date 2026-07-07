import { describe, expect, it } from 'vitest';
import {
  assertSimpleRpgScenarioValid,
  createSimpleRpgRuntime,
  simpleRpgScenario,
} from '../scenario';

describe('SimpleRPG scenario (real consumer of declarative-hex-worlds)', () => {
  it('bundles a valid scenario', () => {
    expect(simpleRpgScenario.id).toBe('docs-simple-rpg-scenario');
    // Validates against the library's scenario schema — throws if invalid.
    expect(() => assertSimpleRpgScenarioValid()).not.toThrow();
  });

  it('compiles the scenario into a live runtime with a board + actors', () => {
    const runtime = createSimpleRpgRuntime();
    const plan = runtime.plan();
    // The board compiled to tiles (the 8 board steps produced a hex board).
    expect(plan.tiles.length).toBeGreaterThan(0);
    // The scenario's 3 actors spawned into the runtime.
    expect(runtime.readActors().length).toBeGreaterThanOrEqual(3);
  });
});
