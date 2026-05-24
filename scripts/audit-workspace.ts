import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import {
  GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS,
  GAMEBOARD_RELEASE_GATE_COMMANDS,
  GAMEBOARD_RELEASE_GATE_SUMMARIES,
  GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS,
} from '../packages/medieval-hexagon-gameboard/src/coverage';

interface PackageJson {
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
  exports?: Record<string, string | { import?: string; types?: string }>;
  files?: string[];
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
    noEmit?: boolean;
    types?: string[];
  };
  extends?: string;
  include?: string[];
}

interface MarkdownLocalLink {
  fragment?: string;
  path: string;
}

interface MarkdownCodeFence {
  language: string;
  source: string;
  startLine: number;
}

interface ReleaseReadinessLedger {
  assets?: unknown[];
  gaps?: unknown[];
  generatedAt?: string;
  guide?: {
    assetCounts?: {
      extra?: number;
      free?: number;
      occurrences?: number;
      unique?: number;
    };
    pageCount?: number;
    scenarioCount?: number;
  };
  manifest?: {
    edition?: string;
    errorCount?: number;
    extraGuideAssetsLocalOnly?: unknown[];
    freeGuideAssetsInManifest?: number;
    freeGuideAssetsMissingFromManifest?: unknown[];
    guideExtraAssetCount?: number;
    guideFreeAssetCount?: number;
    manifestAssetCount?: number;
    warningCount?: number;
  };
  packageChecks?: { command?: string; status?: string; summary?: string }[];
  pages?: {
    docs?: number;
    edition?: string;
    page?: number;
    publicApis?: number;
    scenarioId?: string;
    sourceImage?: { path?: string; status?: string };
    uniqueAssets?: number;
    visualArtifacts?: number;
  }[];
  publicApi?: unknown[];
  references?: { label?: string; path?: string; status?: string }[];
  releaseGateCommands?: string[];
  roles?: unknown[];
  schemaVersion?: string;
  status?: string;
  visualArtifacts?: { pages?: number[]; path?: string; source?: string; status?: string }[];
}

const workspaceRoot = resolve(import.meta.dirname, '..');
const failures: string[] = [];
const markdownAnchorCache = new Map<string, Set<string>>();
const rootReadmeGuideBaseUrl = 'https://github.com/jbcom/medieval-hexagon-gameboard/blob/main/docs/guides';

const workspacePackageJson = readJson<PackageJson>('package.json');
const packageJson = readJson<PackageJson>('packages/medieval-hexagon-gameboard/package.json');
const docsPackageJson = readJson<PackageJson>('apps/docs/package.json');
const pnpmWorkspace = readJson<PnpmWorkspace>('pnpm-workspace.yaml');
const nxJson = readJson<NxJson>('nx.json');
const projectJson = readJson<ProjectJson>('packages/medieval-hexagon-gameboard/project.json');
const scriptsTsconfig = readJson<TsConfigJson>('tsconfig.scripts.json');
const typedocJson = readJson<TypeDocJson>('typedoc.json');
const tsupConfig = readRequired('packages/medieval-hexagon-gameboard/tsup.config.ts');
const promoteShowcasesScript = readRequired('scripts/promote-showcases.ts');
const packageAuditScript = readRequired('scripts/audit-package.ts');
const apiDocsAuditScript = readRequired('scripts/audit-api-docs.ts');
const agentsGuide = readRequired('AGENTS.md');
const rootReadme = readRequired('README.md');
const packageReadme = readRequired('packages/medieval-hexagon-gameboard/README.md');
const docsIndex = readRequired('docs/index.md');
const docsVitePressConfig = readRequired('docs/.vitepress/config.ts');
const publicApiGuide = readRequired('docs/guides/public-api.md');
const releaseReadinessJson = readJson<ReleaseReadinessLedger>('docs/release-readiness.json');
const releaseReadinessMarkdown = readRequired('docs/guides/release-readiness.md');
const guideDocs = readGuideDocs();
const docsMarkdownPaths = readDocsMarkdownPaths();
const tsupEntries = readTsupEntries(tsupConfig);
const ignoredUntrackedWorkspacePaths = [
  {
    checkPath: 'docs/api/index.html',
    label: 'generated TypeDoc docs/api output',
    trackedPath: 'docs/api',
  },
  {
    checkPath: 'apps/docs/dist/index.html',
    label: 'generated VitePress docs app output',
    trackedPath: 'apps/docs/dist',
  },
  {
    checkPath: 'packages/medieval-hexagon-gameboard/dist/index.js',
    label: 'generated package dist output',
    trackedPath: 'packages/medieval-hexagon-gameboard/dist',
  },
  {
    checkPath: 'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/free-catalog.png',
    label: 'generated browser screenshot output',
    trackedPath: 'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__',
  },
  {
    checkPath: 'references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA',
    label: 'local reference asset packs',
    trackedPath: 'references',
  },
] as const;

requireWorkspaceScripts();
requireWorkspacePackages();
requireNxConfiguration();
requireProjectTargets();
requireDocsConfiguration();
requireReleaseReadinessLedger();
requireTypeDocConfiguration();
requireTsupConfiguration();
requirePackageAuditConsumerCoverage();

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
    workspacePackageJson.scripts?.['showcases:promote'] === 'tsx scripts/promote-showcases.ts',
    'showcases:promote must promote curated visual artifacts reproducibly'
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
    workspacePackageJson.scripts?.expectations ===
      'pnpm --dir packages/medieval-hexagon-gameboard exec vitest run --config vitest.config.ts tests/unit/simulation.test.ts tests/unit/examples.test.ts tests/unit/simple-rpg.test.ts',
    'expectations script must run the simulation/example/SimpleRPG behavior-drift tests'
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
  const expectedTestCiScript =
    'pnpm lint && pnpm typecheck && pnpm test:docs-contract && pnpm test:api-docs && pnpm docs:build && pnpm test:assets && pnpm test:workspace && pnpm test:workflows && pnpm build && pnpm test:cli && pnpm expectations && pnpm test && pnpm test:package && pnpm test:consumer && pnpm pack:dry-run';
  assert(
    workspacePackageJson.scripts?.['test:ci'] === expectedTestCiScript,
    'test:ci must keep the full release gate chain in the audited order'
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
  requireDocsMarkdownLinksResolve();
  requireMarkdownFileLinksResolve(
    rootReadme,
    'root README',
    workspaceRoot,
    workspaceRoot,
    join(workspaceRoot, 'README.md')
  );
  requireMarkdownFileLinksResolve(
    packageReadme,
    'package README',
    join(workspaceRoot, 'packages/medieval-hexagon-gameboard'),
    join(workspaceRoot, 'packages/medieval-hexagon-gameboard'),
    join(workspaceRoot, 'packages/medieval-hexagon-gameboard/README.md')
  );
  requireShowcaseCopiesMatch();
  requireMarkdownTypeScriptSnippetsHaveUniqueObjectKeys();
  requireReadmeGuideCoverage();
  requireReadmeAttribution();
  requirePublicApiSubpathGuide();
  requirePackageReadmePublicImports();
  requireAgentsPublicApiSurfaces();
  requireAgentsLocalAssetGuidance();
}

function requireDocsMarkdownLinksResolve(): void {
  assert(docsMarkdownPaths.includes('docs/index.md'), 'docs Markdown audit must include docs/index.md');
  for (const path of docsMarkdownPaths) {
    requireMarkdownFileLinksResolve(
      readRequired(path),
      path,
      dirname(join(workspaceRoot, path)),
      join(workspaceRoot, 'docs'),
      join(workspaceRoot, path)
    );
  }
}

function requireMarkdownFileLinksResolve(
  source: string,
  label: string,
  baseDir: string,
  rootDir: string,
  currentFile?: string
): void {
  requireMarkdownImageLinksResolve(source, label, baseDir, rootDir);
  requireMarkdownLocalLinksResolve(source, label, baseDir, rootDir, currentFile);
}

function requireDocsGuideNavigation(): void {
  assert(guideDocs.length > 0, 'docs/guides must contain at least one guide');

  for (const guideFile of guideDocs) {
    const guideLink = `./guides/${guideFile}`;
    const vitePressLink = `/guides/${guideFile.slice(0, -'.md'.length)}`;
    assert(
      new RegExp(`]\\(${escapeRegExp(guideLink)}(?:#[^)]+)?\\)`).test(docsIndex),
      `docs/index.md must link ${guideLink}`
    );
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

function requireMarkdownTypeScriptSnippetsHaveUniqueObjectKeys(): void {
  const auditedMarkdownPaths = [
    'README.md',
    'AGENTS.md',
    'packages/medieval-hexagon-gameboard/README.md',
    ...docsMarkdownPaths,
  ];
  for (const path of auditedMarkdownPaths) {
    for (const fence of markdownCodeFences(readRequired(path))) {
      if (!isTypeScriptFence(fence.language)) {
        continue;
      }
      requireUniqueObjectKeysInTypeScriptSnippet(path, fence);
    }
  }
}

function requireUniqueObjectKeysInTypeScriptSnippet(path: string, fence: MarkdownCodeFence): void {
  const sourceFile = ts.createSourceFile(
    `${path}:${fence.startLine}`,
    fence.source,
    ts.ScriptTarget.Latest,
    true,
    fence.language === 'tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );

  function visit(node: ts.Node): void {
    if (ts.isObjectLiteralExpression(node)) {
      const seen = new Map<string, ts.Node>();
      for (const property of node.properties) {
        if (
          !ts.isPropertyAssignment(property) &&
          !ts.isShorthandPropertyAssignment(property) &&
          !ts.isMethodDeclaration(property)
        ) {
          continue;
        }
        const name = staticPropertyName(property.name);
        if (!name) {
          continue;
        }
        const existing = seen.get(name);
        if (existing) {
          const first = sourceFile.getLineAndCharacterOfPosition(existing.getStart(sourceFile));
          const duplicate = sourceFile.getLineAndCharacterOfPosition(property.name.getStart(sourceFile));
          failures.push(
            `${path}:${fence.startLine + duplicate.line} TypeScript snippet duplicates object key ${name}; first seen at line ${fence.startLine + first.line}`
          );
          continue;
        }
        seen.set(name, property.name);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

function staticPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function isTypeScriptFence(language: string): boolean {
  return language === 'ts' || language === 'tsx' || language === 'typescript';
}

function requireAgentsLocalAssetGuidance(): void {
  assert(
    agentsGuide.includes('MEDIEVAL_HEXAGON_ASSET_LIBRARY_ROOT'),
    'AGENTS.md must document MEDIEVAL_HEXAGON_ASSET_LIBRARY_ROOT for optional local asset-library smoke tests'
  );
  const derivedMountExpression = 'ASSET_LIBRARY_MOUNT=$' + '{ASSET_LIBRARY_ROOT%/assets}';
  assert(agentsGuide.includes(derivedMountExpression), 'AGENTS.md local asset-library mount check must derive from MEDIEVAL_HEXAGON_ASSET_LIBRARY_ROOT');
  assert(!agentsGuide.includes('/Volumes/home'), 'AGENTS.md shared contributor guidance must not hardcode workstation NAS paths');
  assert(!agentsGuide.includes('this workstation'), 'AGENTS.md shared contributor guidance must not use workstation-specific wording');
  assert(!agentsGuide.includes('on this machine'), 'AGENTS.md shared contributor guidance must not use machine-specific wording');
}

function requireReleaseReadinessLedger(): void {
  assert(releaseReadinessJson.schemaVersion === '1.0.0', 'release-readiness JSON schema version changed');
  assert(
    releaseReadinessJson.generatedAt === '2026-05-24T00:00:00.000Z',
    'release-readiness JSON generatedAt must stay deterministic'
  );
  assert(
    releaseReadinessMarkdown.includes('# Release Readiness Coverage'),
    'release-readiness Markdown must keep the generated title'
  );
  assert(
    releaseReadinessMarkdown.includes('## Summary'),
    'release-readiness Markdown must keep the Summary anchor target'
  );

  const guide = releaseReadinessJson.guide;
  const guideAssetCounts = guide?.assetCounts;
  assert(guide?.pageCount === 19, 'release-readiness JSON must report 19 guide pages');
  assert(guide?.scenarioCount === 19, 'release-readiness JSON must report 19 guide scenarios');
  assert(guideAssetCounts?.unique === 404, 'release-readiness JSON must report 404 unique guide assets');
  assert(guideAssetCounts?.free === 221, 'release-readiness JSON must report 221 FREE guide assets');
  assert(guideAssetCounts?.extra === 183, 'release-readiness JSON must report 183 EXTRA guide assets');
  assert(guideAssetCounts?.occurrences === 1108, 'release-readiness JSON must report 1108 guide asset occurrences');
  assert((releaseReadinessJson.publicApi ?? []).length === 74, 'release-readiness JSON must report 74 public API surfaces');
  assert((releaseReadinessJson.roles ?? []).length === 12, 'release-readiness JSON must report 12 public roles');
  assert((releaseReadinessJson.assets ?? []).length === 404, 'release-readiness JSON must include all 404 treated assets');
  assert((releaseReadinessJson.pages ?? []).length === 19, 'release-readiness JSON must include all 19 page rows');

  requireIncludes(releaseReadinessMarkdown, 'release-readiness Markdown summary', [
    `- Status: ${releaseReadinessJson.status}`,
    `- Guide pages: ${guide?.pageCount}/19`,
    `- Guide scenarios: ${guide?.scenarioCount}`,
    `- Guide assets: ${guideAssetCounts?.unique} unique (${guideAssetCounts?.free} FREE, ${guideAssetCounts?.extra} EXTRA), ${guideAssetCounts?.occurrences} page-level occurrences`,
    `- Public API surfaces: ${(releaseReadinessJson.publicApi ?? []).length}`,
    `- Public roles: ${(releaseReadinessJson.roles ?? []).length}`,
    `- Visual artifacts: ${countReleaseStatus(releaseReadinessJson.visualArtifacts, 'available')} available, ${countReleaseStatus(releaseReadinessJson.visualArtifacts, 'missing')} missing, ${countReleaseStatus(releaseReadinessJson.visualArtifacts, 'skipped')} skipped`,
    `- Local references: ${countReleaseStatus(releaseReadinessJson.references, 'available')} available, ${countReleaseStatus(releaseReadinessJson.references, 'missing')} missing, ${countReleaseStatus(releaseReadinessJson.references, 'skipped')} skipped`,
    `- Release checks: ${countReleaseStatus(releaseReadinessJson.packageChecks, 'passed')} passed, ${countReleaseStatus(releaseReadinessJson.packageChecks, 'failed')} failed, ${countReleaseStatus(releaseReadinessJson.packageChecks, 'not-run')} not run, ${countReleaseStatus(releaseReadinessJson.packageChecks, 'skipped')} skipped`,
    `- Manifest edition: ${releaseReadinessJson.manifest?.edition ?? 'unknown'}`,
    `- Manifest assets: ${releaseReadinessJson.manifest?.manifestAssetCount}`,
    `- FREE guide assets in manifest: ${releaseReadinessJson.manifest?.freeGuideAssetsInManifest}/${releaseReadinessJson.manifest?.guideFreeAssetCount}`,
    `- FREE guide assets missing from manifest: ${releaseReadinessJson.manifest?.freeGuideAssetsMissingFromManifest?.length}`,
    `- EXTRA guide assets kept local-only: ${releaseReadinessJson.manifest?.extraGuideAssetsLocalOnly?.length}/${releaseReadinessJson.manifest?.guideExtraAssetCount}`,
    `- Manifest validation: ${releaseReadinessJson.manifest?.errorCount} error(s), ${releaseReadinessJson.manifest?.warningCount} warning(s)`,
  ]);

  if ((releaseReadinessJson.gaps ?? []).length === 0) {
    assert(releaseReadinessMarkdown.includes('## Gaps\n\n- None'), 'release-readiness Markdown must report no gaps');
  }

  for (const artifact of releaseReadinessJson.visualArtifacts ?? []) {
    assert(
      artifact.path && releaseReadinessMarkdown.includes(`\`${artifact.path}\``),
      `release-readiness Markdown must include visual artifact ${artifact.path ?? '<missing path>'}`
    );
  }
  requireBrowserScreenshotArtifactsTracked();

  for (const reference of releaseReadinessJson.references ?? []) {
    assert(
      reference.path && releaseReadinessMarkdown.includes(`\`${reference.path}\``),
      `release-readiness Markdown must include local reference ${reference.path ?? '<missing path>'}`
    );
  }

  for (const page of releaseReadinessJson.pages ?? []) {
    assert(
      page.page && page.scenarioId && releaseReadinessMarkdown.includes(`| ${page.page} | \`${page.scenarioId}\``),
      `release-readiness Markdown must include guide page row ${page.page ?? '<missing page>'}`
    );
    assert(
      page.sourceImage?.path && releaseReadinessMarkdown.includes(`\`${page.sourceImage.path}\``),
      `release-readiness Markdown must include source image ${page.sourceImage?.path ?? '<missing path>'}`
    );
  }

  assertEqualList(
    releaseReadinessJson.releaseGateCommands ?? [],
    [...GAMEBOARD_RELEASE_GATE_COMMANDS],
    'release-readiness JSON release gate commands'
  );
  assertEqualList(
    (releaseReadinessJson.packageChecks ?? []).map((check) => check.command ?? ''),
    releaseReadinessJson.releaseGateCommands ?? [],
    'release-readiness package checks'
  );
  for (const command of releaseReadinessJson.releaseGateCommands ?? []) {
    assert(
      releaseReadinessMarkdown.includes(`- \`${command}\``),
      `release-readiness Markdown must include final command ${command}`
    );
  }
  for (const check of releaseReadinessJson.packageChecks ?? []) {
    assert(check.summary, `release-readiness package check ${check.command ?? '<missing command>'} must include a summary`);
    assert(
      isReleaseGateCommand(check.command) && check.summary === GAMEBOARD_RELEASE_GATE_SUMMARIES[check.command],
      `release-readiness package check ${check.command ?? '<missing command>'} must use the canonical coverage summary`
    );
    assert(
      check.summary && releaseReadinessMarkdown.includes(check.summary),
      `release-readiness Markdown must include package check summary for ${check.command ?? '<missing command>'}`
    );
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

  assert(
    promoteShowcasesScript.includes('GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS'),
    'scripts/promote-showcases.ts must read the curated showcase list from coverage source'
  );
  assert(
    promoteShowcasesScript.includes('tests/scripts/screenshot-quality') &&
      promoteShowcasesScript.includes('validateShowcaseQuality'),
    'scripts/promote-showcases.ts must validate promoted showcase PNG quality'
  );
  assert(
    packageAuditScript.includes('tests/scripts/screenshot-quality') &&
      packageAuditScript.includes('assertPackedShowcaseImageQuality'),
    'scripts/audit-package.ts must validate packed showcase PNG quality'
  );
  assert(
    packageAuditScript.includes('GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS') &&
      packageAuditScript.includes('assertPackageReadmeShowcaseImages'),
    'scripts/audit-package.ts must require the package README gallery to match the curated package showcase artifacts'
  );
  assert(
    packageAuditScript.includes('KAYKIT_ATTRIBUTION') &&
      packageAuditScript.includes('assertPackedAttribution'),
    'scripts/audit-package.ts must validate packed KayKit attribution and NOTICE text'
  );
  assertEqualList(
    packageReadmeShowcaseImages(),
    packageShowcases.map((filename) => `docs/showcases/${filename}`),
    'package README showcase image links'
  );
  for (const filename of docsShowcases) {
    const docsHash = sha256(join(docsShowcaseDir, filename));
    const packageHash = sha256(join(packageShowcaseDir, filename));
    assert(
      packageHash === docsHash,
      `published README showcase ${filename} must match docs/assets/showcases/${filename}`
    );
  }
  assert(
    promoteShowcasesScript.includes('packages/medieval-hexagon-gameboard/tests/browser/__screenshots__'),
    'scripts/promote-showcases.ts must copy from the ignored browser screenshot output'
  );
  assert(
    curatedShowcaseArtifactsFromCoverage().some((path) => path.startsWith('docs/assets/showcases/')) &&
      curatedShowcaseArtifactsFromCoverage().some((path) =>
        path.startsWith('packages/medieval-hexagon-gameboard/docs/showcases/')
      ) &&
      promoteShowcasesScript.includes('dirname(showcase.target)'),
    'scripts/promote-showcases.ts must derive both docs and package showcase destinations from coverage source'
  );
}

function requireReadmeAttribution(): void {
  const requiredSnippets = [
    '## License And Attribution',
    'MIT licensed',
    'KayKit: Medieval Hexagon Pack',
    'Kay Lousberg',
    'https://www.kaylousberg.com',
    'https://kaylousberg.itch.io',
    'CC0-1.0',
    'https://creativecommons.org/publicdomain/zero/1.0/',
    'NOTICE.md',
    'Purchased EXTRA and third-party reference assets stay local-only',
  ];
  requireIncludes(rootReadme, 'root README attribution', requiredSnippets);
  requireIncludes(packageReadme, 'package README attribution', requiredSnippets);
}

function packageReadmeShowcaseImages(): string[] {
  return [...packageReadme.matchAll(/!\[[^\]]*]\((docs\/showcases\/[^)\s#]+\.png)(?:\s+"[^"]*")?\)/g)]
    .map((match) => match[1])
    .filter((path): path is string => Boolean(path))
    .sort();
}

function requireReadmeGuideCoverage(): void {
  for (const guideFile of guideDocs) {
    const rootGuidePath = `docs/guides/${guideFile}`;
    const packageGuidePath = `docs/guides/${guideFile}`;
    assert(
      rootReadme.includes(`](${rootReadmeGuideBaseUrl}/${guideFile})`),
      `root README Documentation section must link ${rootGuidePath} through GitHub so TypeDoc does not ingest guide Markdown as media`
    );
    assert(
      packageReadme.includes(`](${rootReadmeGuideBaseUrl}/${guideFile})`),
      `package README Documentation section must link ${packageGuidePath} through GitHub because package docs/guides is not published`
    );
  }
}

function requireMarkdownImageLinksResolve(source: string, label: string, baseDir: string, rootDir: string): void {
  for (const match of source.matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    const href = match[1];
    const resolved = resolveMarkdownLocalLink(href, baseDir, rootDir);
    if (!resolved) {
      continue;
    }

    assert(
      existsSync(resolved.path),
      `${label} image link ${href} points at missing ${relative(workspaceRoot, resolved.path)}`
    );
  }
}

function requireMarkdownLocalLinksResolve(
  source: string,
  label: string,
  baseDir: string,
  rootDir: string,
  currentFile?: string
): void {
  for (const match of source.matchAll(/(^|[^!])\[[^\]]+]\(([^)\s]+)(?:\s+"[^"]*")?\)/gm)) {
    const href = match[2];
    const resolved = resolveMarkdownLocalLink(href, baseDir, rootDir, currentFile);
    if (!resolved) {
      continue;
    }

    assert(
      existsSync(resolved.path),
      `${label} Markdown link ${href} points at missing ${relative(workspaceRoot, resolved.path)}`
    );
    if (existsSync(resolved.path) && resolved.fragment) {
      requireMarkdownAnchorExists(resolved.path, resolved.fragment, label, href);
    }
  }
}

function resolveMarkdownLocalLink(
  href: string | undefined,
  baseDir: string,
  rootDir: string,
  currentFile?: string
): MarkdownLocalLink | undefined {
  if (!href || /^(?:[a-z][a-z0-9+.-]*:)/i.test(href)) {
    return undefined;
  }

  const [pathOnly = '', fragment] = href.split('#');
  const path = pathOnly.startsWith('/')
    ? join(rootDir, pathOnly.slice(1))
    : pathOnly
      ? join(baseDir, pathOnly)
      : currentFile;
  if (!path) {
    return undefined;
  }
  return {
    path,
    ...(fragment ? { fragment: decodeURIComponent(fragment) } : {}),
  };
}

function requireMarkdownAnchorExists(path: string, fragment: string, label: string, href: string): void {
  if (!path.endsWith('.md')) {
    return;
  }
  const anchors = markdownAnchorsFor(path);
  assert(
    anchors.has(fragment),
    `${label} Markdown link ${href} points at missing anchor #${fragment} in ${relative(workspaceRoot, path)}`
  );
}

function markdownAnchorsFor(path: string): Set<string> {
  const cached = markdownAnchorCache.get(path);
  if (cached) {
    return cached;
  }

  const anchors = new Set<string>();
  const duplicateCounts = new Map<string, number>();
  const source = readFileSync(path, 'utf8');
  for (const match of source.matchAll(/^(#{1,6})\s+(.+?)\s*#*\s*$/gm)) {
    const rawHeading = match[2] ?? '';
    const explicitAnchor = /\s+\{#([A-Za-z0-9_-]+)}$/.exec(rawHeading)?.[1];
    if (explicitAnchor) {
      anchors.add(explicitAnchor);
      continue;
    }

    const baseSlug = markdownHeadingSlug(rawHeading);
    if (!baseSlug) {
      continue;
    }
    const duplicateCount = duplicateCounts.get(baseSlug) ?? 0;
    duplicateCounts.set(baseSlug, duplicateCount + 1);
    anchors.add(duplicateCount === 0 ? baseSlug : `${baseSlug}-${duplicateCount}`);
  }
  markdownAnchorCache.set(path, anchors);
  return anchors;
}

function markdownHeadingSlug(heading: string): string {
  return heading
    .replace(/\s+\{#[A-Za-z0-9_-]+}$/, '')
    .replace(/<[^>]*>/g, '')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function curatedShowcaseArtifactsFromCoverage(): string[] {
  return [...GAMEBOARD_CURATED_SHOWCASE_ARTIFACTS].sort();
}

function requiredBrowserScreenshotArtifactsFromCoverage(): string[] {
  return [...GAMEBOARD_REQUIRED_BROWSER_SCREENSHOT_ARTIFACTS].sort();
}

function isReleaseGateCommand(command: string | undefined): command is (typeof GAMEBOARD_RELEASE_GATE_COMMANDS)[number] {
  return typeof command === 'string' && (GAMEBOARD_RELEASE_GATE_COMMANDS as readonly string[]).includes(command);
}

function requireBrowserScreenshotArtifactsTracked(): void {
  const expected = browserScreenshotArtifactsFromPackageScripts();
  const coverageArtifacts = requiredBrowserScreenshotArtifactsFromCoverage();
  assertEqualList(coverageArtifacts, expected, 'coverage required browser screenshot artifacts');

  const ledgerArtifacts = new Set(
    (releaseReadinessJson.visualArtifacts ?? [])
      .map((artifact) => artifact.path)
      .filter((path): path is string => Boolean(path))
  );
  for (const path of coverageArtifacts) {
    assert(
      ledgerArtifacts.has(path),
      `release-readiness JSON visualArtifacts must include asserted browser screenshot ${path}`
    );
  }
}

function browserScreenshotArtifactsFromPackageScripts(): string[] {
  const paths = new Set<string>();
  for (const scriptName of ['test:screenshots:free', 'test:screenshots:extra', 'test:screenshots:local-assets']) {
    const script = packageJson.scripts?.[scriptName] ?? '';
    assert(
      script.includes('tests/scripts/assert-screenshots.ts'),
      `package ${scriptName} must run tests/scripts/assert-screenshots.ts`
    );
    for (const match of script.matchAll(/tests\/browser\/__screenshots__\/[^\s]+\.png/g)) {
      paths.add(`packages/medieval-hexagon-gameboard/${match[0]}`);
    }
  }
  return [...paths].sort();
}

function requireTypeDocConfiguration(): void {
  assert(
    typedocJson.tsconfig === 'packages/medieval-hexagon-gameboard/tsconfig.json',
    'typedoc must use the package tsconfig so public subpath examples resolve to source before dist exists'
  );
  assert(typedocJson.out === 'docs/api', 'typedoc output must stay in the ignored docs/api directory');
  assertEqualList(
    typedocJson.entryPoints ?? [],
    expectedTypeDocEntryPoints(),
    'typedoc entry points'
  );
  assert(typedocJson.validation?.notExported === true, 'typedoc must validate notExported links');
  assert(typedocJson.validation?.invalidLink === true, 'typedoc must validate invalid links');
  assert(typedocJson.validation?.notDocumented === false, 'typedoc config should leave notDocumented to test:api-docs');
  requireIncludes(apiDocsAuditScript, 'api docs audit script', [
    'assertTypeDocEntryPointsMatchPublicExports',
    'expectedTypeDocEntryPoints',
    'sourcePathForImportTarget',
    'TypeDoc entry points must match public object exports',
  ]);
  requireGeneratedAndLocalOnlyOutputsStayIgnored();
}

function requireGeneratedAndLocalOnlyOutputsStayIgnored(): void {
  for (const outputPath of ignoredUntrackedWorkspacePaths) {
    assertGitOutputEmpty(
      ['ls-files', outputPath.trackedPath],
      `${outputPath.label} must not be committed`
    );
    assertGitCommandSucceeds(
      ['check-ignore', outputPath.checkPath],
      `.gitignore must ignore ${outputPath.label} at ${outputPath.checkPath}`
    );
  }
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
  assertArrayIncludes(packageJson.files, 'LICENSE', 'package files must ship the MIT LICENSE text');
  assertArrayIncludes(packageJson.files, 'NOTICE.md', 'package files must ship KayKit attribution notices');
}

function requirePackageAuditConsumerCoverage(): void {
  requireIncludes(packageAuditScript, 'package audit script', [
    "import ts from 'typescript'",
    'collectConsumerSmokePackageSpecifiers',
    'collectConsumerSmokeSnippetPackageSpecifiers',
    'collectPackageImportSpecifierFromNode',
    'ts.createSourceFile(',
    'ts.SyntaxKind.ImportKeyword',
    'isConsumerSmokeExportCovered(coveredImportPattern, subpath.includes',
  ]);
  assert(
    !packageAuditScript.includes('packedConsumerSmoke.includes(coveredImport)'),
    'package audit must verify packed consumer exports through parsed import specifiers, not raw substring matching'
  );
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

function markdownCodeFences(source: string): MarkdownCodeFence[] {
  const fences: MarkdownCodeFence[] = [];
  const fencePattern = /^```([^\s`]*)[^\n]*\n([\s\S]*?)^```/gm;
  for (const match of source.matchAll(fencePattern)) {
    const language = (match[1] ?? '').toLowerCase();
    const fenceSource = match[2] ?? '';
    const startLine = source.slice(0, match.index).split(/\r?\n/).length + 1;
    fences.push({ language, source: fenceSource, startLine });
  }
  return fences;
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

function readDocsMarkdownPaths(): string[] {
  const docsDir = join(workspaceRoot, 'docs');
  if (!existsSync(docsDir)) {
    failures.push('missing docs');
    return [];
  }
  return collectMarkdownPaths(docsDir, 'docs').sort();
}

function collectMarkdownPaths(root: string, prefix: string): string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'api' || entry.name === '.vitepress') {
      continue;
    }
    const childPath = join(root, entry.name);
    const childPrefix = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      paths.push(...collectMarkdownPaths(childPath, childPrefix));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) {
      paths.push(childPrefix);
    }
  }
  return paths;
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

function assertGitOutputEmpty(args: readonly string[], message: string): void {
  try {
    const output = execFileSync('git', [...args], { cwd: workspaceRoot, encoding: 'utf8' }).trim();
    assert(output.length === 0, `${message}: ${output}`);
  } catch (error) {
    failures.push(`git ${args.join(' ')} failed while checking workspace contract: ${formatError(error)}`);
  }
}

function assertGitCommandSucceeds(args: readonly string[], message: string): void {
  try {
    execFileSync('git', [...args], { cwd: workspaceRoot, encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    failures.push(`${message}: git ${args.join(' ')} failed: ${formatError(error)}`);
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function countReleaseStatus(values: readonly { status?: string }[] | undefined, status: string): number {
  return (values ?? []).filter((value) => value.status === status).length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
