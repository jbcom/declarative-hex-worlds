import { writeFileSync } from 'node:fs';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import {
  describeKayKitGuidePublicApiCoverage,
  type KayKitGuidePublicApiCoverage,
  listKayKitGuidePublicApiCoverages,
} from '../../scenario';
import {
  formatGuideScenarioPages,
  readCsv,
  safeResolveOutput,
} from '../_shared';
import type { ParsedArgs } from '../_shared';

function filterGuidePublicApiCoverages(
  coverages: readonly KayKitGuidePublicApiCoverage[],
  publicApis: readonly string[]
): KayKitGuidePublicApiCoverage[] {
  const publicApiSet = new Set(publicApis);
  return coverages.filter(
    (coverage) => publicApiSet.size === 0 || publicApiSet.has(coverage.publicApi)
  );
}

export async function run(parsed: ParsedArgs, _sourceRoot: string, _edition: PackEdition): Promise<void> {
  const publicApiFilter = readCsv(parsed.flags.publicApi);
  const coverages = filterGuidePublicApiCoverages(
    listKayKitGuidePublicApiCoverages(),
    publicApiFilter
  );
  if (coverages.length === 0) {
    throw new GameboardCliError(
      'guide-apis selection did not match any public API coverage records'
    );
  }
  const payload = {
    schemaVersion: '1.0.0',
    count: coverages.length,
    selection: { publicApis: publicApiFilter },
    publicApis: coverages.map((coverage) => coverage.publicApi),
    coverage: coverages,
    ...(publicApiFilter.length === 1
      ? { selected: describeKayKitGuidePublicApiCoverage(publicApiFilter[0] ?? '') }
      : {}),
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote ${coverages.length} guide public API coverages to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide public APIs: ${coverages.length}`);
    for (const coverage of coverages.slice(0, 20)) {
      console.log(
        `${coverage.publicApi}: pages ${formatGuideScenarioPages(coverage.pages)}, assets ${coverage.assetCounts.unique}`
      );
    }
    if (coverages.length > 20) {
      console.log(`...${coverages.length - 20} more`);
    }
  }
}
