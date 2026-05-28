/**
 * Coverage for the audit-script shared helpers (PRD E0j).
 *
 * `scripts/_lib.ts` defines `workspaceRoot`, `packageRoot`, `readRequired`,
 * and `readJson`. The audit scripts that use these are run as one-shot
 * binaries (so they don't reach unit-coverage), but the helpers themselves
 * are pure-functional and deterministic — straightforward to unit-test.
 *
 * @module
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { packageRoot, readJson, readRequired, workspaceRoot } from '../_lib';

describe('scripts/_lib (PRD E0j)', () => {
  it('workspaceRoot resolves to the repo top, pointing at package.json', () => {
    expect(workspaceRoot).toBe(resolve(import.meta.dirname, '../..'));
  });

  it('packageRoot is an alias for workspaceRoot after R1 de-monorepo', () => {
    expect(packageRoot).toBe(workspaceRoot);
  });

  it('readRequired reads a workspace-relative file as UTF-8 string', () => {
    const contents = readRequired('package.json');
    expect(contents).toContain('"name"');
    expect(typeof contents).toBe('string');
  });

  it('readRequired throws Error when the relative path does not exist', () => {
    expect(() => readRequired('definitely-does-not-exist.txt')).toThrow(
      /Missing required file/
    );
  });

  it('readRequired accepts absolute paths unchanged', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'lib-readrequired-'));
    const tempFile = join(tempDir, 'fixture.txt');
    writeFileSync(tempFile, 'hello-absolute', 'utf8');
    try {
      expect(readRequired(tempFile)).toBe('hello-absolute');
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('readJson parses package.json into a typed object', () => {
    const pkg = readJson<{ name: string }>('package.json');
    expect(pkg.name).toBe('medieval-hexagon-gameboard');
  });

  it('readJson throws SyntaxError for non-JSON file contents', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'lib-readjson-'));
    const tempFile = join(tempDir, 'fixture.txt');
    writeFileSync(tempFile, 'not-json{', 'utf8');
    try {
      expect(() => readJson(tempFile)).toThrow();
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
