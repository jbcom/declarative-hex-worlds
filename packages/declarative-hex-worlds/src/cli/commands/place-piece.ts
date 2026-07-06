import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import {
  type GameboardPieceDeclaration,
  type GameboardPiecePlacementInspection,
  type GameboardPieceRegistry,
  inspectGameboardPiecePlacement,
  selectGameboardPieces,
} from '../../pieces';
import { appendGameboardLayoutPlacementsToPlan } from '../../coordinates';
import { GameboardCliError } from '../../errors';
import {
  layoutAnalysisPlanFromArgs,
  validationConfigFromArgs,
  printViolations,
  safeResolveOutput,
  readPieceRegistry,
  readNumberFlag,
  pieceSelectionFromFlags,
  formatCounts,
  type ParsedArgs,
} from '../_shared';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runPlacePiece(parsed, sourceRoot, edition);
}

function runPlacePiece(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const inputFlags = ['plan', 'recipe', 'scenario'].filter(
    (key) => typeof parsed.flags[key] === 'string'
  );
  if (inputFlags.length !== 1) {
    throw new GameboardCliError(
      'place-piece requires exactly one of --plan <path>, --recipe <path>, or --scenario <path>'
    );
  }
  if (typeof parsed.flags.pieces !== 'string') {
    throw new GameboardCliError('place-piece requires --pieces <path>');
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

  const registry = readPieceRegistry(resolve(parsed.flags.pieces));
  const piece = pieceForPlacementFromFlags(registry, parsed.flags);
  const placementOptions = {
    count: readNumberFlag(parsed.flags.count),
    seed: typeof parsed.flags.seed === 'string' ? parsed.flags.seed : undefined,
    idPrefix: typeof parsed.flags.idPrefix === 'string' ? parsed.flags.idPrefix : undefined,
  };
  const inspection = inspectGameboardPiecePlacement(plan, piece, placementOptions);

  if (typeof parsed.flags.outPlan === 'string') {
    const nextPlan = appendGameboardLayoutPlacementsToPlan(plan, inspection.placements);
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outPlan)),
      `${JSON.stringify(nextPlan, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote placed GameboardPlan to ${safeResolveOutput(String(parsed.flags.outPlan))}`);
  }
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(inspection, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote piece placement inspection to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else if (parsed.flags.json === true) {
    console.log(JSON.stringify(inspection, null, 2));
  } else {
    printPiecePlacementInspection(inspection);
  }

  const requiredCount = readNumberFlag(parsed.flags.minCount) ?? placementOptions.count ?? 1;
  if (inspection.placements.length < requiredCount) {
    process.exit(1);
  }
}

function pieceForPlacementFromFlags(
  registry: GameboardPieceRegistry,
  flags: Record<string, string | boolean>
): GameboardPieceDeclaration {
  const selection = pieceSelectionFromFlags(flags);
  if (typeof flags.pieceId === 'string') {
    selection.ids = [flags.pieceId];
  } else if (typeof flags.id === 'string') {
    selection.ids = [flags.id];
  }
  if (typeof flags.assetId === 'string') {
    selection.assetIds = [flags.assetId];
  }
  const selected = selectGameboardPieces(registry, selection);
  if (selected.length === 1) {
    return selected[0] as GameboardPieceDeclaration;
  }
  const description = JSON.stringify(selection);
  if (selected.length === 0) {
    throw new GameboardCliError(`place-piece matched no pieces for selection ${description}`);
  }
  throw new GameboardCliError(
    `place-piece matched ${selected.length} pieces for selection ${description}; narrow with --pieceId`
  );
}

function printPiecePlacementInspection(inspection: GameboardPiecePlacementInspection): void {
  console.log(`piece: ${inspection.pieceId}`);
  console.log(`asset: ${inspection.assetId}`);
  console.log(`role: ${inspection.role}`);
  console.log(`source: ${inspection.source}`);
  console.log(`candidate sites: ${inspection.siteInspection.candidateCount}`);
  console.log(`selected sites: ${inspection.siteInspection.selectedCount}`);
  console.log(`rejected sites: ${inspection.siteInspection.rejectedCount}`);
  console.log(`rejections: ${formatCounts(inspection.siteInspection.rejectionCounts)}`);
  console.log(`placements: ${inspection.placements.length}`);
  if (inspection.placements.length > 0) {
    console.log(
      `placement tiles: ${inspection.placements.map((placement) => placementAtKey(placement.at)).join(', ')}`
    );
  }
}

function placementAtKey(at: string | { q: number; r: number }): string {
  /* v8 ignore next -- layout-generated piece placements always carry coordinate objects. */
  return typeof at === 'string' ? at : `${at.q},${at.r}`;
}
