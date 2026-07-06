import { writeFileSync } from 'node:fs';
import type { PackEdition } from '../../types';
import {
  type KayKitGuideScenarioAssetRenderGroup,
  type KayKitGuideScenarioAssetRenderRequest,
  listKayKitGuideScenarioAssetRenderGroups,
  listKayKitGuideScenarioAssetRenderRequests,
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
  runGuideRenderRequests(parsed, sourceRoot, edition);
}

function runGuideRenderRequests(
  parsed: ParsedArgs,
  sourceRoot: string,
  edition: PackEdition
): void {
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
  const assetBaseUrl =
    typeof parsed.flags.assetBaseUrl === 'string' ? parsed.flags.assetBaseUrl : undefined;
  const requestOptions = {
    scenarioIds: scenarioFilter,
    pages: pageFilter,
    minimumEdition,
    assetIds: assetIdFilter,
    roles: roleFilter,
    categories: categoryFilter,
    publicApis: publicApiFilter,
    ...(editionFilter.length > 0 ? { editionScope: editionFilter } : {}),
    ...(assetBaseUrl !== undefined ? { assetBaseUrl } : {}),
  };
  const requests = listKayKitGuideScenarioAssetRenderRequests(requestOptions);
  if (requests.length === 0) {
    throw new GameboardCliError(
      'guide-render-requests selection did not match any guide scenario asset render requests'
    );
  }

  const groups = listKayKitGuideScenarioAssetRenderGroups(requestOptions);
  const catalog = validationCatalogFromArgs(parsed, sourceRoot, edition);
  const assetIds = uniqueStrings(requests.map((request) => request.assetId));
  const missingAssetIds = catalog ? assetIds.filter((assetId) => !catalog.assetsById[assetId]) : [];
  const pages = [...new Set(requests.map((request) => request.page))].sort((a, b) => a - b);
  const scenarioIds = uniqueStrings(requests.map((request) => request.scenarioId));
  const sourceImages = uniqueStrings(requests.map((request) => request.sourceImage));
  const freeCount = requests.filter((request) => request.minimumEdition === 'free').length;
  const extraCount = requests.filter((request) => request.minimumEdition === 'extra').length;
  const includeGroups =
    parsed.flags.groups === true ||
    parsed.flags.grouped === true ||
    parsed.flags.includeGroups === true;
  const payload = {
    schemaVersion: '1.0.0',
    count: requests.length,
    groupCount: groups.length,
    render: {
      assetBaseUrl: assetBaseUrl ?? null,
      urlResolvedCount: requests.filter((request) => request.url !== undefined).length,
    },
    occurrenceCounts: {
      total: requests.length,
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
    missingAssetIds,
    requests,
    ...(includeGroups ? { groups } : {}),
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote ${requests.length} guide render requests to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else if (parsed.flags.json === true || parsed.flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`guide render requests: ${requests.length}`);
    console.log(`groups: ${groups.length}`);
    console.log(`pages: ${formatGuideScenarioPages(pages)}`);
    console.log(`scenarios: ${scenarioIds.length}`);
    console.log(`unique assets: ${assetIds.length}`);
    console.log(`asset occurrences: ${freeCount} free, ${extraCount} extra`);
    console.log(`asset base URL: ${assetBaseUrl ?? '<none>'}`);
    if (catalog) {
      console.log(`missing assets: ${missingAssetIds.length}`);
      for (const assetId of missingAssetIds) {
        console.log(`  - ${assetId}`);
      }
    }
    for (const group of groups.slice(0, 10)) {
      console.log(formatGuideRenderGroupLine(group));
    }
    if (groups.length > 10) {
      console.log(`...${groups.length - 10} more groups`);
    }
    for (const request of requests.slice(0, 10)) {
      console.log(formatGuideRenderRequestLine(request));
    }
    if (requests.length > 10) {
      console.log(`...${requests.length - 10} more requests`);
    }
  }

  if (missingAssetIds.length > 0) {
    process.exit(1);
  }
}

function formatGuideRenderGroupLine(group: KayKitGuideScenarioAssetRenderGroup): string {
  return `page ${group.page}: ${group.count} render request(s), ${group.scenarioId}`;
}

function formatGuideRenderRequestLine(
  request: KayKitGuideScenarioAssetRenderRequest
): string {
  return `${request.label}: ${request.role}, ${request.url ?? request.sourcePath}`;
}
