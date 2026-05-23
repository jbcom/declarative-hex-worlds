import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

interface PackageJson {
  bin?: Record<string, string>;
  engines?: Record<string, string>;
  exports?: Record<string, string | { import?: string; types?: string }>;
  files?: string[];
  packageManager?: string;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  scripts?: Record<string, string>;
}

interface PackFile {
  path: string;
}

interface PackResult {
  files?: PackFile[];
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const workspacePackageJsonPath = join(workspaceRoot, 'package.json');
const workspacePackageJson = JSON.parse(readFileSync(workspacePackageJsonPath, 'utf8')) as PackageJson;
const packageRoot = join(workspaceRoot, 'packages/medieval-hexagon-gameboard');
const packageSrcRoot = join(packageRoot, 'src');
const packageJsonPath = join(packageRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
const forbiddenMetadataPattern = /references|\/Volumes\/home|kenney_castle|KayKit_Adventurers/;
const expectedFiles = ['assets/free', 'dist', 'examples/*.json', 'README.md', 'NOTICE.md'];
const allowedPackRoots = ['assets/free/', 'dist/', 'examples/'];
const allowedPackFiles = new Set(['package.json', 'README.md', 'NOTICE.md']);
const privateEntryModules = new Set(['cli', 'index']);
const textPackFileSuffixes = ['.d.ts', '.js', '.json', '.map', '.md'];
const forbiddenPackedContentPatterns: readonly { label: string; pattern: RegExp }[] = [
  { label: 'macOS home path', pattern: /\/Users\// },
  { label: 'network asset mount path', pattern: /\/Volumes\/home/ },
  { label: 'file URL to a local path', pattern: /file:\/\/\// },
  { label: 'local NAS server URL', pattern: /smb:\/\/192\.168\.1\.200|Yog-Sothoth/i },
];

assertEqualSet(packageJson.files ?? [], expectedFiles, 'package files whitelist changed');
assert(workspacePackageJson.packageManager === 'pnpm@9.15.9', 'workspace packageManager must pin pnpm@9.15.9');
assert(workspacePackageJson.engines?.node === '>=22', 'workspace engines.node must be >=22');
assert(workspacePackageJson.engines?.pnpm === '>=9 <10', 'workspace engines.pnpm must be >=9 <10');
assert(packageJson.engines?.node === '>=22', 'package engines.node must be >=22');
assert(!forbiddenMetadataPattern.test(JSON.stringify(packageJson.scripts ?? {})), 'package scripts contain local-only paths');
assert(packageJson.scripts?.prepublishOnly === 'pnpm -w test:ci', 'prepublishOnly must run the workspace CI gate');
assert(
  workspacePackageJson.scripts?.['test:visual'] ===
    'pnpm test:browser:free && pnpm test:browser:extra && pnpm test:e2e:local-assets',
  'workspace test:visual must serialize the local browser review suites'
);
assert(
  workspacePackageJson.scripts?.['test:assets'] === 'tsx scripts/audit-free-assets.ts',
  'workspace test:assets must run the FREE asset audit'
);
assert(
  packageJson.scripts?.['test:visual'] ===
    'pnpm run test:browser:free && pnpm run test:browser:extra && pnpm run test:e2e:local-assets',
  'package test:visual must serialize the local browser review suites'
);
assert(
  workspacePackageJson.scripts?.['test:consumer'] === 'tsx scripts/smoke-packed-consumer.ts',
  'workspace test:consumer must run the packed consumer smoke'
);
assert(
  workspacePackageJson.scripts?.['test:workspace'] === 'tsx scripts/audit-workspace.ts',
  'workspace test:workspace must run the workspace audit'
);
assert(
  workspacePackageJson.scripts?.['test:cli'] === 'tsx scripts/smoke-built-cli.ts',
  'workspace test:cli must run the built CLI smoke'
);
assert(
  workspacePackageJson.scripts?.['test:ci'] ===
    'pnpm lint && pnpm typecheck && pnpm test:docs-contract && pnpm test:api-docs && pnpm test:assets && pnpm test:workspace && pnpm test:workflows && pnpm build && pnpm test:cli && pnpm test && pnpm test:package && pnpm test:consumer && pnpm pack:dry-run',
  'workspace test:ci must run the built CLI and packed consumer smoke before pack dry-run'
);
assert(
  packageJson.exports?.['./examples/*.json'] === './examples/*.json',
  'package must expose packaged JSON examples without exposing raw example source as executable subpaths'
);
assert(
  !Object.hasOwn(packageJson.exports ?? {}, './examples/*'),
  'package must not expose the broad ./examples/* wildcard'
);
assertOptionalPeer('react');
assertOptionalPeer('@types/react');
assertOptionalPeer('three');
assertBin();
assertExports();
assertSourceModulesExported();
await assertExportImports();
assertPackFileList();

console.log('package audit passed');

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqualSet(actual: readonly string[], expected: readonly string[], message: string): void {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  assert(
    actualSorted.length === expectedSorted.length && actualSorted.every((value, index) => value === expectedSorted[index]),
    `${message}: expected ${expectedSorted.join(', ')}, got ${actualSorted.join(', ')}`
  );
}

function assertOptionalPeer(name: string): void {
  assert(packageJson.peerDependenciesMeta?.[name]?.optional === true, `${name} must be an optional peer dependency`);
}

function assertBin(): void {
  const binPath = packageJson.bin?.['medieval-hexagon-gameboard'];
  assert(binPath === './dist/cli.js', 'CLI bin must point at ./dist/cli.js');
  const resolved = join(packageRoot, binPath.replace(/^\.\//, ''));
  assert(existsSync(resolved), `CLI bin target is missing: ${binPath}`);
  const content = readFileSync(resolved, 'utf8');
  assert(content.startsWith('#!/usr/bin/env node'), 'CLI bin target must preserve the node shebang');
  assert((statSync(resolved).mode & 0o111) !== 0, 'CLI bin target must be executable');
}

function assertExports(): void {
  for (const [subpath, target] of Object.entries(packageJson.exports ?? {})) {
    if (typeof target === 'string') {
      continue;
    }
    for (const [kind, path] of Object.entries(target)) {
      assert(path, `export ${subpath} is missing ${kind}`);
      const resolved = join(packageRoot, path.replace(/^\.\//, ''));
      assert(existsSync(resolved), `export ${subpath} ${kind} target is missing: ${path}`);
    }
  }
}

function assertSourceModulesExported(): void {
  const exportKeys = new Set(Object.keys(packageJson.exports ?? {}));
  for (const moduleId of collectSourceModules(packageSrcRoot)) {
    if (privateEntryModules.has(moduleId)) {
      continue;
    }
    const subpath = `./${moduleId}`;
    assert(exportKeys.has(subpath), `source module ${moduleId} is missing from package exports`);
  }
}

async function assertExportImports(): Promise<void> {
  for (const [subpath, target] of Object.entries(packageJson.exports ?? {})) {
    if (typeof target === 'string' || !target.import) {
      continue;
    }
    const resolved = join(packageRoot, target.import.replace(/^\.\//, ''));
    try {
      await import(pathToFileURL(resolved).href);
    } catch (error) {
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
      throw new Error(`export ${subpath} import target failed: ${target.import}\n${message}`);
    }
  }
}

function collectSourceModules(root: string, prefix = ''): string[] {
  const modules: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    const childPath = join(root, entry.name);
    if (entry.isDirectory()) {
      modules.push(...collectSourceModules(childPath, childPrefix));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      modules.push(childPrefix.replace(/\.ts$/, ''));
    }
  }
  return modules.sort();
}

function assertPackFileList(): void {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const [result] = JSON.parse(output) as PackResult[];
  const files = result?.files ?? [];
  assert(files.length > 0, 'npm pack dry run returned no files');
  for (const file of files) {
    const path = file.path;
    assert(!path.includes('references/'), `tarball includes local references path: ${path}`);
    assert(!path.includes('/Volumes/home'), `tarball includes network asset path: ${path}`);
    assert(!path.startsWith('docs/'), `tarball includes docs output: ${path}`);
    assert(!path.startsWith('tests/'), `tarball includes tests: ${path}`);
    assert(!path.startsWith('src/'), `tarball includes source files: ${path}`);
    assert(!path.startsWith('dist/src/'), `tarball includes nested src build output: ${path}`);
    assert(
      allowedPackFiles.has(path) || allowedPackRoots.some((root) => path.startsWith(root)),
      `unexpected tarball file: ${path}`
    );
    if (path.startsWith('examples/')) {
      assert(path.endsWith('.json'), `tarball includes non-JSON example source: ${path}`);
    }
  }
  assertPackedFileContents(files);
}

function assertPackedFileContents(files: readonly PackFile[]): void {
  for (const file of files) {
    const path = file.path;
    if (!textPackFileSuffixes.some((suffix) => path.endsWith(suffix))) {
      continue;
    }
    const content = readFileSync(join(packageRoot, path), 'utf8');
    if (path.endsWith('.map')) {
      assert(!content.includes('"sourcesContent"'), `packed ${path} embeds raw source content`);
    }
    for (const { label, pattern } of forbiddenPackedContentPatterns) {
      assert(!pattern.test(content), `packed ${path} contains ${label}`);
    }
  }
}
