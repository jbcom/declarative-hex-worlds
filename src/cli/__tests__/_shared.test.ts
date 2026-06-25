/**
 * Coverage gap closure for the pure helpers exported from `src/cli/_shared.ts`
 * that do not require a populated FREE references tree (PRD E0h).
 *
 * The big `runXxx` orchestrators in this file each pull in dozens of helper
 * graph nodes through their happy-path execution; testing those requires
 * fixture scenarios + a FREE bootstrap-target. The small standalone helpers
 * (`relativizePath`, `defaultOutRoot`, `safeResolveOutput`, `formatBytes`,
 * `readJson`, `detectDefaultBootstrapOut`) are pure and trivially testable.
 *
 * @module
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assetIdFromPath,
  defaultOutRoot,
  formatGuideScenarioPages,
  hasPieceFillFlags,
  isPatrolRouteSet,
  isRecord,
  normalizePieceId,
  readBoardForwardEdge,
  readCsv,
  readGuideAssetIdFilter,
  readGuideScenarioEditionFilter,
  readGuideScenarioPageFilter,
  readGuideUsageCategoryFilter,
  readGuideUsageMinimumEdition,
  readGuideUsageRoleFilter,
  readJson,
  readModelForward,
  readNumberFlag,
  readPatrolRouteOptions,
  readPieceSourceRoots,
  readSimulationScript,
  readSpawnGroupOptions,
  relativizePath,
  safeResolveOutput,
  round,
  uniqueRoles,
  uniqueStrings,
} from '../_shared';
import { detectDefaultBootstrapOut, formatBytes } from '../commands/bootstrap';
import { listKayKitGuideRoleCoverages } from '../../scenario';

describe('relativizePath (PRD E0h)', () => {
  it('returns "." when the path is the cwd itself', () => {
    expect(relativizePath(process.cwd())).toBe('.');
  });

  it('returns a relative path for a child of cwd', () => {
    const childAbsolute = join(process.cwd(), 'tests/unit');
    const rel = relativizePath(childAbsolute);
    expect(rel).toBe('tests/unit');
  });

  it('returns the original value for paths above cwd', () => {
    // /tmp is outside the cwd subtree; the function should return the
    // original to avoid printing `../../../...` paths.
    const outside = '/tmp';
    expect(relativizePath(outside)).toBe(outside);
  });

  it('returns the input unchanged for empty or non-string input', () => {
    expect(relativizePath('')).toBe('');
    // biome-ignore lint/suspicious/noExplicitAny: deliberate non-string
    expect(relativizePath(null as any)).toBe('null');
  });
});

describe('defaultOutRoot (PRD E0h)', () => {
  const originalEnv = process.env.HEX_WORLDS_OUT_ROOT;

  beforeEach(() => {
    delete process.env.HEX_WORLDS_OUT_ROOT;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.HEX_WORLDS_OUT_ROOT = originalEnv;
    }
  });

  it('returns process.cwd() when the env override is unset', () => {
    expect(defaultOutRoot()).toBe(process.cwd());
  });

  it('returns the env override resolved to absolute when set', () => {
    process.env.HEX_WORLDS_OUT_ROOT = '/tmp/widget';
    expect(defaultOutRoot()).toBe(resolve('/tmp/widget'));
  });
});

describe('safeResolveOutput (PRD C1 / E0h)', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'safe-resolve-'));

  afterEach(() => {
    // Clean up tempRoot after the suite (single mkdtemp lives for all tests).
  });

  it('resolves a relative path inside the jail root', () => {
    expect(safeResolveOutput('foo.json', tempRoot)).toBe(join(tempRoot, 'foo.json'));
  });

  it('resolves a nested relative path inside the jail root', () => {
    expect(safeResolveOutput('subdir/nested.json', tempRoot)).toBe(
      join(tempRoot, 'subdir/nested.json')
    );
  });

  it('throws when the resolved path escapes via .. segments', () => {
    expect(() => safeResolveOutput('../../../etc/passwd', tempRoot)).toThrow();
  });

  it('throws when an absolute path points outside the jail root', () => {
    expect(() => safeResolveOutput('/etc/passwd', tempRoot)).toThrow();
  });
});

describe('formatBytes (PRD E0h)', () => {
  it('formats bytes under 1024 as plain B', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats KiB with one decimal', () => {
    expect(formatBytes(1024)).toBe('1.0 KiB');
    expect(formatBytes(1536)).toBe('1.5 KiB');
  });

  it('formats MiB with two decimals', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MiB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MiB');
  });
});

describe('readJson (PRD E0h)', () => {
  it('parses a JSON file at the supplied absolute path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'shared-readjson-'));
    const path = join(dir, 'fixture.json');
    writeFileSync(path, JSON.stringify({ hello: 'world', n: 42 }), 'utf8');
    try {
      const obj = readJson(path) as { hello: string; n: number };
      expect(obj.hello).toBe('world');
      expect(obj.n).toBe(42);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('detectDefaultBootstrapOut (PRD E0h)', () => {
  it('returns a string path (cwd-dependent default)', () => {
    const out = detectDefaultBootstrapOut();
    // Depending on the cwd this is either an existing public/assets/models
    // or one of the conventional defaults. Just assert the shape.
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});

describe('guide filter helpers (PRD E0h)', () => {
  it('parses CSV filters and rejects invalid guide values', () => {
    expect(readGuideScenarioPageFilter('2, 4')).toEqual([2, 4]);
    expect(readGuideScenarioEditionFilter('free, mixed')).toEqual(['free', 'mixed']);
    expect(
      readGuideAssetIdFilter({
        command: 'guide-usage',
        flags: { assetId: 'castle,tree', assetIds: 'tree,road' },
      })
    ).toEqual(['castle', 'road', 'tree']);
    expect(readGuideUsageMinimumEdition(undefined)).toBe('all');
    expect(readGuideUsageMinimumEdition('extra')).toBe('extra');
    expect(readGuideUsageCategoryFilter('tiles, units')).toEqual(['tiles', 'units']);
    const firstRole = listKayKitGuideRoleCoverages()[0]?.role;
    expect(firstRole).toBeDefined();
    expect(readGuideUsageRoleFilter(firstRole)).toEqual([firstRole]);
    expect(formatGuideScenarioPages([])).toBe('none');
    expect(formatGuideScenarioPages([3, 1, 2])).toBe('1-3');
    expect(formatGuideScenarioPages([3, 1, 5])).toBe('1,3,5');

    expect(() => readGuideScenarioPageFilter('0')).toThrow(/one-based/);
    expect(() => readGuideScenarioEditionFilter('paid')).toThrow(/editionScope/);
    expect(() => readGuideUsageMinimumEdition('paid')).toThrow(/minimumEdition/);
    expect(() => readGuideUsageCategoryFilter('terrain')).toThrow(/category/);
    expect(() => readGuideUsageRoleFilter('not-a-role')).toThrow(/known guide asset role/);
  });
});

describe('authored option readers (PRD E0h)', () => {
  it('accepts array and object forms for simulation, spawn, and patrol inputs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'shared-authored-'));
    const scriptArrayPath = join(dir, 'script-array.json');
    const scriptObjectPath = join(dir, 'script-object.json');
    const groupsPath = join(dir, 'groups.json');
    const routesPath = join(dir, 'routes.json');
    const invalidPath = join(dir, 'invalid.json');
    try {
      writeFileSync(scriptArrayPath, JSON.stringify([{ action: 'wait', ticks: 1 }]), 'utf8');
      writeFileSync(scriptObjectPath, JSON.stringify({ steps: [{ action: 'wait' }] }), 'utf8');
      writeFileSync(
        groupsPath,
        JSON.stringify({ seed: 'file-seed', profile: { minDistance: 2 }, groups: [{ id: 'g1' }] }),
        'utf8'
      );
      writeFileSync(
        routesPath,
        JSON.stringify({
          seed: 'route-seed',
          profile: { maxCost: 9 },
          routeProfile: { loop: true },
          routes: [{ id: 'r1' }],
        }),
        'utf8'
      );
      writeFileSync(invalidPath, JSON.stringify({ nope: [] }), 'utf8');

      expect(readSimulationScript(scriptArrayPath)).toMatchObject({ schemaVersion: '1.0.0' });
      expect(readSimulationScript(scriptObjectPath).steps).toEqual([{ action: 'wait' }]);
      expect(readSpawnGroupOptions(groupsPath, 'override')).toMatchObject({
        seed: 'override',
        profile: { minDistance: 2 },
        groups: [{ id: 'g1' }],
      });
      expect(readPatrolRouteOptions(routesPath, false)).toMatchObject({
        seed: 'route-seed',
        profile: { maxCost: 9 },
        routeProfile: { loop: true },
        routes: [{ id: 'r1' }],
      });

      expect(() => readSimulationScript(invalidPath)).toThrow(/Simulation script/);
      expect(() => readSpawnGroupOptions(invalidPath, undefined)).toThrow(/Spawn group file/);
      expect(() => readPatrolRouteOptions(invalidPath, undefined)).toThrow(/Patrol route file/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('piece source root parsing (PRD E0h)', () => {
  it('returns null-prototype roots from inline and file JSON', () => {
    const inline = readPieceSourceRoots('{"free":"/packs/free","extra":"/packs/extra"}');
    expect(Object.getPrototypeOf(inline)).toBeNull();
    expect(inline).toEqual({ free: '/packs/free', extra: '/packs/extra' });

    const dir = mkdtempSync(join(tmpdir(), 'shared-roots-'));
    const path = join(dir, 'roots.json');
    try {
      writeFileSync(path, JSON.stringify({ sourceRoots: { local_1: '/packs/local' } }), 'utf8');
      expect(readPieceSourceRoots(path)).toEqual({ local_1: '/packs/local' });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects malformed or unsafe piece source root payloads', () => {
    expect(() => readPieceSourceRoots('[]')).toThrow(/must be a JSON object/);
    expect(() => readPieceSourceRoots('{"bad key":"/x"}')).toThrow(/must match/);
    expect(() => readPieceSourceRoots('{"free":42}')).toThrow(/must be a string/);
    expect(() => readPieceSourceRoots('{"__proto__":"/x"}')).toThrow(/prototype pollution/);
  });
});

describe('scalar CLI helpers (PRD E0h)', () => {
  it('normalizes simple parser and formatter edge cases', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([['a', 1]])).toBe(false);
    expect(isPatrolRouteSet({ routes: [{ id: 'r1', waypoints: [], segments: [] }] })).toBe(true);
    expect(isPatrolRouteSet({ routes: [{ id: 'r1', waypoints: [] }] })).toBe(false);
    expect(uniqueRoles(['tree', undefined, 'tree', 'custom'])).toEqual(['tree', 'custom']);
    expect(readNumberFlag('3.5')).toBe(3.5);
    expect(readNumberFlag(true)).toBeUndefined();
    expect(readModelForward('-x')).toBe('-x');
    expect(readModelForward(undefined)).toBeUndefined();
    expect(readBoardForwardEdge('5')).toBe(5);
    expect(readBoardForwardEdge(false)).toBeUndefined();
    expect(hasPieceFillFlags({ ids: 'a' })).toBe(true);
    expect(hasPieceFillFlags({ out: 'x' })).toBe(false);
    expect(readCsv(' a, ,b ')).toEqual(['a', 'b']);
    expect(uniqueStrings(['b', 'a', 'b'])).toEqual(['a', 'b']);
    expect(normalizePieceId('  Fancy Piece! 01  ')).toBe('Fancy-Piece-01');
    expect(assetIdFromPath('/tmp/models/castle.GLB')).toBe('castle');
    expect(assetIdFromPath(false)).toBe('false');
    expect(round(1.23456)).toBe(1.235);

    expect(() => readNumberFlag('nope')).toThrow(/numeric flag/);
    expect(() => readModelForward('north')).toThrow(/modelForward/);
    expect(() => readBoardForwardEdge('6')).toThrow(/boardForwardEdge/);
  });
});
