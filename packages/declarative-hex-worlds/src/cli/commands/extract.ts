import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import { copyGltfTree, generateManifestFromSource, writeManifestJson } from '../../ingest';
import { relativizePath, safeResolveOutput, type ParsedArgs } from '../_shared';

export async function run(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  const outputRoot = safeResolveOutput(
    String(parsed.flags.out ?? `kaykit-medieval-hexagon-${edition}`)
  );
  const assetRoot = join(outputRoot, 'assets');
  // `copyGltfTree` rmSyncs `assetRoot` before re-mirroring the upstream tree.
  // Refuse to wipe a non-empty existing destination without explicit --force
  // (PRD C1 / S-H1). The check runs on the destination FOLDER (assetRoot),
  // not the wrapping outputRoot, because that's the directory copyGltfTree
  // actually destroys.
  if (
    parsed.flags.force !== true &&
    existsSync(assetRoot) &&
    statSync(assetRoot).isDirectory() &&
    readdirSync(assetRoot).length > 0
  ) {
    throw new GameboardCliError(
      `extract destination ${relativizePath(assetRoot)} is not empty; pass --force to wipe.`
    );
  }
  copyGltfTree(sourceRoot, assetRoot);
  const manifest = generateManifestFromSource({
    sourceRoot,
    edition,
  });
  writeManifestJson(manifest, join(outputRoot, 'manifest.json'));
  console.log(`Extracted ${manifest.counts.total} ${edition} assets to ${outputRoot}`);
}
