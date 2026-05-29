import { writeFileSync } from 'node:fs';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import {
  describeKayKitGuideAssetCoverage,
  type KayKitGuideAssetCoverage,
  type KayKitGuideScenario,
  listKayKitGuideAssetCoverages,
} from '../../scenario';
import {
  formatGuideScenarioPages,
  readCsv,
  readGuideAssetIdFilter,
  readGuideScenarioEditionFilter,
  readGuideScenarioPageFilter,
  safeResolveOutput,
} from '../_shared';
import type { ParsedArgs } from '../_shared';

function filterGuideAssetCoverages(
  coverages: readonly KayKitGuideAssetCoverage[],
  filters: {
    assetIds: readonly string[];
    scenarioIds: readonly string[];
    pages: readonly number[];
    editions: ReadonlyArray<KayKitGuideScenario['edition']>;
    publicApis: readonly string[];
    roles: readonly string[];
  }
): KayKitGuideAssetCoverage[] {
  const assetIds = new Set(filters.assetIds);
  const scenarioIds = new Set(filters.scenarioIds);
  const pages = new Set(filters.pages);
  const editions = new Set(filters.editions);
  const publicApis = new Set(filters.publicApis);
  const roles = new Set(filters.roles);
  return coverages.filter((coverage) => {
    if (assetIds.size > 0 && !assetIds.has(coverage.assetId)) {
      return false;
    }
    if (
      scenarioIds.size > 0 &&
      !coverage.scenarioIds.some((scenarioId) => scenarioIds.has(scenarioId))
    ) {
      return false;
    }
    if (pages.size > 0 && !coverage.pages.some((page) => pages.has(page))) {
      return false;
    }
    if (
      editions.size > 0 &&
      !editions.has(coverage.minimumEdition) &&
      !coverage.editions.some((edition) => editions.has(edition))
    ) {
      return false;
    }
    if (publicApis.size > 0 && !coverage.publicApi.some((publicApi) => publicApis.has(publicApi))) {
      return false;
    }
    if (roles.size > 0 && !roles.has(coverage.role)) {
      return false;
    }
    return true;
  });
}

export async function run(parsed: ParsedArgs, _sourceRoot: string, _edition: PackEdition): Promise<void> {
  const assetIdFilter = readGuideAssetIdFilter(parsed);
  const scenarioFilter = readCsv(parsed.flags.scenarioId ?? parsed.flags.scenario);
  const pageFilter = readGuideScenarioPageFilter(parsed.flags.page);
  const editionFilter = readGuideScenarioEditionFilter(parsed.flags.editionScope);
  const publicApiFilter = readCsv(parsed.flags.publicApi);
  const roleFilter = readCsv(parsed.flags.role ?? parsed.flags.guideRole);
  const coverages = filterGuideAssetCoverages(listKayKitGuideAssetCoverages(), {
    assetIds: assetIdFilter,
    scenarioIds: scenarioFilter,
    pages: pageFilter,
    editions: editionFilter,
    publicApis: publicApiFilter,
    roles: roleFilter,
  });
  if (coverages.length === 0) {
    throw new GameboardCliError(
      'guide-assets selection did not match any public asset coverage records'
    );
  }
  const payload = {
    schemaVersion: '1.0.0',
    count: coverages.length,
    selection: {
      assetIds: assetIdFilter,
      scenarioIds: scenarioFilter,
      pages: pageFilter,
      editions: editionFilter,
      publicApis: publicApiFilter,
      roles: roleFilter,
    },
    assetIds: coverages.map((coverage) => coverage.assetId),
    coverage: coverages,
    ...(assetIdFilter.length === 1
      ? { selected: describeKayKitGuideAssetCoverage(assetIdFilter[0] ?? '') }
      : {}),
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote ${coverages.length} guide asset coverages to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide assets: ${coverages.length}`);
    for (const coverage of coverages.slice(0, 20)) {
      console.log(
        `${coverage.assetId}: ${coverage.role}, pages ${formatGuideScenarioPages(coverage.pages)}, APIs ${coverage.publicApi.length}`
      );
    }
    if (coverages.length > 20) {
      console.log(`...${coverages.length - 20} more`);
    }
  }
}
