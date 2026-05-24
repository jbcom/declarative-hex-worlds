import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS } from '../packages/medieval-hexagon-gameboard/src/coverage';
import {
  analyzeScreenshot,
  formatScreenshotStats,
  validateScreenshot,
} from '../packages/medieval-hexagon-gameboard/tests/scripts/screenshot-quality';

const workspaceRoot = resolve(import.meta.dirname, '..');
const screenshotDir = join(workspaceRoot, 'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__');
const showcaseTargets = GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS.map((path) => ({
  path,
  source: join(screenshotDir, basename(path)),
  target: join(workspaceRoot, path),
}));
const showcaseDirs = [...new Set(showcaseTargets.map((showcase) => dirname(showcase.target)))];
const curatedShowcaseFileCount = new Set(showcaseTargets.map((showcase) => basename(showcase.path))).size;

const args = new Set(process.argv.slice(2));

if (args.has('--help') || args.has('-h')) {
  console.log(`Usage: pnpm showcases:promote [--check]

Copies the curated README/docs showcase screenshots from the ignored browser
screenshot output into both committed showcase directories.

Run pnpm test:visual first so the source screenshots exist.`);
  process.exit(0);
}

const checkOnly = args.has('--check');
const failures: string[] = [];
const qualityPaths = new Set<string>();

for (const directory of showcaseDirs) {
  mkdirSync(directory, { recursive: true });
}

for (const showcase of showcaseTargets) {
  const { source, target } = showcase;
  if (!existsSync(source)) {
    failures.push(`missing source screenshot ${relativeToWorkspace(source)}`);
    continue;
  }
  qualityPaths.add(source);

  if (checkOnly) {
    if (!existsSync(target)) {
      failures.push(`missing showcase ${relativeToWorkspace(target)}`);
    } else if (sha256(source) !== sha256(target)) {
      failures.push(`showcase ${relativeToWorkspace(target)} does not match ${relativeToWorkspace(source)}`);
    } else {
      qualityPaths.add(target);
    }
    continue;
  }

  copyFileSync(source, target);
  qualityPaths.add(target);
  console.log(`promoted ${basename(source)} -> ${relativeToWorkspace(target)}`);
}

for (const failure of validateShowcaseQuality([...qualityPaths].sort())) {
  failures.push(failure);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`showcase promotion: ${failure}`);
  }
  process.exit(1);
}

console.log(
  checkOnly
    ? `showcase promotion check passed for ${curatedShowcaseFileCount} curated screenshot(s)`
    : `promoted ${curatedShowcaseFileCount} curated screenshot(s) to ${showcaseDirs.length} showcase destination(s)`
);

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function relativeToWorkspace(path: string): string {
  return path.replace(`${workspaceRoot}/`, '');
}

function validateShowcaseQuality(paths: readonly string[]): string[] {
  const qualityFailures: string[] = [];
  for (const path of paths) {
    try {
      const stats = analyzeScreenshot(path);
      console.log(formatScreenshotStats({ ...stats, path: relativeToWorkspace(path) }));
      qualityFailures.push(...validateScreenshot(stats).map((failure) => failure.replace(`${workspaceRoot}/`, '')));
    } catch (error) {
      qualityFailures.push(
        `showcase quality check failed for ${relativeToWorkspace(path)}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  return qualityFailures;
}
