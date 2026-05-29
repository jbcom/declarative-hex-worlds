import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import type { GameboardPlan } from '../../gameboard';
import { summarizeGameboardPlan } from '../../gameboard';
import {
  type GameboardRecipe,
  type GameboardScenario,
  inspectGameboardBlueprint,
  inspectGameboardRecipe,
  inspectGameboardScenario,
} from '../../scenario';
import { validateGameboardPlan, type GameboardPlanValidationConfig } from '../../rules';
import { GameboardCliError } from '../../errors';
import {
  readBlueprintOptions,
  readJson,
  relativizePath,
  validationConfigFromArgs,
  summaryOptionsFromFlags,
  printViolations,
  safeResolveOutput,
  formatShape,
  formatCounts,
  type ParsedArgs,
} from '../_shared';

export type GameboardPlanInputKind = 'plan' | 'recipe' | 'scenario' | 'blueprint';
export type GameboardPlanValidationViolation = ReturnType<typeof validateGameboardPlan>[number];

export interface GameboardPlanSummaryInput {
  source: {
    kind: GameboardPlanInputKind;
    path: string;
  };
  plan: GameboardPlan;
  violations: readonly GameboardPlanValidationViolation[];
}

export interface GameboardPlanSummaryPayload {
  source: GameboardPlanSummaryInput['source'];
  validation: {
    errorCount: number;
    warningCount: number;
    violations: readonly GameboardPlanValidationViolation[];
  };
  summary: ReturnType<typeof summarizeGameboardPlan>;
}

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runSummarizePlan(parsed, sourceRoot, edition);
}

function runSummarizePlan(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  const input = summaryPlanFromArgs(
    parsed,
    validationConfigFromArgs(parsed, sourceRoot, edition),
    parsed.flags.allowInvalid === true
  );
  const errorCount = input.violations.filter((violation) => violation.severity === 'error').length;
  const warningCount = input.violations.filter(
    (violation) => violation.severity === 'warning'
  ).length;
  if (errorCount > 0 && parsed.flags.allowInvalid !== true) {
    printViolations(input.violations);
    process.exit(1);
  }

  const payload: GameboardPlanSummaryPayload = {
    source: input.source,
    validation: {
      errorCount,
      warningCount,
      violations: input.violations,
    },
    summary: summarizeGameboardPlan(input.plan, summaryOptionsFromFlags(parsed.flags)),
  };

  if (typeof parsed.flags.outPlan === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(input.plan, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`
    );
  }

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote plan summary to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printGameboardPlanSummary(payload);
  }

  if (parsed.flags.failOnWarning === true && warningCount > 0) {
    process.exit(1);
  }
}

function summaryPlanFromArgs(
  parsed: ParsedArgs,
  validationConfig: GameboardPlanValidationConfig,
  allowInvalid: boolean
): GameboardPlanSummaryInput {
  const blueprintPath =
    typeof parsed.flags.blueprint === 'string'
      ? parsed.flags.blueprint
      : typeof parsed.flags.config === 'string'
        ? parsed.flags.config
        : undefined;
  const inputFlags = [
    ...['plan', 'recipe', 'scenario'].filter((key) => typeof parsed.flags[key] === 'string'),
    ...(blueprintPath ? ['blueprint'] : []),
  ];
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'summarize-plan requires exactly one of --plan <path>, --recipe <path>, --scenario <path>, or --blueprint <path>'
    );
  }

  if (typeof parsed.flags.plan === 'string') {
    const path = resolve(parsed.flags.plan);
    const plan = readJson(path) as GameboardPlan;
    return {
      source: { kind: 'plan', path },
      plan,
      violations: validateGameboardPlan(plan, validationConfig),
    };
  }

  if (typeof parsed.flags.recipe === 'string') {
    const path = resolve(parsed.flags.recipe);
    const inspection = inspectGameboardRecipe(readJson(path) as GameboardRecipe, {
      plan: validationConfig,
    });
    if (!inspection.plan) {
      if (!allowInvalid) {
        printViolations(inspection.violations);
        process.exit(1);
      }
      throw new GameboardCliError(
        `Recipe ${relativizePath(path)} did not compile to a GameboardPlan`
      );
    }
    return {
      source: { kind: 'recipe', path },
      plan: inspection.plan,
      violations: inspection.violations,
    };
  }

  if (typeof parsed.flags.scenario === 'string') {
    const path = resolve(parsed.flags.scenario);
    const inspection = inspectGameboardScenario(readJson(path) as GameboardScenario, {
      plan: validationConfig,
    });
    if (!inspection.plan) {
      if (!allowInvalid) {
        printViolations(inspection.violations);
        process.exit(1);
      }
      throw new GameboardCliError(
        `Scenario ${relativizePath(path)} did not compile to a GameboardPlan`
      );
    }
    return {
      source: { kind: 'scenario', path },
      plan: inspection.plan,
      violations: inspection.violations,
    };
  }

  const path = resolve(String(blueprintPath));
  const inspection = inspectGameboardBlueprint(readBlueprintOptions(parsed.flags));
  return {
    source: { kind: 'blueprint', path },
    plan: inspection.plan,
    violations: validateGameboardPlan(inspection.plan, validationConfig),
  };
}

function printGameboardPlanSummary(payload: GameboardPlanSummaryPayload): void {
  const { summary, validation, source } = payload;
  const topAssets = summary.topAssets.slice(0, 10).map((asset) => {
    const suffix = asset.requiresExtra ? '*' : '';
    return `${asset.assetId}${suffix}=${asset.count}`;
  });
  console.log(`source: ${source.kind} ${source.path}`);
  console.log(`seed: ${summary.seed}`);
  console.log(`shape: ${formatShape(summary.shape)}`);
  console.log(`texture set: ${summary.textureSet}`);
  console.log(`tiles: ${summary.tileCount}`);
  console.log(`placements: ${summary.placementCount}`);
  console.log(`plan warnings: ${summary.warningCount}`);
  console.log(
    `validation: ${validation.errorCount} error(s), ${validation.warningCount} warning(s)`
  );
  console.log(`terrain: ${formatCounts(summary.tileTerrainCounts)}`);
  console.log(`textures: ${formatCounts(summary.tileTextureSetCounts)}`);
  console.log(`elevations: ${formatCounts(summary.tileElevationCounts)}`);
  console.log(`tile tags: ${formatCounts(summary.tileTagCounts)}`);
  console.log(`placement kinds: ${formatCounts(summary.placementKindCounts)}`);
  console.log(`placement layers: ${formatCounts(summary.placementLayerCounts)}`);
  console.log(`features: ${formatCounts(summary.placementFeatureCounts)}`);
  console.log(`requires extra placements: ${summary.requiresExtraPlacementCount}`);
  console.log(
    `extra assets: ${summary.extraAssetIds.length ? summary.extraAssetIds.join(', ') : 'none'}`
  );
  console.log(`top assets: ${topAssets.length ? topAssets.join(', ') : 'none'}`);
}
