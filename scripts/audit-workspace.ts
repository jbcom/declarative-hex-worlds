import { createHash } from 'node:crypto';
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
  tsconfig?: string;
  validation?: {
    invalidLink?: boolean;
    notDocumented?: boolean;
    notExported?: boolean;
  };
}

interface TsConfigJson {
  compilerOptions?: {
    noEmit?: boolean;
    types?: string[];
  };
  extends?: string;
  include?: string[];
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const failures: string[] = [];

const workspacePackageJson = readJson<PackageJson>('package.json');
const packageJson = readJson<PackageJson>('packages/medieval-hexagon-gameboard/package.json');
const docsPackageJson = readJson<PackageJson>('apps/docs/package.json');
const pnpmWorkspace = readJson<PnpmWorkspace>('pnpm-workspace.yaml');
const nxJson = readJson<NxJson>('nx.json');
const projectJson = readJson<ProjectJson>('packages/medieval-hexagon-gameboard/project.json');
const scriptsTsconfig = readJson<TsConfigJson>('tsconfig.scripts.json');
const typedocJson = readJson<TypeDocJson>('typedoc.json');
const tsupConfig = readRequired('packages/medieval-hexagon-gameboard/tsup.config.ts');
const agentsGuide = readRequired('AGENTS.md');
const packageReadme = readRequired('packages/medieval-hexagon-gameboard/README.md');
const docsIndex = readRequired('docs/index.md');
const docsVitePressConfig = readRequired('docs/.vitepress/config.ts');
const publicApiGuide = readRequired('docs/guides/public-api.md');
const coverageSource = readRequired('packages/medieval-hexagon-gameboard/src/coverage.ts');
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
    workspacePackageJson.scripts?.['typecheck:workspace'] === 'tsc -p tsconfig.scripts.json',
    'typecheck:workspace must use tsconfig.scripts.json'
  );
  assert(scriptsTsconfig.extends === './tsconfig.base.json', 'script tsconfig must extend tsconfig.base.json');
  assert(scriptsTsconfig.compilerOptions?.noEmit === true, 'script tsconfig must not emit files');
  assertArrayIncludes(scriptsTsconfig.compilerOptions?.types, 'node', 'script tsconfig must include node types');
  assertEqualList(scriptsTsconfig.include ?? [], ['scripts/*.ts'], 'script tsconfig include');
  for (const scriptFile of readdirSync(join(workspaceRoot, 'scripts')).filter((file) => file.endsWith('.ts'))) {
    assert(scriptTsconfigCovers(scriptFile), `tsconfig.scripts.json must cover scripts/${scriptFile}`);
  }
  assert(
    workspacePackageJson.scripts?.['assets:guide'] === 'tsx scripts/extract-kaykit-guide.ts',
    'assets:guide must use the TypeScript guide extraction entrypoint'
  );
  assert(
    workspacePackageJson.scripts?.['build:package'] === 'nx run @jbcom/medieval-hexagon-gameboard:build',
    'build:package must build only the package project for CLI-backed generated artifacts'
  );
  assert(workspacePackageJson.scripts?.['test:api-docs'] === 'tsx scripts/audit-api-docs.ts', 'missing test:api-docs audit script');
  assert(
    workspacePackageJson.scripts?.['test:reference-assets'] === 'tsx scripts/audit-reference-assets.ts',
    'missing test:reference-assets audit script'
  );
  assert(
    workspacePackageJson.scripts?.cli === 'node packages/medieval-hexagon-gameboard/dist/cli.js',
    'workspace cli shortcut must invoke the built package CLI'
  );
  assert(
    workspacePackageJson.scripts?.['coverage:ledger'] ===
      'pnpm build:package && node packages/medieval-hexagon-gameboard/dist/cli.js coverage --checksPassed --generatedAt 2026-05-24T00:00:00.000Z --outJson docs/release-readiness.json --outMarkdown docs/guides/release-readiness.md',
    'workspace coverage:ledger shortcut must regenerate release-readiness docs through the built CLI'
  );
  assert(
    workspacePackageJson.scripts?.['test:ci']?.includes('pnpm test:docs-contract && pnpm test:api-docs'),
    'test:ci must run api docs audit after docs contract audit'
  );
  assert(
    workspacePackageJson.scripts?.['test:ci']?.includes('pnpm test:workspace && pnpm test:workflows'),
    'test:ci must run workspace audit before workflow audit'
  );
}

function scriptTsconfigCovers(scriptFile: string): boolean {
  return (scriptsTsconfig.include ?? []).some((pattern) => pattern === 'scripts/*.ts' && scriptFile.endsWith('.ts'));
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
  requireShowcaseCopiesMatch();
  requirePublicApiSubpathGuide();
  requirePackageReadmePublicImports();
  requireAgentsPublicApiSurfaces();
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

function requirePublicApiSubpathGuide(): void {
  requireDocumentedPublicImports(
    extractMarkdownSection(publicApiGuide, '## Subpaths', 'docs/guides/public-api.md'),
    'docs/guides/public-api.md Subpaths table'
  );
}

function requirePackageReadmePublicImports(): void {
  requireDocumentedPublicImports(
    extractMarkdownSection(packageReadme, '## Public Imports', 'package README'),
    'package README Public Imports table'
  );
}

function requireDocumentedPublicImports(section: string, label: string): void {
  const expected = new Set(publicImportsFromExports());
  const actual = new Set(
    [...section.matchAll(/`(@jbcom\/medieval-hexagon-gameboard(?:\/[^`]+)?)`/g)]
      .map((match) => match[1])
      .filter((value): value is string => Boolean(value))
  );

  for (const documentedImport of expected) {
    assert(actual.has(documentedImport), `${label} must document ${documentedImport}`);
  }

  for (const documentedImport of actual) {
    assert(expected.has(documentedImport), `${label} documents stale import ${documentedImport}`);
  }
}

function requireAgentsPublicApiSurfaces(): void {
  const section = extractMarkdownSection(agentsGuide, '## Public API Surfaces', 'AGENTS.md');
  const expected = new Set(Object.keys(packageJson.exports ?? {}));
  const actual = [...section.matchAll(/`(\.|\.[/][^`]+)`/g)]
    .map((match) => match[1])
    .filter((value): value is string => Boolean(value));
  const actualSet = new Set(actual);

  for (const subpath of expected) {
    assert(actualSet.has(subpath), `AGENTS.md Public API Surfaces must document export ${subpath}`);
  }

  for (const subpath of actualSet) {
    assert(expected.has(subpath), `AGENTS.md Public API Surfaces documents stale export ${subpath}`);
  }

  const seen = new Set<string>();
  for (const subpath of actual) {
    if (seen.has(subpath)) {
      failures.push(`AGENTS.md Public API Surfaces repeats export ${subpath}`);
    }
    seen.add(subpath);
  }
}

function requireShowcaseCopiesMatch(): void {
  const docsShowcaseDir = join(workspaceRoot, 'docs/assets/showcases');
  const packageShowcaseDir = join(workspaceRoot, 'packages/medieval-hexagon-gameboard/docs/showcases');
  assert(existsSync(docsShowcaseDir), 'missing docs/assets/showcases');
  assert(existsSync(packageShowcaseDir), 'missing packages/medieval-hexagon-gameboard/docs/showcases');
  if (!existsSync(docsShowcaseDir) || !existsSync(packageShowcaseDir)) {
    return;
  }

  const docsShowcases = readdirSync(docsShowcaseDir)
    .filter((entry) => entry.endsWith('.png'))
    .sort();
  const packageShowcases = readdirSync(packageShowcaseDir)
    .filter((entry) => entry.endsWith('.png'))
    .sort();
  assertEqualList(packageShowcases, docsShowcases, 'published README showcase files');
  assertEqualList(
    curatedShowcaseArtifactsFromCoverage(),
    [
      ...docsShowcases.map((filename) => `docs/assets/showcases/${filename}`),
      ...packageShowcases.map((filename) => `packages/medieval-hexagon-gameboard/docs/showcases/${filename}`),
    ].sort(),
    'coverage curated showcase artifacts'
  );

  for (const filename of docsShowcases) {
    const docsHash = sha256(join(docsShowcaseDir, filename));
    const packageHash = sha256(join(packageShowcaseDir, filename));
    assert(
      packageHash === docsHash,
      `published README showcase ${filename} must match docs/assets/showcases/${filename}`
    );
  }
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function curatedShowcaseArtifactsFromCoverage(): string[] {
  const block = /export const GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS = \[([\s\S]*?)\] as const;/m.exec(coverageSource)?.[1];
  if (!block) {
    failures.push('coverage source is missing GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS');
    return [];
  }
  return [...block.matchAll(/'([^']+)'/g)]
    .map((match) => match[1])
    .filter((path): path is string => Boolean(path))
    .sort();
}

function requireTypeDocConfiguration(): void {
  assert(
    typedocJson.tsconfig === 'packages/medieval-hexagon-gameboard/tsconfig.json',
    'typedoc must use the package tsconfig so public subpath examples resolve to source before dist exists'
  );
  assertEqualList(
    typedocJson.entryPoints ?? [],
    expectedTypeDocEntryPoints(),
    'typedoc entry points'
  );
  assert(typedocJson.validation?.notExported === true, 'typedoc must validate notExported links');
  assert(typedocJson.validation?.invalidLink === true, 'typedoc must validate invalid links');
  assert(typedocJson.validation?.notDocumented === false, 'typedoc config should leave notDocumented to test:api-docs');
}

function expectedTypeDocEntryPoints(): string[] {
  return Object.values(packageJson.exports ?? {})
    .filter((target): target is { import: string; types?: string } => typeof target !== 'string' && Boolean(target.import))
    .map((target) => {
      const entryName = importTargetToEntryName(target.import);
      return `packages/medieval-hexagon-gameboard/${expectedSourceForEntry(entryName)}`;
    });
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

function publicImportsFromExports(): string[] {
  const packageName = '@jbcom/medieval-hexagon-gameboard';
  return Object.keys(packageJson.exports ?? {}).map((subpath) =>
    subpath === '.' ? packageName : `${packageName}/${subpath.slice(2)}`
  );
}

function extractMarkdownSection(source: string, heading: string, label: string): string {
  const start = source.indexOf(`${heading}\n`);
  if (start === -1) {
    failures.push(`${label} is missing ${heading}`);
    return '';
  }

  const nextHeading = source.indexOf('\n## ', start + heading.length);
  return nextHeading === -1 ? source.slice(start) : source.slice(start, nextHeading);
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
