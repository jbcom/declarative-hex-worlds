import { writeFileSync } from 'node:fs';
import type { PackEdition } from '../../types';
import { type GuideTilePermutationKind, listGuideTilePermutations } from '../../selectors';
import { safeResolveOutput, type ParsedArgs, validationCatalogFromArgs } from '../_shared';

function countGuidePermutationsByKind(
  permutations: readonly { kind: GuideTilePermutationKind }[]
): Record<GuideTilePermutationKind, number> {
  const counts: Record<GuideTilePermutationKind, number> = {
    road: 0,
    river: 0,
    'river-curvy': 0,
    'river-crossing': 0,
    coast: 0,
  };
  for (const permutation of permutations) {
    counts[permutation.kind] += 1;
  }
  return counts;
}

export function runGuidePermutations(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  const permutations = listGuideTilePermutations();
  const catalog = validationCatalogFromArgs(parsed, sourceRoot, edition);
  const missingAssetIds = catalog
    ? [
        ...new Set(
          permutations
            .map((permutation) => permutation.assetId)
            .filter((assetId) => !catalog.assetsById[assetId])
        ),
      ]
    : [];
  const payload = {
    schemaVersion: '1.0.0',
    count: permutations.length,
    counts: countGuidePermutationsByKind(permutations),
    missingAssetIds,
    permutations,
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote ${permutations.length} guide permutations to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide permutations: ${permutations.length}`);
    for (const [kind, count] of Object.entries(payload.counts)) {
      console.log(`${kind}: ${count}`);
    }
    if (catalog) {
      console.log(`missing assets: ${missingAssetIds.length}`);
      for (const assetId of missingAssetIds) {
        console.log(`  - ${assetId}`);
      }
    }
  }

  if (missingAssetIds.length > 0) {
    process.exit(1);
  }
}

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runGuidePermutations(parsed, sourceRoot, edition);
}
