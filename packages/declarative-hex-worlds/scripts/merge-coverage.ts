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
import { fileURLToPath } from 'node:url';
import { MERGED_COVERAGE_THRESHOLDS } from '../vitest.coverage.shared';

const repoRoot = resolve(import.meta.dirname, '..');
const coverageRoot = join(repoRoot, 'coverage');
const mergedDir = join(coverageRoot, '.merged');
const enforce = process.env.HEX_WORLDS_COVERAGE_ENFORCE === '1';

export function runCoverageMerge(): void {
  if (!existsSync(coverageRoot)) {
    console.error('coverage merge: no coverage/ directory — run `HEX_WORLDS_COVERAGE=1 pnpm test:coverage` first.');
    process.exit(1);
  }

  const harnessDirs = readdirSync(coverageRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== '.merged' &&
        entry.name !== 'merged' &&
        !entry.name.startsWith('.')
    )
    .sort((left, right) => harnessSortRank(left.name) - harnessSortRank(right.name) || left.name.localeCompare(right.name))
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

  if (enforce) {
    // Diagnostic: before nyc's summary-only threshold check, list the exact
    // uncovered functions/statements/branches per file from the merged tree, so a
    // sub-100 merged gate points at the precise gap instead of just a percentage.
    reportMergedGaps(mergedFinal);
    execFileSync(
      'pnpm',
      [
        'exec',
        'nyc',
        'check-coverage',
        '--temp-dir',
        mergedDir,
        '--statements',
        String(MERGED_COVERAGE_THRESHOLDS.statements),
        '--branches',
        String(MERGED_COVERAGE_THRESHOLDS.branches),
        '--functions',
        String(MERGED_COVERAGE_THRESHOLDS.functions),
        '--lines',
        String(MERGED_COVERAGE_THRESHOLDS.lines),
      ],
      { cwd: repoRoot, stdio: 'inherit' }
    );
  }

  console.log(`coverage merge: combined ${harnessDirs.length} harness reports into ${mergedDir}/coverage-final.json`);
}

/**
 * Print every uncovered function, statement, and branch in the merged tree with
 * its file + line, so a sub-100 merged gate is actionable. Purely diagnostic.
 */
function reportMergedGaps(merged: Record<string, unknown>): void {
  const lines: string[] = [];
  for (const [url, rawRec] of Object.entries(merged)) {
    const rec = rawRec as Record<string, unknown>;
    const rel = url.includes('/src/') ? `src/${url.split('/src/')[1]}` : url;
    const fnMap = (rec.fnMap ?? {}) as Record<string, { name?: string; decl?: { start?: { line?: number } } }>;
    const f = (rec.f ?? {}) as Record<string, number>;
    for (const [id, entry] of Object.entries(fnMap)) {
      if ((f[id] ?? 0) === 0) {
        lines.push(`  fn   ${rel}:${entry.decl?.start?.line ?? '?'} ${entry.name ?? '(anonymous)'}`);
      }
    }
    const statementMap = (rec.statementMap ?? {}) as Record<string, { start?: { line?: number } }>;
    const s = (rec.s ?? {}) as Record<string, number>;
    for (const [id, loc] of Object.entries(statementMap)) {
      if ((s[id] ?? 0) === 0) {
        lines.push(`  stmt ${rel}:${loc.start?.line ?? '?'}`);
      }
    }
    const branchMap = (rec.branchMap ?? {}) as Record<string, { line?: number; loc?: { start?: { line?: number } } }>;
    const b = (rec.b ?? {}) as Record<string, number[]>;
    for (const [id, entry] of Object.entries(branchMap)) {
      const counts = b[id] ?? [];
      if (counts.some((c) => c === 0)) {
        lines.push(`  br   ${rel}:${entry.line ?? entry.loc?.start?.line ?? '?'}`);
      }
    }
  }
  if (lines.length > 0) {
    console.log(`coverage merge: ${lines.length} uncovered element(s) in the merged tree:`);
    console.log(lines.join('\n'));
  }
}

export function mergeIstanbulRecord(
  existing: Record<string, unknown>,
  next: Record<string, unknown>
): Record<string, unknown> {
  const statements = mergeMappedCounters(
    existing.statementMap as Record<string, CoverageLocation> | undefined,
    existing.s as Record<string, number> | undefined,
    next.statementMap as Record<string, CoverageLocation> | undefined,
    next.s as Record<string, number> | undefined,
    locationKey,
    lineLocationKey
  );
  const functions = mergeMappedCounters(
    existing.fnMap as Record<string, FunctionMapEntry> | undefined,
    existing.f as Record<string, number> | undefined,
    next.fnMap as Record<string, FunctionMapEntry> | undefined,
    next.f as Record<string, number> | undefined,
    functionKey,
    functionLineKey
  );
  const branches = mergeBranchCounters(
    existing.branchMap as Record<string, BranchMapEntry> | undefined,
    existing.b as Record<string, number[]> | undefined,
    next.branchMap as Record<string, BranchMapEntry> | undefined,
    next.b as Record<string, number[]> | undefined
  );
  return {
    ...existing,
    statementMap: statements.map,
    fnMap: functions.map,
    branchMap: branches.map,
    s: statements.counts,
    f: functions.counts,
    b: branches.counts,
  };
}

interface CoveragePosition {
  line: number;
  column: number;
}

interface CoverageLocation {
  start: CoveragePosition;
  end: CoveragePosition;
}

interface FunctionMapEntry {
  name?: string;
  decl?: CoverageLocation;
  loc: CoverageLocation;
  line?: number;
}

interface BranchMapEntry {
  type?: string;
  loc: CoverageLocation;
  locations?: CoverageLocation[];
  line?: number;
}

function mergeMappedCounters<T>(
  leftMap: Record<string, T> | undefined,
  leftCounts: Record<string, number> | undefined,
  rightMap: Record<string, T> | undefined,
  rightCounts: Record<string, number> | undefined,
  keyFor: (entry: T) => string,
  fallbackKeyFor?: (entry: T) => string
): { map: Record<string, T>; counts: Record<string, number> } {
  if (!leftMap || !rightMap) {
    return {
      map: { ...(leftMap ?? rightMap ?? {}) },
      counts: addCountersById(leftCounts, rightCounts),
    };
  }
  const map: Record<string, T> = { ...leftMap };
  const counts: Record<string, number> = { ...(leftCounts ?? {}) };
  const idsByLocation = new Map(Object.entries(map).map(([id, entry]) => [keyFor(entry), id]));
  const fallbackIds = fallbackKeyFor ? uniqueEntryIndex(map, fallbackKeyFor) : new Map<string, string>();
  const rightFallbackCounts = fallbackKeyFor ? keyCounts(rightMap, fallbackKeyFor) : new Map<string, number>();
  let nextId = nextCounterId(map);

  for (const [rightId, entry] of Object.entries(rightMap)) {
    const count = rightCounts?.[rightId] ?? 0;
    const key = keyFor(entry);
    let id = idsByLocation.get(key);
    if (!id && fallbackKeyFor) {
      const fallbackKey = fallbackKeyFor(entry);
      if (rightFallbackCounts.get(fallbackKey) === 1) {
        id = fallbackIds.get(fallbackKey);
      }
    }
    if (!id) {
      if (count === 0) {
        continue;
      }
      id = String(nextId);
      nextId += 1;
      map[id] = entry;
      idsByLocation.set(key, id);
    }
    counts[id] = (counts[id] ?? 0) + count;
  }
  return { map, counts };
}

function mergeBranchCounters(
  leftMap: Record<string, BranchMapEntry> | undefined,
  leftCounts: Record<string, number[]> | undefined,
  rightMap: Record<string, BranchMapEntry> | undefined,
  rightCounts: Record<string, number[]> | undefined
): { map: Record<string, BranchMapEntry>; counts: Record<string, number[]> } {
  if (!leftMap || !rightMap) {
    return {
      map: { ...(leftMap ?? rightMap ?? {}) },
      counts: addBranchCountersById(leftCounts, rightCounts),
    };
  }
  const map: Record<string, BranchMapEntry> = { ...leftMap };
  const counts: Record<string, number[]> = { ...(leftCounts ?? {}) };
  const idsByLocation = new Map(Object.entries(map).map(([id, entry]) => [branchKey(entry), id]));
  const fallbackIds = uniqueEntryIndex(map, branchLineKey);
  const rightFallbackCounts = keyCounts(rightMap, branchLineKey);
  let nextId = nextCounterId(map);

  for (const [rightId, entry] of Object.entries(rightMap)) {
    const right = rightCounts?.[rightId] ?? [];
    const key = branchKey(entry);
    let id = idsByLocation.get(key);
    if (!id) {
      const fallbackKey = branchLineKey(entry);
      if (rightFallbackCounts.get(fallbackKey) === 1) {
        id = fallbackIds.get(fallbackKey);
      }
    }
    if (!id) {
      if (right.every((count) => count === 0)) {
        continue;
      }
      id = String(nextId);
      nextId += 1;
      map[id] = entry;
      idsByLocation.set(key, id);
    }
    const left = counts[id] ?? [];
    const length = Math.max(left.length, right.length);
    const merged = new Array<number>(length);
    for (let i = 0; i < length; i += 1) {
      merged[i] = (left[i] ?? 0) + (right[i] ?? 0);
    }
    counts[id] = merged;
  }
  return { map, counts };
}

function addCountersById(
  a: Record<string, number> | undefined,
  b: Record<string, number> | undefined
): Record<string, number> {
  const result: Record<string, number> = { ...(a ?? {}) };
  for (const [key, value] of Object.entries(b ?? {})) {
    result[key] = (result[key] ?? 0) + value;
  }
  return result;
}

function addBranchCountersById(
  a: Record<string, number[]> | undefined,
  b: Record<string, number[]> | undefined
): Record<string, number[]> {
  const result: Record<string, number[]> = {};
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const key of keys) {
    const left = a?.[key] ?? [];
    const right = b?.[key] ?? [];
    result[key] = left.map((value, index) => value + (right[index] ?? 0));
    for (let index = left.length; index < right.length; index += 1) {
      result[key].push(right[index] ?? 0);
    }
  }
  return result;
}

function locationKey(location: CoverageLocation): string {
  return `${location.start.line}:${location.start.column}-${location.end.line}:${location.end.column}`;
}

function lineLocationKey(location: CoverageLocation): string {
  return `${location.start.line}-${location.end.line}`;
}

function functionKey(entry: FunctionMapEntry): string {
  return `${entry.name ?? ''}|${locationKey(entry.decl ?? entry.loc)}|${locationKey(entry.loc)}`;
}

function functionLineKey(entry: FunctionMapEntry): string {
  return `${entry.name ?? ''}|${lineLocationKey(entry.decl ?? entry.loc)}|${lineLocationKey(entry.loc)}`;
}

function branchKey(entry: BranchMapEntry): string {
  return `${entry.type ?? ''}|${locationKey(entry.loc)}|${(entry.locations ?? []).map(locationKey).join(',')}`;
}

function branchLineKey(entry: BranchMapEntry): string {
  return `${entry.type ?? ''}|${lineLocationKey(entry.loc)}|${(entry.locations ?? []).map(lineLocationKey).join(',')}`;
}

function uniqueEntryIndex<T>(
  map: Record<string, T>,
  keyFor: (entry: T) => string
): Map<string, string> {
  const unique = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const [id, entry] of Object.entries(map)) {
    const key = keyFor(entry);
    if (unique.has(key)) {
      unique.delete(key);
      duplicates.add(key);
    } else if (!duplicates.has(key)) {
      unique.set(key, id);
    }
  }
  return unique;
}

function keyCounts<T>(map: Record<string, T>, keyFor: (entry: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of Object.values(map)) {
    const key = keyFor(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function nextCounterId(map: Record<string, unknown>): number {
  return Math.max(-1, ...Object.keys(map).map((key) => Number(key)).filter(Number.isFinite)) + 1;
}

function harnessSortRank(name: string): number {
  if (name === 'unit') {
    return 0;
  }
  return 1;
}

function isDirectRun(argvEntry = process.argv[1], moduleUrl = import.meta.url): boolean {
  return typeof argvEntry === 'string' && resolve(argvEntry) === fileURLToPath(moduleUrl);
}

/* v8 ignore next 3 -- thin executable entrypoint; merge helpers are unit-tested. */
if (isDirectRun()) {
  runCoverageMerge();
}
