import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import type { GameboardPatrolSimulationActorAssignment, GameboardPatrolSimulationScriptPlan } from '../../simulation';
import { createGameboardPatrolSimulationScript } from '../../simulation';
import type { GameboardScenario } from '../../scenario';
import { GameboardCliError } from '../../errors';
import {
  type ParsedArgs,
  isRecord,
  patrolRouteSetFromArgs,
  readJson,
  readNumberFlag,
  relativizePath,
  safeResolveOutput,
} from '../_shared';

function readPatrolSimulationAssignments(
  parsed: ParsedArgs
): readonly GameboardPatrolSimulationActorAssignment[] {
  const rounds = readNumberFlag(parsed.flags.rounds);
  if (typeof parsed.flags.assignments === 'string') {
    const payload = readJson(resolve(parsed.flags.assignments));
    const assignments = Array.isArray(payload)
      ? (payload as readonly GameboardPatrolSimulationActorAssignment[])
      : isRecord(payload) && Array.isArray(payload.assignments)
        ? (payload.assignments as readonly GameboardPatrolSimulationActorAssignment[])
        : undefined;
    if (!Array.isArray(assignments)) {
      throw new GameboardCliError(
        `Patrol assignment file ${relativizePath(String(parsed.flags.assignments))} must be an array or { "assignments": [...] }`
      );
    }
    return assignments.map((assignment) => ({
      ...assignment,
      rounds: assignment.rounds ?? rounds,
    }));
  }
  if (typeof parsed.flags.routeId === 'string' && typeof parsed.flags.actorId === 'string') {
    return [
      {
        routeId: parsed.flags.routeId,
        actorId: parsed.flags.actorId,
        rounds,
        stepIdPrefix: typeof parsed.flags.idPrefix === 'string' ? parsed.flags.idPrefix : undefined,
      },
    ];
  }
  throw new GameboardCliError(
    'patrol-script requires --assignments <path> or both --routeId <id> and --actorId <id>'
  );
}

function printPatrolSimulationScriptPlan(plan: GameboardPatrolSimulationScriptPlan): void {
  console.log(`patrol simulation steps: ${plan.stepCount}`);
  console.log(`assignments: ${plan.assignments.length}`);
  for (const assignment of plan.assignments) {
    console.log(
      `  - ${assignment.actorId} -> ${assignment.routeId}: ${assignment.stepCount} step(s), ${assignment.roundCount} round(s)`
    );
    for (const warning of assignment.warnings) {
      console.log(`    warning: ${warning}`);
    }
    for (const error of assignment.errors) {
      console.log(`    error: ${error}`);
    }
  }
  console.log(`warnings: ${plan.warnings.length}`);
  console.log(`errors: ${plan.errors.length}`);
}

export function runPatrolScript(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  const scenarioPayload =
    typeof parsed.flags.scenario === 'string'
      ? readJson(resolve(parsed.flags.scenario))
      : undefined;
  if (
    scenarioPayload !== undefined &&
    (typeof scenarioPayload !== 'object' || scenarioPayload === null || Array.isArray(scenarioPayload))
  ) {
    throw new GameboardCliError(
      `Scenario file ${relativizePath(String(parsed.flags.scenario))} must be a JSON object`
    );
  }
  const scenario = scenarioPayload as GameboardScenario | undefined;
  const routeSet = patrolRouteSetFromArgs(parsed, sourceRoot, edition, scenario);
  const scriptPlan = createGameboardPatrolSimulationScript({
    routes: routeSet,
    assignments: readPatrolSimulationAssignments(parsed),
    requireFoundRoutes: parsed.flags.allowInvalid !== true,
  });

  const payload = parsed.flags.includeReport === true ? scriptPlan : scriptPlan.script;
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote patrol simulation script to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printPatrolSimulationScriptPlan(scriptPlan);
  }

  if (scriptPlan.errors.length > 0 && parsed.flags.allowInvalid !== true) {
    process.exit(1);
  }
  if (scriptPlan.warnings.length > 0 && parsed.flags.failOnWarning === true) {
    process.exit(1);
  }
}

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runPatrolScript(parsed, sourceRoot, edition);
}
