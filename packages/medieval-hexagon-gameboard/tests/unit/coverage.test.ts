import { describe, expect, it } from 'vitest';
import {
  createDefaultGameboardCoveragePackageChecks as createDefaultGameboardCoveragePackageChecksFromRoot,
  renderGameboardCoverageMarkdown as renderGameboardCoverageMarkdownFromRoot,
  summarizeGameboardCoverage as summarizeGameboardCoverageFromRoot,
} from '../../src';
import {
  GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS,
  GAMEBOARD_RELEASE_GATE_COMMANDS,
  createDefaultGameboardCoveragePackageChecks,
  createDefaultGameboardCoverageReferences,
  renderGameboardCoverageMarkdown,
  summarizeGameboardCoverage,
  type GameboardCoveragePathStatusInput,
} from '../../src/coverage';

describe('release-readiness coverage', () => {
  it('summarizes every guide page, public API, visual artifact, and manifest boundary', () => {
    const report = summarizeGameboardCoverage({
      packageChecks: createDefaultGameboardCoveragePackageChecks('passed'),
    });

    expect(summarizeGameboardCoverageFromRoot({ packageChecks: createDefaultGameboardCoveragePackageChecksFromRoot('passed') }).guide.assetCounts).toEqual(
      report.guide.assetCounts
    );
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
    expect(report.releaseGateCommands).toEqual(GAMEBOARD_RELEASE_GATE_COMMANDS);
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
        'docs/assets/showcases/free-blueprint-builder-showcase.png': 'missing',
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
          subject: 'docs/assets/showcases/free-blueprint-builder-showcase.png',
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
    });
    const markdown = renderGameboardCoverageMarkdown(report);

    expect(renderGameboardCoverageMarkdownFromRoot(report)).toBe(markdown);
    expect(markdown).toContain('# Release Readiness Coverage');
    expect(markdown).toContain('- Guide pages: 19/19');
    expect(markdown).toContain('- Guide assets: 404 unique (221 FREE, 183 EXTRA), 1108 page-level occurrences');
    expect(markdown).toContain('| Status | Reference | Path | Purpose |');
    expect(markdown).toContain('| Status | Command | Summary |');
    expect(markdown).toContain('`pnpm test:visual`');
    expect(markdown).toContain('`page-15-shipyard-harbors`');
  });
});
