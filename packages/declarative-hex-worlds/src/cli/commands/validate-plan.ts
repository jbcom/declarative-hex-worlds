import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import { validateGameboardPlan } from '../../rules';
import type { GameboardPlan } from '../../gameboard';
import {
  printViolations,
  readJson,
  validationConfigFromArgs,
  type ParsedArgs,
} from '../_shared';

export async function run(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  if (typeof parsed.flags.plan !== 'string') {
    throw new GameboardCliError('validate-plan requires --plan <path>');
  }
  const plan = readJson(resolve(parsed.flags.plan)) as GameboardPlan;
  const violations = validateGameboardPlan(
    plan,
    validationConfigFromArgs(parsed, sourceRoot, edition)
  );
  if (parsed.flags.json === true) {
    console.log(JSON.stringify(violations, null, 2));
  } else {
    printViolations(violations);
  }
  if (violations.some((violation) => violation.severity === 'error')) {
    process.exit(1);
  }
}
