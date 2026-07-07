import { existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export interface GuideExtractionArgs {
  pdfPath: string;
  pagesDirectory: string;
  montagePath: string;
}

type CommandResult = Pick<SpawnSyncReturns<Buffer>, 'status'>;
type SpawnCommand = (
  command: string,
  args: readonly string[],
  options: { cwd?: string; stdio: 'ignore' | 'inherit' }
) => CommandResult;

export interface ExtractKayKitGuideDependencies {
  readonly error?: (message: string) => void;
  readonly existsSyncImpl?: (path: string) => boolean;
  readonly log?: (message: string) => void;
  readonly mkdirSyncImpl?: (path: string, options: { recursive: true }) => void;
  readonly mkdtempSyncImpl?: (prefix: string) => string;
  readonly platform?: NodeJS.Platform;
  readonly readdirSyncImpl?: (path: string) => string[];
  readonly rmSyncImpl?: (path: string, options: { force: true; recursive: true }) => void;
  readonly spawnSyncImpl?: SpawnCommand;
  readonly tmpdirImpl?: typeof tmpdir;
}

interface ResolvedExtractKayKitGuideDependencies {
  readonly error: (message: string) => void;
  readonly existsSync: (path: string) => boolean;
  readonly log: (message: string) => void;
  readonly mkdirSync: (path: string, options: { recursive: true }) => void;
  readonly mkdtempSync: (prefix: string) => string;
  readonly platform: NodeJS.Platform;
  readonly readdirSync: (path: string) => string[];
  readonly rmSync: (path: string, options: { force: true; recursive: true }) => void;
  readonly spawnSync: SpawnCommand;
  readonly tmpdir: typeof tmpdir;
}

export interface ExtractKayKitGuideOptions {
  readonly dependencies?: ExtractKayKitGuideDependencies;
  readonly repoRoot?: string;
}

export interface ExtractKayKitGuideResult {
  readonly pageCount?: number;
  readonly renderer: 'swift' | 'portable';
}

class GuideExtractionExit extends Error {
  constructor(readonly code: number) {
    super(`guide extractor exited with status ${code}`);
  }
}

export function defaultRepoRoot(): string {
  return resolve(import.meta.dirname, '..');
}

export function parseGuideExtractionArgs(
  rawArgs: readonly string[],
  repoRoot = defaultRepoRoot()
): GuideExtractionArgs {
  return {
    pdfPath: resolve(
      readFlag(rawArgs, '--pdf') ??
        join(repoRoot, 'references/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Medieval_Hexagon_UserGuide_v1.pdf')
    ),
    pagesDirectory: resolve(readFlag(rawArgs, '--pages') ?? join(repoRoot, 'docs/assets/kaykit-guide/pages')),
    montagePath: resolve(readFlag(rawArgs, '--montage') ?? join(repoRoot, 'docs/assets/kaykit-guide/montage.png')),
  };
}

export function resolveExtractKayKitGuideDependencies(
  dependencies: ExtractKayKitGuideDependencies = {}
): ResolvedExtractKayKitGuideDependencies {
  return {
    error: dependencies.error ?? console.error,
    existsSync: dependencies.existsSyncImpl ?? existsSync,
    log: dependencies.log ?? console.log,
    mkdirSync: dependencies.mkdirSyncImpl ?? mkdirSync,
    mkdtempSync: dependencies.mkdtempSyncImpl ?? mkdtempSync,
    platform: dependencies.platform ?? process.platform,
    readdirSync: dependencies.readdirSyncImpl ?? readdirSync,
    rmSync: dependencies.rmSyncImpl ?? rmSync,
    spawnSync: dependencies.spawnSyncImpl ?? spawnSync,
    tmpdir: dependencies.tmpdirImpl ?? tmpdir,
  };
}

export function extractKayKitGuide(
  args: GuideExtractionArgs,
  options: ExtractKayKitGuideOptions = {}
): ExtractKayKitGuideResult {
  const repoRoot = options.repoRoot ?? defaultRepoRoot();
  const dependencies = resolveExtractKayKitGuideDependencies(options.dependencies);

  if (!dependencies.existsSync(args.pdfPath)) {
    throw new Error(`Unable to find guide PDF at ${args.pdfPath}`);
  }

  dependencies.mkdirSync(args.pagesDirectory, { recursive: true });
  dependencies.mkdirSync(dirname(args.montagePath), { recursive: true });

  if (dependencies.platform === 'darwin' && commandExists('swift', dependencies)) {
    return runSwiftExtractor(args, repoRoot, dependencies);
  }
  if (commandExists('pdftoppm', dependencies) && commandExists('magick', dependencies)) {
    return runPortableExtractor(args, repoRoot, dependencies);
  }
  throw new Error(
    [
      'No guide PDF renderer is available.',
      'On macOS install Xcode Command Line Tools for swift, or install poppler and ImageMagick',
      'so pdftoppm and magick are available on PATH.',
    ].join(' ')
  );
}

export function runExtractKayKitGuide(
  argv = process.argv.slice(2),
  options: ExtractKayKitGuideOptions = {}
): number {
  const dependencies = resolveExtractKayKitGuideDependencies(options.dependencies);
  const repoRoot = options.repoRoot ?? defaultRepoRoot();
  try {
    extractKayKitGuide(parseGuideExtractionArgs(argv, repoRoot), { ...options, repoRoot });
    return 0;
  } catch (error) {
    if (error instanceof GuideExtractionExit) {
      return error.code;
    }
    dependencies.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function readFlag(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }
  return value;
}

function runSwiftExtractor(
  config: GuideExtractionArgs,
  repoRoot: string,
  dependencies: ResolvedExtractKayKitGuideDependencies
): ExtractKayKitGuideResult {
  const swiftScript = join(repoRoot, 'scripts/extract-kaykit-guide.swift');
  const result = dependencies.spawnSync(
    'swift',
    [
      swiftScript,
      '--pdf',
      config.pdfPath,
      '--pages',
      config.pagesDirectory,
      '--montage',
      config.montagePath,
    ],
    { cwd: repoRoot, stdio: 'inherit' }
  );
  if (result.status !== 0) {
    throw new GuideExtractionExit(result.status ?? 1);
  }
  return { renderer: 'swift' };
}

function runPortableExtractor(
  config: GuideExtractionArgs,
  repoRoot: string,
  dependencies: ResolvedExtractKayKitGuideDependencies
): ExtractKayKitGuideResult {
  const workingDirectory = dependencies.mkdtempSync(
    join(dependencies.tmpdir(), 'medieval-hexagon-guide-')
  );
  try {
    const prefix = join(workingDirectory, 'page');
    run('pdftoppm', ['-png', '-r', '144', config.pdfPath, prefix], repoRoot, dependencies);

    const rawPages = dependencies.readdirSync(workingDirectory)
      .filter((file) => /^page-\d+\.png$/u.test(file))
      .sort((left, right) => pageNumber(left) - pageNumber(right))
      .map((file) => join(workingDirectory, file));

    if (rawPages.length === 0) {
      throw new Error('pdftoppm did not render any guide pages');
    }

    const pagePaths: string[] = [];
    for (const [index, rawPage] of rawPages.entries()) {
      const pagePath = join(config.pagesDirectory, `page-${String(index + 1).padStart(2, '0')}.png`);
      run('magick', [rawPage, '-resize', '1920x1080!', pagePath], repoRoot, dependencies);
      pagePaths.push(pagePath);
    }

    run(
      'magick',
      [
        'montage',
        ...pagePaths,
        '-thumbnail',
        '480x270!',
        '-tile',
        '4x5',
        '-geometry',
        '480x270+8+8',
        '-background',
        '#212121',
        config.montagePath,
      ],
      repoRoot,
      dependencies
    );

    dependencies.log(`Extracted ${pagePaths.length} guide pages and montage.`);
    return { renderer: 'portable', pageCount: pagePaths.length };
  } finally {
    dependencies.rmSync(workingDirectory, { force: true, recursive: true });
  }
}

function run(
  command: string,
  commandArgs: string[],
  repoRoot: string,
  dependencies: ResolvedExtractKayKitGuideDependencies
): void {
  const result = dependencies.spawnSync(command, commandArgs, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`${command} failed while extracting KayKit guide imagery`);
  }
}

export function commandExists(
  command: string,
  dependencies: Pick<ResolvedExtractKayKitGuideDependencies, 'spawnSync'> &
    Partial<Pick<ResolvedExtractKayKitGuideDependencies, 'platform'>> =
    resolveExtractKayKitGuideDependencies()
): boolean {
  // Pass `command` as a positional shell argument so its value can never
  // inject shell metacharacters into the snippet. Current call sites pass
  // literal strings (`'swift'`, `'pdftoppm'`, `'magick'`), so there's no
  // injection today, but the template form would have silently become
  // injectable the moment any user-controlled value flowed in.
  // Phase 2 security review S-M2.
  const result =
    (dependencies.platform ?? process.platform) === 'win32'
      ? dependencies.spawnSync('where', [command], { stdio: 'ignore' })
      : dependencies.spawnSync('sh', ['-c', 'command -v "$1"', '--', command], {
          stdio: 'ignore',
        });
  return result.status === 0;
}

function pageNumber(filePath: string): number {
  return Number(basename(filePath).slice('page-'.length, -'.png'.length));
}

export function isDirectRun(
  argvEntry = process.argv[1],
  moduleUrl = import.meta.url,
  realpath: (path: string) => string = realpathSync
): boolean {
  if (!argvEntry) {
    return false;
  }
  try {
    return (
      realpath(resolve(argvEntry)).toLowerCase() === realpath(fileURLToPath(moduleUrl)).toLowerCase()
    );
  } catch {
    return false;
  }
}

/* v8 ignore next 3 -- thin executable entrypoint; predicate and extractor helpers are unit-tested. */
if (isDirectRun()) {
  process.exit(runExtractKayKitGuide());
}
