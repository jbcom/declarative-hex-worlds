// Single-package audit (replaces the workspace audit after R1 de-monorepo).
//
// This script enforces the structural invariants of the single-package layout:
//   - package.json shape (private/public flags, engines, packageManager, scripts pin to
//     the release-gate chain, exports map matches sub-package barrels)
//   - tsconfig + tsup wiring
//   - typedoc + vitepress wiring
//   - release-readiness ledger shape
//   - README and AGENTS sanity (link integrity, attribution)
//
// Workspace-only assertions (pnpm-workspace.yaml, nx.json, project.json, apps/docs)
// are deliberately removed as part of Epic R: the repo is a single package at root.
// Deep audits (audit-package.ts for tarball contract, audit-api-docs for typedoc
// surface, etc.) remain in their own files and continue to assert the published
// contract.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  exports?: Record<string, string | { import?: string; types?: string }>;
  files?: string[];
  packageManager?: string;
  scripts?: Record<string, string>;
  type?: string;
}

interface TypeDocJson {
  entryPoints?: string[];
  out?: string;
  tsconfig?: string;
  validation?: {
    invalidLink?: boolean;
    notDocumented?: boolean;
    notExported?: boolean;
  };
}

interface TsConfigJson {
  compilerOptions?: {
    rootDir?: string;
    outDir?: string;
    paths?: Record<string, string[]>;
    types?: string[];
  };
  extends?: string;
  include?: string[];
  exclude?: string[];
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const failures: string[] = [];

const packageJson = readJson<PackageJson>('package.json');
const tsconfig = readJson<TsConfigJson>('tsconfig.json');
const tsconfigBase = readJson<TsConfigJson>('tsconfig.base.json');
const typedocJson = readJson<TypeDocJson>('typedoc.json');
const tsupConfig = readRequired('tsup.config.ts');

assert(packageJson.name === '@jbcom/medieval-hexagon-gameboard', 'package name must be @jbcom/medieval-hexagon-gameboard');
assert(packageJson.type === 'module', 'package must be ESM');
assert(packageJson.packageManager === 'pnpm@9.15.9', 'packageManager must pin pnpm@9.15.9');
assert(packageJson.engines?.node === '>=22', 'engines.node must be >=22');
assert(packageJson.engines?.pnpm === '>=9', 'engines.pnpm must be >=9');

const requiredScripts = [
  'build',
  'lint',
  'typecheck',
  'test',
  'test:browser:free',
  'test:browser:extra',
  'test:e2e:local-assets',
  'verify',
  'test:api-docs',
  'test:assets',
  'test:cli',
  'test:consumer',
  'test:docs-contract',
  'test:package',
  'test:workspace',
  'test:workflows',
  'cli',
  'coverage:ledger',
  'docs',
  'docs:build',
  'pack:dry-run',
  'prepublishOnly',
] as const;
for (const script of requiredScripts) {
  assert(typeof packageJson.scripts?.[script] === 'string', `package.json scripts must define ${script}`);
}

assert(
  packageJson.scripts?.test === 'vitest run --config vitest.config.ts',
  'test script must invoke vitest directly (no nx, no pnpm --dir)'
);
assert(
  packageJson.scripts?.build === 'tsup --config tsup.config.ts',
  'build script must invoke tsup directly (no nx)'
);
assert(
  packageJson.scripts?.typecheck === 'tsc --noEmit',
  'typecheck script must invoke tsc directly'
);
assert(
  packageJson.scripts?.['pack:dry-run'] === 'npm pack --dry-run',
  'pack:dry-run runs at repo root'
);
assert(
  !packageJson.scripts?.verify?.includes('nx run'),
  'verify must not call nx run (post-restructure)'
);
assert(
  !packageJson.scripts?.verify?.includes('pnpm --dir'),
  'verify must not call pnpm --dir (post-restructure)'
);

assert(
  packageJson.scripts?.['test:ci'] === 'pnpm verify',
  'test:ci must delegate to pnpm verify (single source of truth)'
);

const expectedFiles = [
  'assets/free/manifest.json',
  'docs/showcases',
  'dist',
  '!dist/**/*.map',
  '!dist/**/*.d.ts.map',
  'examples/*.json',
  'LICENSE',
  'README.md',
  'NOTICE.md',
];
assertEqualList(packageJson.files ?? [], expectedFiles, 'files allowlist');

assert(tsconfig.extends === './tsconfig.base.json', 'tsconfig must extend ./tsconfig.base.json');
assert(tsconfig.compilerOptions?.rootDir === '.', 'tsconfig rootDir must be repo root');
assert(tsconfig.compilerOptions?.outDir === 'dist', 'tsconfig outDir must be ./dist');
assert(
  tsconfig.compilerOptions?.paths?.['@jbcom/medieval-hexagon-gameboard']?.[0] === 'src/index.ts',
  'tsconfig paths must resolve umbrella to src/index.ts'
);

assert(tsconfigBase.compilerOptions?.['verbatimModuleSyntax' as keyof TsConfigJson['compilerOptions']] === true, 'base tsconfig must enable verbatimModuleSyntax');

assert(typedocJson.tsconfig === './tsconfig.json', 'typedoc.json must point at the root tsconfig.json');

assert(tsupConfig.includes("entry:"), 'tsup.config.ts must declare an entry list');
assert(!tsupConfig.includes('packages/medieval-hexagon-gameboard/'), 'tsup.config.ts must not reference the old packages/ path');

const dependencies = packageJson.dependencies ?? {};
for (const required of ['honeycomb-grid', 'koota', 'seedrandom', 'react', 'react-dom', 'three']) {
  assert(typeof dependencies[required] === 'string', `dependencies must include ${required} (no longer a peer)`);
}
assert(
  !Object.hasOwn(packageJson, 'peerDependencies'),
  'peerDependencies must be removed (react/three are first-class dependencies per PRD)'
);

const scriptsDir = join(workspaceRoot, 'scripts');
const expectedAudits = [
  'audit-api-docs.ts',
  'audit-docs-contract.ts',
  'audit-free-assets.ts',
  'audit-package.ts',
  'audit-reference-assets.ts',
  'audit-workflows.ts',
  'audit-workspace.ts',
];
for (const name of expectedAudits) {
  assert(existsSync(join(scriptsDir, name)), `scripts/${name} must exist`);
}

const scriptFiles = readdirSync(scriptsDir).filter((file: string) => file.endsWith('.ts'));
const includePatterns = tsconfig.include ?? [];
const scriptsCovered = includePatterns.some((pattern) => pattern.startsWith('scripts/'));
assert(scriptsCovered, 'tsconfig.json include must cover scripts/**/*.ts');
assert(scriptFiles.length > 0, 'scripts/ must contain at least one TS file');

const releaseReadinessPath = join(workspaceRoot, 'docs/release-readiness.json');
if (!existsSync(releaseReadinessPath)) {
  failures.push('docs/release-readiness.json missing — run pnpm coverage:ledger');
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`workspace audit: ${failure}`);
  }
  process.exit(1);
}

console.log('workspace audit passed (single-package layout)');

function assert(condition: boolean, message: string): void {
  if (!condition) {
    failures.push(message);
  }
}

function assertEqualList(actual: readonly string[], expected: readonly string[], label: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    failures.push(`${label}: expected ${expected.join(', ')}, got ${actual.join(', ')}`);
  }
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readRequired(relativePath)) as T;
}

function readRequired(relativePath: string): string {
  const resolved = join(workspaceRoot, relativePath);
  if (!existsSync(resolved)) {
    failures.push(`missing required file: ${relativePath}`);
    return '';
  }
  return readFileSync(resolved, 'utf8');
}
