import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  listSimpleRpgGuidePublicApiExercises,
  runSimpleRpgExecutableGuideApiSmoke,
  summarizeSimpleRpgGuidePublicApiExercises,
} from '../../guides/simple-rpg';
import scenarioJson from '../../../tests/integration/simple-rpg/fixtures/simple-rpg-scenario.json';
import {
  createDefaultGameboardCoveragePackageChecks,
  createDefaultGameboardCoverageReferences,
  GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS,
  type GameboardCoveragePathStatusInput,
  type GameboardCoverageReport,
  type GameboardCoverageSimpleRpgEvidence,
  type GameboardCoverageSimpleRpgEvidenceMode,
  type GameboardCoverageStatus,
  renderGameboardCoverageMarkdown,
  summarizeGameboardCoverage,
} from '../../interop';
import { GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS } from '../../interop/internal';
import { listKayKitGuideScenarios, type GameboardScenario } from '../../scenario';
import type { PackEdition } from '../../types';
import { type ParsedArgs, readManifest, safeResolveOutput, uniqueStrings } from '../_shared';

export async function run(
  parsed: ParsedArgs,
  _sourceRoot: string,
  _edition: PackEdition
): Promise<void> {
  runCoverage(parsed);
}

export function runCoverage(parsed: ParsedArgs): void {
  const manifest =
    typeof parsed.flags.manifest === 'string'
      ? readManifest(resolve(parsed.flags.manifest))
      : undefined;
  const checksPassed = parsed.flags.checksPassed === true;
  const report = summarizeGameboardCoverage({
    manifest,
    generatedAt:
      typeof parsed.flags.generatedAt === 'string'
        ? parsed.flags.generatedAt
        : new Date().toISOString(),
    pathStatus: coveragePathStatuses(),
    references: createDefaultGameboardCoverageReferences().map((reference) => ({
      ...reference,
      status: existsSync(resolve(reference.path)) ? 'available' : 'missing',
    })),
    packageChecks: createDefaultGameboardCoveragePackageChecks(checksPassed ? 'passed' : 'not-run'),
    simpleRpgEvidence: createCliSimpleRpgEvidence(),
  });
  const markdown =
    parsed.flags.markdown === true ? renderGameboardCoverageMarkdown(report) : undefined;

  if (typeof parsed.flags.outJson === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outJson)),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
    console.log(`Wrote coverage JSON to ${safeResolveOutput(String(parsed.flags.outJson))}`);
  }
  if (typeof parsed.flags.outMarkdown === 'string') {
    writeFileSync(
      safeResolveOutput(String(parsed.flags.outMarkdown)),
      `${renderGameboardCoverageMarkdown(report)}\n`,
      'utf8'
    );
    console.log(
      `Wrote coverage Markdown to ${safeResolveOutput(String(parsed.flags.outMarkdown))}`
    );
  }
  if (typeof parsed.flags.out === 'string') {
    const outputPath = safeResolveOutput(String(parsed.flags.out));
    const output =
      parsed.flags.markdown === true
        ? (markdown ?? renderGameboardCoverageMarkdown(report))
        : JSON.stringify(report, null, 2);
    writeFileSync(outputPath, `${output}\n`, 'utf8');
    console.log(
      `Wrote coverage ${parsed.flags.markdown === true ? 'Markdown' : 'JSON'} to ${outputPath}`
    );
  }
  if (parsed.flags.json === true) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (parsed.flags.markdown === true) {
    console.log(markdown ?? renderGameboardCoverageMarkdown(report));
    return;
  }

  printCoverageSummary(report);
}

export function createCliSimpleRpgEvidence(): GameboardCoverageSimpleRpgEvidence {
  const exerciseCoverage = summarizeSimpleRpgGuidePublicApiExercises();
  const executableSmoke = runSimpleRpgExecutableGuideApiSmoke(scenarioJson as GameboardScenario);
  const evidenceModeCounts = exerciseCoverage.exerciseModeCounts;
  const evidenceModeEntries = Object.entries(evidenceModeCounts) as Array<
    [GameboardCoverageSimpleRpgEvidenceMode, number]
  >;
  return {
    guidePublicApiCount: exerciseCoverage.guidePublicApiCount,
    exercisedPublicApiCount: exerciseCoverage.exercisedPublicApiCount,
    missingPublicApis: exerciseCoverage.missingPublicApis,
    stalePublicApis: exerciseCoverage.staleExercisePublicApis,
    executablePublicApiCount: executableSmoke.directPublicApiCount,
    publicTreatmentCount: executableSmoke.publicTreatmentCount,
    guideScenarioCount: executableSmoke.guideScenarioCount,
    evidenceModeCounts,
    activeEvidenceModes: evidenceModeEntries.filter(([, count]) => count > 0).map(([mode]) => mode),
    inactiveEvidenceModes: evidenceModeEntries
      .filter(([, count]) => count <= 0)
      .map(([mode]) => mode),
    publicApiExercises: listSimpleRpgGuidePublicApiExercises(),
  };
}

export function coveragePathStatuses(): GameboardCoveragePathStatusInput {
  const scenarios = listKayKitGuideScenarios();
  const sourceImages = uniqueStrings(scenarios.map((scenario) => scenario.sourceImage));
  const docs = uniqueStrings(scenarios.flatMap((scenario) => scenario.docs));
  const visualArtifacts = uniqueStrings([
    ...sourceImages,
    ...scenarios.flatMap((scenario) => scenario.visualArtifacts),
    ...GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS,
    ...GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS,
  ]);
  return {
    sourceImages: statusMapForPaths(sourceImages),
    docs: statusMapForPaths(docs),
    visualArtifacts: statusMapForPaths(visualArtifacts),
  };
}

export function statusMapForPaths(
  paths: readonly string[]
): Record<string, GameboardCoverageStatus> {
  return Object.fromEntries(
    paths.map((path) => [path, existsSync(resolve(path)) ? 'available' : 'missing'])
  );
}

export function printCoverageSummary(report: GameboardCoverageReport): void {
  console.log(`coverage status: ${report.status}`);
  console.log(`guide pages: ${report.guide.pageCount}/19`);
  console.log(`guide scenarios: ${report.guide.scenarioCount}`);
  console.log(
    `guide assets: ${report.guide.assetCounts.unique} unique (${report.guide.assetCounts.free} FREE, ${report.guide.assetCounts.extra} EXTRA), ${report.guide.assetCounts.occurrences} occurrence(s)`
  );
  console.log(`public APIs: ${report.publicApi.length}`);
  console.log(
    `manifest: ${report.manifest.manifestAssetCount} asset(s), ${report.manifest.freeGuideAssetsInManifest}/${report.manifest.guideFreeAssetCount} FREE guide asset(s)`
  );
  console.log(
    `visual artifacts: ${countCoverageStatus(report.visualArtifacts, 'available')} available, ${countCoverageStatus(report.visualArtifacts, 'missing')} missing, ${countCoverageStatus(report.visualArtifacts, 'skipped')} skipped`
  );
  console.log(
    `local references: ${countCoverageStatus(report.references, 'available')} available, ${countCoverageStatus(report.references, 'missing')} missing, ${countCoverageStatus(report.references, 'skipped')} skipped`
  );
  if (report.simpleRpgEvidence) {
    console.log(
      `SimpleRPG API evidence: ${report.simpleRpgEvidence.exercisedPublicApiCount}/${report.simpleRpgEvidence.guidePublicApiCount} represented, ${report.simpleRpgEvidence.executablePublicApiCount} directly executed, ${report.simpleRpgEvidence.activeEvidenceModes.length} active mode(s)`
    );
  }
  console.log(`gaps: ${report.gaps.length}`);
  for (const gap of report.gaps.slice(0, 20)) {
    console.log(
      `- ${gap.severity} ${gap.code}: ${gap.subject ? `${gap.subject}: ` : ''}${gap.message}`
    );
  }
  if (report.gaps.length > 20) {
    console.log(`...${report.gaps.length - 20} more gap(s)`);
  }
}

export function countCoverageStatus<T extends { status: GameboardCoverageStatus }>(
  values: readonly T[],
  status: GameboardCoverageStatus
): number {
  return values.filter((value) => value.status === status).length;
}
