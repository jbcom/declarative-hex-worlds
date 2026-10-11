/** Verify the published core entry in a fresh process with runtime peers denied. */
export function corePurityProbeArgs(entry = 'declarative-hex-worlds/core'): string[] {
  const loader = `
export function resolve(specifier, context, nextResolve) {
  if (['koota', 'three', 'react', 'react-dom', '@react-three/fiber'].some(
    peer => specifier === peer || specifier.startsWith(peer + '/')
  )) {
    throw new Error('Core imported runtime peer: ' + specifier);
  }
  return nextResolve(specifier, context);
}`;
  const probe = `
import assert from 'node:assert/strict';
const core = await import(${JSON.stringify(entry)});
const recipe = {
  schemaVersion: '1.0.0',
  options: { seed: 'pure-consumer', shape: { kind: 'rectangle', width: 3, height: 3 } },
  steps: [],
  generation: { layoutFills: [{ archetype: 'tree', assetId: 'tree_single_A', count: 1 }] },
};
assert.throws(() => core.createGameboardPlanFromRecipe(recipe), /require the runtime tier/);
console.log('packed core purity attestation passed');
`;
  return [
    '--loader',
    `data:text/javascript,${encodeURIComponent(loader)}`,
    '--input-type=module',
    '--eval',
    probe,
  ];
}

/** Each runtime entry must initialize generation without another entry helping. */
export function runtimeGenerationProbeArgs(entry: string): string[] {
  return [
    '--input-type=module',
    '--eval',
    `
import assert from 'node:assert/strict';
import { createGameboardPlanFromRecipe } from ${JSON.stringify(entry)};
const plan = createGameboardPlanFromRecipe({
  schemaVersion: '1.0.0',
  options: { seed: 'runtime-consumer', shape: { kind: 'rectangle', width: 3, height: 3 } },
  steps: [],
  generation: { layoutFills: [{ archetype: 'tree', assetId: 'tree_single_A', count: 1 }] },
});
assert.equal(plan.placements.filter(placement => placement.kind === 'decoration').length, 1);
console.log('packed runtime generation attestation passed');
`,
  ];
}
