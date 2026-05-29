import { writeFileSync } from 'node:fs';
import type { PackEdition } from '../../types';
import {
  type KayKitGuideScenarioAssetUsage,
  listKayKitGuideScenarioAssetUsages,
} from '../../scenario';
import { GameboardCliError } from '../../errors';
import {
  readCsv,
  readGuideAssetIdFilter,
  readGuideScenarioEditionFilter,
  readGuideScenarioPageFilter,
  readGuideUsageCategoryFilter,
  readGuideUsageMinimumEdition,
  readGuideUsageRoleFilter,
  safeResolveOutput,
  formatGuideScenarioPages,
  uniqueStrings,
  validationCatalogFromArgs,
  type ParsedArgs,
} from '../_shared';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runGuideUsages(parsed, sourceRoot, edition);
}

function runGuideUsages(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): void {
  const scenarioFilter = readCsv(parsed.flags.scenarioId ?? parsed.flags.scenario);
  const pageFilter = readGuideScenarioPageFilter(parsed.flags.page);
  const editionFilter = readGuideScenarioEditionFilter(parsed.flags.editionScope);
  const publicApiFilter = readCsv(parsed.flags.publicApi);
  const roleFilter = readGuideUsageRoleFilter(parsed.flags.role ?? parsed.flags.guideRole);
  const assetIdFilter = readGuideAssetIdFilter(parsed);
  const categoryFilter = readGuideUsageCategoryFilter(
    parsed.flags.category ?? parsed.flags.categories
  );
  const minimumEdition = readGuideUsageMinimumEdition(
    parsed.flags.minimumEdition ?? parsed.flags.assetEdition
  );
  const usages = listKayKitGuideScenarioAssetUsages({
    scenarioIds: scenarioFilter,
    pages: pageFilter,
    editionScope: editionFilter.length > 0 ? editionFilter : undefined,
    minimumEdition,
    assetIds: assetIdFilter,
    roles: roleFilter,
    categories: categoryFilter,
    publicApis: publicApiFilter,
  });
  if (usages.length === 0) {
    throw new GameboardCliError(
      'guide-usages selection did not match any guide scenario asset usages'
    );
  }

  const catalog = validationCatalogFromArgs(parsed, sourceRoot, edition);
  const assetIds = uniqueStrings(usages.map((usage) => usage.assetId));
  const missingAssetIds = catalog ? assetIds.filter((assetId) => !catalog.assetsById[assetId]) : [];
  const pages = [...new Set(usages.map((usage) => usage.page))].sort((a, b) => a - b);
  const scenarioIds = uniqueStrings(usages.map((usage) => usage.scenarioId));
  const sourceImages = uniqueStrings(usages.map((usage) => usage.sourceImage));
  const docs = uniqueStrings(usages.flatMap((usage) => usage.docs));
  const visualArtifacts = uniqueStrings(usages.flatMap((usage) => usage.visualArtifacts));
  const freeCount = usages.filter((usage) => usage.minimumEdition === 'free').length;
  const extraCount = usages.filter((usage) => usage.minimumEdition === 'extra').length;
  const payload = {
    schemaVersion: '1.0.0',
    count: usages.length,
    occurrenceCounts: {
      total: usages.length,
      free: freeCount,
      extra: extraCount,
      uniqueAssets: assetIds.length,
      scenarios: scenarioIds.length,
      pages: pages.length,
      missing: missingAssetIds.length,
    },
    selection: {
      scenarioIds: scenarioFilter,
      pages: pageFilter,
      editions: editionFilter,
      publicApis: publicApiFilter,
      roles: roleFilter,
      assetIds: assetIdFilter,
      categories: categoryFilter,
      minimumEdition,
    },
    pages,
    scenarioIds,
    assetIds,
    sourceImages,
    docs,
    visualArtifacts,
    missingAssetIds,
    usages,
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote ${usages.length} guide usage rows to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide usage rows: ${usages.length}`);
    console.log(`pages: ${formatGuideScenarioPages(pages)}`);
    console.log(`scenarios: ${scenarioIds.length}`);
    console.log(`unique assets: ${assetIds.length}`);
    console.log(`asset occurrences: ${freeCount} free, ${extraCount} extra`);
    if (catalog) {
      console.log(`missing assets: ${missingAssetIds.length}`);
      for (const assetId of missingAssetIds) {
        console.log(`  - ${assetId}`);
      }
    }
    for (const usage of usages.slice(0, 20)) {
      console.log(formatGuideUsageLine(usage));
    }
    if (usages.length > 20) {
      console.log(`...${usages.length - 20} more`);
    }
  }

  if (missingAssetIds.length > 0) {
    process.exit(1);
  }
}

function formatGuideUsageLine(usage: KayKitGuideScenarioAssetUsage): string {
  return `${usage.label}: ${usage.role}, ${usage.minimumEdition}, ${usage.sourcePath}`;
}
