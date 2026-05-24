/**
 * Release-readiness coverage reporting for guide pages, manifests, screenshots,
 * local reference packs, and package verification gates.
 *
 * @module
 */
import {
  listKayKitGuideAssetCoverages,
  listKayKitGuidePublicApiCoverages,
  listKayKitGuideRoleCoverages,
  listKayKitGuideScenarios,
  summarizeKayKitGuideCoverage,
  type KayKitGuideAssetCoverage,
  type KayKitGuideCoverageSummary,
  type KayKitGuidePublicApiCoverage,
  type KayKitGuideRoleCoverage,
  type KayKitGuideScenario,
} from './catalog';
import { freeManifest } from './manifest/free';
import {
  inspectMedievalHexagonManifest,
  type MedievalHexagonManifestIssue,
} from './manifest/schema';
import type { MedievalHexagonManifest, PackEdition } from './types';

/** Schema version for generated release-readiness reports. */
export const GAMEBOARD_COVERAGE_SCHEMA_VERSION = '1.0.0';

/** Filesystem availability status for coverage inputs and screenshot artifacts. */
export type GameboardCoverageStatus = 'available' | 'missing' | 'skipped';

/** Verification status for package, docs, CI, or release gate commands. */
export type GameboardCoverageCheckStatus = 'passed' | 'failed' | 'not-run' | 'skipped';

/** Overall release-readiness status derived from coverage gaps and check status. */
export type GameboardCoverageReportStatus = 'passed' | 'warning' | 'failed';

/** Severity for a machine-readable coverage gap. */
export type CoverageGapSeverity = 'info' | 'warning' | 'error';

/** Review artifact source class for screenshots, guide images, or required supporting files. */
export type VisualArtifactCoverageSource = 'guide' | 'showcase' | 'screenshot';

/** Stable machine-readable release-readiness gap. */
export interface CoverageGap {
  /** Stable code for docs, tests, and CI parsing. */
  code: string;
  /** Whether the gap blocks release, needs review, or is informational. */
  severity: CoverageGapSeverity;
  /** Human-readable explanation. */
  message: string;
  /** Optional source path, asset id, guide page id, or command id. */
  subject?: string;
}

/** One docs or source-image path referenced by a guide page. */
export interface GameboardCoverageLinkedPath {
  /** Repo-relative source path. */
  path: string;
  /** Availability status supplied by the caller or CLI filesystem scan. */
  status: GameboardCoverageStatus;
}

/** One screenshot, contact sheet, guide image, or required review artifact for release. */
export interface VisualArtifactCoverage {
  /** Repo-relative screenshot, showcase, or contact-sheet path. */
  path: string;
  /** Whether the artifact was available during the coverage scan. */
  status: GameboardCoverageStatus;
  /** Whether this artifact comes from guide visual coverage or curated showcases. */
  source: VisualArtifactCoverageSource;
  /** Guide scenarios that reference this artifact. */
  scenarioIds: readonly string[];
  /** One-based guide pages represented by this artifact. */
  pages: readonly number[];
  /** Whether release review expects this artifact to exist. */
  required: boolean;
}

/** Release-readiness coverage for one extracted KayKit guide page. */
export interface GuidePageCoverage {
  /** One-based extracted guide page number. */
  page: number;
  /** Stable guide scenario id. */
  scenarioId: string;
  /** Human-readable guide page title. */
  title: string;
  /** Edition scope represented by this page. */
  edition: KayKitGuideScenario['edition'];
  /** Asset references on this page, counting repeated use across pages. */
  assetOccurrences: number;
  /** Unique asset ids on this page. */
  uniqueAssets: number;
  /** FREE asset ids on this page. */
  freeAssets: number;
  /** EXTRA asset ids on this page. */
  extraAssets: number;
  /** Public helper/API entries attached to this page. */
  publicApis: number;
  /** Review artifacts attached to this page. */
  visualArtifacts: number;
  /** Documentation entries attached to this page. */
  docs: number;
  /** Source guide image for this page plus availability status. */
  sourceImage: GameboardCoverageLinkedPath;
  /** Documentation pages linked by this scenario plus availability status. */
  docsCoverage: readonly GameboardCoverageLinkedPath[];
  /** Visual artifacts linked by this scenario plus availability status. */
  visualArtifactCoverage: readonly VisualArtifactCoverage[];
}

/** Manifest coverage summary for guide-described FREE and EXTRA assets. */
export interface GameboardCoverageManifestSummary {
  /** Edition declared by the inspected manifest. */
  edition?: PackEdition;
  /** Total assets in the inspected manifest. */
  manifestAssetCount: number;
  /** FREE guide assets expected from the published package. */
  guideFreeAssetCount: number;
  /** EXTRA guide assets expected to remain local-only. */
  guideExtraAssetCount: number;
  /** FREE guide assets found in the inspected manifest. */
  freeGuideAssetsInManifest: number;
  /** FREE guide asset ids absent from the inspected manifest. */
  freeGuideAssetsMissingFromManifest: readonly string[];
  /** EXTRA guide assets found in the inspected manifest. */
  extraGuideAssetsInManifest: number;
  /** EXTRA guide asset ids not present in the inspected manifest. */
  extraGuideAssetsLocalOnly: readonly string[];
  /** Manifest validation issue count by severity. */
  errorCount: number;
  /** Manifest validation warning count. */
  warningCount: number;
  /** Manifest validation issues from schema inspection. */
  issues: readonly MedievalHexagonManifestIssue[];
}

/** Local reference pack status for optional EXTRA/reference visual coverage. */
export interface GameboardCoverageReference {
  /** Stable reference id used by docs and CLI output. */
  id: string;
  /** Human-readable reference pack name. */
  label: string;
  /** Repo-relative local path. */
  path: string;
  /** Availability status from the caller or CLI filesystem scan. */
  status: GameboardCoverageStatus;
  /** Optional KayKit edition represented by this reference. */
  edition?: PackEdition;
  /** Why this reference exists in the release-readiness matrix. */
  purpose: string;
  /** Whether missing this reference should be treated as a warning. */
  requiredForFullReview: boolean;
}

/** Input used to override local reference pack statuses. */
export interface GameboardCoverageReferenceInput
  extends Partial<Omit<GameboardCoverageReference, 'id' | 'status'>> {
  /** Stable reference id to override. */
  id: string;
  /** Availability status from a filesystem scan or caller-provided probe. */
  status?: GameboardCoverageStatus;
}

/** Package, docs, CI, or visual command captured in the coverage ledger. */
export interface GameboardCoveragePackageCheck {
  /** Stable check id. */
  id: string;
  /** Human-readable check label. */
  label: string;
  /** Command or CI check name. */
  command: string;
  /** Verification status for this report. */
  status: GameboardCoverageCheckStatus;
  /** Optional captured output summary. */
  summary?: string;
}

/** Input used to override package gate command status. */
export interface GameboardCoveragePackageCheckInput
  extends Partial<Omit<GameboardCoveragePackageCheck, 'id' | 'status'>> {
  /** Stable check id to override. */
  id: string;
  /** Verification status for this report. */
  status?: GameboardCoverageCheckStatus;
}

/** Optional path status maps supplied by the CLI or another build tool. */
export interface GameboardCoveragePathStatusInput {
  /** Availability status by repo-relative source image path. */
  sourceImages?: Readonly<Record<string, GameboardCoverageStatus>>;
  /** Availability status by repo-relative docs path. */
  docs?: Readonly<Record<string, GameboardCoverageStatus>>;
  /** Availability status by repo-relative visual artifact path. */
  visualArtifacts?: Readonly<Record<string, GameboardCoverageStatus>>;
}

/** Options for `summarizeGameboardCoverage`. */
export interface SummarizeGameboardCoverageOptions {
  /** Manifest to inspect. Defaults to the packaged FREE manifest. */
  manifest?: MedievalHexagonManifest;
  /** ISO timestamp for generated report consumers. */
  generatedAt?: string;
  /** Caller-provided path status maps. Omitted paths are marked `skipped`. */
  pathStatus?: GameboardCoveragePathStatusInput;
  /** Local reference pack status overrides. */
  references?: readonly GameboardCoverageReferenceInput[];
  /** Package, docs, visual, or release gate check status overrides. */
  packageChecks?: readonly GameboardCoveragePackageCheckInput[];
}

/** Full release-readiness report for the package and local visual evidence. */
export interface GameboardCoverageReport {
  /** Report schema version. */
  schemaVersion: typeof GAMEBOARD_COVERAGE_SCHEMA_VERSION;
  /** Optional ISO timestamp provided by the caller. */
  generatedAt?: string;
  /** Overall status derived from gaps and check status. */
  status: GameboardCoverageReportStatus;
  /** Full guide scenario summary from the catalog source of truth. */
  guide: KayKitGuideCoverageSummary;
  /** Page-by-page guide coverage enriched with path status. */
  pages: readonly GuidePageCoverage[];
  /** Manifest coverage against guide-described FREE and EXTRA assets. */
  manifest: GameboardCoverageManifestSummary;
  /** Inverse public API coverage from guide pages and treated assets. */
  publicApi: readonly KayKitGuidePublicApiCoverage[];
  /** Inverse public gameplay-role coverage. */
  roles: readonly KayKitGuideRoleCoverage[];
  /** Asset-id-level coverage for every treated FREE and EXTRA asset. */
  assets: readonly KayKitGuideAssetCoverage[];
  /** Screenshot and showcase artifact availability. */
  visualArtifacts: readonly VisualArtifactCoverage[];
  /** Local reference pack availability for EXTRA and third-party visual tests. */
  references: readonly GameboardCoverageReference[];
  /** Package, docs, visual, and release verification command status. */
  packageChecks: readonly GameboardCoveragePackageCheck[];
  /** Machine-readable gaps that should guide release closeout. */
  gaps: readonly CoverageGap[];
  /** Canonical command sequence for final acceptance. */
  releaseGateCommands: readonly string[];
}

/** Curated showcase artifacts promoted from browser screenshots into docs. */
export const GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS = [
  'docs/assets/showcases/free-guide-scenarios-by-extracted-page.png',
  'docs/assets/showcases/free-guide-roads-all-labels-rotations.png',
  'docs/assets/showcases/free-guide-rivers-all-labels-rotations-water-waterless.png',
  'docs/assets/showcases/free-guide-coasts-all-labels-rotations-water-waterless.png',
  'docs/assets/showcases/free-blueprint-builder-showcase.png',
  'docs/assets/showcases/extra-blueprint-biome-transition-showcase.png',
  'docs/assets/showcases/extra-harbor-gameboard.png',
  'docs/assets/showcases/simple-rpg-fixed-completed.png',
  'docs/assets/showcases/simple-rpg-seeded-completed.png',
  'docs/assets/showcases/simple-rpg-local-third-party-assets.png',
  'packages/medieval-hexagon-gameboard/docs/showcases/free-guide-scenarios-by-extracted-page.png',
  'packages/medieval-hexagon-gameboard/docs/showcases/free-guide-roads-all-labels-rotations.png',
  'packages/medieval-hexagon-gameboard/docs/showcases/free-guide-rivers-all-labels-rotations-water-waterless.png',
  'packages/medieval-hexagon-gameboard/docs/showcases/free-guide-coasts-all-labels-rotations-water-waterless.png',
  'packages/medieval-hexagon-gameboard/docs/showcases/free-blueprint-builder-showcase.png',
  'packages/medieval-hexagon-gameboard/docs/showcases/extra-blueprint-biome-transition-showcase.png',
  'packages/medieval-hexagon-gameboard/docs/showcases/extra-harbor-gameboard.png',
  'packages/medieval-hexagon-gameboard/docs/showcases/simple-rpg-fixed-completed.png',
  'packages/medieval-hexagon-gameboard/docs/showcases/simple-rpg-seeded-completed.png',
  'packages/medieval-hexagon-gameboard/docs/showcases/simple-rpg-local-third-party-assets.png',
] as const;

/** Browser screenshot artifacts enforced by the visual test scripts. */
export const GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS = [
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-catalog.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-assets-by-public-role.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-source-pages.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-scenarios-by-extracted-page.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-roads-all-labels-rotations.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-rivers-all-labels-rotations-water-waterless.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-river-curvy-crossings-all-modes.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-coasts-all-labels-rotations-water-waterless.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-guide-page-nature-stacks-buildings-props.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-gameboard-recipe.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-blueprint-builder-showcase.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-gameboard.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-seeded-hex-gameboard.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-generated-piece-recipe.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-fixed-completed.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-seeded-completed.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-packaged-scenario.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-simulation-report.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-tiles-guide-and-transitions.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-buildings-factions-neutral-harbors.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-decoration-nature-props.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-guide-assets-by-public-role.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-guide-scenarios-pages-02-15.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-guide-scenarios-pages-16-18.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-seasonal-textures.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-harbor-gameboard.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-blueprint-biome-transition-showcase.png',
  'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/simple-rpg-local-third-party-assets.png',
] as const;

/** Canonical final acceptance commands for release closeout. */
export const GAMEBOARD_RELEASE_GATE_COMMANDS = [
  'pnpm lint',
  'pnpm typecheck',
  'pnpm build',
  'pnpm test:ci',
  'pnpm docs:build',
  'pnpm test:consumer',
  'pnpm test:visual',
  'pnpm test:workflows',
  'pnpm pack:dry-run',
] as const;

/**
 * Builds the default local reference-pack status inputs without probing the
 * filesystem. The CLI upgrades these statuses from `skipped` to `available` or
 * `missing` during a workspace scan.
 */
export function createDefaultGameboardCoverageReferences(
  status: GameboardCoverageStatus = 'skipped'
): GameboardCoverageReference[] {
  return [
    {
      id: 'kaykit-medieval-free',
      label: 'KayKit Medieval Hexagon FREE',
      path: 'references/KayKit_Medieval_Hexagon_Pack_1.0_FREE',
      status,
      edition: 'free',
      purpose: 'FREE source pack for guide extraction, generated assets, and manifest audits.',
      requiredForFullReview: true,
    },
    {
      id: 'kaykit-medieval-extra',
      label: 'KayKit Medieval Hexagon EXTRA',
      path: 'references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA',
      status,
      edition: 'extra',
      purpose: 'Purchased local-only EXTRA pack for category and guide visual coverage.',
      requiredForFullReview: true,
    },
    {
      id: 'kenney-castle-kit',
      label: 'Kenney Castle Kit',
      path: 'references/kenney_castle-kit',
      status,
      purpose: 'Third-party compatibility fixture for non-hex props, structures, and warnings.',
      requiredForFullReview: true,
    },
    {
      id: 'kaykit-adventurers',
      label: 'KayKit Adventurers FREE',
      path: 'references/KayKit_Adventurers_2.0_FREE',
      status,
      purpose: 'Animated actor fixture for facing, spawn, and SimpleRPG local-asset coverage.',
      requiredForFullReview: true,
    },
  ];
}

/** Builds the default release gate command rows without executing commands. */
export function createDefaultGameboardCoveragePackageChecks(
  status: GameboardCoverageCheckStatus = 'not-run'
): GameboardCoveragePackageCheck[] {
  return GAMEBOARD_RELEASE_GATE_COMMANDS.map((command) => ({
    id: command.replace(/^pnpm /, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, ''),
    label: command,
    command,
    status,
  }));
}

/**
 * Summarizes guide-page coverage, manifest coverage, public APIs, visual
 * artifacts, local references, package gates, and release gaps.
 */
export function summarizeGameboardCoverage(
  options: SummarizeGameboardCoverageOptions = {}
): GameboardCoverageReport {
  const guide = summarizeKayKitGuideCoverage();
  const scenarios = listKayKitGuideScenarios();
  const assets = listKayKitGuideAssetCoverages();
  const publicApi = listKayKitGuidePublicApiCoverages();
  const roles = listKayKitGuideRoleCoverages();
  const manifest = summarizeManifestCoverage(options.manifest ?? freeManifest, assets);
  const visualArtifacts = summarizeVisualArtifacts(scenarios, options.pathStatus?.visualArtifacts);
  const sourceImageStatuses = options.pathStatus?.sourceImages ?? {};
  const docsStatuses = options.pathStatus?.docs ?? {};
  const pageByScenarioId = new Map(guide.pages.map((page) => [page.scenarioId, page]));
  const pages = scenarios.map((scenario) => {
    const page = pageByScenarioId.get(scenario.id);
    if (!page) {
      throw new Error(`Missing guide coverage row for scenario ${scenario.id}`);
    }
    const scenarioVisualArtifacts = visualArtifacts.filter((artifact) =>
      artifact.scenarioIds.includes(scenario.id)
    );
    return {
      ...page,
      title: scenario.title,
      sourceImage: {
        path: scenario.sourceImage,
        status: statusForPath(sourceImageStatuses, scenario.sourceImage),
      },
      docsCoverage: scenario.docs.map((path) => ({
        path,
        status: statusForPath(docsStatuses, path),
      })),
      visualArtifactCoverage: scenarioVisualArtifacts,
    };
  });
  const references = normalizeReferences(options.references);
  const packageChecks = normalizePackageChecks(options.packageChecks);
  const gaps = collectCoverageGaps({
    guide,
    pages,
    manifest,
    visualArtifacts,
    references,
    packageChecks,
  });
  const status = reportStatusFromGaps(gaps);

  return {
    schemaVersion: GAMEBOARD_COVERAGE_SCHEMA_VERSION,
    ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
    status,
    guide,
    pages,
    manifest,
    publicApi,
    roles,
    assets,
    visualArtifacts,
    references,
    packageChecks,
    gaps,
    releaseGateCommands: GAMEBOARD_RELEASE_GATE_COMMANDS,
  };
}

/** Renders a release-readiness report as a Markdown ledger. */
export function renderGameboardCoverageMarkdown(
  report: GameboardCoverageReport = summarizeGameboardCoverage()
): string {
  const lines = [
    '# Release Readiness Coverage',
    '',
    'This generated ledger combines the decomposed KayKit guide coverage, manifest',
    'coverage, public API treatment, visual artifacts, local reference packs, and',
    'package verification gates. Regenerate it with:',
    '',
    '```bash',
    'pnpm coverage:ledger',
    '```',
    '',
    '## Summary',
    '',
    `- Status: ${report.status}`,
    `- Guide pages: ${report.guide.pageCount}/19`,
    `- Guide scenarios: ${report.guide.scenarioCount}`,
    `- Guide assets: ${report.guide.assetCounts.unique} unique (${report.guide.assetCounts.free} FREE, ${report.guide.assetCounts.extra} EXTRA), ${report.guide.assetCounts.occurrences} page-level occurrences`,
    `- Public API surfaces: ${report.publicApi.length}`,
    `- Public roles: ${report.roles.length}`,
    `- Visual artifacts: ${countStatus(report.visualArtifacts, 'available')} available, ${countStatus(report.visualArtifacts, 'missing')} missing, ${countStatus(report.visualArtifacts, 'skipped')} skipped`,
    `- Local references: ${countStatus(report.references, 'available')} available, ${countStatus(report.references, 'missing')} missing, ${countStatus(report.references, 'skipped')} skipped`,
    `- Release checks: ${countCheckStatus(report.packageChecks, 'passed')} passed, ${countCheckStatus(report.packageChecks, 'failed')} failed, ${countCheckStatus(report.packageChecks, 'not-run')} not run, ${countCheckStatus(report.packageChecks, 'skipped')} skipped`,
    '',
    '## Manifest Coverage',
    '',
    `- Manifest edition: ${report.manifest.edition ?? 'unknown'}`,
    `- Manifest assets: ${report.manifest.manifestAssetCount}`,
    `- FREE guide assets in manifest: ${report.manifest.freeGuideAssetsInManifest}/${report.manifest.guideFreeAssetCount}`,
    `- FREE guide assets missing from manifest: ${report.manifest.freeGuideAssetsMissingFromManifest.length}`,
    `- EXTRA guide assets kept local-only: ${report.manifest.extraGuideAssetsLocalOnly.length}/${report.manifest.guideExtraAssetCount}`,
    `- Manifest validation: ${report.manifest.errorCount} error(s), ${report.manifest.warningCount} warning(s)`,
    '',
    '## Gaps',
    '',
  ];

  if (report.gaps.length === 0) {
    lines.push('- None', '');
  } else {
    lines.push('| Severity | Code | Subject | Message |', '| --- | --- | --- | --- |');
    for (const gap of report.gaps) {
      lines.push(
        `| ${gap.severity} | \`${gap.code}\` | ${markdownCell(gap.subject ?? '')} | ${markdownCell(gap.message)} |`
      );
    }
    lines.push('');
  }

  lines.push('## Local References', '', '| Status | Reference | Path | Purpose |', '| --- | --- | --- | --- |');
  for (const reference of report.references) {
    lines.push(
      `| ${reference.status} | ${markdownCell(reference.label)} | \`${reference.path}\` | ${markdownCell(reference.purpose)} |`
    );
  }

  lines.push('', '## Release Checks', '', '| Status | Command | Summary |', '| --- | --- | --- |');
  for (const check of report.packageChecks) {
    lines.push(
      `| ${check.status} | \`${check.command}\` | ${markdownCell(check.summary ?? '')} |`
    );
  }

  lines.push(
    '',
    '## Visual Artifacts',
    '',
    '| Status | Source | Artifact | Pages |',
    '| --- | --- | --- | --- |'
  );
  for (const artifact of report.visualArtifacts) {
    lines.push(
      `| ${artifact.status} | ${artifact.source} | \`${artifact.path}\` | ${artifact.pages.join(', ') || '-'} |`
    );
  }

  lines.push(
    '',
    '## Guide Pages',
    '',
    '| Page | Scenario | Edition | Assets | APIs | Docs | Visuals | Source Image |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | --- |'
  );
  for (const page of report.pages) {
    lines.push(
      [
        `| ${page.page}`,
        `\`${page.scenarioId}\``,
        page.edition,
        String(page.uniqueAssets),
        String(page.publicApis),
        String(page.docs),
        String(page.visualArtifacts),
        `${page.sourceImage.status} \`${page.sourceImage.path}\` |`,
      ].join(' | ')
    );
  }

  lines.push('', '## Final Commands', '');
  for (const command of report.releaseGateCommands) {
    lines.push(`- \`${command}\``);
  }

  return lines.join('\n');
}

interface CoverageGapContext {
  guide: KayKitGuideCoverageSummary;
  pages: readonly GuidePageCoverage[];
  manifest: GameboardCoverageManifestSummary;
  visualArtifacts: readonly VisualArtifactCoverage[];
  references: readonly GameboardCoverageReference[];
  packageChecks: readonly GameboardCoveragePackageCheck[];
}

function summarizeManifestCoverage(
  manifestInput: MedievalHexagonManifest,
  assets: readonly KayKitGuideAssetCoverage[]
): GameboardCoverageManifestSummary {
  const inspection = inspectMedievalHexagonManifest(manifestInput);
  const manifest = inspection.manifest;
  const manifestAssetIds = new Set(manifest?.assets.map((asset) => asset.id) ?? []);
  const freeGuideAssetIds = assets
    .filter((asset) => asset.minimumEdition === 'free')
    .map((asset) => asset.assetId);
  const extraGuideAssetIds = assets
    .filter((asset) => asset.minimumEdition === 'extra')
    .map((asset) => asset.assetId);
  const freeGuideAssetsMissingFromManifest = freeGuideAssetIds.filter(
    (assetId) => !manifestAssetIds.has(assetId)
  );
  const extraGuideAssetsInManifest = extraGuideAssetIds.filter((assetId) =>
    manifestAssetIds.has(assetId)
  );

  return {
    edition: manifest?.edition,
    manifestAssetCount: manifest?.counts.total ?? 0,
    guideFreeAssetCount: freeGuideAssetIds.length,
    guideExtraAssetCount: extraGuideAssetIds.length,
    freeGuideAssetsInManifest: freeGuideAssetIds.length - freeGuideAssetsMissingFromManifest.length,
    freeGuideAssetsMissingFromManifest,
    extraGuideAssetsInManifest: extraGuideAssetsInManifest.length,
    extraGuideAssetsLocalOnly: extraGuideAssetIds.filter((assetId) => !manifestAssetIds.has(assetId)),
    errorCount: inspection.errorCount,
    warningCount: inspection.warningCount,
    issues: inspection.issues,
  };
}

function summarizeVisualArtifacts(
  scenarios: readonly KayKitGuideScenario[],
  statusByPath: Readonly<Record<string, GameboardCoverageStatus>> | undefined
): VisualArtifactCoverage[] {
  const artifactsByPath = new Map<string, VisualArtifactCoverage>();

  for (const scenario of scenarios) {
    const existingSourceImage = artifactsByPath.get(scenario.sourceImage);
    artifactsByPath.set(scenario.sourceImage, {
      path: scenario.sourceImage,
      status: statusForPath(statusByPath, scenario.sourceImage),
      source: 'guide',
      scenarioIds: uniqueSorted([...(existingSourceImage?.scenarioIds ?? []), scenario.id]),
      pages: uniqueNumbers([...(existingSourceImage?.pages ?? []), scenario.page]),
      required: true,
    });

    for (const path of scenario.visualArtifacts) {
      const existing = artifactsByPath.get(path);
      artifactsByPath.set(path, {
        path,
        status: statusForPath(statusByPath, path),
        source: 'guide',
        scenarioIds: uniqueSorted([...(existing?.scenarioIds ?? []), scenario.id]),
        pages: uniqueNumbers([...(existing?.pages ?? []), scenario.page]),
        required: true,
      });
    }
  }

  for (const path of GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS) {
    if (artifactsByPath.has(path)) {
      continue;
    }
    artifactsByPath.set(path, {
      path,
      status: statusForPath(statusByPath, path),
      source: 'showcase',
      scenarioIds: [],
      pages: [],
      required: true,
    });
  }

  for (const path of GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS) {
    if (artifactsByPath.has(path)) {
      continue;
    }
    artifactsByPath.set(path, {
      path,
      status: statusForPath(statusByPath, path),
      source: 'screenshot',
      scenarioIds: [],
      pages: [],
      required: true,
    });
  }

  return [...artifactsByPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function normalizeReferences(
  references: readonly GameboardCoverageReferenceInput[] | undefined
): GameboardCoverageReference[] {
  const provided = new Map((references ?? []).map((reference) => [reference.id, reference]));
  return createDefaultGameboardCoverageReferences().map((defaultReference) => {
    const override = provided.get(defaultReference.id);
    return {
      ...defaultReference,
      ...override,
      status: override?.status ?? defaultReference.status,
    };
  });
}

function normalizePackageChecks(
  packageChecks: readonly GameboardCoveragePackageCheckInput[] | undefined
): GameboardCoveragePackageCheck[] {
  const provided = new Map((packageChecks ?? []).map((check) => [check.id, check]));
  return createDefaultGameboardCoveragePackageChecks().map((defaultCheck) => {
    const override = provided.get(defaultCheck.id);
    return {
      ...defaultCheck,
      ...override,
      status: override?.status ?? defaultCheck.status,
    };
  });
}

function collectCoverageGaps(context: CoverageGapContext): CoverageGap[] {
  const gaps: CoverageGap[] = [];

  if (context.guide.pageCount !== 19 || context.guide.scenarioCount !== 19) {
    gaps.push({
      code: 'guide.page_count',
      severity: 'error',
      subject: 'guide',
      message: `Expected 19 guide pages and scenarios, found ${context.guide.pageCount} pages and ${context.guide.scenarioCount} scenarios.`,
    });
  }

  for (const page of context.pages) {
    if (page.sourceImage.status === 'missing') {
      gaps.push({
        code: 'guide.source_image_missing',
        severity: 'error',
        subject: page.sourceImage.path,
        message: `Guide page ${page.page} source image is missing.`,
      });
    }
    for (const doc of page.docsCoverage) {
      if (doc.status === 'missing') {
        gaps.push({
          code: 'guide.doc_missing',
          severity: 'error',
          subject: doc.path,
          message: `Guide page ${page.page} documentation link is missing.`,
        });
      }
    }
  }

  if (context.manifest.errorCount > 0) {
    gaps.push({
      code: 'manifest.invalid',
      severity: 'error',
      subject: 'manifest',
      message: `Manifest inspection found ${context.manifest.errorCount} error(s).`,
    });
  }
  for (const assetId of context.manifest.freeGuideAssetsMissingFromManifest) {
    gaps.push({
      code: 'manifest.free_guide_asset_missing',
      severity: 'error',
      subject: assetId,
      message: 'FREE guide asset is not present in the inspected manifest.',
    });
  }

  for (const artifact of context.visualArtifacts) {
    if (artifact.status === 'missing') {
      gaps.push({
        code: 'visual.artifact_missing',
        severity: artifact.source === 'showcase' ? 'error' : 'warning',
        subject: artifact.path,
        message: `${artifact.source === 'showcase' ? 'Curated showcase' : 'Browser visual'} artifact is missing.`,
      });
    }
  }

  for (const reference of context.references) {
    if (reference.status === 'missing') {
      gaps.push({
        code: 'reference.missing',
        severity: reference.requiredForFullReview ? 'warning' : 'info',
        subject: reference.path,
        message: `${reference.label} is unavailable, so local-only visual coverage cannot run.`,
      });
    }
  }

  for (const check of context.packageChecks) {
    if (check.status === 'failed') {
      gaps.push({
        code: 'check.failed',
        severity: 'error',
        subject: check.command,
        message: `${check.label} failed.`,
      });
    }
    if (check.status === 'not-run') {
      gaps.push({
        code: 'check.not_run',
        severity: 'warning',
        subject: check.command,
        message: `${check.label} has not been recorded in this coverage report.`,
      });
    }
  }

  return gaps;
}

function reportStatusFromGaps(gaps: readonly CoverageGap[]): GameboardCoverageReportStatus {
  if (gaps.some((gap) => gap.severity === 'error')) {
    return 'failed';
  }
  if (gaps.some((gap) => gap.severity === 'warning')) {
    return 'warning';
  }
  return 'passed';
}

function statusForPath(
  statusByPath: Readonly<Record<string, GameboardCoverageStatus>> | undefined,
  path: string
): GameboardCoverageStatus {
  return statusByPath?.[path] ?? 'skipped';
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function countStatus<T extends { status: GameboardCoverageStatus }>(
  values: readonly T[],
  status: GameboardCoverageStatus
): number {
  return values.filter((value) => value.status === status).length;
}

function countCheckStatus(
  values: readonly GameboardCoveragePackageCheck[],
  status: GameboardCoverageCheckStatus
): number {
  return values.filter((value) => value.status === status).length;
}

function markdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}
