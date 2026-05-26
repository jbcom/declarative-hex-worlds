import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
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
const packedConsumerSmoke = readSmokeOrchestratorSource(
  join(workspaceRoot, 'scripts/smoke-packed-consumer.ts')
);
// Local-only path patterns that must NEVER appear in published package metadata
// (`./Volumes/home` is the maintainer's NAS mount; kenney_castle + KayKit_Adventurers
// are local-only reference packs from `references/`, which is gitignored). The
// older check also rejected the literal string `references` in dev scripts,
// but `pnpm assets:free` legitimately reads from `references/KayKit_Medieval_
// Hexagon_Pack_1.0_FREE` at dev time to regenerate the bundled manifest —
// allow that one specific dev script path while still rejecting EXTRA paths.
const forbiddenMetadataPattern = /\/Volumes\/home|kenney_castle|KayKit_Adventurers|references\/KayKit_Medieval_Hexagon_Pack_1\.0_EXTRA/;
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
// `assets/free/` is intentionally limited to the single `manifest.json` metadata
// file; the GLTF/BIN/PNG asset tree is bootstrapped at install time via the CLI
// `bootstrap` subcommand (per PRD Epic RB), not bundled in the npm tarball.
const allowedPackRoots = ['docs/showcases/', 'dist/', 'examples/'];
const allowedExactPackPaths = new Set(['assets/free/manifest.json']);
const allowedPackFiles = new Set(['package.json', 'LICENSE', 'README.md', 'NOTICE.md']);
// Post-R1: showcase artifacts live at the single canonical path
// `docs/showcases/`. The pre-R1 prefix distinguishing in-package vs root
// copies has collapsed to empty.
const packageShowcaseArtifactPrefix = '';
// Modules that are part of `src/` but aren't published as their own subpath.
// `cli` is the bin entry, `index` is the umbrella, `manifest` is exposed as
// the dual subpaths `./manifest/schema` + `./manifest/free` instead of one
// umbrella, and `traits` ships under `./traits` already (just listed for
// completeness — the audit's directory-with-index check covers traits).
const privateEntryModules = new Set(['cli', 'index', 'manifest']);
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
assert(workspacePackageJson.engines?.pnpm === '>=9', 'package engines.pnpm must be >=9');
assert(packageJson.engines?.node === '>=22', 'package engines.node must be >=22');
assert(packageJson.dependencies?.['honeycomb-grid'], 'honeycomb-grid must remain a runtime dependency');
assert(packageJson.dependencies?.koota, 'koota must remain a runtime dependency');
assert(packageJson.dependencies?.seedrandom, 'seedrandom must remain a runtime dependency');
assert(!forbiddenMetadataPattern.test(JSON.stringify(packageJson.scripts ?? {})), 'package scripts contain local-only paths');
assert(packageJson.scripts?.prepublishOnly === 'pnpm verify', 'prepublishOnly must run the verify gate');
// Post-R1: workspace and package are the same package.json. Only one
// `test:visual` script exists, and it uses `pnpm run X && pnpm run Y && ...`
// shape so script-runner ergonomics stay consistent with the package-relative
// `pnpm exec` calls inside test:browser:free.
assert(
  packageJson.scripts?.['test:visual'] ===
    'pnpm run test:browser:free && pnpm run test:browser:extra && pnpm run test:e2e:local-assets',
  'test:visual must serialize the local browser review suites',
);
assert(
  packageJson.scripts?.['test:assets'] ===
    'pnpm test:assets:free && pnpm test:reference-assets && pnpm test:manifest-drift',
  'test:assets must run the FREE asset audit, local reference asset audit, and manifest drift check',
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
// Post-R1: react/react-dom/three moved from peerDependencies to dependencies
// (they're first-class bindings, NOT optional peers — same shape as koota
// itself per PRD bundled-bindings correction). Audit now asserts there is
// NO peerDependencies block and that the bindings live in dependencies.
assertBindingsAreDependencies();
assertNoPeerDependencies();
assertRootEntrypointMetadata();
assertBin();
assertExports();
assertSourceModulesExported();
assertPackedConsumerSmokeCoversExports();
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

function assertWorkspaceTestCiOrder(_testCiScript: string): void {
  // Post-R1: `test:ci` delegates to `pnpm verify` (single source of truth);
  // `verify` itself is the canonical chain. Audit the chain against `verify`.
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
  const verifyScript = packageJson.scripts?.verify ?? '';
  const actualSteps = verifyScript.split(' && ');
  assert(
    actualSteps.length === expectedSteps.length && actualSteps.every((step, index) => step === expectedSteps[index]),
    `verify expected ${expectedSteps.join(' && ')}, got ${verifyScript}`,
  );
}

function assertBindingsAreDependencies(): void {
  for (const required of ['react', 'react-dom', 'three', '@types/react']) {
    assert(
      typeof packageJson.dependencies?.[required] === 'string',
      `${required} must be a runtime dependency (R1 promoted react/three from peers)`,
    );
  }
}

function assertNoPeerDependencies(): void {
  assert(
    !Object.hasOwn(packageJson, 'peerDependencies'),
    'peerDependencies must not be present (react/three are runtime dependencies post-R1)',
  );
  assert(
    !Object.hasOwn(packageJson, 'peerDependenciesMeta'),
    'peerDependenciesMeta must not be present (no optional peers post-R1)',
  );
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



/**
 * Read the smoke-packed-consumer orchestrator source plus every local module
 * it imports, concatenated into a single virtual source. Needed because the
 * D10 refactor split the orchestrator into `pack-install.ts` + `types.ts` +
 * `_shared.ts` — the audit must continue to see the
 * `@jbcom/medieval-hexagon-gameboard/...` import specifiers that moved to
 * those sub-modules.
 */
function readSmokeOrchestratorSource(entryPath: string): string {
  const visited = new Set<string>();
  const parts: string[] = [];
  const walk = (filePath: string): void => {
    const absolute = resolve(filePath);
    if (visited.has(absolute)) {
      return;
    }
    visited.add(absolute);
    if (!existsSync(absolute)) {
      return;
    }
    const source = readFileSync(absolute, 'utf8');
    parts.push(`// === ${absolute} ===\n${source}`);
    const importPattern = /from\s+['"](\.[^'"]+)['"]|import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
    const importDir = resolve(absolute, '..');
    for (const match of source.matchAll(importPattern)) {
      const rawSpecifier = match[1] ?? match[2];
      if (!rawSpecifier) {
        continue;
      }
      const candidate = rawSpecifier.replace(/\.js$/, '.ts');
      walk(resolve(importDir, candidate));
    }
  };
  walk(entryPath);
  return parts.join('\n');
}

function collectSourceModules(root: string, prefix = ''): string[] {
  // Post-R2 sub-packages have an `index.ts` barrel that IS the public surface;
  // any other `.ts` siblings are internal-but-allowed. Treat a directory with
  // an `index.ts` as one module identified by the directory name. Loose `.ts`
  // files at the root (e.g. `src/index.ts`) keep their per-file identity.
  const modules: string[] = [];
  const entries = readdirSync(root, { withFileTypes: true });
  const hasIndex = entries.some((e) => e.isFile() && e.name === 'index.ts');
  if (hasIndex && prefix) {
    modules.push(prefix);
    return modules;
  }
  for (const entry of entries) {
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
  // PRD R4: SimpleRPG is a test driver, not a published example. Reject
  // any tarball that ships its compiled module, JSON fixtures, or raw
  // source. SimpleRPG SHOWCASE PNGs under `docs/showcases/` are still
  // shipped — they're product marketing screenshots referenced from the
  // README gallery, separate from the relocated test driver.
  for (const file of files) {
    const path = file.path;
    if (path.startsWith('docs/showcases/') && path.endsWith('.png')) {
      continue;
    }
    assert(
      !/simple-rpg/i.test(path),
      `tarball must not ship SimpleRPG (PRD R4 — SimpleRPG is a test driver, not a published example): ${path}`
    );
  }
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
      allowedPackFiles.has(path) ||
        allowedExactPackPaths.has(path) ||
        allowedPackRoots.some((root) => path.startsWith(root)),
      `unexpected tarball file: ${path}`
    );
    if (path.startsWith('examples/')) {
      assert(path.endsWith('.json'), `tarball includes non-JSON example source: ${path}`);
    }
    // Bundled binary assets must NOT ship: the runtime bootstrap (Epic RB) fetches
    // them at install time. Only `assets/free/manifest.json` is permitted under
    // `assets/free/` in the tarball.
    if (path.startsWith('assets/')) {
      assert(
        path === 'assets/free/manifest.json',
        `tarball includes a bundled asset (use CLI bootstrap instead): ${path}`
      );
    }
    // Anywhere in the tarball — no GLTF, BIN, FBX, OBJ. The CLI bootstrap
    // subcommand is the only supported channel for those binaries.
    const lowerPath = path.toLowerCase();
    if (
      lowerPath.endsWith('.gltf') ||
      lowerPath.endsWith('.bin') ||
      lowerPath.endsWith('.fbx') ||
      lowerPath.endsWith('.obj') ||
      lowerPath.endsWith('.mtl')
    ) {
      throw new Error(
        `tarball must not bundle asset binaries (use CLI bootstrap instead): ${path}`
      );
    }
    // PNGs are only allowed under docs/showcases/ (curated marketing screens).
    if (lowerPath.endsWith('.png')) {
      assert(
        path.startsWith('docs/showcases/'),
        `tarball PNGs are restricted to docs/showcases/; got ${path}`
      );
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
