import type { PackEdition } from '../../types';
import { validateSourceRoot } from '../../ingest';
import type { ParsedArgs } from '../_shared';

export async function run(
  _parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  const validation = validateSourceRoot(sourceRoot, edition);
  if (!validation.ok) {
    console.error(
      `Expected ${validation.expectedCount} ${edition} GLTF files, found ${validation.gltfCount}.`
    );
    process.exit(1);
  }
  console.log(`Validated ${validation.gltfCount} ${edition} GLTF files.`);
}
