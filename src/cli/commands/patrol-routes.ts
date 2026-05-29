import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import type { GameboardPatrolRouteSet } from '../../gameboard';
import { planGameboardPatrolRoutes } from '../../gameboard';
import type { GameboardScenario } from '../../scenario';
import { GameboardCliError } from '../../errors';
import {
  type ParsedArgs,
  patrolSpawnGroupsFromArgs,
  printSpawnGroupPlan,
  printViolations,
  readJson,
  readPatrolRouteOptions,
  routePlanningPlanFromArgs,
  safeResolveOutput,
  validationConfigFromArgs,
} from '../_shared';

function printPatrolRouteSet(routeSet: GameboardPatrolRouteSet): void {
  console.log(`patrol seed: ${routeSet.seed}`);
  console.log(`routes: ${routeSet.routeCount}`);
  console.log(
    `complete: ${routeSet.routes.filter((route) => route.found).length}/${routeSet.routes.length}`
  );
  for (const route of routeSet.routes) {
    console.log(
      `  - ${route.id}: ${route.selectedWaypointCount}/${route.requestedWaypointCount} waypoint(s), ${route.segments.filter((segment) => segment.found).length}/${route.segments.length} segment(s)`
    );
    if (route.waypoints.length > 0) {
      console.log(`    tiles: ${route.waypoints.map((waypoint) => waypoint.key).join(', ')}`);
    }
    if (route.pathKeys.length > 0) {
      console.log(`    path: ${route.pathKeys.join(' -> ')}`);
    }
    for (const warning of route.warnings) {
      console.log(`    warning: ${warning}`);
    }
    for (const error of route.errors) {
      console.log(`    error: ${error}`);
    }
  }
}

export function runPatrolRoutes(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  const inputFlags = ['plan', 'recipe', 'scenario'].filter(
    (key) => typeof parsed.flags[key] === 'string'
  );
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'patrol-routes requires exactly one of --plan <path>, --recipe <path>, or --scenario <path>'
    );
  }
  const scenario =
    typeof parsed.flags.scenario === 'string'
      ? readJson(resolve(parsed.flags.scenario)) as GameboardScenario
      : undefined;
  if (typeof parsed.flags.routes !== 'string' && !scenario?.patrolRoutes?.length) {
    throw new GameboardCliError(
      'patrol-routes requires --routes <path> unless --scenario includes patrolRoutes'
    );
  }

  const { plan, violations } = routePlanningPlanFromArgs(
    parsed,
    validationConfigFromArgs(parsed, sourceRoot, edition),
    parsed.flags.allowInvalid === true,
    scenario
  );
  if (
    violations.some((violation) => violation.severity === 'error') &&
    parsed.flags.allowInvalid !== true
  ) {
    printViolations(violations);
    process.exit(1);
  }

  const spawnGroups = patrolSpawnGroupsFromArgs(parsed, plan, scenario);
  if (spawnGroups?.errors.length && parsed.flags.allowInvalid !== true) {
    printSpawnGroupPlan(spawnGroups);
    process.exit(1);
  }

  const routeOptions =
    typeof parsed.flags.routes === 'string'
      ? readPatrolRouteOptions(resolve(parsed.flags.routes), parsed.flags.seed)
      : {
          seed:
            typeof parsed.flags.seed === 'string'
              ? parsed.flags.seed
              : `${scenario?.id ?? plan.seed}:patrol-routes`,
          routes: scenario?.patrolRoutes ?? [],
        };
  const routeSet = planGameboardPatrolRoutes(plan, {
    ...routeOptions,
    spawnGroups,
  });

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(routeSet, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote patrol route plan to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(routeSet, null, 2));
  } else {
    printPatrolRouteSet(routeSet);
  }
  if (routeSet.errors.length > 0) {
    process.exit(1);
  }
  if (parsed.flags.failOnWarning === true && routeSet.warnings.length > 0) {
    process.exit(1);
  }
}

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runPatrolRoutes(parsed, sourceRoot, edition);
}
