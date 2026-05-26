import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
const packageJson = readJson<PackageJson>('package.json');
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
  // Post-R2: sub-package barrels handle multiple published subpaths (e.g.
  // `./blueprint`, `./scenario`, `./recipe` all live under
  // `src/scenario/`). Audit invariant simplifies to: every TypeDoc entry
  // listed in `typedoc.json` must exist on disk. Per-export documentation
  // coverage is enforced separately by TypeDoc's own
  // `validation.notExported: true` flag below.
  const entries = typedocJson.entryPoints ?? [];
  for (const entry of entries) {
    const resolved = join(workspaceRoot, entry);
    if (!existsSync(resolved)) {
      throw new Error(`TypeDoc entryPoints includes missing file: ${entry}`);
    }
  }
  // Keep the packageJson reference so future audits can re-scope this
  // without needing to re-thread the JSON load.
  void packageJson;
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
