import { describe, expect, it } from 'vitest';
import { mergeIstanbulRecord } from '../merge-coverage';

describe('coverage merge helpers', () => {
  it('merges Istanbul counters by source location across mismatched harness ids', () => {
    const lineOne = loc(1);
    const lineTwo = loc(2);
    const lineThree = loc(3);
    const lineFour = loc(4);
    const browserLineOne = loc(1, 2, 9);
    const browserLineTwo = loc(2, 1, 9);
    const browserLineThree = loc(3, 1, 9);
    const merged = mergeIstanbulRecord(
      {
        statementMap: { '0': lineOne, '1': lineTwo },
        fnMap: { '0': { name: 'run', decl: lineOne, loc: lineOne } },
        branchMap: { '0': { type: 'if', loc: lineTwo, locations: [lineTwo, lineThree] } },
        s: { '0': 1, '1': 0 },
        f: { '0': 1 },
        b: { '0': [1, 0] },
      },
      {
        statementMap: { '8': browserLineOne, '9': lineThree, '10': lineFour },
        fnMap: {
          '4': { name: 'run', decl: browserLineOne, loc: browserLineOne },
          '5': { name: 'browserOnly', decl: lineThree, loc: lineThree },
          '6': { name: 'zeroOnly', decl: lineFour, loc: lineFour },
        },
        branchMap: {
          '3': { type: 'if', loc: browserLineTwo, locations: [browserLineTwo, browserLineThree] },
          '4': { type: 'cond-expr', loc: lineThree, locations: [lineThree, lineFour] },
          '5': { type: 'if', loc: lineFour, locations: [lineFour, lineFour] },
        },
        s: { '8': 2, '9': 3, '10': 0 },
        f: { '4': 2, '5': 1, '6': 0 },
        b: { '3': [0, 4], '4': [1, 0], '5': [0, 0] },
      }
    );

    expect(merged.statementMap).toEqual({ '0': lineOne, '1': lineTwo, '2': lineThree });
    expect(merged.s).toEqual({ '0': 3, '1': 0, '2': 3 });
    expect(merged.f).toEqual({ '0': 3, '1': 1 });
    expect(merged.b).toEqual({ '0': [1, 4], '1': [1, 0] });
  });
});

function loc(line: number, startColumn = 0, endColumn = 10) {
  return {
    start: { line, column: startColumn },
    end: { line, column: endColumn },
  };
}
