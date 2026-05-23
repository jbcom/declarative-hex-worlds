import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const workspaceRoot = resolve(import.meta.dirname, '..');
const outDir = mkdtempSync(join(tmpdir(), 'medieval-hexagon-typedoc-audit-'));
const typedocBin = resolve(
  workspaceRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'typedoc.cmd' : 'typedoc'
);
const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR;

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
