/**
 * Coverage merge (PRD R6).
 *
 * Combines every harness's `coverage/<harness>/coverage-final.json` into
 * a single root `coverage/coverage-final.json` + lcov + summary report.
 * Coverage from unit + browser-free + browser-extra + e2e-local-assets
 * harnesses adds up to the surface ratcheted by A8 (100/100/100/100) and
 * the E0-E10 sub-epic.
 *
 * v8 coverage JSON is shape `{[url]: {url, scriptId, functions: [...]}}`.
 * Merging is by-url union of functions; for the same url across harnesses,
 * any function exercised in any harness counts as covered.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const coverageRoot = join(repoRoot, 'coverage');
const mergedDir = join(coverageRoot, '.merged');

if (!existsSync(coverageRoot)) {
  console.error('coverage merge: no coverage/ directory — run `HEX_WORLDS_COVERAGE=1 pnpm test:coverage` first.');
  process.exit(1);
}

const harnessDirs = readdirSync(coverageRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== '.merged' && !entry.name.startsWith('.'))
  .map((entry) => join(coverageRoot, entry.name));

if (harnessDirs.length === 0) {
  console.error('coverage merge: no harness coverage directories found under coverage/.');
  process.exit(1);
}

mkdirSync(mergedDir, { recursive: true });
const merged = new Map<string, unknown>();

for (const harnessDir of harnessDirs) {
  const final = join(harnessDir, 'coverage-final.json');
  if (!existsSync(final)) {
    console.warn(`coverage merge: ${harnessDir} missing coverage-final.json — skipped.`);
    continue;
  }
  const parsed = JSON.parse(readFileSync(final, 'utf8')) as Record<string, unknown>;
  for (const [url, data] of Object.entries(parsed)) {
    if (!merged.has(url)) {
      merged.set(url, data);
      continue;
    }
    // istanbul-shaped { statementMap, fnMap, branchMap, s, f, b }: sum counters
    const existing = merged.get(url) as Record<string, unknown>;
    const next = data as Record<string, unknown>;
    merged.set(url, mergeIstanbulRecord(existing, next));
  }
}

const mergedFinal = Object.fromEntries(merged);
writeFileSync(join(mergedDir, 'coverage-final.json'), `${JSON.stringify(mergedFinal, null, 2)}\n`, 'utf8');

// Use nyc to render the merged JSON into HTML + lcov + text summary.
try {
  execFileSync(
    'pnpm',
    [
      'exec',
      'nyc',
      'report',
      '--temp-dir',
      mergedDir,
      '--reporter=lcov',
      '--reporter=text-summary',
      '--report-dir',
      join(coverageRoot, 'merged'),
    ],
    { cwd: repoRoot, stdio: 'inherit' }
  );
} catch (error) {
  console.warn(
    `coverage merge: nyc reporter unavailable (${error instanceof Error ? error.message : String(error)}); JSON-only output written to ${mergedDir}.`
  );
}

console.log(`coverage merge: combined ${harnessDirs.length} harness reports into ${mergedDir}/coverage-final.json`);

function mergeIstanbulRecord(
  existing: Record<string, unknown>,
  next: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...existing,
    s: addCounters(existing.s as Record<string, number> | undefined, next.s as Record<string, number> | undefined),
    f: addCounters(existing.f as Record<string, number> | undefined, next.f as Record<string, number> | undefined),
    b: mergeBranchCounters(
      existing.b as Record<string, number[]> | undefined,
      next.b as Record<string, number[]> | undefined
    ),
  };
}

function addCounters(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined
): Record<string, number> {
  const result: Record<string, number> = { ...(a ?? {}) };
  for (const [key, value] of Object.entries(b ?? {})) {
    result[key] = (result[key] ?? 0) + value;
  }
  return result;
}

function mergeBranchCounters(
  a: Record<string, number[]> | undefined,
  b: Record<string, number[]> | undefined
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const key of keys) {
    const left = a?.[key] ?? [];
    const right = b?.[key] ?? [];
    const length = Math.max(left.length, right.length);
    const merged = new Array<number>(length);
    for (let i = 0; i < length; i += 1) {
      merged[i] = (left[i] ?? 0) + (right[i] ?? 0);
    }
    result[key] = merged;
  }
  return result;
}
