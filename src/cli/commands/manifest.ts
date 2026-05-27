import type { PackEdition } from '../../types';
import { generateManifestFromSource, writeManifestJson } from '../../ingest';
import { safeResolveOutput, type ParsedArgs } from '../_shared';

export async function run(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  const manifest = generateManifestFromSource({
    sourceRoot,
    edition,
    assetBasePath: String(parsed.flags.assetBasePath ?? `assets/${edition}`),
  });
  const output = parsed.flags.out;
  if (typeof output === 'string') {
    const outputPath = safeResolveOutput(output);
    writeManifestJson(manifest, outputPath);
    console.log(`Wrote manifest to ${outputPath}`);
  } else {
    console.log(JSON.stringify(manifest, null, 2));
  }
}
