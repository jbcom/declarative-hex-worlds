import { writeFileSync } from 'node:fs';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import {
  describeKayKitGuideRoleCoverage,
  type KayKitGuideRoleCoverage,
  listKayKitGuideRoleCoverages,
} from '../../scenario';
import {
  formatGuideScenarioPages,
  readCsv,
  safeResolveOutput,
} from '../_shared';
import type { ParsedArgs } from '../_shared';

function filterGuideRoleCoverages(
  coverages: readonly KayKitGuideRoleCoverage[],
  roles: readonly string[]
): KayKitGuideRoleCoverage[] {
  const roleSet = new Set(roles);
  return coverages.filter((coverage) => roleSet.size === 0 || roleSet.has(coverage.role));
}

export async function run(parsed: ParsedArgs, _sourceRoot: string, _edition: PackEdition): Promise<void> {
  const roleFilter = readCsv(parsed.flags.role ?? parsed.flags.guideRole);
  const coverages = filterGuideRoleCoverages(listKayKitGuideRoleCoverages(), roleFilter);
  if (coverages.length === 0) {
    throw new GameboardCliError(
      'guide-roles selection did not match any public role coverage records'
    );
  }
  const payload = {
    schemaVersion: '1.0.0',
    count: coverages.length,
    selection: { roles: roleFilter },
    roles: coverages.map((coverage) => coverage.role),
    coverage: coverages,
    ...(roleFilter.length === 1
      ? { selected: describeKayKitGuideRoleCoverage(roleFilter[0] ?? '') }
      : {}),
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote ${coverages.length} guide role coverages to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide public roles: ${coverages.length}`);
    for (const coverage of coverages.slice(0, 20)) {
      console.log(
        `${coverage.role}: pages ${formatGuideScenarioPages(coverage.pages)}, assets ${coverage.assetCounts.unique}, APIs ${coverage.publicApi.length}`
      );
    }
    if (coverages.length > 20) {
      console.log(`...${coverages.length - 20} more`);
    }
  }
}
