import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import { inspectGameboardRecipe, type GameboardRecipe } from '../../scenario';
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
  if (typeof parsed.flags.recipe !== 'string') {
    throw new GameboardCliError('validate-recipe requires --recipe <path>');
  }
  const recipe = readJson(resolve(parsed.flags.recipe)) as GameboardRecipe;
  const inspection = inspectGameboardRecipe(recipe, {
    plan: validationConfigFromArgs(parsed, sourceRoot, edition),
  });
  if (typeof parsed.flags.outPlan === 'string' && inspection.plan) {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(inspection.plan, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
  }
  const violations = inspection.violations;
  if (parsed.flags.json === true) {
    console.log(JSON.stringify(violations, null, 2));
  } else {
    printViolations(violations);
  }
  if (violations.some((violation) => violation.severity === 'error')) {
    process.exit(1);
  }
}
