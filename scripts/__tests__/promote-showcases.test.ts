import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ScreenshotStats } from '../../tests/scripts/screenshot-quality';
import {
  buildShowcaseTargets,
  defaultWorkspaceRoot,
  isDirectRun,
  parsePromoteShowcasesArgs,
  PROMOTE_SHOWCASES_USAGE,
  promoteShowcases,
  runPromoteShowcases,
  type PromoteShowcasesDependencies,
  type ShowcasePromotionTarget,
} from '../promote-showcases';

const target: ShowcasePromotionTarget = {
  path: 'docs/showcases/hero.png',
  source: '/repo/tests/browser/__screenshots__/hero.png',
  target: '/repo/docs/showcases/hero.png',
};

describe('scripts/promote-showcases', () => {
  it('parses flags, resolves default targets, and detects direct execution', () => {
    expect(defaultWorkspaceRoot()).toBe(resolve(import.meta.dirname, '../..'));
    expect(parsePromoteShowcasesArgs(['--check'])).toEqual({ checkOnly: true, help: false });
    expect(parsePromoteShowcasesArgs(['-h'])).toEqual({ checkOnly: false, help: true });
    expect(buildShowcaseTargets('/repo')[0]).toEqual(
      expect.objectContaining({
        source: expect.stringContaining('/repo/tests/browser/__screenshots__/'),
        target: expect.stringContaining('/repo/docs/showcases/'),
      })
    );

    const scriptPath = '/repo/scripts/promote-showcases.ts';
    const moduleUrl = pathToFileURL(scriptPath).href;
    expect(isDirectRun(scriptPath, moduleUrl, (path) => path)).toBe(true);
    expect(isDirectRun('/repo/scripts/other.ts', moduleUrl, (path) => path)).toBe(false);
    expect(isDirectRun('', moduleUrl, (path) => path)).toBe(false);
    expect(isDirectRun('/missing.ts', moduleUrl, () => { throw new Error('missing'); })).toBe(false);
  });

  it('prints usage without touching showcase files', () => {
    const harness = createHarness();
    const exitCode = runPromoteShowcases(['--help'], { dependencies: harness.dependencies });

    expect(exitCode).toBe(0);
    expect(harness.logs).toEqual([PROMOTE_SHOWCASES_USAGE]);
    expect(harness.calls).toEqual([]);
  });

  it('reports missing source screenshots in check mode', () => {
    const harness = createHarness();
    const exitCode = runPromoteShowcases(['--check'], {
      workspaceRoot: '/repo',
      targets: [target],
      dependencies: harness.dependencies,
    });

    expect(exitCode).toBe(1);
    expect(harness.errors).toEqual([
      'showcase promotion: missing source screenshot tests/browser/__screenshots__/hero.png',
    ]);
    expect(harness.calls).toEqual([{ kind: 'mkdir', path: '/repo/docs/showcases' }]);
  });

  it('checks matching source and showcase hashes plus PNG quality', () => {
    const harness = createHarness({
      existingPaths: [target.source, target.target],
      fileContents: {
        [target.source]: 'same-bytes',
        [target.target]: 'same-bytes',
      },
    });
    const exitCode = runPromoteShowcases(['--check'], {
      workspaceRoot: '/repo',
      targets: [target],
      dependencies: harness.dependencies,
    });

    expect(exitCode).toBe(0);
    expect(harness.logs).toContain('stats:docs/showcases/hero.png');
    expect(harness.logs).toContain('stats:tests/browser/__screenshots__/hero.png');
    expect(harness.logs.at(-1)).toBe('showcase promotion check passed for 1 curated screenshot(s)');
  });

  it('reports missing committed showcases when the source screenshot exists', () => {
    const harness = createHarness({
      existingPaths: [target.source],
      fileContents: { [target.source]: 'source-bytes' },
    });

    const result = promoteShowcases({ checkOnly: true, workspaceRoot: '/repo', targets: [target], dependencies: harness.dependencies });

    expect(result.failures).toContain('missing showcase docs/showcases/hero.png');
  });

  it('copies sources to showcase targets in promotion mode', () => {
    const harness = createHarness({
      existingPaths: [target.source],
      fileContents: { [target.source]: 'source-bytes' },
    });
    const result = promoteShowcases({ workspaceRoot: '/repo', targets: [target], dependencies: harness.dependencies });

    expect(result.failures).toEqual([]);
    expect(result.curatedShowcaseFileCount).toBe(1);
    expect(result.directoryCount).toBe(1);
    expect(harness.calls).toEqual([
      { kind: 'mkdir', path: '/repo/docs/showcases' },
      { kind: 'copy', source: target.source, target: target.target },
    ]);
    expect(harness.logs).toContain('promoted hero.png -> docs/showcases/hero.png');
  });

  it('reports hash mismatches and quality failures', () => {
    const harness = createHarness({
      existingPaths: [target.source, target.target],
      fileContents: {
        [target.source]: 'source-bytes',
        [target.target]: 'target-bytes',
      },
      qualityFailures: {
        [target.source]: [`${target.source}: too flat`],
      },
    });
    const result = promoteShowcases({ checkOnly: true, workspaceRoot: '/repo', targets: [target], dependencies: harness.dependencies });

    expect(result.failures).toEqual([
      'showcase docs/showcases/hero.png does not match tests/browser/__screenshots__/hero.png',
      'tests/browser/__screenshots__/hero.png: too flat',
    ]);
  });

  it('reports thrown quality analyzer failures', () => {
    const throwingTarget: ShowcasePromotionTarget = {
      path: 'docs/showcases/throw.png',
      source: '/repo/tests/browser/__screenshots__/throw.png',
      target: '/repo/docs/showcases/throw.png',
    };
    const harness = createHarness({
      existingPaths: [throwingTarget.source],
      thrownQualityPaths: [throwingTarget.target],
    });

    const result = promoteShowcases({ workspaceRoot: '/repo', targets: [throwingTarget], dependencies: harness.dependencies });

    expect(result.failures).toEqual([
      'showcase quality check failed for docs/showcases/throw.png: not a png',
    ]);
  });
});

function createHarness(options: {
  existingPaths?: readonly string[];
  fileContents?: Record<string, string>;
  qualityFailures?: Record<string, readonly string[]>;
  thrownQualityPaths?: readonly string[];
} = {}) {
  const calls: unknown[] = [];
  const errors: string[] = [];
  const logs: string[] = [];
  const existingPaths = new Set(options.existingPaths ?? []);
  const fileContents = options.fileContents ?? {};
  const thrownQualityPaths = new Set(options.thrownQualityPaths ?? []);
  const qualityFailures = options.qualityFailures ?? {};
  const dependencies: PromoteShowcasesDependencies = {
    analyzeScreenshotImpl: (path) => {
      if (thrownQualityPaths.has(path)) {
        throw 'not a png';
      }
      return statsFor(path);
    },
    copyFileSyncImpl: (source, destination) => {
      calls.push({ kind: 'copy', source: String(source), target: String(destination) });
      existingPaths.add(String(destination));
    },
    error: (message) => errors.push(message),
    existsSyncImpl: (path) => existingPaths.has(String(path)),
    formatScreenshotStatsImpl: (stats) => `stats:${stats.path}`,
    log: (message) => logs.push(message),
    mkdirSyncImpl: (path) => { calls.push({ kind: 'mkdir', path: String(path) }); },
    readFileSyncImpl: (path) => Buffer.from(fileContents[String(path)] ?? ''),
    validateScreenshotImpl: (stats) => qualityFailures[stats.path] ?? [],
  };
  return { calls, dependencies, errors, logs };
}

function statsFor(path: string): ScreenshotStats {
  return { path, height: 256, luminanceStdDev: 10, nonBackgroundRatio: 0.1, pixels: 65_536, uniqueColorBuckets: 32, width: 256 };
}
