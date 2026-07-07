import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MedievalHexagonManifestInspection } from '../../manifest';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import {
  formatManifestIssue,
  inspectManifestPath,
  relativizePath,
  safeResolveOutput,
} from '../_shared';
import type { ParsedArgs } from '../_shared';

function printManifestInspection(
  path: string,
  inspection: MedievalHexagonManifestInspection
): void {
  console.log(`manifest: ${relativizePath(path)}`);
  if (inspection.manifest) {
    console.log(`edition: ${inspection.manifest.edition}`);
    console.log(`assets: ${inspection.manifest.counts.total}`);
    console.log(`texture sets: ${inspection.manifest.textureSets.join(', ') || 'none'}`);
  }
  console.log(
    `validation: ${inspection.errorCount} error(s), ${inspection.warningCount} warning(s)`
  );
  for (const issue of inspection.issues) {
    console.log(`${issue.severity}: ${formatManifestIssue(issue)}`);
  }
}

export async function run(parsed: ParsedArgs, _sourceRoot: string, _edition: PackEdition): Promise<void> {
  if (typeof parsed.flags.manifest !== 'string') {
    throw new GameboardCliError('validate-manifest requires --manifest <path>');
  }
  const manifestPath = resolve(parsed.flags.manifest);
  const inspection = inspectManifestPath(manifestPath);
  if (typeof parsed.flags.outManifest === 'string' && inspection.manifest) {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outManifest)),
      `${JSON.stringify(inspection.manifest, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote normalized manifest to ${safeResolveOutput(String(parsed.flags.outManifest))}`
    );
  }
  if (parsed.flags.json === true) {
    console.log(
      JSON.stringify(
        {
          manifest: manifestPath,
          errorCount: inspection.errorCount,
          warningCount: inspection.warningCount,
          counts: inspection.manifest?.counts,
          edition: inspection.manifest?.edition,
          textureSets: inspection.manifest?.textureSets,
          issues: inspection.issues,
        },
        null,
        2
      )
    );
  } else {
    printManifestInspection(manifestPath, inspection);
  }
  if (inspection.errorCount > 0) {
    process.exit(1);
  }
}
