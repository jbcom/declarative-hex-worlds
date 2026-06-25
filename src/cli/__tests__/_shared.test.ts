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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assetIdFromPath,
  defaultOutRoot,
  emitOutput,
  formatCounts,
  formatGuideScenarioPages,
  formatShape,
  hasPieceFillFlags,
  isPatrolRouteSet,
  isRecord,
  normalizePieceId,
  pieceFillFromFlags,
  pieceSelectionFromFlags,
  pieceSourceUrlOptionsFromFlags,
  printAnalysis,
  printCompatibility,
  printPieceRegistryAnalysis,
  printSpawnGroupPlan,
  readBoardForwardEdge,
  readCsv,
  readGlbJson,
  readGltfMetadata,
  readGuideAssetIdFilter,
  readGuideScenarioEditionFilter,
  readGuideScenarioPageFilter,
  readGuideUsageCategoryFilter,
  readGuideUsageMinimumEdition,
  readGuideUsageRoleFilter,
  readIntendedRole,
  readJson,
  readModelForward,
  readNumberFlag,
  readPatrolRouteOptions,
  readPieceFillMode,
  readPieceRegistry,
  readPieceRole,
  readPieceSourceRoots,
  readRegistry,
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

describe('shared registry, output, metadata, and print helpers (PRD E0h)', () => {
  it('covers registry validation, output emission, GLTF metadata, and piece flags', () => {
    const dir = mkdtempSync(join(tmpdir(), 'shared-helper-branches-'));
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    const previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = dir;
    try {
      const registryPath = join(dir, 'registry.json');
      const invalidRegistryPath = join(dir, 'invalid-registry.json');
      const pieceRegistryPath = join(dir, 'pieces.json');
      const invalidPieceRegistryPath = join(dir, 'invalid-pieces.json');
      const missingPieceRegistryPath = join(dir, 'missing-pieces.json');
      writeFileSync(registryPath, JSON.stringify([]), 'utf8');
      writeFileSync(invalidRegistryPath, JSON.stringify({ declarations: 'bad' }), 'utf8');
      writeFileSync(pieceRegistryPath, JSON.stringify({ declaration: { id: 'piece-1', assetId: 'asset-1' } }), 'utf8');
      writeFileSync(invalidPieceRegistryPath, JSON.stringify(null), 'utf8');
      writeFileSync(missingPieceRegistryPath, JSON.stringify({ nope: [] }), 'utf8');

      expect(readRegistry(registryPath).declarations).toEqual([]);
      expect(() => readRegistry(invalidRegistryPath)).toThrow(/Registry file/);
      expect(readPieceRegistry(pieceRegistryPath).pieces).toHaveLength(1);
      expect(() => readPieceRegistry(invalidPieceRegistryPath)).toThrow(/Piece registry file/);
      expect(() => readPieceRegistry(missingPieceRegistryPath)).toThrow(/Piece registry file/);

      emitOutput({ out: 'payload.json' }, { ok: true }, 'payload');
      emitOutput({}, { ok: false }, 'payload');
      expect(readJson(join(dir, 'payload.json'))).toEqual({ ok: true });
      expect(logs.join('\n')).toContain('"ok": false');

      const gltfPath = join(dir, 'asset.gltf');
      writeFileSync(
        gltfPath,
        JSON.stringify({ accessors: [{ min: [-1, -2, -3], max: [1, 2, 3] }], animations: [{}, { name: 'walk' }], materials: [{}, { name: 'mat' }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ skin: 0 }], skins: [{}] }),
        'utf8'
      );
      expect(readGltfMetadata(gltfPath)).toMatchObject({
        bounds: { min: [-1, -2, -3], max: [1, 2, 3], size: [2, 4, 6] },
        hasRig: true,
        animationNames: ['animation_0', 'walk'],
        materialSlots: ['material_0', 'mat'],
      });
      expect(() => readGlbJson(gltfPath)).toThrow(/Invalid GLB header/);

      expect(formatCounts({})).toBe('none');
      expect(formatCounts({ a: 2, b: undefined })).toBe('a=2');
      expect(formatShape({ kind: 'hexagon', radius: 3 })).toBe('hexagon radius 3');
      expect(readIntendedRole('tile')).toBe('tile');
      expect(readIntendedRole('other')).toBeUndefined();
      expect(readPieceRole('tree')).toBe('tree');
      expect(readPieceRole('other')).toBeUndefined();
      expect(readPieceFillMode('pool')).toBe('pool');
      expect(readPieceFillMode('other')).toBeUndefined();
      expect(
        pieceSelectionFromFlags({
          ids: 'piece-1,piece-2',
          assetIds: 'asset-1',
          role: 'building',
          roles: 'tree,prop,other',
          sourcePack: 'fixture-pack',
          tags: 'forest',
          excludeTags: 'dead',
          requiresExtra: true,
          freeOnly: true,
        })
      ).toMatchObject({
        ids: ['piece-1', 'piece-2'],
        assetIds: ['asset-1'],
        roles: ['building', 'tree', 'prop'],
        sources: ['fixture-pack'],
        tags: ['forest'],
        excludeTags: ['dead'],
        requiresExtra: false,
      });
      expect(
        pieceFillFromFlags({
          ids: 'piece-1',
          mode: 'pool',
          id: 'fill-1',
          ruleIdPrefix: 'rule',
          count: '2',
          fill: '0.5',
          minCount: '1',
          maxCount: '4',
        })
      ).toMatchObject({
        id: 'fill-1',
        ruleIdPrefix: 'rule',
        mode: 'pool',
        count: 2,
        fill: 0.5,
        minCount: 1,
        maxCount: 4,
      });
      expect(
        pieceSourceUrlOptionsFromFlags({
          pieceSourceRoot: '/assets/default',
          pieceSourceRoots: '{"fixture":"/assets/fixture"}',
          unencodedSourceUrls: true,
        })
      ).toMatchObject({
        sourceRoot: '/assets/default',
        sourceRoots: { fixture: '/assets/fixture' },
        encode: false,
      });
    } finally {
      logSpy.mockRestore();
      if (previousOutRoot === undefined) {
        delete process.env.HEX_WORLDS_OUT_ROOT;
      } else {
        process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
      }
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('covers readable helper reports with warnings, checks, routes, and compatibility errors', () => {
    const logs: string[] = [];
    const logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    try {
      printAnalysis({
        tileCount: 1, analyzedCount: 1, recommendedScale: 1.25, medianWidth: 2, medianDepth: 3, medianHeight: 4, rowSpacing: 5,
        warnings: ['analysis warning'],
      } as never);
      printPieceRegistryAnalysis({
        pieceCount: 1,
        localOnlyCount: 1,
        roleCounts: { tree: 1 },
        sourceCounts: { local: 1 },
        tagCounts: { forest: 1 },
        checks: [{ id: 'check-1', selectedCount: 1, mode: 'all', selectedIds: ['piece-1'] }],
        warnings: ['piece warning'],
        errors: ['piece error'],
      } as never);
      printSpawnGroupPlan({
        seed: 'seed',
        groupCount: 1,
        selectedLocationCount: 1,
        routeChecks: [{ found: true }, { found: false }],
        groups: [
          {
            id: 'group-1',
            selectedCount: 1,
            requestedCount: 2,
            rejectedByGroupDistanceCount: 1,
            locations: [{ key: '0,0' }],
            routeChecks: [
              { toGroupId: 'group-2', found: true, fromKey: '0,0', toKey: '1,0', cost: 1.2345 },
              { toGroupId: 'group-3', found: false },
            ],
            warnings: ['group warning'],
            errors: ['group error'],
          },
        ],
      } as never);
      printCompatibility({
        id: 'asset-1', sourcePack: 'fixture', compatibleAsTile: false, suggestedRole: 'prop',
        placement: { footprint: 'single', scale: 1, modelForward: '+z', boardForwardEdge: 0, rotationSteps: 0, facingErrorRadians: 0 },
        tile: { widthScale: 1, depthScale: 1 },
        warnings: [],
        errors: ['compat error'],
      } as never);
    } finally {
      logSpy.mockRestore();
    }

    const output = logs.join('\n');
    expect(output).toContain('analysis warning');
    expect(output).toContain('pieces: piece-1');
    expect(output).toContain('warning: group warning');
    expect(output).toContain('errors:');
    expect(output).toContain('compat error');
  });
});
