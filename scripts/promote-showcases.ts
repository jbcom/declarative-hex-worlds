import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const screenshotDir = join(workspaceRoot, 'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__');
const showcaseDirs = [
  join(workspaceRoot, 'docs/assets/showcases'),
  join(workspaceRoot, 'packages/medieval-hexagon-gameboard/docs/showcases'),
];

const curatedShowcaseFiles = [
  'extra-blueprint-biome-transition-showcase.png',
  'extra-harbor-gameboard.png',
  'free-blueprint-builder-showcase.png',
  'free-guide-coasts-all-labels-rotations-water-waterless.png',
  'free-guide-rivers-all-labels-rotations-water-waterless.png',
  'free-guide-roads-all-labels-rotations.png',
  'free-guide-scenarios-by-extracted-page.png',
  'simple-rpg-fixed-completed.png',
  'simple-rpg-local-third-party-assets.png',
  'simple-rpg-seeded-completed.png',
] as const;

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

for (const directory of showcaseDirs) {
  mkdirSync(directory, { recursive: true });
}

for (const file of curatedShowcaseFiles) {
  const source = join(screenshotDir, file);
  if (!existsSync(source)) {
    failures.push(`missing source screenshot ${relativeToWorkspace(source)}`);
    continue;
  }

  for (const directory of showcaseDirs) {
    const target = join(directory, file);
    if (checkOnly) {
      if (!existsSync(target)) {
        failures.push(`missing showcase ${relativeToWorkspace(target)}`);
      } else if (sha256(source) !== sha256(target)) {
        failures.push(`showcase ${relativeToWorkspace(target)} does not match ${relativeToWorkspace(source)}`);
      }
      continue;
    }

    copyFileSync(source, target);
    console.log(`promoted ${basename(source)} -> ${relativeToWorkspace(target)}`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`showcase promotion: ${failure}`);
  }
  process.exit(1);
}

console.log(
  checkOnly
    ? `showcase promotion check passed for ${curatedShowcaseFiles.length} curated screenshot(s)`
    : `promoted ${curatedShowcaseFiles.length} curated screenshot(s) to ${showcaseDirs.length} showcase destination(s)`
);

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function relativeToWorkspace(path: string): string {
  return path.replace(`${workspaceRoot}/`, '');
}
