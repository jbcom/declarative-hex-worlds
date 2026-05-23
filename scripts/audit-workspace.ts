import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface PackageJson {
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  exports?: Record<string, string | { import?: string; types?: string }>;
  packageManager?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  type?: string;
  workspaces?: unknown;
}

interface PnpmWorkspace {
  packages?: string[];
  onlyBuiltDependencies?: string[];
}

interface NxJson {
  namedInputs?: Record<string, unknown>;
  parallel?: number;
  targetDefaults?: Record<string, { cache?: boolean; dependsOn?: string[]; inputs?: string[]; outputs?: string[] }>;
}

interface ProjectJson {
  name?: string;
  projectType?: string;
  sourceRoot?: string;
  targets?: Record<string, { executor?: string; options?: { command?: string } }>;
  tags?: string[];
}

interface TypeDocJson {
  entryPoints?: string[];
  validation?: {
    invalidLink?: boolean;
    notDocumented?: boolean;
    notExported?: boolean;
  };
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const failures: string[] = [];

const workspacePackageJson = readJson<PackageJson>('package.json');
const packageJson = readJson<PackageJson>('packages/medieval-hexagon-gameboard/package.json');
const docsPackageJson = readJson<PackageJson>('apps/docs/package.json');
const pnpmWorkspace = readJson<PnpmWorkspace>('pnpm-workspace.yaml');
const nxJson = readJson<NxJson>('nx.json');
const projectJson = readJson<ProjectJson>('packages/medieval-hexagon-gameboard/project.json');
const typedocJson = readJson<TypeDocJson>('typedoc.json');
const tsupConfig = readRequired('packages/medieval-hexagon-gameboard/tsup.config.ts');
const docsIndex = readRequired('docs/index.md');
const docsVitePressConfig = readRequired('docs/.vitepress/config.ts');
const guideDocs = readGuideDocs();
const tsupEntries = readTsupEntries(tsupConfig);

requireWorkspaceScripts();
requireWorkspacePackages();
requireNxConfiguration();
requireProjectTargets();
requireDocsConfiguration();
requireTypeDocConfiguration();
requireTsupConfiguration();

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`workspace audit: ${failure}`);
  }
  process.exit(1);
}

console.log('workspace audit passed');

function requireWorkspaceScripts(): void {
  assert(workspacePackageJson.private === true, 'workspace package must remain private');
  assert(workspacePackageJson.type === 'module', 'workspace package must be ESM');
  assert(workspacePackageJson.packageManager === 'pnpm@9.15.9', 'workspace packageManager must pin pnpm@9.15.9');
  assert(workspacePackageJson.engines?.node === '>=22', 'workspace must require Node >=22');
  assert(workspacePackageJson.engines?.pnpm === '>=9 <10', 'workspace must require pnpm >=9 <10');
  assert(workspacePackageJson.scripts?.['test:workspace'] === 'tsx scripts/audit-workspace.ts', 'missing test:workspace audit script');
  assert(
    workspacePackageJson.scripts?.['typecheck:workspace']?.includes('scripts/audit-workspace.ts'),
    'typecheck:workspace must typecheck scripts/audit-workspace.ts'
  );
  assert(
    workspacePackageJson.scripts?.['typecheck:workspace']?.includes('scripts/audit-api-docs.ts'),
    'typecheck:workspace must typecheck scripts/audit-api-docs.ts'
  );
  assert(workspacePackageJson.scripts?.['test:api-docs'] === 'tsx scripts/audit-api-docs.ts', 'missing test:api-docs audit script');
  assert(
    workspacePackageJson.scripts?.['test:ci']?.includes('pnpm test:docs-contract && pnpm test:api-docs'),
    'test:ci must run api docs audit after docs contract audit'
  );
  assert(
    workspacePackageJson.scripts?.['test:ci']?.includes('pnpm test:workspace && pnpm test:workflows'),
    'test:ci must run workspace audit before workflow audit'
  );
}

function requireWorkspacePackages(): void {
  assertEqualList(pnpmWorkspace.packages ?? [], ['packages/*', 'apps/*'], 'pnpm workspace packages');
  assertEqualList(pnpmWorkspace.onlyBuiltDependencies ?? [], ['esbuild'], 'pnpm onlyBuiltDependencies');
}

function requireNxConfiguration(): void {
  assert(nxJson.parallel === 3, 'nx parallel must stay at 3');
  assertArrayIncludes(nxJson.namedInputs?.production, '!{projectRoot}/tests/**/*', 'nx production inputs must omit tests');
  assertArrayIncludes(nxJson.targetDefaults?.build?.dependsOn, '^build', 'nx build must depend on upstream builds');
  assertArrayIncludes(nxJson.targetDefaults?.build?.outputs, '{projectRoot}/dist', 'nx build outputs must include dist');
  assert(nxJson.targetDefaults?.build?.cache === true, 'nx build must be cacheable');
  assertArrayIncludes(nxJson.targetDefaults?.test?.dependsOn, 'build', 'nx test must depend on build');
  assert(nxJson.targetDefaults?.test?.cache === true, 'nx test must be cacheable');
  assert(nxJson.targetDefaults?.lint?.cache === true, 'nx lint must be cacheable');
  assert(nxJson.targetDefaults?.typecheck?.cache === true, 'nx typecheck must be cacheable');
}

function requireProjectTargets(): void {
  assert(projectJson.name === '@jbcom/medieval-hexagon-gameboard', 'package project name changed');
  assert(projectJson.projectType === 'library', 'package project must remain a library');
  assert(projectJson.sourceRoot === 'packages/medieval-hexagon-gameboard/src', 'package sourceRoot changed');
  assertArrayIncludes(projectJson.tags, 'scope:package', 'package project tags must include scope:package');
  assertArrayIncludes(projectJson.tags, 'type:library', 'package project tags must include type:library');

  const expectedTargets: Record<string, string> = {
    build: 'pnpm --dir packages/medieval-hexagon-gameboard build',
    lint: 'pnpm --dir packages/medieval-hexagon-gameboard lint',
    test: 'pnpm --dir packages/medieval-hexagon-gameboard test',
    'test:browser:extra': 'pnpm --dir packages/medieval-hexagon-gameboard test:browser:extra',
    'test:browser:free': 'pnpm --dir packages/medieval-hexagon-gameboard test:browser:free',
    'test:e2e:local-assets': 'pnpm --dir packages/medieval-hexagon-gameboard test:e2e:local-assets',
    typecheck: 'pnpm --dir packages/medieval-hexagon-gameboard typecheck',
  };

  for (const [target, command] of Object.entries(expectedTargets)) {
    const config = projectJson.targets?.[target];
    assert(config?.executor === 'nx:run-commands', `target ${target} must use nx:run-commands`);
    assert(config?.options?.command === command, `target ${target} command changed`);
  }
}

function requireDocsConfiguration(): void {
  assert(docsPackageJson.private === true, 'docs app must remain private');
  assert(docsPackageJson.type === 'module', 'docs app must be ESM');
  assert(docsPackageJson.scripts?.build === 'vitepress build ../../docs --outDir dist', 'docs build command changed');
  assert(docsPackageJson.scripts?.dev === 'vitepress dev ../../docs --port 5174', 'docs dev command changed');
  assert(docsPackageJson.scripts?.preview === 'vitepress preview dist --port 4174', 'docs preview command changed');
  assert(
    workspacePackageJson.devDependencies?.vitepress === docsPackageJson.devDependencies?.vitepress,
    'workspace and docs app must use the same vitepress version specifier'
  );
  requireDocsGuideNavigation();
}

function requireDocsGuideNavigation(): void {
  assert(guideDocs.length > 0, 'docs/guides must contain at least one guide');

  for (const guideFile of guideDocs) {
    const guideLink = `./guides/${guideFile}`;
    const vitePressLink = `/guides/${guideFile.slice(0, -'.md'.length)}`;
    assert(docsIndex.includes(`](${guideLink})`), `docs/index.md must link ${guideLink}`);
    assert(
      docsVitePressConfig.includes(`link: '${vitePressLink}'`),
      `docs/.vitepress/config.ts sidebar must link ${vitePressLink}`
    );
  }
}

function requireTypeDocConfiguration(): void {
  assertEqualList(
    typedocJson.entryPoints ?? [],
    [
      'packages/medieval-hexagon-gameboard/src/index.ts',
      'packages/medieval-hexagon-gameboard/src/ingest.ts',
      'packages/medieval-hexagon-gameboard/src/react.ts',
      'packages/medieval-hexagon-gameboard/src/three.ts',
    ],
    'typedoc entry points'
  );
  assert(typedocJson.validation?.notExported === true, 'typedoc must validate notExported links');
  assert(typedocJson.validation?.invalidLink === true, 'typedoc must validate invalid links');
  assert(typedocJson.validation?.notDocumented === false, 'typedoc config should leave notDocumented to test:api-docs');
}

function requireTsupConfiguration(): void {
  requireIncludes(tsupConfig, 'tsup config', [
    "format: ['esm']",
    'dts: true',
    'sourcemap: true',
    'clean: true',
    "target: 'es2022'",
    'splitting: true',
    'options.sourcesContent = false',
    "'@jbcom/medieval-hexagon-gameboard'",
    '/^@jbcom\\/medieval-hexagon-gameboard\\//',
    "'koota'",
    "'koota/react'",
    "'react'",
    "'three'",
  ]);

  for (const [subpath, target] of Object.entries(packageJson.exports ?? {})) {
    if (typeof target === 'string') {
      continue;
    }
    assert(target.import, `export ${subpath} is missing import target`);
    const entryName = importTargetToEntryName(target.import);
    assert(tsupEntries.has(entryName), `export ${subpath} import target ${target.import} has no tsup entry`);
    assert(
      tsupEntries.get(entryName) === expectedSourceForEntry(entryName),
      `tsup entry ${entryName} points at ${tsupEntries.get(entryName)}, expected ${expectedSourceForEntry(entryName)}`
    );
  }

  assert(tsupEntries.get('cli') === 'src/cli.ts', 'CLI bin must have a tsup cli entry');
  assert(![...tsupEntries.keys()].some((entry) => entry.startsWith('src/')), 'tsup entries must use named output keys');
}

function importTargetToEntryName(target: string): string {
  if (!target.startsWith('./dist/') || !target.endsWith('.js')) {
    failures.push(`unsupported import target ${target}`);
    return target;
  }
  return target.slice('./dist/'.length, -'.js'.length);
}

function expectedSourceForEntry(entryName: string): string {
  if (entryName === 'index') {
    return 'src/index.ts';
  }
  if (entryName.startsWith('examples/')) {
    return `${entryName}.ts`;
  }
  return `src/${entryName}.ts`;
}

function readTsupEntries(source: string): Map<string, string> {
  const entries = new Map<string, string>();
  const block = /entry:\s*{([\s\S]*?)\n\s*},\n\s*format:/m.exec(source)?.[1];
  if (!block) {
    failures.push('tsup config is missing an object entry block');
    return entries;
  }

  const linePattern = /^\s*(?:(['"])(.*?)\1|([A-Za-z0-9_$-]+)):\s*'([^']+)'/gm;
  for (const match of block.matchAll(linePattern)) {
    const key = match[2] ?? match[3];
    const path = match[4];
    if (key && path) {
      entries.set(key, path);
    }
  }
  return entries;
}

function readJson<T>(path: string): T {
  const source = readRequired(path);
  if (path.endsWith('.yaml') || path.endsWith('.yml')) {
    return parseSimpleYaml(source, path) as T;
  }
  return JSON.parse(source) as T;
}

function readRequired(path: string): string {
  const resolved = join(workspaceRoot, path);
  if (!existsSync(resolved)) {
    failures.push(`missing ${path}`);
    return '';
  }
  return readFileSync(resolved, 'utf8');
}

function readGuideDocs(): string[] {
  const guidesDir = join(workspaceRoot, 'docs/guides');
  if (!existsSync(guidesDir)) {
    failures.push('missing docs/guides');
    return [];
  }
  return readdirSync(guidesDir)
    .filter((entry) => entry.endsWith('.md'))
    .sort();
}

function parseSimpleYaml(source: string, label: string): unknown {
  if (label !== 'pnpm-workspace.yaml') {
    failures.push(`no YAML parser is available for ${label}`);
    return {};
  }

  const result: PnpmWorkspace = {};
  let currentList: keyof PnpmWorkspace | undefined;
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line) {
      continue;
    }
    const keyMatch = /^([A-Za-z]+):$/.exec(line);
    if (keyMatch) {
      currentList = keyMatch[1] as keyof PnpmWorkspace;
      result[currentList] = [];
      continue;
    }
    const itemMatch = /^ {2}- (.+)$/.exec(line);
    if (itemMatch && currentList) {
      (result[currentList] as string[]).push(itemMatch[1] ?? '');
      continue;
    }
    failures.push(`${label} has unsupported line: ${line}`);
  }
  return result;
}

function requireIncludes(source: string, label: string, snippets: readonly string[]): void {
  for (const snippet of snippets) {
    assert(source.includes(snippet), `${label} is missing ${snippet}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    failures.push(message);
  }
}

function assertArrayIncludes(source: unknown, value: string, message: string): void {
  assert(Array.isArray(source) && source.includes(value), message);
}

function assertEqualList(actual: readonly string[], expected: readonly string[], label: string): void {
  assert(
    actual.length === expected.length && actual.every((value, index) => value === expected[index]),
    `${label} expected ${expected.join(', ')}, got ${actual.join(', ')}`
  );
}
