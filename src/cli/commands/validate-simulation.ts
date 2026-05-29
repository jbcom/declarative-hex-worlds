import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import { inspectGameboardScenario, type GameboardScenario } from '../../scenario';
import { inspectGameboardScenarioSimulationScript } from '../../simulation';
import { GameboardCliError } from '../../errors';
import {
  readJson,
  readSimulationScript,
  relativizePath,
  validationConfigFromArgs,
  printViolations,
  safeResolveOutput,
  type ParsedArgs,
} from '../_shared';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runValidateSimulation(parsed, sourceRoot, edition);
}

function runValidateSimulation(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  if (typeof parsed.flags.scenario !== 'string') {
    throw new GameboardCliError('validate-simulation requires --scenario <path>');
  }
  if (typeof parsed.flags.script !== 'string') {
    throw new GameboardCliError('validate-simulation requires --script <path>');
  }

  const scenarioRaw = readJson(resolve(parsed.flags.scenario));
  if (typeof scenarioRaw !== 'object' || scenarioRaw === null || Array.isArray(scenarioRaw)) {
    throw new GameboardCliError(
      `Scenario file ${relativizePath(String(parsed.flags.scenario))} must be a JSON object`
    );
  }
  const scenario = scenarioRaw as GameboardScenario;
  const scenarioInspection = inspectGameboardScenario(scenario, {
    plan: validationConfigFromArgs(parsed, sourceRoot, edition),
  });
  const script = readSimulationScript(resolve(parsed.flags.script));
  const scriptInspection = inspectGameboardScenarioSimulationScript(script, {
    scenario,
    plan: scenarioInspection.plan,
  });
  const violations = [...scenarioInspection.violations, ...scriptInspection.violations];

  if (typeof parsed.flags.outPlan === 'string' && scenarioInspection.plan) {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(scenarioInspection.plan, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`
    );
  }

  if (parsed.flags.json === true) {
    console.log(
      JSON.stringify(
        {
          scenario: scenario.id,
          steps: Array.isArray(script.steps) ? script.steps.length : 0,
          actors: scenario.actors?.map((actor) => actor.actorId) ?? [],
          quests: scenario.quests?.map((quest) => quest.id) ?? [],
          violations,
        },
        null,
        2
      )
    );
  } else {
    console.log(`scenario: ${scenario.id}`);
    console.log(`steps: ${Array.isArray(script.steps) ? script.steps.length : 0}`);
    console.log(`actors: ${scenario.actors?.length ?? 0}`);
    console.log(`quests: ${scenario.quests?.length ?? 0}`);
    printViolations(violations);
  }

  if (violations.some((violation) => violation.severity === 'error')) {
    process.exit(1);
  }
}
