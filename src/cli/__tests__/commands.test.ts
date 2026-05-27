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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ParsedArgs } from '../_shared';
import { run as runDoctor } from '../commands/doctor';

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
