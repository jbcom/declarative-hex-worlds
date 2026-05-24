import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

interface TypeDocJson {
  entryPoints?: string[];
}

interface PackageJson {
  exports?: Record<string, string | { import?: string; types?: string }>;
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const typedocJson = readJson<TypeDocJson>('typedoc.json');
const packageJson = readJson<PackageJson>('packages/medieval-hexagon-gameboard/package.json');
const outDir = mkdtempSync(join(tmpdir(), 'medieval-hexagon-typedoc-audit-'));
const typedocBin = resolve(
  workspaceRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'typedoc.cmd' : 'typedoc'
);
const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR;

assertTypeDocEntryPointsMatchPublicExports();

const missingModuleDocs = (typedocJson.entryPoints ?? []).filter((entryPoint) => {
  const source = readRequired(entryPoint);
  return !hasTopLevelModuleDoc(source);
});

if (missingModuleDocs.length > 0) {
  for (const entryPoint of missingModuleDocs) {
    console.error(`api docs audit: ${entryPoint} is missing a top-level @module JSDoc comment`);
  }
  process.exit(1);
}

const result = spawnSync(
  typedocBin,
  [
    '--options',
    'typedoc.json',
    '--validation.notDocumented',
    'true',
    '--logLevel',
    'Warn',
    '--out',
    outDir,
  ],
  {
    cwd: workspaceRoot,
    encoding: 'utf8',
    env,
  }
);
const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
rmSync(outDir, { recursive: true, force: true });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

if (result.status !== 0) {
  process.stdout.write(output);
  process.exit(result.status ?? 1);
}

const warnings = output
  .split(/\r?\n/)
  .filter((line) => line.includes('[warning]'));

if (warnings.length > 0) {
  for (const warning of warnings) {
    console.error(warning);
  }
  console.error(`api docs audit failed with ${warnings.length} TypeDoc warning(s)`);
  process.exit(1);
}

console.log('api docs audit passed with 0 TypeDoc warnings');

function assertTypeDocEntryPointsMatchPublicExports(): void {
  assertEqualList(
    typedocJson.entryPoints ?? [],
    expectedTypeDocEntryPoints(),
    'TypeDoc entry points must match public object exports'
  );
}

function expectedTypeDocEntryPoints(): string[] {
  return Object.values(packageJson.exports ?? {})
    .filter((target): target is { import: string; types?: string } => typeof target !== 'string' && Boolean(target.import))
    .map((target) => `packages/medieval-hexagon-gameboard/${sourcePathForImportTarget(target.import)}`);
}

function sourcePathForImportTarget(target: string): string {
  const entryName = importTargetToEntryName(target);
  if (entryName === 'index') {
    return 'src/index.ts';
  }
  if (entryName.startsWith('examples/')) {
    return `${entryName}.ts`;
  }
  return `src/${entryName}.ts`;
}

function importTargetToEntryName(target: string): string {
  if (!target.startsWith('./dist/') || !target.endsWith('.js')) {
    throw new Error(`unsupported public import target for TypeDoc audit: ${target}`);
  }
  return target.slice('./dist/'.length, -'.js'.length);
}

function assertEqualList(actual: readonly string[], expected: readonly string[], message: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error(`${message}: expected ${expected.join(', ')}, got ${actual.join(', ')}`);
  }
}

function hasTopLevelModuleDoc(source: string): boolean {
  const trimmed = source.trimStart();
  const match = /^\/\*\*[\s\S]*?\*\//.exec(trimmed);
  return Boolean(match?.[0].includes('@module'));
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readRequired(relativePath)) as T;
}

function readRequired(relativePath: string): string {
  return readFileSync(resolve(workspaceRoot, relativePath), 'utf8');
}
