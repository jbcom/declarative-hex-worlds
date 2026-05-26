import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const failures: string[] = [];

const files = {
  automerge: '.github/workflows/automerge.yml',
  cd: '.github/workflows/cd.yml',
  ci: '.github/workflows/ci.yml',
  dependabot: '.github/dependabot.yml',
  release: '.github/workflows/release.yml',
  releasePleaseConfig: 'release-please-config.json',
  releasePleaseManifest: '.release-please-manifest.json',
} as const;

for (const path of Object.values(files)) {
  if (!existsSync(join(workspaceRoot, path))) {
    failures.push(`missing ${path}`);
  }
}

const ci = readRequired(files.ci);
const release = readRequired(files.release);
const cd = readRequired(files.cd);
const automerge = readRequired(files.automerge);
const dependabot = readRequired(files.dependabot);
const releasePleaseConfig = readJson(files.releasePleaseConfig) as {
  packages?: Record<string, { component?: string }>;
};
const releasePleaseManifest = readJson(files.releasePleaseManifest) as Record<string, string>;
const packageJson = readJson('package.json') as {
  engines?: Record<string, string>;
  packageManager?: string;
};

requireIncludes(ci, 'ci.yml', [
  "NODE_VERSION: '22'",
  'pnpm/action-setup',
  "task: [lint, typecheck, build, test, 'test:coverage:enforce']",
  'pnpm test:browser:free',
  'pnpm test:docs-contract && pnpm test:api-docs && pnpm docs:build',
  'pnpm test:assets',
  'pnpm test:workspace',
  'pnpm test:workflows',
  'pnpm test:cli',
  'pnpm expectations',
  'pnpm test:package',
  'pnpm test:consumer',
  'pnpm pack:dry-run',
  'actions/upload-artifact',
  'fail-on-severity: high',
]);
requireExcludes(ci, 'ci.yml', ['continue-on-error: true']);
// Post-PRD-A9: `install` runs once and uploads node_modules as an artifact;
// every downstream job restores via tar. The `package` job's first `run:`
// is the restore step, not `pnpm install`.
requireWorkflowJobRunCommands(ci, files.ci, 'package', [
  'tar --use-compress-program=unzstd -xf node_modules.tar.zst',
  'pnpm audit --prod --audit-level=high',
  'pnpm test:assets',
  'pnpm test:workspace',
  'pnpm test:workflows',
  'pnpm build',
  'pnpm test:cli',
  'pnpm expectations',
  'pnpm test:package',
  'pnpm test:consumer',
  'pnpm pack:dry-run',
]);
requireIncludes(release, 'release.yml', [
  "NODE_VERSION: '22'",
  'pnpm/action-setup',
  'id-token: write',
  'pnpm test:ci',
  'npm publish --access public --provenance',
]);
requireIncludes(cd, 'cd.yml', [
  "NODE_VERSION: '22'",
  'pnpm/action-setup',
  'googleapis/release-please-action',
  'secrets.CI_GITHUB_TOKEN',
  // Post-F-Site-5: replaces the legacy vitepress build with the Astro Starlight
  // build under docs-site/. F-Site-12 removes the vitepress source.
  'pnpm docs-site:build',
  'actions/deploy-pages',
]);
requireIncludes(automerge, 'automerge.yml', [
  "github.actor == 'dependabot[bot]'",
  "github.event.pull_request.user.login == 'dependabot[bot]'",
  'github.event.pull_request.user.type == \'Bot\'',
  'github.event.pull_request.head.repo.full_name == github.repository',
  "startsWith(github.head_ref, 'release-please--')",
  'gh pr review "$PR_URL" --approve',
  'gh pr merge "$PR_URL" --auto --squash',
]);
requireIncludes(dependabot, 'dependabot.yml', [
  'package-ecosystem: "github-actions"',
  'package-ecosystem: "npm"',
  'github-actions-non-major',
  'github-actions-major',
  'npm-non-major',
  'npm-major',
  'update-types: ["minor", "patch"]',
  'update-types: ["major"]',
]);

requirePinnedActions(ci, files.ci);
requirePinnedActions(release, files.release);
requirePinnedActions(cd, files.cd);
requirePinnedActions(automerge, files.automerge);

const releasePackage = releasePleaseConfig.packages?.['.'];
if (releasePackage?.component !== '@jbcom/medieval-hexagon-gameboard') {
  failures.push('release-please config must target @jbcom/medieval-hexagon-gameboard at the root');
}
if (releasePleaseManifest['.'] !== '0.1.0') {
  failures.push('release-please manifest must start "." at 0.1.0');
}
if (packageJson.packageManager !== 'pnpm@9.15.9') {
  failures.push('packageManager must pin pnpm@9.15.9');
}
if (packageJson.engines?.node !== '>=22') {
  failures.push('engines.node must be >=22');
}
if (packageJson.engines?.pnpm !== '>=9') {
  failures.push('engines.pnpm must be >=9');
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`workflow audit: ${failure}`);
  }
  process.exit(1);
}

console.log('workflow audit passed');

function readRequired(path: string): string {
  const resolved = join(workspaceRoot, path);
  if (!existsSync(resolved)) {
    return '';
  }
  return readFileSync(resolved, 'utf8');
}

function readJson(path: string): unknown {
  const source = readRequired(path);
  if (!source) {
    return {};
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    failures.push(`${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function requireIncludes(source: string, label: string, snippets: readonly string[]): void {
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      failures.push(`${label} is missing ${snippet}`);
    }
  }
}

function requireExcludes(source: string, label: string, snippets: readonly string[]): void {
  for (const snippet of snippets) {
    if (source.includes(snippet)) {
      failures.push(`${label} must not include ${snippet}`);
    }
  }
}

function requirePinnedActions(source: string, label: string): void {
  const lines = source.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const match = /^\s*uses:\s*([^ #]+)/.exec(line);
    if (!match) {
      continue;
    }
    const action = match[1] ?? '';
    if (action.startsWith('./')) {
      continue;
    }
    const refIndex = action.lastIndexOf('@');
    if (refIndex === -1) {
      failures.push(`${label}:${index + 1} uses ${action} without a pinned ref`);
      continue;
    }
    const ref = action.slice(refIndex + 1);
    if (!/^[a-f0-9]{40}$/i.test(ref)) {
      failures.push(`${label}:${index + 1} uses ${action} without a full commit SHA`);
    }
  }
}

function requireWorkflowJobRunCommands(
  source: string,
  label: string,
  jobId: string,
  expectedCommands: readonly string[]
): void {
  const block = workflowJobBlock(source, label, jobId);
  if (!block) {
    return;
  }
  const commands = [...block.matchAll(/^\s+run:\s*(.+)$/gm)].map((match) => stripYamlScalar(match[1] ?? ''));
  assertEqualList(commands, expectedCommands, `${label} ${jobId} run command sequence`);
}

function workflowJobBlock(source: string, label: string, jobId: string): string | undefined {
  const startPattern = new RegExp(`^  ${escapeRegExp(jobId)}:\\n`, 'm');
  const match = startPattern.exec(source);
  if (!match) {
    failures.push(`${label} is missing job ${jobId}`);
    return undefined;
  }
  const start = match.index;
  const nextJobPattern = /\n {2}[A-Za-z0-9_-]+:\n/g;
  nextJobPattern.lastIndex = start + match[0].length;
  const next = nextJobPattern.exec(source);
  return source.slice(start, next?.index);
}

function stripYamlScalar(value: string): string {
  const trimmed = value.trim();
  const quote = trimmed[0];
  if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertEqualList(actual: readonly string[], expected: readonly string[], label: string): void {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    failures.push(`${label}: expected ${expected.join(' -> ')}, got ${actual.join(' -> ')}`);
  }
}
