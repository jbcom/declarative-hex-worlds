import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS } from '../src/interop';
import {
  analyzeScreenshot,
  formatScreenshotStats,
  type ScreenshotStats,
  validateScreenshot,
} from '../tests/scripts/screenshot-quality';

type ReadBinaryFile = (path: string) => Buffer;

export interface ShowcasePromotionTarget {
  readonly path: string;
  readonly source: string;
  readonly target: string;
}

export interface PromoteShowcasesDependencies {
  readonly analyzeScreenshotImpl?: (path: string) => ScreenshotStats;
  readonly copyFileSyncImpl?: typeof copyFileSync;
  readonly error?: (message: string) => void;
  readonly existsSyncImpl?: typeof existsSync;
  readonly formatScreenshotStatsImpl?: typeof formatScreenshotStats;
  readonly log?: (message: string) => void;
  readonly mkdirSyncImpl?: typeof mkdirSync;
  readonly readFileSyncImpl?: ReadBinaryFile;
  readonly validateScreenshotImpl?: typeof validateScreenshot;
}

interface ResolvedPromoteShowcasesDependencies {
  readonly analyzeScreenshot: (path: string) => ScreenshotStats;
  readonly copyFileSync: typeof copyFileSync;
  readonly error: (message: string) => void;
  readonly existsSync: typeof existsSync;
  readonly formatScreenshotStats: typeof formatScreenshotStats;
  readonly log: (message: string) => void;
  readonly mkdirSync: typeof mkdirSync;
  readonly readFileSync: ReadBinaryFile;
  readonly validateScreenshot: typeof validateScreenshot;
}

export interface PromoteShowcasesOptions {
  readonly checkOnly?: boolean;
  readonly dependencies?: PromoteShowcasesDependencies;
  readonly targets?: readonly ShowcasePromotionTarget[];
  readonly workspaceRoot?: string;
}

export interface PromoteShowcasesResult {
  readonly checkOnly: boolean;
  readonly curatedShowcaseFileCount: number;
  readonly directoryCount: number;
  readonly failures: readonly string[];
}

export const PROMOTE_SHOWCASES_USAGE = `Usage: pnpm showcases:promote [--check]

Copies the curated README/docs showcase screenshots from the ignored browser
screenshot output into both committed showcase directories.

Run pnpm test:visual first so the source screenshots exist.`;

export function defaultWorkspaceRoot(): string {
  return resolve(import.meta.dirname, '..');
}

export function buildShowcaseTargets(workspaceRoot = defaultWorkspaceRoot()): ShowcasePromotionTarget[] {
  const screenshotDir = join(workspaceRoot, 'tests/browser/__screenshots__');
  return GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS.map((path) => ({
    path,
    source: join(screenshotDir, basename(path)),
    target: join(workspaceRoot, path),
  }));
}

export function parsePromoteShowcasesArgs(argv: readonly string[]): {
  readonly checkOnly: boolean;
  readonly help: boolean;
} {
  const args = new Set(argv);
  return {
    checkOnly: args.has('--check'),
    help: args.has('--help') || args.has('-h'),
  };
}

export function promoteShowcases(options: PromoteShowcasesOptions = {}): PromoteShowcasesResult {
  const workspaceRoot = options.workspaceRoot ?? defaultWorkspaceRoot();
  const targets = options.targets ?? buildShowcaseTargets(workspaceRoot);
  const dependencies = resolvePromoteShowcasesDependencies(options.dependencies);
  const showcaseDirs = [...new Set(targets.map((showcase) => dirname(showcase.target)))];
  const curatedShowcaseFileCount = new Set(targets.map((showcase) => basename(showcase.path))).size;
  const checkOnly = options.checkOnly === true;
  const failures: string[] = [];
  const qualityPaths = new Set<string>();

  for (const directory of showcaseDirs) {
    dependencies.mkdirSync(directory, { recursive: true });
  }

  for (const showcase of targets) {
    const { source, target } = showcase;
    if (!dependencies.existsSync(source)) {
      failures.push(`missing source screenshot ${relativeToWorkspace(source, workspaceRoot)}`);
      continue;
    }
    qualityPaths.add(source);

    if (checkOnly) {
      if (!dependencies.existsSync(target)) {
        failures.push(`missing showcase ${relativeToWorkspace(target, workspaceRoot)}`);
      } else if (sha256(source, dependencies.readFileSync) !== sha256(target, dependencies.readFileSync)) {
        failures.push(
          `showcase ${relativeToWorkspace(target, workspaceRoot)} does not match ${relativeToWorkspace(source, workspaceRoot)}`
        );
      } else {
        qualityPaths.add(target);
      }
      continue;
    }

    dependencies.copyFileSync(source, target);
    qualityPaths.add(target);
    dependencies.log(`promoted ${basename(source)} -> ${relativeToWorkspace(target, workspaceRoot)}`);
  }

  for (const failure of validateShowcaseQuality(
    [...qualityPaths].sort(),
    workspaceRoot,
    dependencies
  )) {
    failures.push(failure);
  }

  return { checkOnly, curatedShowcaseFileCount, directoryCount: showcaseDirs.length, failures };
}

export function runPromoteShowcases(
  argv = process.argv.slice(2),
  options: Omit<PromoteShowcasesOptions, 'checkOnly'> = {}
): number {
  const parsed = parsePromoteShowcasesArgs(argv);
  const dependencies = resolvePromoteShowcasesDependencies(options.dependencies);
  if (parsed.help) {
    dependencies.log(PROMOTE_SHOWCASES_USAGE);
    return 0;
  }

  const result = promoteShowcases({
    ...options,
    checkOnly: parsed.checkOnly,
  });

  if (result.failures.length > 0) {
    for (const failure of result.failures) {
      dependencies.error(`showcase promotion: ${failure}`);
    }
    return 1;
  }

  dependencies.log(
    result.checkOnly
      ? `showcase promotion check passed for ${result.curatedShowcaseFileCount} curated screenshot(s)`
      : `promoted ${result.curatedShowcaseFileCount} curated screenshot(s) to ${result.directoryCount} showcase destination(s)`
  );
  return 0;
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

function resolvePromoteShowcasesDependencies(
  dependencies: PromoteShowcasesDependencies = {}
): ResolvedPromoteShowcasesDependencies {
  return {
    analyzeScreenshot: dependencies.analyzeScreenshotImpl ?? analyzeScreenshot,
    copyFileSync: dependencies.copyFileSyncImpl ?? copyFileSync,
    error: dependencies.error ?? console.error,
    existsSync: dependencies.existsSyncImpl ?? existsSync,
    formatScreenshotStats: dependencies.formatScreenshotStatsImpl ?? formatScreenshotStats,
    log: dependencies.log ?? console.log,
    mkdirSync: dependencies.mkdirSyncImpl ?? mkdirSync,
    readFileSync: dependencies.readFileSyncImpl ?? readFileSync,
    validateScreenshot: dependencies.validateScreenshotImpl ?? validateScreenshot,
  };
}

function sha256(path: string, readFile: ReadBinaryFile): string {
  return createHash('sha256').update(readFile(path)).digest('hex');
}

function relativeToWorkspace(path: string, workspaceRoot: string): string {
  return path.replace(`${workspaceRoot}/`, '');
}

function validateShowcaseQuality(
  paths: readonly string[],
  workspaceRoot: string,
  dependencies: ResolvedPromoteShowcasesDependencies
): string[] {
  const qualityFailures: string[] = [];
  for (const path of paths) {
    try {
      const stats = dependencies.analyzeScreenshot(path);
      dependencies.log(
        dependencies.formatScreenshotStats({ ...stats, path: relativeToWorkspace(path, workspaceRoot) })
      );
      qualityFailures.push(
        ...dependencies.validateScreenshot(stats).map((failure) => failure.replace(`${workspaceRoot}/`, ''))
      );
    } catch (error) {
      qualityFailures.push(
        `showcase quality check failed for ${relativeToWorkspace(path, workspaceRoot)}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return qualityFailures;
}

/* v8 ignore next 3 -- thin executable entrypoint; predicate and promotion helpers are unit-tested. */
if (isDirectRun()) {
  process.exit(runPromoteShowcases());
}
