import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PackEdition } from '../../types';
import { expectedModelCount, validateSourceRoot } from '../../ingest';
import type { ParsedArgs } from '../_shared';

export async function run(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  if (parsed.flags.coverage === true) {
    const { runCoverage } = await import('./coverage');
    runCoverage(parsed);
    return;
  }
  const validation = validateSourceRoot(sourceRoot, edition);
  const docsMontage = resolve('docs/assets/kaykit-guide/montage.png');
  console.log(`edition: ${edition}`);
  console.log(`source: ${sourceRoot}`);
  console.log(`source exists: ${existsSync(sourceRoot) ? 'yes' : 'no'}`);
  console.log(`gltf count: ${validation.gltfCount}/${expectedModelCount(edition)}`);
  console.log(`docs montage: ${existsSync(docsMontage) ? docsMontage : 'missing'}`);
}
