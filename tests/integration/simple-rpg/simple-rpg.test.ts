/**
 * SimpleRPG integration test (PRD RS2 — Node side).
 *
 * Runs in the default `pnpm test` loop. No browser, no bootstrap, no
 * network. Exercises the SimpleRPG driver's full synchronous path through
 * the library's public API and asserts the shapes that downstream
 * consumers (the CLI's coverage gate, the docs-site SimpleRPG evidence
 * matrix, the visual gallery) rely on.
 *
 * The two browser-side e2e variants (`tests/e2e/simple-rpg-ci.test.ts` +
 * `tests/e2e/simple-rpg-local-extra.test.ts`) layer rendering + bootstrap
 * on top of these same scenario shapes.
 *
 * Note: each `runSimpleRpgUsageExample()` / `runSimpleRpgExecutableGuideApiSmoke()`
 * call creates one or more koota Worlds, and koota caps live worlds at 16
 * per process. Tests carefully share fixtures rather than re-invoking the
 * summary functions in every `it` block.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';
import {
  listSimpleRpgGuidePublicApiExercises,
  runSimpleRpgUsageExample,
  summarizeSimpleRpgGuidePublicApiExercises,
  type SimpleRpgUsageSummary,
} from './simple-rpg';

describe('SimpleRPG integration driver (PRD RS2)', () => {
  // One invocation; share across the assertion-grouped tests.
  const summary: SimpleRpgUsageSummary = runSimpleRpgUsageExample();

  it('produces a valid scenario with no validation errors', () => {
    expect(summary.scenarioId).toBeTypeOf('string');
    expect(summary.scenarioId.length).toBeGreaterThan(0);
    expect(summary.validationErrorCount).toBe(0);
  });

  it('resolves scenario spawn groups and patrol routes from the packaged JSON', () => {
    expect(summary.scenarioSpawnGroupIds.length).toBeGreaterThan(0);
    expect(summary.scenarioSpawnLocationIds.length).toBeGreaterThanOrEqual(
      summary.scenarioSpawnGroupIds.length
    );
    expect(summary.scenarioSpawnRouteCount).toBeGreaterThanOrEqual(0);
    expect(summary.scenarioPatrolRouteIds.length).toBeGreaterThan(0);
    expect(summary.scenarioPatrolWaypointCount).toBeGreaterThan(0);
  });

  it('emits an interop snapshot with entities + relations', () => {
    expect(summary.interopEntityCount).toBeGreaterThan(0);
    expect(summary.interopRelationCount).toBeGreaterThanOrEqual(0);
  });

  it('runs the packaged simulation script to completion with expected events', () => {
    expect(summary.simulationSucceeded).toBe(true);
    expect(summary.eventTypes.length).toBeGreaterThan(0);
    expect(summary.actorTargetRecordCount).toBeGreaterThanOrEqual(0);
    expect(summary.actorTargetScanCount).toBeGreaterThanOrEqual(0);
  });

  it('reports actor-target inspection results: target ids, reachability, command kinds', () => {
    expect(summary.actorTargetTargetIds.length).toBeGreaterThanOrEqual(0);
    expect(summary.reachableActorTargetIds.length).toBeLessThanOrEqual(
      summary.actorTargetTargetIds.length
    );
    expect(summary.actorTargetCommandKinds.length).toBeGreaterThanOrEqual(0);
  });

  it('reports runtime facade actor-target interaction with handler resolution', () => {
    expect(summary.runtimeActorTargetEventTypes.length).toBeGreaterThanOrEqual(0);
    expect(typeof summary.runtimeActorTargetHandled).toBe('boolean');
    if (summary.runtimeActorTargetCommandKind !== undefined) {
      expect(summary.runtimeActorTargetCommandKind).toBeTypeOf('string');
    }
  });

  it('tracks every actor to a final tile + names completed quests', () => {
    const actorIds = Object.keys(summary.finalActorTiles);
    expect(actorIds.length).toBeGreaterThan(0);
    for (const tileKey of Object.values(summary.finalActorTiles)) {
      expect(tileKey).toMatch(/^-?\d+,-?\d+$/);
    }
    expect(summary.completedQuestIds.length).toBeGreaterThanOrEqual(0);
  });

  it('reports guide-API exercise coverage without missing or stale entries', () => {
    expect(summary.guidePublicApiCount).toBeGreaterThanOrEqual(40);
    expect(summary.exercisedGuidePublicApiCount).toBe(summary.guidePublicApiCount);
    expect(summary.missingGuidePublicApis).toEqual([]);
    expect(summary.staleGuidePublicApis).toEqual([]);

    const modeSum = Object.values(summary.guidePublicApiExerciseModes).reduce<number>(
      (acc, n) => acc + n,
      0
    );
    expect(modeSum).toBeGreaterThanOrEqual(summary.exercisedGuidePublicApiCount);
  });

  it('embeds an executable guide-API smoke summary inside the larger summary', () => {
    const smoke = summary.executableGuideApiSmoke;
    expect(smoke.directPublicApiCount).toBeGreaterThan(0);
    expect(smoke.publicTreatmentCount).toBeGreaterThan(0);
    expect(smoke.guideScenarioCount).toBeGreaterThan(0);
    expect(smoke.directPublicApiCount).toBeLessThanOrEqual(summary.guidePublicApiCount);
  });
});

describe('SimpleRPG exercise catalog (PRD RS2)', () => {
  // Pure-data calls — no world creation, safe to invoke per-test.
  it('listSimpleRpgGuidePublicApiExercises returns at least one entry per guide-page API', () => {
    const exercises = listSimpleRpgGuidePublicApiExercises();
    expect(exercises.length).toBeGreaterThanOrEqual(40);
    for (const ex of exercises) {
      expect(ex.publicApi).toBeTypeOf('string');
      expect(ex.publicApi.length).toBeGreaterThan(0);
      expect(ex.mode).toBeTypeOf('string');
    }
  });

  it('summarizeSimpleRpgGuidePublicApiExercises is internally consistent', () => {
    const summary = summarizeSimpleRpgGuidePublicApiExercises();
    expect(summary.exercises.length).toBe(summary.guidePublicApiCount);
    expect(summary.exercisedPublicApiCount).toBeLessThanOrEqual(summary.guidePublicApiCount);
    expect(summary.missingPublicApis.length).toBe(
      summary.guidePublicApiCount - summary.exercisedPublicApiCount
    );

    const modeSum = Object.values(summary.exerciseModeCounts).reduce<number>(
      (acc, n) => acc + n,
      0
    );
    expect(modeSum).toBeGreaterThanOrEqual(summary.exercisedPublicApiCount);
  });
});
