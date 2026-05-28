import { describe, expect, it } from 'vitest';
import {
  errorMessage,
  includesString,
  isHexCoordinatesInput,
  isNonEmptyString,
  isRecord,
} from '../predicates';

describe('internal predicates', () => {
  it('includesString narrows correctly', () => {
    const set = ['alpha', 'beta', 'gamma'] as const;
    expect(includesString(set, 'beta')).toBe(true);
    expect(includesString(set, 'delta')).toBe(false);
    expect(includesString(set, 17)).toBe(false);
  });

  it('isNonEmptyString rejects empty/whitespace/non-string inputs', () => {
    expect(isNonEmptyString('hi')).toBe(true);
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('   ')).toBe(false);
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
  });

  it('isRecord rejects arrays and primitives', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
  });

  it('errorMessage extracts string from Error and falls back for non-Errors', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(123)).toBe('123');
    expect(errorMessage({ foo: 'bar' })).toContain('[object');
  });

  it('isHexCoordinatesInput accepts {q, r} numbers and rejects partial inputs', () => {
    expect(isHexCoordinatesInput({ q: 0, r: 0 })).toBe(true);
    expect(isHexCoordinatesInput({ q: 1, r: 2 })).toBe(true);
    expect(isHexCoordinatesInput({ q: 1 })).toBe(false);
    expect(isHexCoordinatesInput({ q: '1', r: '2' })).toBe(false);
    expect(isHexCoordinatesInput(null)).toBe(false);
  });
});
