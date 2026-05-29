import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GameboardScenarioInteropOptions } from '../../interop';
import {
  createGameboardInteropSnapshot,
  createGameboardScenarioInteropSnapshot,
} from '../../interop';
import {
  inspectGameboardRecipe,
  inspectGameboardScenario,
  type GameboardRecipe,
  type GameboardScenario,
} from '../../scenario';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import {
  type ParsedArgs,
  relativizePath,
  safeResolveOutput,
  validationConfigFromArgs,
  readJson,
  readNumberFlag,
  printViolations,
} from '../_shared';
import type { GameboardPlanValidationConfig } from '../../rules';
import { validateGameboardPlan } from '../../rules';
import type { GameboardPlan } from '../../gameboard';

export function snapshotOptionsFromFlags(
  flags: Record<string, string | boolean>
): GameboardScenarioInteropOptions {
  const options: GameboardScenarioInteropOptions = {};
  if (flags.excludePlacements === true) {
    options.includePlacements = false;
  }
  if (flags.excludeActors === true) {
    options.includeActors = false;
  }
  if (flags.excludeQuests === true) {
    options.includeQuests = false;
  }
  if (flags.excludeSpawnGroups === true) {
    options.includeSpawnGroups = false;
  }
  const spawnCount = readNumberFlag(flags.spawnCount);
  if (spawnCount !== undefined) {
    options.spawnLocations = {
      count: spawnCount,
      seed: typeof flags.spawnSeed === 'string' ? flags.spawnSeed : undefined,
      minDistance: readNumberFlag(flags.spawnMinDistance),
      edgePadding: readNumberFlag(flags.spawnEdgePadding),
    };
  }
  return options;
}

export function failOnSnapshotViolations(
  violations: ReadonlyArray<ReturnType<typeof validateGameboardPlan>[number]>,
  allowInvalid: boolean
): void {
  if (allowInvalid || !violations.some((violation) => violation.severity === 'error')) {
    return;
  }
  printViolations(violations);
  process.exit(1);
}

export function snapshotFromPlan(
  path: string,
  validationConfig: GameboardPlanValidationConfig,
  options: GameboardScenarioInteropOptions,
  allowInvalid: boolean
) {
  const plan = readJson(resolve(path)) as GameboardPlan;
  const violations = validateGameboardPlan(plan, validationConfig);
  failOnSnapshotViolations(violations, allowInvalid);
  return createGameboardInteropSnapshot(plan, options);
}

export function snapshotFromRecipe(
  path: string,
  validationConfig: GameboardPlanValidationConfig,
  options: GameboardScenarioInteropOptions,
  allowInvalid: boolean
) {
  const recipe = readJson(resolve(path)) as GameboardRecipe;
  const inspection = inspectGameboardRecipe(recipe, { plan: validationConfig });
  failOnSnapshotViolations(inspection.violations, allowInvalid);
  if (!inspection.plan) {
    throw new GameboardCliError(
      `Recipe ${relativizePath(path)} did not compile to a GameboardPlan`
    );
  }
  return createGameboardInteropSnapshot(inspection.plan, options);
}

export function snapshotFromScenario(
  path: string,
  validationConfig: GameboardPlanValidationConfig,
  options: GameboardScenarioInteropOptions,
  allowInvalid: boolean
) {
  const scenario = readJson(resolve(path)) as GameboardScenario;
  const inspection = inspectGameboardScenario(scenario, { plan: validationConfig });
  failOnSnapshotViolations(inspection.violations, allowInvalid);
  return createGameboardScenarioInteropSnapshot(scenario, options);
}

export function runSnapshot(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const inputFlags = ['plan', 'recipe', 'scenario'].filter(
    (key) => typeof parsed.flags[key] === 'string'
  );
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'snapshot requires exactly one of --plan <path>, --recipe <path>, or --scenario <path>'
    );
  }

  const validationConfig = validationConfigFromArgs(parsed, sourceRoot, edition);
  const options = snapshotOptionsFromFlags(parsed.flags);
  const allowInvalid = parsed.flags.allowInvalid === true;
  const snapshot =
    typeof parsed.flags.plan === 'string'
      ? snapshotFromPlan(parsed.flags.plan, validationConfig, options, allowInvalid)
      : typeof parsed.flags.recipe === 'string'
        ? snapshotFromRecipe(parsed.flags.recipe, validationConfig, options, allowInvalid)
        : snapshotFromScenario(
            String(parsed.flags.scenario),
            validationConfig,
            options,
            allowInvalid
          );

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(snapshot, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote interop snapshot with ${snapshot.entities.length} entities and ${snapshot.relations.length} relations to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else {
    console.log(JSON.stringify(snapshot, null, 2));
  }
}

export async function run(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  runSnapshot(parsed, sourceRoot, edition);
}
