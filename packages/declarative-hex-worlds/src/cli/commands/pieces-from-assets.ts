import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { analyzeExternalAssetCompatibility } from '../../interop';
import {
  analyzeGameboardPieceRegistry,
  createGameboardPieceRegistry,
  declareGameboardPiecesFromCompatibilityReports,
  type GameboardPieceCompatibilityDeclarationOptions,
  type GameboardPieceRegistryAnalysis,
} from '../../pieces';
import type { PackEdition } from '../../types';
import { GameboardCliError } from '../../errors';
import {
  type ParsedArgs,
  formatCounts,
  readCsv,
  readGltfMetadata,
  readIntendedRole,
  readModelForward,
  readBoardForwardEdge,
  readPieceRole,
  relativizePath,
  safeResolveOutput,
  readJson,
} from '../_shared';

export interface AssetInputRoot {
  input: string;
  base: string;
}

export interface BatchSourceAssetRecord {
  id: string;
  relativePath: string;
  fileName: string;
  extension: string;
  path?: string;
}

export interface PiecesFromAssetsSummary {
  assetCount: number;
  compatibleTileCount: number;
  warningCount: number;
  errorCount: number;
  suggestedRoles: Readonly<Record<string, number>>;
  pieceRoles: Readonly<Record<string, number>>;
  overrideWarnings: readonly string[];
  registryWarnings: readonly string[];
  registryErrors: readonly string[];
}

function pieceOverridesFromArgs(
  flags: Record<string, string | boolean>
): Readonly<Record<string, GameboardPieceCompatibilityDeclarationOptions>> | undefined {
  const path =
    typeof flags.pieceOverrides === 'string'
      ? flags.pieceOverrides
      : typeof flags.overrides === 'string'
        ? flags.overrides
        : undefined;
  if (!path) {
    return undefined;
  }
  const raw = readJson(resolve(path));
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new GameboardCliError(
      `Piece overrides file ${relativizePath(path)} must be a JSON object`
    );
  }
  const payload = raw as Record<string, GameboardPieceCompatibilityDeclarationOptions> & {
    overrides?: Record<string, GameboardPieceCompatibilityDeclarationOptions>;
  };
  if (
    payload.overrides !== undefined &&
    (typeof payload.overrides !== 'object' || payload.overrides === null || Array.isArray(payload.overrides))
  ) {
    throw new GameboardCliError(
      `Piece overrides file ${relativizePath(path)} "overrides" property must be a JSON object`
    );
  }
  return payload.overrides ?? payload;
}

export function runPiecesFromAssets(parsed: ParsedArgs): void {
  const assetInputs = readAssetInputs(parsed.flags);
  const assetPaths = collectGltfAssetPaths(assetInputs);
  if (assetPaths.length === 0) {
    throw new GameboardCliError('pieces-from-assets found no .glb or .gltf files');
  }
  const roots = assetInputRoots(assetInputs);
  const includeAbsolutePaths = parsed.flags.includeAbsolutePaths === true;
  const sourceInputs = assetPaths.map((assetPath) => ({
    assetPath,
    sourceAsset: sourceAssetRecord(assetPath, roots, includeAbsolutePaths),
  }));
  const sourceAssets = sourceInputs.map((sourceInput) => sourceInput.sourceAsset);
  const sourcePack = String(parsed.flags.sourcePack ?? 'external');
  const intendedRole = readIntendedRole(parsed.flags.intendedRole);
  const reports = sourceInputs.map(({ assetPath, sourceAsset }) => {
    const metadata = readGltfMetadata(assetPath);
    return analyzeExternalAssetCompatibility({
      id: sourceAsset.id,
      sourcePack,
      creator: typeof parsed.flags.creator === 'string' ? parsed.flags.creator : undefined,
      license: typeof parsed.flags.license === 'string' ? parsed.flags.license : undefined,
      bounds: metadata.bounds,
      intendedRole,
      hasRig: metadata.hasRig,
      animationNames: metadata.animationNames,
      materialSlots: metadata.materialSlots,
      modelForward: readModelForward(parsed.flags.modelForward),
      boardForwardEdge: readBoardForwardEdge(parsed.flags.boardForwardEdge),
    });
  });
  const role = readPieceRole(parsed.flags.role);
  const overrides = pieceOverridesFromArgs(parsed.flags);
  const overridesWithSourceMetadata = mergeSourceAssetOverrides(overrides, sourceAssets);
  const pieces = declareGameboardPiecesFromCompatibilityReports(reports, {
    source: sourcePack,
    pieceIdPrefix:
      typeof parsed.flags.pieceIdPrefix === 'string' ? parsed.flags.pieceIdPrefix : undefined,
    assetIdPrefix:
      typeof parsed.flags.assetIdPrefix === 'string' ? parsed.flags.assetIdPrefix : undefined,
    tags: readCsv(parsed.flags.tags),
    overrides: overridesWithSourceMetadata,
    ...(role ? { role } : {}),
  });
  const registry = createGameboardPieceRegistry(pieces);
  const analysis = analyzeGameboardPieceRegistry(registry);
  const overrideWarnings = unmatchedOverrideWarnings(overrides, reports);
  const summary = summarizeCompatibilityReports(reports, analysis, overrideWarnings);
  const includeReports =
    parsed.flags.includeReports === true || parsed.flags.includeReport === true;
  const payload = {
    schemaVersion: '1.0.0',
    sourcePack,
    assets: sourceAssets.map((asset) => asset.relativePath),
    sourceAssets,
    pieces,
    summary,
    ...(includeReports ? { reports } : {}),
  };

  if (typeof parsed.flags.out === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.out)),
      `${JSON.stringify(payload, null, 2)}\n`,
      'utf8'
    );
    console.log(
      `Wrote ${pieces.length} piece declarations to ${safeResolveOutput(String(parsed.flags.out))}`
    );
  } else if (parsed.flags.json === true || includeReports) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printPiecesFromAssets(summary);
  }

  const hasErrors =
    reports.some((report) => report.errors.length > 0) || analysis.errors.length > 0;
  const hasWarnings =
    reports.some((report) => report.warnings.length > 0) ||
    analysis.warnings.length > 0 ||
    overrideWarnings.length > 0;
  if (hasErrors) {
    process.exit(1);
  }
  if (parsed.flags.failOnWarning === true && hasWarnings) {
    process.exit(1);
  }
}

function printPiecesFromAssets(summary: PiecesFromAssetsSummary): void {
  console.log(`assets scanned: ${summary.assetCount}`);
  console.log(`compatible KayKit hex tiles: ${summary.compatibleTileCount}`);
  console.log(`suggested roles: ${formatCounts(summary.suggestedRoles)}`);
  console.log(`piece roles: ${formatCounts(summary.pieceRoles)}`);
  console.log(`warnings: ${summary.warningCount}`);
  console.log(`errors: ${summary.errorCount}`);
  if (summary.overrideWarnings.length > 0) {
    console.log('override warnings:');
    for (const warning of summary.overrideWarnings) {
      console.log(`  - ${warning}`);
    }
  }
  if (summary.registryWarnings.length > 0) {
    console.log('registry warnings:');
    for (const warning of summary.registryWarnings) {
      console.log(`  - ${warning}`);
    }
  }
  if (summary.registryErrors.length > 0) {
    console.log('registry errors:');
    for (const error of summary.registryErrors) {
      console.log(`  - ${error}`);
    }
  }
}

function readAssetInputs(flags: Record<string, string | boolean>): string[] {
  const inputs = [...readCsv(flags.assets)];
  if (typeof flags.asset === 'string') {
    inputs.push(flags.asset);
  }
  if (inputs.length === 0) {
    throw new GameboardCliError(
      'pieces-from-assets requires --assets <path[,path]> or --asset <path>'
    );
  }
  return inputs.map((input) => resolve(input));
}

function assetInputRoots(inputs: readonly string[]): AssetInputRoot[] {
  return inputs.map((input) => {
    const stats = statSync(input);
    return {
      input,
      base: stats.isDirectory() ? input : dirname(input),
    };
  });
}

function collectGltfAssetPaths(inputs: readonly string[]): string[] {
  const files = new Set<string>();
  for (const input of inputs) {
    const stats = statSync(input);
    if (stats.isDirectory()) {
      for (const assetPath of collectGltfAssetPathsFromDirectory(input)) {
        files.add(assetPath);
      }
      continue;
    }
    if (isGltfPath(input)) {
      files.add(input);
    }
  }
  return [...files].sort((left, right) => left.localeCompare(right));
}

function collectGltfAssetPathsFromDirectory(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectGltfAssetPathsFromDirectory(fullPath));
      continue;
    }
    if (entry.isFile() && isGltfPath(fullPath)) {
      files.push(fullPath);
    }
  }
  return files;
}

function isGltfPath(path: string): boolean {
  const extension = extname(path).toLowerCase();
  return extension === '.glb' || extension === '.gltf';
}

function assetIdFromBatchPath(path: string, roots: readonly AssetInputRoot[]): string {
  const relativePath = relativeAssetPath(path, roots);
  const withoutExtension = relativePath.slice(0, -extname(relativePath).length);
  return normalizeAssetId(withoutExtension);
}

function sourceAssetRecord(
  path: string,
  roots: readonly AssetInputRoot[],
  includeAbsolutePath: boolean
): BatchSourceAssetRecord {
  const relativePath = relativeAssetPath(path, roots);
  const extension = extname(path).toLowerCase();
  return {
    id: assetIdFromBatchPath(path, roots),
    relativePath,
    fileName: basename(path),
    extension,
    ...(includeAbsolutePath ? { path } : {}),
  };
}

function relativeAssetPath(path: string, roots: readonly AssetInputRoot[]): string {
  const root = [...roots]
    .sort((left, right) => right.base.length - left.base.length)
    .find((candidate) => path === candidate.input || path.startsWith(`${candidate.base}/`)) as AssetInputRoot;
  return normalizePath(relative(root.base, path));
}

function normalizeAssetId(value: string): string {
  return normalizePath(value)
    .split('/')
    .map((part) =>
      part
        .trim()
        .replace(/[^a-zA-Z0-9:_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean)
    .join('/');
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/');
}

function mergeSourceAssetOverrides(
  overrides: Readonly<Record<string, GameboardPieceCompatibilityDeclarationOptions>> | undefined,
  sourceAssets: readonly BatchSourceAssetRecord[]
): Readonly<Record<string, GameboardPieceCompatibilityDeclarationOptions>> {
  const merged: Record<string, GameboardPieceCompatibilityDeclarationOptions> = {
    ...(overrides ?? {}),
  };
  for (const asset of sourceAssets) {
    merged[asset.id] = {
      ...(merged[asset.id] ?? {}),
      metadata: {
        sourceRelativePath: asset.relativePath,
        sourceFileName: asset.fileName,
        sourceExtension: asset.extension,
        localAsset: true,
        ...(merged[asset.id]?.metadata ?? {}),
      },
    };
  }
  return merged;
}

function unmatchedOverrideWarnings(
  overrides: Readonly<Record<string, GameboardPieceCompatibilityDeclarationOptions>> | undefined,
  reports: ReadonlyArray<ReturnType<typeof analyzeExternalAssetCompatibility>>
): string[] {
  if (!overrides) {
    return [];
  }
  const reportIds = new Set(reports.map((report) => report.id));
  return Object.keys(overrides)
    .filter((id) => !reportIds.has(id))
    .map((id) => `Piece override ${id} did not match any scanned asset id`);
}

function summarizeCompatibilityReports(
  reports: ReadonlyArray<ReturnType<typeof analyzeExternalAssetCompatibility>>,
  analysis: GameboardPieceRegistryAnalysis,
  extraWarnings: readonly string[] = []
): PiecesFromAssetsSummary {
  const suggestedRoles: Record<string, number> = {};
  for (const report of reports) {
    incrementCount(suggestedRoles, report.suggestedRole);
  }
  return {
    assetCount: reports.length,
    compatibleTileCount: reports.filter((report) => report.compatibleAsTile).length,
    warningCount:
      reports.reduce((count, report) => count + report.warnings.length, 0) +
      analysis.warnings.length +
      extraWarnings.length,
    errorCount:
      reports.reduce((count, report) => count + report.errors.length, 0) + analysis.errors.length,
    suggestedRoles,
    pieceRoles: analysis.roleCounts,
    overrideWarnings: extraWarnings,
    registryWarnings: analysis.warnings,
    registryErrors: analysis.errors,
  };
}

function incrementCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export async function run(parsed: ParsedArgs, _sourceRoot: string, _edition: PackEdition): Promise<void> {
  runPiecesFromAssets(parsed);
}
