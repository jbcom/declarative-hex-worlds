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
  defaultOutRoot,
  detectDefaultBootstrapOut,
  formatBytes,
  readJson,
  relativizePath,
  safeResolveOutput,
} from '../_shared';

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
  const originalEnv = process.env.MEDIEVAL_HEXAGON_OUT_ROOT;

  beforeEach(() => {
    delete process.env.MEDIEVAL_HEXAGON_OUT_ROOT;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.MEDIEVAL_HEXAGON_OUT_ROOT = originalEnv;
    }
  });

  it('returns process.cwd() when the env override is unset', () => {
    expect(defaultOutRoot()).toBe(process.cwd());
  });

  it('returns the env override resolved to absolute when set', () => {
    process.env.MEDIEVAL_HEXAGON_OUT_ROOT = '/tmp/widget';
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
      const obj = readJson<{ hello: string; n: number }>(path);
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
