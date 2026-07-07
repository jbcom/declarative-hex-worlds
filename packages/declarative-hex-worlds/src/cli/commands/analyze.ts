import type { PackEdition } from '../../types';
import { analyzeHexTileRegistry } from '../../scenario';
import { printAnalysis, registryFromArgs, type ParsedArgs } from '../_shared';

export async function run(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  const registry = registryFromArgs(parsed, sourceRoot, edition);
  const analysis = analyzeHexTileRegistry(registry);
  if (parsed.flags.json === true) {
    console.log(JSON.stringify(analysis, null, 2));
  } else {
    printAnalysis(analysis);
  }
}
