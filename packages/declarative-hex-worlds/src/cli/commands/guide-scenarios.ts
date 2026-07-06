import { writeFileSync } from 'node:fs';
import type { PackEdition } from '../../types';
import {
  type KayKitAssetPublicTreatment,
  type KayKitGuideScenario,
  type KayKitGuideScenarioCoverage,
  describeKayKitGuideScenarioCoverage,
  listKayKitAssetPublicTreatments,
  listKayKitGuideScenarios,
  renderKayKitGuideScenarioCoverageMarkdown,
  summarizeKayKitGuideCoverage,
} from '../../scenario';
import { GameboardCliError } from '../../errors';
import {
  readCsv,
  readGuideAssetIdFilter,
  readGuideScenarioEditionFilter,
  readGuideScenarioPageFilter,
  safeResolveOutput,
  formatGuideScenarioPages,
  uniqueStrings,
  validationCatalogFromArgs,
  type ParsedArgs,
} from '../_shared';

export type GuideScenarioAssetScope = PackEdition | 'all';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runGuideScenarios(parsed, sourceRoot, edition);
}

function runGuideScenarios(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
  const scenarioFilter = readCsv(parsed.flags.scenarioId ?? parsed.flags.scenario);
  const pageFilter = readGuideScenarioPageFilter(parsed.flags.page);
  const editionFilter = readGuideScenarioEditionFilter(parsed.flags.editionScope);
  const publicApiFilter = readCsv(parsed.flags.publicApi);
  const roleFilter = readCsv(parsed.flags.role ?? parsed.flags.guideRole);
  const assetIdFilter = readGuideAssetIdFilter(parsed);
  const scenarios = filterGuideScenarios(listKayKitGuideScenarios(), {
    scenarioIds: scenarioFilter,
    pages: pageFilter,
    editions: editionFilter,
    publicApis: publicApiFilter,
    roles: roleFilter,
    assetIds: assetIdFilter,
  });
  if (scenarios.length === 0) {
    throw new GameboardCliError(
      'guide-scenarios selection did not match any extracted guide scenarios'
    );
  }
  const coverage = summarizeKayKitGuideCoverage();
  const treatmentByAssetId = new Map(
    listKayKitAssetPublicTreatments().map((treatment) => [treatment.assetId, treatment])
  );
  const catalog = validationCatalogFromArgs(parsed, sourceRoot, edition);
  const assetScope = readGuideScenarioAssetScope(parsed.flags.assetScope, catalog?.edition);
  const scenarioAssetIds = scenarios.flatMap((scenario) => scenario.assetIds);
  const allAssetIds = uniqueStrings(scenarioAssetIds);
  const occurrenceTreatments = scenarioAssetIds
    .map((assetId) => treatmentByAssetId.get(assetId))
    .filter((treatment): treatment is KayKitAssetPublicTreatment => treatment !== undefined);
  const checkedAssetIds = allAssetIds.filter((assetId) => {
    const treatment = treatmentByAssetId.get(assetId);
    if (!treatment) {
      return false;
    }
    return assetScope === 'all' || treatment.minimumEdition === assetScope;
  });
  const missingAssetIds = catalog
    ? checkedAssetIds.filter((assetId) => !catalog.assetsById[assetId])
    : [];
  const docs = uniqueStrings(scenarios.flatMap((scenario) => scenario.docs));
  const sourceImages = uniqueStrings(scenarios.map((scenario) => scenario.sourceImage));
  const visualArtifacts = uniqueStrings(scenarios.flatMap((scenario) => scenario.visualArtifacts));
  const payload = {
    schemaVersion: '1.0.0',
    count: scenarios.length,
    pages: scenarios.map((scenario) => scenario.page),
    assetScope,
    assetCounts: {
      total: coverage.assetCounts.unique,
      selected: allAssetIds.length,
      free: countGuideScenarioAssetsByEdition(allAssetIds, treatmentByAssetId, 'free'),
      extra: countGuideScenarioAssetsByEdition(allAssetIds, treatmentByAssetId, 'extra'),
      occurrences: occurrenceTreatments.length,
      freeOccurrences: occurrenceTreatments.filter(
        (treatment) => treatment.minimumEdition === 'free'
      ).length,
      extraOccurrences: occurrenceTreatments.filter(
        (treatment) => treatment.minimumEdition === 'extra'
      ).length,
      checked: checkedAssetIds.length,
      missing: missingAssetIds.length,
    },
    coverage,
    selection: {
      scenarioIds: scenarioFilter,
      pages: pageFilter,
      editions: editionFilter,
      publicApis: publicApiFilter,
      roles: roleFilter,
      assetIds: assetIdFilter,
    },
    sourceImages,
    docs,
    visualArtifacts,
    missingAssetIds,
    scenarios,
    ...(parsed.flags.includeTreatments === true
      ? {
          scenarioCoverage: scenarios
            .map((scenario) => describeKayKitGuideScenarioCoverage(scenario.id))
            .filter(
              (scenarioCoverage): scenarioCoverage is KayKitGuideScenarioCoverage =>
                scenarioCoverage !== undefined
            ),
        }
      : {}),
  };

  if (parsed.flags.markdown === true || parsed.flags.format === 'markdown') {
    const markdown = renderKayKitGuideScenarioCoverageMarkdown({
      scenarios,
      includeRoleCoverage: scenarios.length === listKayKitGuideScenarios().length,
      includePublicApiInversion: scenarios.length === listKayKitGuideScenarios().length,
    });
    if (typeof parsed.flags.out === 'string') {
      writeFileSync(safeResolveOutput(String(parsed.flags.out)), markdown, 'utf8');
      console.log(
        `Wrote ${scenarios.length} guide scenario markdown rows to ${safeResolveOutput(String(parsed.flags.out))}`
      );
    } else {
      process.stdout.write(markdown);
    }
    if (missingAssetIds.length > 0) {
      process.exit(1);
    }
    return;
  }

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote ${scenarios.length} guide scenarios to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide scenarios: ${scenarios.length}`);
    console.log(`pages: ${formatGuideScenarioPages(payload.pages)}`);
    console.log(
      `assets: ${payload.assetCounts.selected} selected, ${payload.assetCounts.free} free, ${payload.assetCounts.extra} extra`
    );
    console.log(
      `asset occurrences: ${payload.assetCounts.occurrences} total, ${payload.assetCounts.freeOccurrences} free, ${payload.assetCounts.extraOccurrences} extra`
    );
    if (catalog) {
      console.log(`asset scope: ${assetScope}`);
      console.log(`checked assets: ${checkedAssetIds.length}`);
      console.log(`missing assets: ${missingAssetIds.length}`);
      for (const assetId of missingAssetIds) {
        console.log(`  - ${assetId}`);
      }
    }
    console.log(`source images: ${sourceImages.length}`);
    console.log(`docs: ${docs.length}`);
    console.log(`visual artifacts: ${visualArtifacts.length}`);
  }

  if (missingAssetIds.length > 0) {
    process.exit(1);
  }
}

function filterGuideScenarios(
  scenarios: readonly KayKitGuideScenario[],
  filters: {
    scenarioIds: readonly string[];
    pages: readonly number[];
    editions: ReadonlyArray<KayKitGuideScenario['edition']>;
    publicApis: readonly string[];
    roles: readonly string[];
    assetIds: readonly string[];
  }
): KayKitGuideScenario[] {
  const scenarioIds = new Set(filters.scenarioIds);
  const pages = new Set(filters.pages);
  const editions = new Set(filters.editions);
  const publicApis = new Set(filters.publicApis);
  const roles = new Set(filters.roles);
  const assetIds = new Set(filters.assetIds);
  return scenarios.filter((scenario) => {
    if (scenarioIds.size > 0 && !scenarioIds.has(scenario.id)) {
      return false;
    }
    if (pages.size > 0 && !pages.has(scenario.page)) {
      return false;
    }
    if (editions.size > 0 && !editions.has(scenario.edition)) {
      return false;
    }
    if (publicApis.size > 0 && !scenario.publicApi.some((publicApi) => publicApis.has(publicApi))) {
      return false;
    }
    if (roles.size > 0 && !scenario.treatmentRoles.some((role) => roles.has(role))) {
      return false;
    }
    if (assetIds.size > 0 && !scenario.assetIds.some((assetId) => assetIds.has(assetId))) {
      return false;
    }
    return true;
  });
}

function countGuideScenarioAssetsByEdition(
  assetIds: readonly string[],
  treatmentByAssetId: ReadonlyMap<string, KayKitAssetPublicTreatment>,
  edition: PackEdition
): number {
  return assetIds.filter((assetId) => treatmentByAssetId.get(assetId)?.minimumEdition === edition)
    .length;
}

function readGuideScenarioAssetScope(
  value: string | boolean | undefined,
  manifestEdition: PackEdition | undefined
): GuideScenarioAssetScope {
  const defaultScope = manifestEdition === 'free' ? 'free' : 'all';
  if (value === undefined || value === false) {
    return defaultScope;
  }
  if (value === 'free' || value === 'extra' || value === 'all') {
    return value;
  }
  throw new GameboardCliError(`Unsupported guide scenario asset scope: ${String(value)}`);
}
