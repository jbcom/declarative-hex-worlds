import { describe, expect, it } from 'vitest';
import {
  createDefaultGameboardCoveragePackageChecks as createDefaultGameboardCoveragePackageChecksFromRoot,
  renderGameboardCoverageMarkdown as renderGameboardCoverageMarkdownFromRoot,
  summarizeGameboardCoverage as summarizeGameboardCoverageFromRoot,
} from '../..';
import {
  runSimpleRpgExecutableGuideApiSmoke,
  summarizeSimpleRpgGuidePublicApiExercises,
} from '../../../examples/simple-rpg-usage';
import {
  GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS,
  GAMEBOARD_RELEASE_GATE_COMMANDS,
  GAMEBOARD_RELEASE_GATE_SUMMARIES,
  GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS,
  createDefaultGameboardCoveragePackageChecks,
  createDefaultGameboardCoverageReferences,
  renderGameboardCoverageMarkdown,
  summarizeGameboardCoverage,
  type GameboardCoveragePathStatusInput,
  type GameboardCoverageSimpleRpgEvidence,
  type GameboardCoverageSimpleRpgEvidenceMode,
} from '../../interop/coverage';

describe('release-readiness coverage', () => {
  it('summarizes every guide page, public API, visual artifact, and manifest boundary', () => {
    const report = summarizeGameboardCoverage({
      packageChecks: createDefaultGameboardCoveragePackageChecks('passed'),
      simpleRpgEvidence: createSimpleRpgEvidence(),
    });

    expect(
      summarizeGameboardCoverageFromRoot({
        packageChecks: createDefaultGameboardCoveragePackageChecksFromRoot('passed'),
      }).guide.assetCounts
    ).toEqual(report.guide.assetCounts);
    expect(report.schemaVersion).toBe('1.0.0');
    expect(report.status).toBe('passed');
    expect(report.guide).toMatchObject({
      scenarioCount: 19,
      pageCount: 19,
      sourceImageCount: 19,
      assetCounts: {
        unique: 404,
        free: 221,
        extra: 183,
        occurrences: 1108,
      },
    });
    expect(report.pages).toHaveLength(19);
    expect(report.pages.map((page) => page.page)).toEqual(
      Array.from({ length: 19 }, (_, index) => index + 1)
    );
    const visualArtifactPaths = report.visualArtifacts.map((artifact) => artifact.path);
    expect(
      visualArtifactPaths.filter((path) => path.startsWith('docs/assets/kaykit-guide/pages/page-'))
    ).toHaveLength(19);
    for (const page of report.pages) {
      expect(visualArtifactPaths).toContain(page.sourceImage.path);
      expect(page.visualArtifactCoverage.map((artifact) => artifact.path)).toContain(
        page.sourceImage.path
      );
    }
    expect(report.publicApi).toHaveLength(74);
    expect(report.roles).toHaveLength(12);
    expect(report.assets).toHaveLength(404);
    expect(report.manifest).toMatchObject({
      edition: 'free',
      manifestAssetCount: 221,
      guideFreeAssetCount: 221,
      guideExtraAssetCount: 183,
      freeGuideAssetsInManifest: 221,
      freeGuideAssetsMissingFromManifest: [],
      extraGuideAssetsInManifest: 0,
      errorCount: 0,
    });
    expect(report.manifest.extraGuideAssetsLocalOnly).toHaveLength(183);
    expect(report.visualArtifacts.map((artifact) => artifact.path)).toEqual(
      [...new Set(report.visualArtifacts.map((artifact) => artifact.path))].sort((a, b) =>
        a.localeCompare(b)
      )
    );
    for (const showcase of GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS) {
      expect(report.visualArtifacts.map((artifact) => artifact.path)).toContain(showcase);
    }
    for (const screenshot of GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS) {
      expect(report.visualArtifacts.map((artifact) => artifact.path)).toContain(screenshot);
    }
    expect(report.releaseGateCommands).toEqual(GAMEBOARD_RELEASE_GATE_COMMANDS);
    expect(report.packageChecks.map((check) => check.summary)).toEqual(
      GAMEBOARD_RELEASE_GATE_COMMANDS.map((command) => GAMEBOARD_RELEASE_GATE_SUMMARIES[command])
    );
    expect(report.simpleRpgEvidence).toMatchObject({
      guidePublicApiCount: 74,
      exercisedPublicApiCount: 74,
      missingPublicApis: [],
      stalePublicApis: [],
      executablePublicApiCount: 40,
      publicTreatmentCount: 404,
      guideScenarioCount: 19,
      inactiveEvidenceModes: [],
    });
    expect(report.simpleRpgEvidence?.activeEvidenceModes).toEqual([
      'fixed-gameplay',
      'seeded-generation',
      'packaged-scenario',
      'executable-smoke',
      'blueprint-recipe',
      'manifest-package',
      'compatibility-adapter',
      'package-boundary',
      'visual-coverage',
    ]);
    expect(report.simpleRpgEvidence?.evidenceModeCounts).toMatchObject({
      'fixed-gameplay': 30,
      'seeded-generation': 10,
      'packaged-scenario': 1,
      'executable-smoke': 40,
      'blueprint-recipe': 4,
      'manifest-package': 6,
      'compatibility-adapter': 2,
      'package-boundary': 3,
      'visual-coverage': 26,
    });
    expect(report.simpleRpgEvidence?.publicApiExercises).toHaveLength(74);
    expect(report.simpleRpgEvidence?.publicApiExercises?.[0]).toMatchObject({
      publicApi: 'analyzeHexTileRegistry',
      mode: 'executable-smoke',
      pages: expect.arrayContaining([13]),
      assetCount: expect.any(Number) as number,
    });
    expect(
      report.simpleRpgEvidence?.publicApiExercises?.find(
        (exercise) => exercise.publicApi === 'GameboardBuilder.addBridge'
      )
    ).toMatchObject({
      modes: expect.arrayContaining(['fixed-gameplay', 'visual-coverage']) as string[],
      pages: [2, 7, 9],
      assetCount: 2,
    });

    const simpleRpgSmoke = runSimpleRpgExecutableGuideApiSmoke();
    const docsContractSummary = GAMEBOARD_RELEASE_GATE_SUMMARIES['pnpm test:docs-contract'];
    expect(docsContractSummary).toContain(
      `${simpleRpgSmoke.directPublicApiCount} guide-facing helper APIs`
    );
    expect(docsContractSummary).toContain(
      `${simpleRpgSmoke.publicTreatmentCount} KayKit public treatment`
    );
    expect(docsContractSummary).toContain(`${simpleRpgSmoke.guideScenarioCount} guide pages`);
  });

  it('keeps each curated showcase wired to both docs and package README destinations', () => {
    const byFilename = new Map<string, string[]>();

    for (const path of GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS) {
      const filename = path.split('/').at(-1);
      expect(filename).toMatch(/\.png$/);
      byFilename.set(filename ?? '', [...(byFilename.get(filename ?? '') ?? []), path]);
    }

    expect(byFilename.size).toBe(10);
    for (const [filename, paths] of byFilename) {
      // Post-R1: each showcase lives at exactly one canonical path.
      expect(paths.sort()).toEqual([`docs/showcases/${filename}`]);
    }
  });

  it('marks local reference, docs, and visual gaps without requiring EXTRA binaries', () => {
    const pathStatus: GameboardCoveragePathStatusInput = {
      sourceImages: {
        'docs/assets/kaykit-guide/pages/page-01.png': 'missing',
      },
      docs: {
        'docs/guides/public-api.md': 'missing',
      },
      visualArtifacts: {
        'docs/showcases/free-blueprint-builder-showcase.png': 'missing',
      },
    };
    const report = summarizeGameboardCoverage({
      pathStatus,
      references: createDefaultGameboardCoverageReferences('missing'),
      packageChecks: createDefaultGameboardCoveragePackageChecks('not-run'),
    });

    expect(report.status).toBe('failed');
    expect(report.gaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'guide.source_image_missing',
          severity: 'error',
          subject: 'docs/assets/kaykit-guide/pages/page-01.png',
        }),
        expect.objectContaining({
          code: 'guide.doc_missing',
          severity: 'error',
          subject: 'docs/guides/public-api.md',
        }),
        expect.objectContaining({
          code: 'visual.artifact_missing',
          severity: 'error',
          subject: 'docs/showcases/free-blueprint-builder-showcase.png',
        }),
        expect.objectContaining({
          code: 'reference.missing',
          severity: 'warning',
          subject: 'references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA',
        }),
        expect.objectContaining({
          code: 'check.not_run',
          severity: 'warning',
          subject: 'pnpm test:ci',
        }),
      ])
    );
  });

  it('renders a Markdown ledger that names counts, gaps, references, and commands', () => {
    const report = summarizeGameboardCoverage({
      packageChecks: createDefaultGameboardCoveragePackageChecks('passed'),
      simpleRpgEvidence: createSimpleRpgEvidence(),
    });
    const markdown = renderGameboardCoverageMarkdown(report);

    expect(renderGameboardCoverageMarkdownFromRoot(report)).toBe(markdown);
    expect(markdown).toContain('# Release Readiness Coverage');
    expect(markdown).toContain('- Guide pages: 19/19');
    expect(markdown).toContain('- SimpleRPG API evidence: 74/74 represented, 40 directly executed, 9 active mode(s)');
    expect(markdown).toContain('## SimpleRPG Public API Evidence');
    expect(markdown).toContain('| visual-coverage | 26 |');
    expect(markdown).toContain('### SimpleRPG Exercise Matrix');
    expect(markdown).toContain(
      '| `GameboardBuilder.addBridge` | fixed-gameplay, visual-coverage | 2, 7, 9 | 2 | Fixed SimpleRPG board places a bridge beside the harbor approach. |'
    );
    expect(markdown).toContain(
      '- Guide assets: 404 unique (221 FREE, 183 EXTRA), 1108 page-level occurrences'
    );
    expect(markdown).toContain('| Status | Reference | Path | Purpose |');
    expect(markdown).toContain('| Status | Command | Summary |');
    expect(markdown).toContain('`pnpm test:docs-contract`');
    expect(markdown).toContain('`pnpm test:visual`');
    expect(markdown).toContain('README gallery links');
    expect(markdown).toContain('`pnpm showcases:promote -- --check`');
    expect(markdown).toContain('`page-15-shipyard-harbors`');
  });
});

function createSimpleRpgEvidence(): GameboardCoverageSimpleRpgEvidence {
  const exerciseCoverage = summarizeSimpleRpgGuidePublicApiExercises();
  const executableSmoke = runSimpleRpgExecutableGuideApiSmoke();
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
    activeEvidenceModes: evidenceModeEntries
      .filter(([, count]) => count > 0)
      .map(([mode]) => mode),
    inactiveEvidenceModes: evidenceModeEntries
      .filter(([, count]) => count <= 0)
      .map(([mode]) => mode),
    publicApiExercises: exerciseCoverage.exercises,
  };
}
