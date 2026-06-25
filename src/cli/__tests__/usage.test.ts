import { afterEach, describe, expect, it, vi } from 'vitest';
import { HELP_TEXT, usage } from '../usage';

describe('CLI usage help text (E0h)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the hand-curated command and option reference import-covered', () => {
    expect(HELP_TEXT).toContain('declarative-hex-worlds <command> [options]');
    expect(HELP_TEXT).toContain('guide-render-requests');
    expect(HELP_TEXT).toContain('--include-source-formats');
  });

  it('prints help text and exits with the requested code', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(String(message));
    });
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });

    expect(() => usage(2)).toThrow('process.exit 2');
    expect(logs).toEqual([HELP_TEXT]);
  });
});
