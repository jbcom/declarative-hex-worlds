import { describe, expect, it } from 'vitest';
import {
  GameboardCliError,
  GameboardError,
  GameboardIoError,
  GameboardManifestError,
  GameboardRuntimeError,
  GameboardScenarioError,
  GameboardValidationError,
} from '../index';

type Subclass = {
  name: string;
  factory: (message: string, options?: { cause?: unknown }) => GameboardError;
};

const subclasses: readonly Subclass[] = [
  {
    name: 'GameboardValidationError',
    factory: (message, options) => new GameboardValidationError(message, options),
  },
  {
    name: 'GameboardManifestError',
    factory: (message, options) => new GameboardManifestError(message, options),
  },
  {
    name: 'GameboardScenarioError',
    factory: (message, options) => new GameboardScenarioError(message, options),
  },
  {
    name: 'GameboardRuntimeError',
    factory: (message, options) => new GameboardRuntimeError(message, options),
  },
  {
    name: 'GameboardCliError',
    factory: (message, options) => new GameboardCliError(message, options),
  },
  {
    name: 'GameboardIoError',
    factory: (message, options) => new GameboardIoError(message, options),
  },
];

describe('GameboardError base', () => {
  it('extends the built-in Error', () => {
    const error = new GameboardError('something broke');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(GameboardError);
  });

  it('sets name to the constructor name and preserves the message', () => {
    const error = new GameboardError('boom');
    expect(error.name).toBe('GameboardError');
    expect(error.message).toBe('boom');
  });

  it('preserves a cause when provided', () => {
    const cause = new Error('root cause');
    const error = new GameboardError('wrapper', { cause });
    expect(error.cause).toBe(cause);
  });

  it('leaves cause undefined when not provided', () => {
    const error = new GameboardError('no cause');
    expect(error.cause).toBeUndefined();
  });
});

describe.each(subclasses)('$name', ({ name, factory }) => {
  it('extends GameboardError and Error', () => {
    const error = factory('subclass message');
    expect(error).toBeInstanceOf(GameboardError);
    expect(error).toBeInstanceOf(Error);
  });

  it(`reports name === '${name}'`, () => {
    expect(factory('m').name).toBe(name);
  });

  it('preserves the message verbatim', () => {
    const message = 'a precise message with formatted detail (id=42, count=3)';
    expect(factory(message).message).toBe(message);
  });

  it('preserves a cause from options', () => {
    const cause = { kind: 'root-cause' };
    const error = factory('wrapped', { cause });
    expect(error.cause).toBe(cause);
  });

  it('produces a useful stack trace', () => {
    const error = factory('boom');
    expect(typeof error.stack).toBe('string');
    expect(error.stack ?? '').toContain(name);
  });
});

describe('discrimination across subclasses', () => {
  it('does not cross-pollute instanceof checks between sibling subclasses', () => {
    const validation = new GameboardValidationError('v');
    expect(validation).toBeInstanceOf(GameboardValidationError);
    expect(validation).not.toBeInstanceOf(GameboardManifestError);
    expect(validation).not.toBeInstanceOf(GameboardScenarioError);
    expect(validation).not.toBeInstanceOf(GameboardRuntimeError);
    expect(validation).not.toBeInstanceOf(GameboardCliError);
    expect(validation).not.toBeInstanceOf(GameboardIoError);
  });

  it('lets consumers branch via instanceof on the base class', () => {
    const errors: Error[] = [
      new GameboardValidationError('v'),
      new GameboardManifestError('m'),
      new GameboardScenarioError('s'),
      new GameboardRuntimeError('r'),
      new GameboardCliError('c'),
      new GameboardIoError('i'),
    ];
    for (const error of errors) {
      expect(error instanceof GameboardError).toBe(true);
    }
  });
});
