import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import { analyzeExternalAssetCompatibility } from '../../interop';
import {
  assetIdFromPath,
  printCompatibility,
  readBoardForwardEdge,
  readGltfMetadata,
  readIntendedRole,
  readModelForward,
  type ParsedArgs,
} from '../_shared';

export async function run(
  parsed: ParsedArgs,
  _sourceRoot: string,
  _edition: PackEdition
): Promise<void> {
  if (typeof parsed.flags.asset !== 'string') {
    throw new GameboardCliError('compatibility requires --asset <path>');
  }
  const metadata = readGltfMetadata(resolve(parsed.flags.asset));
  const report = analyzeExternalAssetCompatibility({
    id: String(parsed.flags.id ?? assetIdFromPath(parsed.flags.asset)),
    sourcePack: String(parsed.flags.sourcePack ?? 'external'),
    creator: typeof parsed.flags.creator === 'string' ? parsed.flags.creator : undefined,
    license: typeof parsed.flags.license === 'string' ? parsed.flags.license : undefined,
    bounds: metadata.bounds,
    intendedRole: readIntendedRole(parsed.flags.intendedRole),
    hasRig: metadata.hasRig,
    animationNames: metadata.animationNames,
    materialSlots: metadata.materialSlots,
    modelForward: readModelForward(parsed.flags.modelForward),
    boardForwardEdge: readBoardForwardEdge(parsed.flags.boardForwardEdge),
  });
  if (parsed.flags.json === true) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printCompatibility(report);
  }
  if (parsed.flags.failOnWarning === true && report.warnings.length > 0) {
    process.exit(1);
  }
  if (report.errors.length > 0) {
    process.exit(1);
  }
}
