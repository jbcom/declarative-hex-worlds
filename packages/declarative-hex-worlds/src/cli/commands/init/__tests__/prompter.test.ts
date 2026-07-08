import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { createReadlinePrompter } from '../prompter';

/**
 * Drive the readline prompter over in-memory streams. `feed` queues the lines the "user"
 * types (one per prompt); `output` accumulates everything written. The readline interface
 * consumes a line per `question`, so we push each answer as the prompter asks.
 */
function harness() {
  const input = new PassThrough();
  const output = new PassThrough();
  let out = '';
  output.on('data', (c: Buffer) => {
    out += c.toString();
  });
  const prompter = createReadlinePrompter(input, output);
  return {
    prompter,
    output: () => out,
    type: (line: string) => input.write(`${line}\n`),
    // End the input stream — the readline interface emits 'close' (EOF / Ctrl-D).
    close: () => input.end(),
  };
}

describe('createReadlinePrompter', () => {
  it('rejects a pending question on stdin EOF instead of hanging', async () => {
    const h = harness();
    const pending = h.prompter.text('Name');
    // Close the input stream (EOF / Ctrl-D) — the question must reject, not hang forever.
    h.close();
    await expect(pending).rejects.toThrow(/EOF/);
  });

  it('rejects a fresh question issued after the stream already closed', async () => {
    const h = harness();
    h.close();
    // Give the close event a tick to flip the closed flag.
    await new Promise((r) => setTimeout(r, 0));
    await expect(h.prompter.text('Name')).rejects.toThrow(/EOF/);
  });

  it('note() writes a line', () => {
    const h = harness();
    h.prompter.note('hello');
    h.prompter.close();
    expect(h.output()).toContain('hello');
  });

  it('text() returns the typed value, or the default on empty input', async () => {
    const h = harness();
    const typed = h.prompter.text('Name', 'def');
    h.type('custom');
    expect(await typed).toBe('custom');

    const empty = h.prompter.text('Name', 'def');
    h.type('');
    expect(await empty).toBe('def');
    h.prompter.close();
  });

  it('text() returns empty string when no default and empty input', async () => {
    const h = harness();
    const empty = h.prompter.text('Name');
    h.type('');
    expect(await empty).toBe('');
    h.prompter.close();
  });

  it('confirm() reads y/yes/n and honours the default on empty input', async () => {
    const h = harness();
    const yes = h.prompter.confirm('OK?', false);
    h.type('y');
    expect(await yes).toBe(true);

    const no = h.prompter.confirm('OK?', true);
    h.type('n');
    expect(await no).toBe(false);

    const def = h.prompter.confirm('OK?', true);
    h.type('');
    expect(await def).toBe(true);
    h.prompter.close();
  });

  it('select() returns the value at the typed 1-based index', async () => {
    const h = harness();
    const pick = h.prompter.select(
      'Pick',
      [
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana', hint: 'yellow' },
      ],
      'a'
    );
    h.type('2');
    expect(await pick).toBe('b');
    expect(h.output()).toContain('Banana');
    expect(h.output()).toContain('yellow');
    h.prompter.close();
  });

  it('select() re-prompts on an out-of-range index, then accepts a valid one', async () => {
    const h = harness();
    const pick = h.prompter.select(
      'Pick',
      [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
      'b'
    );
    // An invalid index (9) → re-prompt; then a valid index (2) → 'b'. Feed the second
    // line only after the first has been consumed + the re-prompt printed, so readline
    // sees two distinct lines (a synchronous double-write can coalesce).
    h.type('9');
    await vi.waitFor(() => expect(h.output()).toContain('between 1 and 2'));
    h.type('2');
    expect(await pick).toBe('b');
    h.prompter.close();
  });

  it('select() with no default has no pre-fill — an empty entry re-prompts', async () => {
    const h = harness();
    const pick = h.prompter.select('Pick', [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ]);
    // No default → empty input can't resolve; it re-prompts until a valid index.
    h.type('');
    await vi.waitFor(() => expect(h.output()).toContain('between 1 and 2'));
    h.type('1');
    expect(await pick).toBe('a');
    h.prompter.close();
  });

  it('select() honours the default on empty input', async () => {
    const h = harness();
    const pick = h.prompter.select(
      'Pick',
      [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
      'b'
    );
    h.type('');
    expect(await pick).toBe('b');
    h.prompter.close();
  });
});
