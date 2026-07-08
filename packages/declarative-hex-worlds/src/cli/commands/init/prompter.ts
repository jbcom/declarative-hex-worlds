/**
 * `src/cli/commands/init/prompter.ts` — the tiny prompt surface the interactive
 * `init` wizard drives, plus a zero-dependency `node:readline/promises` adapter.
 *
 * The wizard logic ({@link ./wizard}) never touches a real terminal — it talks to this
 * `Prompter` interface, so it is fully testable with a scripted stub. The RFC's thin,
 * agnostic ethos (no `sharp`/`pngjs` for PNG sizing) applies here too: the human flow
 * needs `select`/`confirm`/`text` prompts, which `node:readline` provides natively — no
 * `@clack`/`prompts`/`inquirer` dependency earns its weight for three primitives.
 *
 * @module
 */
import { createInterface, type Interface } from 'node:readline/promises';
import { GameboardCliError } from '../../../errors';

/** One choice in a {@link Prompter.select} list. */
export interface PrompterChoice<T extends string> {
  /** The value returned when this choice is picked. */
  readonly value: T;
  /** The human-facing label shown in the list. */
  readonly label: string;
  /** Optional one-line hint shown after the label. */
  readonly hint?: string;
}

/**
 * The prompt primitives the wizard needs. An injectable seam: the readline adapter
 * fulfils it against a real TTY; tests fulfil it with a scripted queue of answers.
 */
export interface Prompter {
  /** Print a line of guidance/heading (no input). */
  note(message: string): void;
  /** Free-text input with an optional default (empty input → the default). */
  text(message: string, defaultValue?: string): Promise<string>;
  /** Yes/no, defaulting to `defaultValue` on empty input. */
  confirm(message: string, defaultValue: boolean): Promise<boolean>;
  /** Pick one of `choices`; `defaultValue` (if a valid value) is selected on empty input. */
  select<T extends string>(
    message: string,
    choices: ReadonlyArray<PrompterChoice<T>>,
    defaultValue?: T
  ): Promise<T>;
}

/**
 * A `Prompter` backed by `node:readline/promises` over the given input/output streams
 * (defaulting to `process.stdin`/`process.stdout`). `close()` releases the readline
 * interface — the caller (the `init` command) owns the lifecycle.
 */
export function createReadlinePrompter(
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout
): Prompter & { close(): void } {
  const rl: Interface = createInterface({ input, output });

  // On stdin EOF (Ctrl-D / a closed pipe) `rl.question` neither resolves nor rejects — it
  // would hang the wizard forever, and a re-prompt loop would never exit. Track the close
  // and make any in-flight (or subsequent) question reject with EOF so the flow aborts
  // cleanly instead of wedging the process.
  let closed = false;
  const eofWaiters: Array<() => void> = [];
  rl.on('close', () => {
    closed = true;
    for (const notify of eofWaiters.splice(0)) {
      notify();
    }
  });

  const note = (message: string): void => {
    output.write(`${message}\n`);
  };

  const question = async (prompt: string): Promise<string> => {
    if (closed) {
      throw new GameboardCliError('input closed (EOF) — aborting');
    }
    const eof = new Promise<never>((_res, reject) => {
      eofWaiters.push(() => reject(new GameboardCliError('input closed (EOF) — aborting')));
    });
    return Promise.race([rl.question(prompt), eof]);
  };

  const text = async (message: string, defaultValue?: string): Promise<string> => {
    const suffix = defaultValue ? ` (${defaultValue})` : '';
    const answer = (await question(`${message}${suffix}: `)).trim();
    return answer.length > 0 ? answer : (defaultValue ?? '');
  };

  const confirm = async (message: string, defaultValue: boolean): Promise<boolean> => {
    const hint = defaultValue ? 'Y/n' : 'y/N';
    const answer = (await question(`${message} [${hint}]: `)).trim().toLowerCase();
    if (answer.length === 0) {
      return defaultValue;
    }
    return answer === 'y' || answer === 'yes';
  };

  const select = async <T extends string>(
    message: string,
    choices: ReadonlyArray<PrompterChoice<T>>,
    defaultValue?: T
  ): Promise<T> => {
    const defaultIndex = choices.findIndex((c) => c.value === defaultValue);
    output.write(`${message}\n`);
    choices.forEach((choice, index) => {
      const marker = index === defaultIndex ? '*' : ' ';
      const hint = choice.hint ? `  — ${choice.hint}` : '';
      output.write(` ${marker} ${index + 1}) ${choice.label}${hint}\n`);
    });
    // Loop until a valid 1-based index (or empty → default) is entered.
    for (;;) {
      const fallback = defaultIndex >= 0 ? String(defaultIndex + 1) : undefined;
      const raw = await text('Choose', fallback);
      const picked = Number(raw);
      if (Number.isInteger(picked) && picked >= 1 && picked <= choices.length) {
        // Index checked in range above, so the element is defined.
        return (choices[picked - 1] as PrompterChoice<T>).value;
      }
      output.write(`  Enter a number between 1 and ${choices.length}.\n`);
    }
  };

  return { note, text, confirm, select, close: () => rl.close() };
}
