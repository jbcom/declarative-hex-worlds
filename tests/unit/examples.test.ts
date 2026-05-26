import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createGameboardPlanFromRecipe, type GameboardRecipe } from '../../src/scenario/recipe';
import { validateGameboardPlan } from '../../src/rules/validation';

const testDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(testDir, '../..');
const docsExamplePath = resolve(
  workspaceRoot,
  'docs/examples/generated-piece-scenario.recipe.json'
);
const packageExamplePath = resolve(testDir, '../../examples/generated-piece-scenario.recipe.json');
const docsLocalPieceOverridesPath = resolve(
  workspaceRoot,
  'docs/examples/local-piece-overrides.kenney-castle.json'
);
const docsLocalPieceSourceRootsPath = resolve(
  workspaceRoot,
  'docs/examples/local-piece-source-roots.example.json'
);

// PRD R4: SimpleRPG fixtures moved out of `examples/` into
// `tests/integration/simple-rpg/fixtures/`. The previous SimpleRPG-shape
// assertions live with the integration tests now; this file keeps coverage
// for the *remaining* published `examples/` content + the docs-examples
// payloads consumed by the catalog/doc-site generator.

describe('published recipe examples', () => {
  it('keeps docs and package generated-piece examples identical and valid', () => {
    const docsExample = readFileSync(docsExamplePath, 'utf8');
    const packageExample = readFileSync(packageExamplePath, 'utf8');
    expect(packageExample).toBe(docsExample);

    const recipe = JSON.parse(packageExample) as GameboardRecipe;
    const plan = createGameboardPlanFromRecipe(recipe);
    const generatedPlacements = plan.placements.filter(
      (placement) => placement.metadata.example === 'generated-piece-scenario'
    );

    expect(
      validateGameboardPlan(plan).filter((violation) => violation.severity === 'error')
    ).toEqual([]);
    expect(generatedPlacements).toHaveLength(5);
    expect(generatedPlacements.map((placement) => placement.assetId)).toEqual(
      expect.arrayContaining(['tree_single_A', 'crate_A_small', 'flag_green'])
    );
    expect(
      generatedPlacements.filter(
        (placement) => placement.metadata.exampleArchetype === 'camp-supply'
      )
    ).toHaveLength(2);
  });

  it('keeps the local-pack override example valid for batch piece scans', () => {
    const example = JSON.parse(readFileSync(docsLocalPieceOverridesPath, 'utf8')) as {
      overrides?: Record<string, unknown>;
    };

    expect(Object.keys(example.overrides ?? {})).toEqual([
      'tower-hexagon-base',
      'tower-square-base',
      'tree-large',
    ]);
    expect(example.overrides?.['tower-hexagon-base']).toMatchObject({
      role: 'landmark',
      footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
    });
    expect(example.overrides?.['tree-large']).toMatchObject({
      role: 'tree',
      criteria: { maxPerTile: 3, slotGroup: 'soft-feature' },
    });
  });

  it('documents the local piece source-root map shape used by the CLI and renderers', () => {
    const example = JSON.parse(readFileSync(docsLocalPieceSourceRootsPath, 'utf8')) as {
      sourceRoots?: Record<string, unknown>;
    };

    expect(example.sourceRoots).toMatchObject({
      'Kenney Castle Kit': expect.stringContaining('kenney_castle-kit'),
      'KayKit Adventurers 2.0 FREE': expect.stringContaining('KayKit_Adventurers_2.0_FREE'),
    });
    expect(
      Object.values(example.sourceRoots ?? {}).every((value) => typeof value === 'string')
    ).toBe(true);
  });
});
