import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import {
  createGameboardWorldFromScenario,
  inspectGameboardScenario,
  type GameboardScenario,
} from '../../scenario';
import {
  printViolations,
  readJson,
  safeResolveOutput,
  validationConfigFromArgs,
  type ParsedArgs,
} from '../_shared';

export async function run(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  if (typeof parsed.flags.scenario !== 'string') {
    throw new GameboardCliError('validate-scenario requires --scenario <path>');
  }
  const scenario = readJson<GameboardScenario>(resolve(parsed.flags.scenario));
  const inspection = inspectGameboardScenario(scenario, {
    plan: validationConfigFromArgs(parsed, sourceRoot, edition),
  });
  const hasScenarioErrors = inspection.violations.some(
    (violation) => violation.severity === 'error'
  );
  const runtime = hasScenarioErrors ? undefined : createGameboardWorldFromScenario(scenario);
  if (typeof parsed.flags.outPlan === 'string' && (inspection.plan ?? runtime?.plan)) {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(inspection.plan ?? runtime?.plan, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
  }
  const violations = [...inspection.violations];
  if (parsed.flags.json === true) {
    console.log(
      JSON.stringify(
        {
          scenario: scenario.id,
          actors:
            runtime?.actors.map((actor) => actor.actor.actorId) ??
            scenario.actors?.map((actor) => actor.actorId) ??
            [],
          quests:
            runtime?.quests.map((quest) => quest.quest.questId) ??
            scenario.quests?.map((quest) => quest.id) ??
            [],
          spawnGroups: inspection.spawnGroups,
          patrolRoutes: inspection.patrolRoutes,
          violations,
        },
        null,
        2
      )
    );
  } else {
    console.log(`scenario: ${scenario.id}`);
    console.log(`actors: ${runtime?.actors.length ?? scenario.actors?.length ?? 0}`);
    console.log(`quests: ${runtime?.quests.length ?? scenario.quests?.length ?? 0}`);
    if (inspection.spawnGroups) {
      const foundRoutes = inspection.spawnGroups.routeChecks.filter(
        (route) => route.found
      ).length;
      console.log(
        `spawn groups: ${inspection.spawnGroups.groupCount} group(s), ${inspection.spawnGroups.selectedLocationCount} location(s), ${foundRoutes}/${inspection.spawnGroups.routeChecks.length} route(s)`
      );
    }
    if (inspection.patrolRoutes) {
      const foundPatrolRoutes = inspection.patrolRoutes.routes.filter(
        (route) => route.found
      ).length;
      console.log(
        `patrol routes: ${foundPatrolRoutes}/${inspection.patrolRoutes.routeCount} complete`
      );
    }
    printViolations(violations);
  }
  if (violations.some((violation) => violation.severity === 'error')) {
    process.exit(1);
  }
}
