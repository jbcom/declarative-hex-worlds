import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

interface GuideExtractionArgs {
  pdfPath: string;
  pagesDirectory: string;
  montagePath: string;
}

const repoRoot = resolve(import.meta.dirname, '..');
const args = parseArgs(process.argv.slice(2));

if (!existsSync(args.pdfPath)) {
  fail(`Unable to find guide PDF at ${args.pdfPath}`);
}

mkdirSync(args.pagesDirectory, { recursive: true });
mkdirSync(dirname(args.montagePath), { recursive: true });

if (process.platform === 'darwin' && commandExists('swift')) {
  runSwiftExtractor(args);
} else if (commandExists('pdftoppm') && commandExists('magick')) {
  runPortableExtractor(args);
} else {
  fail(
    [
      'No guide PDF renderer is available.',
      'On macOS install Xcode Command Line Tools for swift, or install poppler and ImageMagick',
      'so pdftoppm and magick are available on PATH.',
    ].join(' ')
  );
}

function parseArgs(rawArgs: string[]): GuideExtractionArgs {
  return {
    pdfPath: resolve(
      readFlag(rawArgs, '--pdf') ??
        join(repoRoot, 'references/KayKit_Medieval_Hexagon_Pack_1.0_FREE/Medieval_Hexagon_UserGuide_v1.pdf')
    ),
    pagesDirectory: resolve(readFlag(rawArgs, '--pages') ?? join(repoRoot, 'docs/assets/kaykit-guide/pages')),
    montagePath: resolve(readFlag(rawArgs, '--montage') ?? join(repoRoot, 'docs/assets/kaykit-guide/montage.png')),
  };
}

function readFlag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    fail(`Missing value for ${name}`);
  }
  return value;
}

function runSwiftExtractor(config: GuideExtractionArgs): void {
  const swiftScript = join(repoRoot, 'scripts/extract-kaykit-guide.swift');
  const result = spawnSync(
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
    process.exit(result.status ?? 1);
  }
}

function runPortableExtractor(config: GuideExtractionArgs): void {
  const workingDirectory = mkdtempSync(join(tmpdir(), 'medieval-hexagon-guide-'));
  try {
    const prefix = join(workingDirectory, 'page');
    run('pdftoppm', ['-png', '-r', '144', config.pdfPath, prefix]);

    const rawPages = readdirSync(workingDirectory)
      .filter((file) => /^page-\d+\.png$/u.test(file))
      .sort((left, right) => pageNumber(left) - pageNumber(right))
      .map((file) => join(workingDirectory, file));

    if (rawPages.length === 0) {
      fail('pdftoppm did not render any guide pages');
    }

    const pagePaths: string[] = [];
    for (const [index, rawPage] of rawPages.entries()) {
      const pagePath = join(config.pagesDirectory, `page-${String(index + 1).padStart(2, '0')}.png`);
      run('magick', [rawPage, '-resize', '1920x1080!', pagePath]);
      pagePaths.push(pagePath);
    }

    run('magick', [
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
    ]);

    console.log(`Extracted ${pagePaths.length} guide pages and montage.`);
  } finally {
    rmSync(workingDirectory, { force: true, recursive: true });
  }
}

function run(command: string, commandArgs: string[]): void {
  const result = spawnSync(command, commandArgs, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) {
    fail(`${command} failed while extracting KayKit guide imagery`);
  }
}

function commandExists(command: string): boolean {
  // Pass `command` as a positional shell argument so its value can never
  // inject shell metacharacters into the snippet. Current call sites pass
  // literal strings (`'swift'`, `'pdftoppm'`, `'magick'`), so there's no
  // injection today, but the template form would have silently become
  // injectable the moment any user-controlled value flowed in.
  // Phase 2 security review S-M2.
  const result = spawnSync('sh', ['-c', 'command -v "$1"', '--', command], { stdio: 'ignore' });
  return result.status === 0;
}

function pageNumber(filePath: string): number {
  const match = /^page-(\d+)\.png$/u.exec(basename(filePath));
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
