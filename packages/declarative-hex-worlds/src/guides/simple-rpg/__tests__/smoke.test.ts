import { describe, expect, it } from 'vitest';
import type { GameboardPlan } from 'declarative-hex-worlds';
import {
  countSimpleRpgErrorViolations,
  selectSimpleRpgSmokePlanTile,
  simpleRpgLayoutFillRuleId,
} from '../smoke';

describe('SimpleRPG executable guide smoke helpers', () => {
  it('selects the origin tile when available and otherwise falls back to the first tile', () => {
    const planWithOrigin = {
      tiles: [{ key: '1,0' }, { key: '0,0' }],
    } as unknown as Pick<GameboardPlan, 'tiles'>;
    const planWithoutOrigin = {
      tiles: [{ key: '1,0' }, { key: '2,0' }],
    } as unknown as Pick<GameboardPlan, 'tiles'>;

    expect(selectSimpleRpgSmokePlanTile(planWithOrigin).key).toBe('0,0');
    expect(selectSimpleRpgSmokePlanTile(planWithoutOrigin).key).toBe('1,0');
  });

  it('fails closed when the smoke plan has no tiles', () => {
    const emptyPlan = { tiles: [] } as unknown as Pick<GameboardPlan, 'tiles'>;

    expect(() => selectSimpleRpgSmokePlanTile(emptyPlan)).toThrow(
      'SimpleRPG executable smoke requires at least one plan tile'
    );
  });

  it('counts only error-severity recipe violations', () => {
    expect(
      countSimpleRpgErrorViolations([
        { severity: 'warning' },
        { severity: 'error' },
        { severity: 'info' },
        { severity: 'error' },
      ])
    ).toBe(2);
  });

  it('uses the authored layout fill rule id and falls back to the piece id', () => {
    expect(simpleRpgLayoutFillRuleId({ id: 'rule-1' }, { id: 'piece-1' })).toBe('rule-1');
    expect(simpleRpgLayoutFillRuleId({}, { id: 'piece-1' })).toBe('piece-1');
  });
});
