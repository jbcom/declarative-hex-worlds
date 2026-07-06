import { writeFileSync } from 'node:fs';
import type { PackEdition } from '../../types';
import { registryFromArgs, safeResolveOutput, type ParsedArgs } from '../_shared';

export async function run(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  const registry = registryFromArgs(parsed, sourceRoot, edition);
  const output = parsed.flags.out;
  const declarations = registry.declarations;
  if (typeof output === 'string') {
    const outputPath = safeResolveOutput(output);
    writeFileSync(outputPath, `${JSON.stringify(declarations, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${declarations.length} tile declarations to ${outputPath}`);
  } else {
    console.log(JSON.stringify(declarations, null, 2));
  }
}
