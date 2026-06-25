import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import { planGameboardSpawnGroups } from '../../gameboard';
import { GameboardCliError } from '../../errors';
import {
  layoutAnalysisPlanFromArgs,
  validationConfigFromArgs,
  printViolations,
  safeResolveOutput,
  readSpawnGroupOptions,
  printSpawnGroupPlan,
  type ParsedArgs,
} from '../_shared';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runSpawnGroups(parsed, sourceRoot, edition);
}

function runSpawnGroups(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const inputFlags = ['plan', 'recipe', 'scenario'].filter(
    (key) => typeof parsed.flags[key] === 'string'
  );
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'spawn-groups requires exactly one of --plan <path>, --recipe <path>, or --scenario <path>'
    );
  }
  if (typeof parsed.flags.groups !== 'string') {
    throw new GameboardCliError('spawn-groups requires --groups <path>');
  }
  const { plan, violations } = layoutAnalysisPlanFromArgs(
    parsed,
    validationConfigFromArgs(parsed, sourceRoot, edition),
    parsed.flags.allowInvalid === true
  );
  if (
    violations.some((violation) => violation.severity === 'error') &&
    parsed.flags.allowInvalid !== true
  ) {
    printViolations(violations);
    process.exit(1);
  }

  const options = readSpawnGroupOptions(resolve(parsed.flags.groups), parsed.flags.seed);
  const spawnPlan = planGameboardSpawnGroups(plan, options);
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(spawnPlan, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote spawn group plan to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(spawnPlan, null, 2));
  } else {
    printSpawnGroupPlan(spawnPlan);
  }
  if (spawnPlan.errors.length > 0) {
    process.exit(1);
  }
  /* v8 ignore next 3 -- spawn-group planner currently emits fatal errors only; warning exits are reserved for future warning emitters. */
  if (parsed.flags.failOnWarning === true && spawnPlan.warnings.length > 0) {
    process.exit(1);
  }
}
