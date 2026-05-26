import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import {
  analyzeScreenshot,
  validateScreenshot,
} from '../tests/scripts/screenshot-quality';
import { GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS } from '../src/interop';
import { KAYKIT_ATTRIBUTION } from '../src/manifest/schema';

interface PackageJson {
  bin?: Record<string, string>;
  dependencies?: Record<string, string>;
  license?: string;
  main?: string;
  module?: string;
  name?: string;
  engines?: Record<string, string>;
  exports?: Record<string, string | { import?: string; types?: string }>;
  files?: string[];
  packageManager?: string;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  publishConfig?: { access?: string };
  sideEffects?: boolean;
  scripts?: Record<string, string>;
  type?: string;
  types?: string;
}

interface PackFile {
  path: string;
}

interface PackResult {
  files?: PackFile[];
}

interface FreeManifestAttribution {
  sourcePack?: {
    creator?: string;
    license?: string;
    licenseUrl?: string;
    name?: string;
    version?: string;
  };
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const packageRoot = workspaceRoot;
const packageSrcRoot = join(packageRoot, 'src');
const packageJsonPath = join(packageRoot, 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
// Post-restructure: workspace and package are the same single manifest.
const workspacePackageJson = packageJson;
const freeManifest = JSON.parse(readFileSync(join(packageRoot, 'assets/free/manifest.json'), 'utf8')) as FreeManifestAttribution;
const packedConsumerSmoke = readFileSync(join(workspaceRoot, 'scripts/smoke-packed-consumer.ts'), 'utf8');
const forbiddenMetadataPattern = /references|\/Volumes\/home|kenney_castle|KayKit_Adventurers/;
const expectedFiles = [
  'assets/free',
  'docs/showcases',
  'dist',
  '!dist/**/*.map',
  '!dist/**/*.d.ts.map',
  'examples/*.json',
  'LICENSE',
  'README.md',
  'NOTICE.md',
];
const allowedPackRoots = ['assets/free/', 'docs/showcases/', 'dist/', 'examples/'];
const allowedPackFiles = new Set(['package.json', 'LICENSE', 'README.md', 'NOTICE.md']);
const packageShowcaseArtifactPrefix = '/';
const privateEntryModules = new Set(['cli', 'index']);
const optionalPeerImports = new Set(['react', 'three', 'koota/react']);
const optionalPeerImportAllowlist = new Map<string, ReadonlySet<string>>([
  ['./react', new Set(['react', 'koota/react'])],
  ['./three', new Set(['three'])],
]);
const textPackFiles = new Set(['LICENSE']);
const textPackFileSuffixes = ['.d.ts', '.js', '.json', '.map', '.md'];
const forbiddenPackedContentPatterns: readonly { label: string; pattern: RegExp }[] = [
  { label: 'macOS home path', pattern: /\/Users\// },
  { label: 'network asset mount path', pattern: /\/Volumes\/home/ },
  { label: 'file URL to a local path', pattern: /file:\/\/\// },
  { label: 'local NAS server URL', pattern: /smb:\/\/192\.168\.1\.200|Yog-Sothoth/i },
];

assertEqualSet(packageJson.files ?? [], expectedFiles, 'package files whitelist changed');
assert(packageJson.name === '@jbcom/medieval-hexagon-gameboard', 'package name changed');
assert(packageJson.type === 'module', 'package must publish as ESM');
assert(packageJson.sideEffects === false, 'package must remain side-effect-free for bundlers');
assert(packageJson.license === 'MIT', 'package code license must stay MIT');
assert(packageJson.publishConfig?.access === 'public', 'package publishConfig.access must be public');
assert(workspacePackageJson.packageManager === 'pnpm@9.15.9', 'workspace packageManager must pin pnpm@9.15.9');
assert(workspacePackageJson.engines?.node === '>=22', 'workspace engines.node must be >=22');
assert(workspacePackageJson.engines?.pnpm === '>=9 <10', 'workspace engines.pnpm must be >=9 <10');
assert(packageJson.engines?.node === '>=22', 'package engines.node must be >=22');
assert(packageJson.dependencies?.['honeycomb-grid'], 'honeycomb-grid must remain a runtime dependency');
assert(packageJson.dependencies?.koota, 'koota must remain a runtime dependency');
assert(packageJson.dependencies?.seedrandom, 'seedrandom must remain a runtime dependency');
assert(!forbiddenMetadataPattern.test(JSON.stringify(packageJson.scripts ?? {})), 'package scripts contain local-only paths');
assert(packageJson.scripts?.prepublishOnly === 'pnpm -w test:ci', 'prepublishOnly must run the workspace CI gate');
assert(
  workspacePackageJson.scripts?.['test:visual'] ===
    'pnpm test:browser:free && pnpm test:browser:extra && pnpm test:e2e:local-assets',
  'workspace test:visual must serialize the local browser review suites'
);
assert(
  workspacePackageJson.scripts?.['test:assets'] === 'pnpm test:assets:free && pnpm test:reference-assets',
  'workspace test:assets must run the FREE asset audit and local reference asset audit'
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
const workspaceTestCi = workspacePackageJson.scripts?.['test:ci'];
assert(workspaceTestCi, 'workspace test:ci must run the built CLI and packed consumer smoke before pack dry-run');
assertWorkspaceTestCiOrder(workspaceTestCi);
assert(
  packageJson.exports?.['./examples/*.json'] === './examples/*.json',
  'package must expose packaged JSON examples without exposing raw example source as executable subpaths'
);
assert(
  !Object.hasOwn(packageJson.exports ?? {}, './examples/*'),
  'package must not expose the broad ./examples/* wildcard'
);
assertPeerDependencyMetadataTargetsRealPeers();
assertOptionalPeer('react');
assertOptionalPeer('@types/react');
assertOptionalPeer('three');
assertRootEntrypointMetadata();
assertBin();
assertExports();
assertSourceModulesExported();
assertPackedConsumerSmokeCoversExports();
await assertExportImports();
assertOptionalPeerImportIsolation();
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

function assertWorkspaceTestCiOrder(script: string): void {
  const expectedSteps = [
    'pnpm lint',
    'pnpm typecheck',
    'pnpm test:docs-contract',
    'pnpm test:api-docs',
    'pnpm docs:build',
    'pnpm test:assets',
    'pnpm test:workspace',
    'pnpm test:workflows',
    'pnpm build',
    'pnpm test:cli',
    'pnpm expectations',
    'pnpm test',
    'pnpm test:package',
    'pnpm test:consumer',
    'pnpm pack:dry-run',
  ];
  const actualSteps = script.split(' && ');
  assert(
    actualSteps.length === expectedSteps.length && actualSteps.every((step, index) => step === expectedSteps[index]),
    `workspace test:ci expected ${expectedSteps.join(' && ')}, got ${script}`
  );
}

function assertOptionalPeer(name: string): void {
  assert(packageJson.peerDependenciesMeta?.[name]?.optional === true, `${name} must be an optional peer dependency`);
}

function assertPeerDependencyMetadataTargetsRealPeers(): void {
  for (const peerName of Object.keys(packageJson.peerDependenciesMeta ?? {})) {
    assert(
      packageJson.peerDependencies?.[peerName],
      `peerDependenciesMeta entry ${peerName} must also be declared in peerDependencies`
    );
  }
}

function assertRootEntrypointMetadata(): void {
  const rootExport = packageJson.exports?.['.'];
  assert(typeof rootExport === 'object' && rootExport !== null, 'root export must be an object export');
  assert(rootExport.import === './dist/index.js', 'root export import must point at ./dist/index.js');
  assert(rootExport.types === './dist/index.d.ts', 'root export types must point at ./dist/index.d.ts');
  assert(packageJson.main === rootExport.import, 'package main must mirror root export import');
  assert(packageJson.module === rootExport.import, 'package module must mirror root export import');
  assert(packageJson.types === rootExport.types, 'package types must mirror root export types');
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

function assertPackedConsumerSmokeCoversExports(): void {
  const packageName = '@jbcom/medieval-hexagon-gameboard';
  const coveredSpecifiers = collectConsumerSmokePackageSpecifiers(packageName);
  for (const subpath of Object.keys(packageJson.exports ?? {})) {
    const exportPattern = subpath.slice(2);
    const coveredImportPattern =
      subpath === '.'
        ? packageName
        : `${packageName}/${subpath.includes('*') ? exportPattern.slice(0, exportPattern.indexOf('*')) : exportPattern}`;
    const documentedExport = subpath === '.' ? packageName : `${packageName}/${exportPattern}`;
    assert(
      isConsumerSmokeExportCovered(coveredImportPattern, subpath.includes('*'), coveredSpecifiers),
      `packed consumer smoke must import or load export ${documentedExport}`
    );
  }
}

function collectConsumerSmokePackageSpecifiers(packageName: string): Set<string> {
  const specifiers = new Set<string>();
  const visitedSnippets = new Set<string>();
  const sourceFile = ts.createSourceFile(
    'smoke-packed-consumer.ts',
    packedConsumerSmoke,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const visit = (node: ts.Node): void => {
    collectPackageImportSpecifierFromNode(node, packageName, specifiers);
    const snippet = nodeTextSnippet(node);
    if (snippet?.includes(packageName) && !visitedSnippets.has(snippet)) {
      visitedSnippets.add(snippet);
      collectConsumerSmokeSnippetPackageSpecifiers(snippet, packageName, specifiers);
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return specifiers;
}

function collectConsumerSmokeSnippetPackageSpecifiers(
  source: string,
  packageName: string,
  specifiers: Set<string>
): void {
  const sourceFile = ts.createSourceFile(
    'packed-consumer-generated-snippet.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const visit = (node: ts.Node): void => {
    collectPackageImportSpecifierFromNode(node, packageName, specifiers);
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function collectPackageImportSpecifierFromNode(
  node: ts.Node,
  packageName: string,
  specifiers: Set<string>
): void {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
    addPackageSpecifierFromExpression(node.moduleSpecifier, packageName, specifiers);
    return;
  }

  if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    addPackageSpecifierFromExpression(node.arguments[0], packageName, specifiers);
  }
}

function addPackageSpecifierFromExpression(
  expression: ts.Expression | undefined,
  packageName: string,
  specifiers: Set<string>
): void {
  if (!expression || !isStaticStringLiteral(expression)) {
    return;
  }
  if (expression.text === packageName || expression.text.startsWith(`${packageName}/`)) {
    specifiers.add(expression.text);
  }
}

function nodeTextSnippet(node: ts.Node): string | undefined {
  return isStaticStringLiteral(node) ? node.text : undefined;
}

function isStaticStringLiteral(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function isConsumerSmokeExportCovered(
  importPattern: string,
  isWildcard: boolean,
  specifiers: ReadonlySet<string>
): boolean {
  if (!isWildcard) {
    return specifiers.has(importPattern);
  }
  for (const specifier of specifiers) {
    if (specifier.startsWith(importPattern)) {
      return true;
    }
  }
  return false;
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

function assertOptionalPeerImportIsolation(): void {
  for (const [subpath, target] of Object.entries(packageJson.exports ?? {})) {
    if (typeof target === 'string' || !target.import) {
      continue;
    }
    const entryPath = join(packageRoot, target.import.replace(/^\.\//, ''));
    const allowedImports = optionalPeerImportAllowlist.get(subpath) ?? new Set<string>();
    for (const importRecord of collectTransitiveImports(entryPath)) {
      if (!optionalPeerImports.has(importRecord.specifier)) {
        continue;
      }
      assert(
        allowedImports.has(importRecord.specifier),
        `export ${subpath} transitively imports optional peer ${importRecord.specifier} through ${relativePackagePath(importRecord.filePath)}`
      );
    }
  }
}

function collectTransitiveImports(entryPath: string): { specifier: string; filePath: string }[] {
  const imports: { specifier: string; filePath: string }[] = [];
  const visited = new Set<string>();
  const stack = [entryPath];

  while (stack.length > 0) {
    const filePath = stack.pop();
    if (!filePath || visited.has(filePath)) {
      continue;
    }
    visited.add(filePath);
    const source = readFileSync(filePath, 'utf8');
    const importPattern = /\b(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1] ?? '';
      imports.push({ specifier, filePath });
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        const resolved = resolve(dirname(filePath), specifier);
        if (resolved.startsWith(join(packageRoot, 'dist')) && resolved.endsWith('.js')) {
          stack.push(resolved);
        }
      }
    }
  }

  return imports;
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

function relativePackagePath(path: string): string {
  return path.slice(packageRoot.length + 1);
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
    assert(
      !path.startsWith('docs/') || path.startsWith('docs/showcases/'),
      `tarball includes docs output: ${path}`
    );
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
  assertPackedAttribution(files);
  assertPackedReadmeLocalLinks(files);
  assertPackedShowcaseImageQuality(files);
}

function assertPackedFileContents(files: readonly PackFile[]): void {
  for (const file of files) {
    const path = file.path;
    if (!isTextPackFile(path)) {
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

function isTextPackFile(path: string): boolean {
  return textPackFiles.has(path) || textPackFileSuffixes.some((suffix) => path.endsWith(suffix));
}

function assertPackedAttribution(files: readonly PackFile[]): void {
  const packedPaths = new Set(files.map((file) => file.path));
  for (const path of ['LICENSE', 'NOTICE.md', 'README.md', 'assets/free/manifest.json']) {
    assert(packedPaths.has(path), `package attribution file must be packed: ${path}`);
  }

  assert(freeManifest.sourcePack?.creator === KAYKIT_ATTRIBUTION.creator, 'FREE manifest creator attribution changed');
  assert(freeManifest.sourcePack?.license === KAYKIT_ATTRIBUTION.license, 'FREE manifest license attribution changed');
  assert(freeManifest.sourcePack?.licenseUrl === KAYKIT_ATTRIBUTION.licenseUrl, 'FREE manifest license URL changed');
  assert(freeManifest.sourcePack?.name === 'KayKit: Medieval Hexagon Pack', 'FREE manifest source pack name changed');
  assert(freeManifest.sourcePack?.version === '1.0', 'FREE manifest source pack version changed');

  const license = readFileSync(join(packageRoot, 'LICENSE'), 'utf8');
  const notice = readFileSync(join(packageRoot, 'NOTICE.md'), 'utf8');
  const readme = readFileSync(join(packageRoot, 'README.md'), 'utf8');
  requireAttributionText(license, 'package LICENSE', ['MIT License']);
  requireAttributionText(notice, 'package NOTICE.md', expectedAttributionSnippets());
  requireAttributionText(readme, 'package README.md', [
    '## License And Attribution',
    'MIT licensed',
    'assets/free/',
    'Purchased EXTRA and third-party reference assets stay local-only',
    '[NOTICE.md](NOTICE.md)',
    ...expectedAttributionSnippets(),
  ]);
}

function expectedAttributionSnippets(): string[] {
  return [
    'KayKit: Medieval Hexagon Pack',
    KAYKIT_ATTRIBUTION.creator,
    KAYKIT_ATTRIBUTION.website,
    'KayKit',
    'https://kaylousberg.itch.io',
    KAYKIT_ATTRIBUTION.license,
    KAYKIT_ATTRIBUTION.licenseUrl,
  ];
}

function requireAttributionText(source: string, label: string, snippets: readonly string[]): void {
  for (const snippet of snippets) {
    assert(source.includes(snippet), `${label} must include attribution text: ${snippet}`);
  }
}

function assertPackedReadmeLocalLinks(files: readonly PackFile[]): void {
  const packedPaths = new Set(files.map((file) => file.path));
  const readme = readFileSync(join(packageRoot, 'README.md'), 'utf8');
  const imagePaths = new Set<string>();
  for (const match of readme.matchAll(/(!?)\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const isImage = match[1] === '!';
    const href = match[2];
    if (!href || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(href)) {
      continue;
    }
    const [pathOnly = ''] = href.split('#');
    if (!pathOnly) {
      continue;
    }
    const resolved = resolve(packageRoot, pathOnly);
    assert(resolved.startsWith(`${packageRoot}/`), `package README link escapes package root: ${href}`);
    const packageRelative = resolved.slice(packageRoot.length + 1);
    assert(existsSync(resolved), `package README link ${href} points at missing ${packageRelative}`);
    assert(packedPaths.has(packageRelative), `package README link ${href} points at unpacked ${packageRelative}`);
    if (isImage && packageRelative.endsWith('.png')) {
      imagePaths.add(packageRelative);
    }
  }
  for (const path of imagePaths) {
    assertPackedPngQuality(path, `package README image ${path}`);
  }
  assertPackageReadmeShowcaseImages([...imagePaths]);
}

function assertPackedShowcaseImageQuality(files: readonly PackFile[]): void {
  const showcaseImages = files
    .map((file) => file.path)
    .filter((path) => path.startsWith('docs/showcases/') && path.endsWith('.png'))
    .sort();
  assert(showcaseImages.length > 0, 'package must include committed showcase PNGs');
  assertEqualSet(
    showcaseImages,
    expectedPackageShowcaseImages(),
    'packed showcase PNGs must match curated package showcase artifacts'
  );
  for (const path of showcaseImages) {
    assertPackedPngQuality(path, `packed showcase ${path}`);
  }
}

function assertPackageReadmeShowcaseImages(imagePaths: readonly string[]): void {
  const showcaseImages = imagePaths
    .filter((path) => path.startsWith('docs/showcases/') && path.endsWith('.png'))
    .sort();
  assertEqualSet(
    showcaseImages,
    expectedPackageShowcaseImages(),
    'package README showcase image links must match curated package showcase artifacts'
  );
}

function expectedPackageShowcaseImages(): string[] {
  return GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS
    .filter((path) => path.startsWith(`${packageShowcaseArtifactPrefix}docs/showcases/`))
    .map((path) => path.slice(packageShowcaseArtifactPrefix.length))
    .sort();
}

function assertPackedPngQuality(packageRelativePath: string, label: string): void {
  const failures = validateScreenshot(analyzeScreenshot(join(packageRoot, packageRelativePath)));
  assert(failures.length === 0, `${label} failed PNG quality checks: ${failures.join('; ')}`);
}
