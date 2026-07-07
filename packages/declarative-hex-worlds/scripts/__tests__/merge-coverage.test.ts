import { describe, expect, it } from 'vitest';
import { harnessCoverage } from '../../vitest.coverage.shared';
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

describe('browser-free coverage excludes line-drifting game-flow modules', () => {
  // Regression: after simple-rpg-visual.test.ts moved to packages/examples, the
  // browser-free harness still imports these pure-TS modules transitively but only
  // exercises one ternary arm. Vite's browser transform shifts LINE numbers, so
  // the phantom branch record drifts on both column AND line — defeating
  // merge-coverage's branchLineKey line-only fallback (see below) — and the by-url
  // merge keeps a 0-hit arm that fails the 100% branch gate. They must be excluded
  // from BROWSER coverage so only the unit harness's full coverage survives.
  const gameFlowModules = [
    'src/scenario/scenario.ts',
    'src/scenario/recipe.ts',
    'src/simulation/engine.ts',
    'src/commands/commands.ts',
    'src/gameboard/gameboard.ts',
  ];

  it.each(gameFlowModules)('excludes %s from browser-free coverage', (mod) => {
    expect(harnessCoverage('browser-free').exclude).toContain(mod);
  });

  it('keeps these modules IN unit coverage (the unit harness owns them)', () => {
    for (const mod of gameFlowModules) {
      expect(harnessCoverage('unit').exclude).not.toContain(mod);
    }
  });

  it('demonstrates the line+column drift that defeats the merge line-key fallback', () => {
    // A unit branch with BOTH arms covered ([29,70]) plus a browser phantom of the
    // SAME logical ternary but LINE-drifted (Vite preamble) with only one arm hit.
    // Because the line-key differs, the merge cannot unify them and keeps the
    // phantom's 0-arm — proving exclusion (not keying) is the correct fix.
    const unitLoc = loc(647, 22, 40);
    const unitArmA = loc(647, 31, 60);
    const unitArmB = loc(649, 6, 20);
    const browserLoc = loc(654, 25, 43); // +7 lines (Vite injects a preamble)
    const browserArmA = loc(654, 34, 63);
    const browserArmB = loc(656, 9, 23);
    const merged = mergeIstanbulRecord(
      {
        statementMap: {},
        fnMap: {},
        branchMap: { '0': { type: 'cond-expr', loc: unitLoc, locations: [unitArmA, unitArmB] } },
        s: {},
        f: {},
        b: { '0': [29, 70] },
      },
      {
        statementMap: {},
        fnMap: {},
        branchMap: { '3': { type: 'cond-expr', loc: browserLoc, locations: [browserArmA, browserArmB] } },
        s: {},
        f: {},
        b: { '3': [5, 0] }, // browser only hit the truthy arm → phantom 0-arm
      }
    );
    // The phantom did NOT unify with the unit branch; a 0-hit arm is present in the
    // merged tree. This is exactly the state that fails the 100% branch gate and is
    // why the modules are excluded from browser coverage instead.
    const branchArms = Object.values(merged.b as Record<string, number[]>);
    expect(branchArms).toContainEqual([29, 70]); // unit branch preserved
    expect(branchArms.some((arms) => arms.includes(0))).toBe(true); // phantom 0-arm kept
  });
});

function loc(line: number, startColumn = 0, endColumn = 10) {
  return {
    start: { line, column: startColumn },
    end: { line, column: endColumn },
  };
}
