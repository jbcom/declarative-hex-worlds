/**
 * Direct-import coverage for the smaller CLI command modules (PRD E0h).
 *
 * The CLI dispatcher (cli.ts) lazy-imports per-subcommand modules; tests
 * that invoke the dispatcher via subprocess (smoke-built-cli.ts) don't
 * register coverage. Direct `import { run } from ...` calls do.
 *
 * Limited to subcommands that:
 *   - Don't require a populated bootstrap-target (so CI without RB-pre
 *     step still runs clean).
 *   - Have side-effects we can capture (console.log mock) + restore.
 *
 * @module
 */

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParsedArgs } from '../_shared';
import { run as runDoctor } from '../commands/doctor';
import { run as runManifest } from '../commands/manifest';
import { run as runValidate } from '../commands/validate';

describe('CLI doctor subcommand (PRD E0h)', () => {
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('reports edition + source + gltf count for a non-existent source', async () => {
    const parsed: ParsedArgs = { command: 'doctor', flags: {} };
    await runDoctor(parsed, '/nonexistent-source-root', 'free');

    const joined = logs.join('\n');
    expect(joined).toMatch(/edition: free/);
    expect(joined).toMatch(/source: \/nonexistent-source-root/);
    expect(joined).toMatch(/source exists: no/);
    expect(joined).toMatch(/gltf count: 0\/221/);
  });
});

const repoRoot = resolve(import.meta.dirname, '../../..');
const referenceFreeRoot = join(repoRoot, 'references/KayKit_Medieval_Hexagon_Pack_1.0_FREE');
const HAS_FREE_REFERENCES = existsSync(referenceFreeRoot);

describe.skipIf(!HAS_FREE_REFERENCES)('CLI validate subcommand (PRD E0h)', () => {
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('confirms the local FREE reference pack has the expected 221 GLTFs', async () => {
    const parsed: ParsedArgs = { command: 'validate', flags: {} };
    await runValidate(parsed, referenceFreeRoot, 'free');
    const joined = logs.join('\n');
    expect(joined).toMatch(/Validated 221 free GLTF files/);
  });
});

describe.skipIf(!HAS_FREE_REFERENCES)('CLI manifest subcommand (PRD E0h)', () => {
  // safeResolveOutput jails --out to cwd subtree (PRD C1), so the test fixture
  // lives under cwd rather than tmpdir.
  const outRelative = `.test-tmp/manifest-${process.pid}.json`;
  const outAbsolute = resolve(repoRoot, outRelative);

  afterAll(() => {
    const dir = resolve(repoRoot, '.test-tmp');
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('emits the FREE manifest to disk when --out is supplied', async () => {
    const parsed: ParsedArgs = {
      command: 'manifest',
      flags: { out: outRelative },
    };
    await runManifest(parsed, referenceFreeRoot, 'free');
    expect(existsSync(outAbsolute)).toBe(true);
    const parsedManifest = JSON.parse(readFileSync(outAbsolute, 'utf8'));
    expect(parsedManifest.edition).toBe('free');
    expect(parsedManifest.counts.total).toBe(221);
  });
});
