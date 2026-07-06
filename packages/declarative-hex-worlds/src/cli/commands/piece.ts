import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import { analyzeExternalAssetCompatibility } from '../../interop';
import { declareGameboardPieceFromCompatibility } from '../../pieces';
import {
  assetIdFromPath,
  normalizePieceId,
  readBoardForwardEdge,
  readCsv,
  readGltfMetadata,
  readIntendedRole,
  readModelForward,
  readPieceRole,
  safeResolveOutput,
  type ParsedArgs,
} from '../_shared';

export async function run(
  parsed: ParsedArgs,
  _sourceRoot: string,
  _edition: PackEdition
): Promise<void> {
  if (typeof parsed.flags.asset !== 'string') {
    throw new GameboardCliError('piece requires --asset <path>');
  }
  const assetId = String(parsed.flags.id ?? assetIdFromPath(parsed.flags.asset));
  const intendedRole = readIntendedRole(parsed.flags.intendedRole);
  const metadata = readGltfMetadata(resolve(parsed.flags.asset));
  const report = analyzeExternalAssetCompatibility({
    id: assetId,
    sourcePack: String(parsed.flags.sourcePack ?? 'external'),
    creator: typeof parsed.flags.creator === 'string' ? parsed.flags.creator : undefined,
    license: typeof parsed.flags.license === 'string' ? parsed.flags.license : undefined,
    bounds: metadata.bounds,
    intendedRole,
    hasRig: metadata.hasRig,
    animationNames: metadata.animationNames,
    materialSlots: metadata.materialSlots,
    modelForward: readModelForward(parsed.flags.modelForward),
    boardForwardEdge: readBoardForwardEdge(parsed.flags.boardForwardEdge),
  });
  const role = readPieceRole(parsed.flags.role);
  const declaration = declareGameboardPieceFromCompatibility(report, {
    id: String(parsed.flags.pieceId ?? normalizePieceId(assetId)),
    assetId,
    tags: readCsv(parsed.flags.tags),
    ...(role ? { role } : {}),
  });
  const payload = parsed.flags.includeReport === true ? { declaration, report } : declaration;
  if (typeof parsed.flags.out === 'string') {
    writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote piece declaration to ${safeResolveOutput(String(parsed.flags.out))}`);
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
  if (parsed.flags.failOnWarning === true && report.warnings.length > 0) {
    process.exit(1);
  }
  if (report.errors.length > 0) {
    process.exit(1);
  }
}
