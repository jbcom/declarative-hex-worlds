import { describe, expect, it } from 'vitest';

describe('Vitest Browser smoke', () => {
  it('runs a browser test', () => {
    expect(window.location.href).toContain('sessionId=');
  });
});
