import type { SpawnSyncReturns } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  commandExists,
  defaultRepoRoot,
  extractKayKitGuide,
  isDirectRun,
  parseGuideExtractionArgs,
  resolveExtractKayKitGuideDependencies,
  runExtractKayKitGuide,
  type ExtractKayKitGuideDependencies,
  type GuideExtractionArgs,
} from '../extract-kaykit-guide';

const args: GuideExtractionArgs = {
  pdfPath: '/repo/guide.pdf',
  pagesDirectory: '/repo/docs/assets/kaykit-guide/pages',
  montagePath: '/repo/docs/assets/kaykit-guide/montage.png',
};

describe('scripts/extract-kaykit-guide', () => {
  it('parses paths, detects commands, and guards direct execution', () => {
    expect(defaultRepoRoot()).toBe(resolve(import.meta.dirname, '../..'));
    expect(parseGuideExtractionArgs(['--pdf', 'guide.pdf'], '/repo').pdfPath).toBe(
      resolve('guide.pdf')
    );
    expect(parseGuideExtractionArgs([], '/repo')).toEqual({
      pdfPath: resolve(
        '/repo/references/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Medieval_Hexagon_UserGuide_v1.pdf'
      ),
      pagesDirectory: resolve('/repo/docs/assets/kaykit-guide/pages'),
      montagePath: resolve('/repo/docs/assets/kaykit-guide/montage.png'),
    });
    expect(() => parseGuideExtractionArgs(['--pdf'], '/repo')).toThrow('Missing value for --pdf');

    const harness = createHarness({ commandStatus: { swift: 0 } });
    const dependencies = resolveExtractKayKitGuideDependencies(harness.dependencies);
    expect(commandExists('swift', dependencies)).toBe(true);
    expect(harness.calls.at(-1)).toEqual({
      kind: 'spawn',
      command: 'sh',
      args: ['-c', 'command -v "$1"', '--', 'swift'],
    });
    const windowsHarness = createHarness({ platform: 'win32', spawnStatus: { where: 0 } });
    expect(commandExists('magick', resolveExtractKayKitGuideDependencies(windowsHarness.dependencies))).toBe(true);
    expect(windowsHarness.calls.at(-1)).toEqual({ kind: 'spawn', command: 'where', args: ['magick'] });

    const scriptPath = '/repo/scripts/extract-kaykit-guide.ts';
    const moduleUrl = pathToFileURL(scriptPath).href;
    expect(isDirectRun(scriptPath, moduleUrl, (path) => path)).toBe(true);
    expect(isDirectRun('/repo/scripts/other.ts', moduleUrl, (path) => path)).toBe(false);
    expect(isDirectRun('', moduleUrl, (path) => path)).toBe(false);
    expect(isDirectRun('/missing.ts', moduleUrl, () => { throw new Error('missing'); })).toBe(false);
  });

  it('reports missing PDFs before creating output directories', () => {
    const harness = createHarness({ existingPdf: false });
    const exitCode = runExtractKayKitGuide(['--pdf', args.pdfPath], {
      repoRoot: '/repo',
      dependencies: harness.dependencies,
    });

    expect(exitCode).toBe(1);
    expect(harness.errors).toEqual(['Unable to find guide PDF at /repo/guide.pdf']);
    expect(harness.calls).toEqual([]);
  });

  it('uses Swift on macOS and propagates Swift exit codes', () => {
    const success = createHarness({
      platform: 'darwin',
      commandStatus: { swift: 0 },
      spawnStatus: { swift: 0 },
    });
    expect(runExtractKayKitGuide(['--pdf', args.pdfPath], { repoRoot: '/repo', dependencies: success.dependencies })).toBe(0);
    expect(success.calls).toContainEqual({
      kind: 'spawn',
      command: 'swift',
      args: [
        '/repo/scripts/extract-kaykit-guide.swift',
        '--pdf',
        '/repo/guide.pdf',
        '--pages',
        resolve('/repo/docs/assets/kaykit-guide/pages'),
        '--montage',
        resolve('/repo/docs/assets/kaykit-guide/montage.png'),
      ],
    });

    const failure = createHarness({
      platform: 'darwin',
      commandStatus: { swift: 0 },
      spawnStatus: { swift: 7 },
    });
    expect(runExtractKayKitGuide(['--pdf', args.pdfPath], { repoRoot: '/repo', dependencies: failure.dependencies })).toBe(7);
    expect(failure.errors).toEqual([]);
  });

  it('uses the portable renderer, sorts rendered pages, and cleans temporary files', () => {
    const harness = createHarness({
      commandStatus: { pdftoppm: 0, magick: 0 },
      renderedFiles: ['page-10.png', 'ignore.txt', 'page-2.png'],
    });
    const result = extractKayKitGuide(args, { repoRoot: '/repo', dependencies: harness.dependencies });

    expect(result).toEqual({ renderer: 'portable', pageCount: 2 });
    expect(harness.logs).toEqual(['Extracted 2 guide pages and montage.']);
    expect(harness.calls.filter(isCommandCall).map((call) => [call.command, call.args])).toEqual([
      ['sh', ['-c', 'command -v "$1"', '--', 'pdftoppm']],
      ['sh', ['-c', 'command -v "$1"', '--', 'magick']],
      ['pdftoppm', ['-png', '-r', '144', args.pdfPath, '/tmp/guide/page']],
      ['magick', ['/tmp/guide/page-2.png', '-resize', '1920x1080!', `${args.pagesDirectory}/page-01.png`]],
      ['magick', ['/tmp/guide/page-10.png', '-resize', '1920x1080!', `${args.pagesDirectory}/page-02.png`]],
      ['magick', [
        'montage',
        `${args.pagesDirectory}/page-01.png`,
        `${args.pagesDirectory}/page-02.png`,
        '-thumbnail',
        '480x270!',
        '-tile',
        '4x5',
        '-geometry',
        '480x270+8+8',
        '-background',
        '#212121',
        args.montagePath,
      ]],
    ]);
    expect(harness.calls).toContainEqual({ kind: 'rm', path: '/tmp/guide' });
  });

  it('reports missing renderers and portable rendering failures', () => {
    const noRenderer = createHarness();
    expect(runExtractKayKitGuide(['--pdf', args.pdfPath], { repoRoot: '/repo', dependencies: noRenderer.dependencies })).toBe(1);
    expect(noRenderer.errors[0]).toContain('No guide PDF renderer is available');

    const noPages = createHarness({ commandStatus: { pdftoppm: 0, magick: 0 }, renderedFiles: [] });
    expect(runExtractKayKitGuide(['--pdf', args.pdfPath], { repoRoot: '/repo', dependencies: noPages.dependencies })).toBe(1);
    expect(noPages.errors).toEqual(['pdftoppm did not render any guide pages']);
    expect(noPages.calls).toContainEqual({ kind: 'rm', path: '/tmp/guide' });

    const badMagick = createHarness({
      commandStatus: { pdftoppm: 0, magick: 0 },
      renderedFiles: ['page-1.png'],
      spawnStatus: { magick: 2 },
    });
    expect(runExtractKayKitGuide(['--pdf', args.pdfPath], { repoRoot: '/repo', dependencies: badMagick.dependencies })).toBe(1);
    expect(badMagick.errors).toEqual(['magick failed while extracting KayKit guide imagery']);
    expect(badMagick.calls).toContainEqual({ kind: 'rm', path: '/tmp/guide' });
  });
});

function createHarness(options: {
  commandStatus?: Record<string, number>;
  existingPdf?: boolean;
  platform?: NodeJS.Platform;
  renderedFiles?: string[];
  spawnStatus?: Record<string, number | null>;
} = {}) {
  const calls: unknown[] = [];
  const errors: string[] = [];
  const logs: string[] = [];
  const commandStatus = options.commandStatus ?? {};
  const dependencies: ExtractKayKitGuideDependencies = {
    error: (message) => errors.push(message),
    existsSyncImpl: (path) => options.existingPdf !== false && String(path) === args.pdfPath,
    log: (message) => logs.push(message),
    mkdirSyncImpl: (path) => { calls.push({ kind: 'mkdir', path: String(path) }); },
    mkdtempSyncImpl: (prefix) => { calls.push({ kind: 'mkdtemp', prefix }); return '/tmp/guide'; },
    platform: options.platform ?? 'linux',
    readdirSyncImpl: () => options.renderedFiles ?? ['page-1.png'],
    rmSyncImpl: (path) => { calls.push({ kind: 'rm', path: String(path) }); },
    spawnSyncImpl: (command, commandArgs) => {
      const args = [...(commandArgs ?? [])].map(String);
      calls.push({ kind: 'spawn', command: String(command), args });
      const status = command === 'sh'
        ? commandStatus[String(args.at(-1))] ?? 1
        : options.spawnStatus?.[String(command)] ?? 0;
      return spawnResult(status);
    },
    tmpdirImpl: () => '/tmp',
  };
  return { calls, dependencies, errors, logs };
}

function isCommandCall(call: unknown): call is { args: string[]; command: string; kind: 'spawn' } {
  return typeof call === 'object' && call !== null && 'command' in call;
}

function spawnResult(status: number | null): SpawnSyncReturns<Buffer> {
  return { status, signal: null, output: [], pid: 1, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
}
