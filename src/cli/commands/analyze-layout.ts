import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import {
  analyzeGameboardLayoutFill,
  type GameboardLayoutFillAnalysis,
  type GameboardLayoutFillOptions,
  type GameboardLayoutFillRule,
} from '../../coordinates';
import { GameboardCliError } from '../../errors';
import {
  readJson,
  isRecord,
  relativizePath,
  validationConfigFromArgs,
  printViolations,
  safeResolveOutput,
  layoutAnalysisPlanFromArgs,
  formatCounts,
  type ParsedArgs,
} from '../_shared';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runAnalyzeLayout(parsed, sourceRoot, edition);
}

function runAnalyzeLayout(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  const inputFlags = ['plan', 'recipe', 'scenario'].filter(
    (key) => typeof parsed.flags[key] === 'string'
  );
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'analyze-layout requires exactly one of --plan <path>, --recipe <path>, or --scenario <path>'
    );
  }
  if (typeof parsed.flags.rules !== 'string') {
    throw new GameboardCliError('analyze-layout requires --rules <path>');
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
  if (typeof parsed.flags.outPlan === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(plan, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote compiled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`
    );
  }
  const options = readLayoutFillOptions(resolve(parsed.flags.rules), parsed.flags.seed);
  const analysis = analyzeGameboardLayoutFill(plan, options);
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(analysis, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote layout analysis to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(analysis, null, 2));
  } else {
    printLayoutFillAnalysis(analysis);
  }
  if (analysis.errorCount > 0) {
    process.exit(1);
  }
  if (parsed.flags.failOnWarning === true && analysis.warningCount > 0) {
    process.exit(1);
  }
}

function readLayoutFillOptions(
  path: string,
  seedOverride: string | boolean | undefined
): GameboardLayoutFillOptions {
  const payload = readJson(path);
  const rules = Array.isArray(payload)
    ? (payload as readonly GameboardLayoutFillRule[])
    : isRecord(payload) && Array.isArray(payload.rules)
      ? (payload.rules as readonly GameboardLayoutFillRule[])
      : undefined;
  if (!Array.isArray(rules)) {
    throw new GameboardCliError(
      `Layout rules file ${relativizePath(path)} must be a rule array or { "rules": [...] }`
    );
  }
  const fileSeed = isRecord(payload) && typeof payload.seed === 'string' ? payload.seed : undefined;
  return {
    seed: typeof seedOverride === 'string' ? seedOverride : fileSeed,
    rules,
  };
}

function printLayoutFillAnalysis(analysis: GameboardLayoutFillAnalysis): void {
  console.log(`layout seed: ${analysis.seed}`);
  console.log(`rules: ${analysis.ruleCount}`);
  console.log(`placements: ${analysis.placementCount}`);
  console.log(`candidate sites: ${analysis.candidateCount}`);
  console.log(`diagnostics: ${analysis.errorCount} error(s), ${analysis.warningCount} warning(s)`);
  for (const rule of analysis.rules) {
    console.log(
      `  - ${rule.id}: ${rule.selectedCount}/${rule.targetCount} selected from ${rule.candidateCount} candidate site(s)`
    );
    if (rule.rejectedSiteCount > 0) {
      console.log(`    rejected tiles: ${rule.rejectedSiteCount}`);
      console.log(`    rejection counts: ${formatCounts(rule.rejectionCounts)}`);
    }
    if (rule.assetIds.length > 0) {
      console.log(`    assets: ${rule.assetIds.join(', ')}`);
    }
    if (rule.selectedTileKeys.length > 0) {
      console.log(`    selected tiles: ${rule.selectedTileKeys.join(', ')}`);
    }
    for (const warning of rule.warnings) {
      console.log(`    warning: ${warning}`);
    }
    for (const error of rule.errors) {
      console.log(`    error: ${error}`);
    }
  }
}
