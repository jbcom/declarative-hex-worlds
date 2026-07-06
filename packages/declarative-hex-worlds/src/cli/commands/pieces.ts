import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import {
  analyzeGameboardPieceRegistry,
  createGameboardPieceSourceUrlMap,
} from '../../pieces';
import { createSeededGameboardPieceFillRules } from '../../rules';
import { appendGameboardLayoutPlacementsToPlan } from '../../coordinates';
import {
  hasPieceFillFlags,
  inspectPiecesPlacementFromArgs,
  pieceFillFromFlags,
  pieceSourceUrlOptionsFromFlags,
  printPieceRegistryAnalysis,
  readPieceRegistry,
  safeResolveOutput,
  type ParsedArgs,
} from '../_shared';

export async function run(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  if (typeof parsed.flags.pieces !== 'string') {
    throw new GameboardCliError('pieces requires --pieces <path>');
  }
  const registry = readPieceRegistry(resolve(parsed.flags.pieces));
  const fill = pieceFillFromFlags(parsed.flags);
  const shouldCheckFill = hasPieceFillFlags(parsed.flags);
  const placementInputFlags = ['plan', 'recipe', 'scenario'].filter(
    (key) => typeof parsed.flags[key] === 'string'
  );
  if (placementInputFlags.length > 1) {
    throw new GameboardCliError(
      'pieces placement inspection requires exactly one of --plan <path>, --recipe <path>, or --scenario <path>'
    );
  }
  const analysis = analyzeGameboardPieceRegistry(registry, {
    checks: shouldCheckFill
      ? [
          {
            id: fill.id ?? fill.ruleIdPrefix ?? 'cli-selection',
            mode: fill.mode,
            selection: fill.selection,
          },
        ]
      : [],
  });
  const rules =
    parsed.flags.emitRules === true && analysis.errors.length === 0
      ? createSeededGameboardPieceFillRules(registry, [fill])
      : undefined;
  const sourceUrls =
    parsed.flags.emitSourceUrls === true
      ? createGameboardPieceSourceUrlMap(registry, pieceSourceUrlOptionsFromFlags(parsed.flags))
      : undefined;
  const placementInspection =
    placementInputFlags.length === 1 && analysis.errors.length === 0
      ? inspectPiecesPlacementFromArgs(parsed, sourceRoot, edition, registry, fill)
      : undefined;
  if (placementInspection && typeof parsed.flags.outPlan === 'string') {
    const nextPlan = appendGameboardLayoutPlacementsToPlan(
      placementInspection.plan,
      placementInspection.inspection.placements
    );
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(nextPlan, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote piece-filled GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
  }
  const payload =
    rules || sourceUrls || placementInspection
      ? {
          analysis,
          ...(rules ? { rules } : {}),
          ...(sourceUrls ? { sourceUrls } : {}),
          ...(placementInspection ? { placementInspection: placementInspection.inspection } : {}),
        }
      : analysis;
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote piece registry output to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else if (parsed.flags.json === true || rules) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printPieceRegistryAnalysis(analysis);
  }
  if (analysis.errors.length > 0) {
    process.exit(1);
  }
  /* v8 ignore next 7 -- registry analysis blocks invalid selections before placement inspection; this is a defensive future-inspector guard. */
  if (
    placementInspection &&
    (placementInspection.inspection.errors.length > 0 ||
      placementInspection.inspection.analysis.errorCount > 0)
  ) {
    process.exit(1);
  }
  if (parsed.flags.failOnWarning === true && analysis.warnings.length > 0) {
    process.exit(1);
  }
  if (
    parsed.flags.failOnWarning === true &&
    placementInspection &&
    (placementInspection.inspection.warnings.length > 0 ||
      placementInspection.inspection.analysis.warningCount > 0)
  ) {
    process.exit(1);
  }
}
