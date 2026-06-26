import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run as runAnalyzeLayout } from '../commands/analyze-layout';
import { run as runCompatibility } from '../commands/compatibility';
import { run as runDeclarations } from '../commands/declarations';
import { run as runDoctor } from '../commands/doctor';
import { run as runExtract } from '../commands/extract';
import { run as runGuideApis } from '../commands/guide-apis';
import { run as runGuideAssets } from '../commands/guide-assets';
import { run as runGuideRoles } from '../commands/guide-roles';
import { run as runGuideUsages } from '../commands/guide-usages';
import { run as runPatrolRoutes } from '../commands/patrol-routes';
import { run as runPiece } from '../commands/piece';
import { run as runPieces } from '../commands/pieces';
import { run as runPlacePiece } from '../commands/place-piece';
import { run as runSimulateScenario } from '../commands/simulate-scenario';
import { run as runSummarizePlan } from '../commands/summarize-plan';
import { run as runValidateManifest } from '../commands/validate-manifest';
import { run as runValidatePlan } from '../commands/validate-plan';
import { run as runValidateRecipe } from '../commands/validate-recipe';
import type { GameboardPlan } from '../../gameboard';

describe('remaining CLI branch gaps (PRD E0a/E0h)', () => {
  let root: string;
  let previousOutRoot: string | undefined;
  let logs: string[];
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'hex-worlds-cli-gaps-'));
    previousOutRoot = process.env.HEX_WORLDS_OUT_ROOT;
    process.env.HEX_WORLDS_OUT_ROOT = root;
    logs = [];
    logSpy = vi.spyOn(console, 'log').mockImplementation((message: unknown) => {
      logs.push(typeof message === 'string' ? message : String(message));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
    if (previousOutRoot === undefined) {
      delete process.env.HEX_WORLDS_OUT_ROOT;
    } else {
      process.env.HEX_WORLDS_OUT_ROOT = previousOutRoot;
    }
    rmSync(root, { recursive: true, force: true });
  });

  it('prints readable guide summaries and exits on missing catalog assets', async () => {
    await runGuideApis({ command: 'guide-apis', flags: {} }, '/missing-source', 'free');
    await runGuideRoles({ command: 'guide-roles', flags: {} }, '/missing-source', 'free');
    await runGuideUsages({ command: 'guide-usages', flags: {} }, '/missing-source', 'free');
    await runGuideUsages({ command: 'guide-usages', flags: { editionScope: 'free', json: true } }, '/missing-source', 'free');
    await runGuideUsages({ command: 'guide-usages', flags: { assetId: 'barrel' } }, '/missing-source', 'free');
    await expect(
      runGuideUsages({ command: 'guide-usages', flags: { page: '9999' } }, '/missing-source', 'free')
    ).rejects.toThrow(/guide-usages selection did not match/);

    const manifestPath = writeJson('empty-manifest.json', emptyManifest());
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    try {
      await expect(
        runGuideUsages(
          { command: 'guide-usages', flags: { manifest: manifestPath, role: 'prop' } },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }

    const joined = logs.join('\n');
    expect(joined).toContain('guide public APIs:');
    expect(joined).toContain('guide public roles:');
    expect(joined).toContain('guide usage rows:');
    expect(joined).toMatch(/\.\.\.[0-9]+ more/);
    expect(joined).toContain('missing assets:');
    expect(joined).toContain('  - ');
  });

  it('covers guide-assets selected payload and empty filter branches', async () => {
    await runGuideAssets(
      {
        command: 'guide-assets',
        flags: {
          assetId: 'barrel',
          scenarioId: 'page-02-buildings-props-and-factions',
          page: '2',
          editionScope: 'free',
          publicApi: 'GameboardBuilder.addProp',
          role: 'prop',
          json: true,
        },
      },
      '/missing-source',
      'free'
    );
    const payload = JSON.parse(logs.at(-1) ?? '{}') as {
      count: number;
      selected?: { assetId: string };
      selection: { assetIds: string[]; pages: number[]; roles: string[] };
    };
    expect(payload.count).toBe(1);
    expect(payload.selected?.assetId).toBe('barrel');
    expect(payload.selection).toMatchObject({
      assetIds: ['barrel'],
      pages: [2],
      roles: ['prop'],
    });

    logs.length = 0;
    await runGuideAssets(
      { command: 'guide-assets', flags: { assetId: 'barrel', out: 'guide-assets.json' } },
      '/missing-source',
      'free'
    );
    expect(logs.join('\n')).toContain('Wrote 1 guide asset coverages to');

    logs.length = 0;
    await runGuideAssets({ command: 'guide-assets', flags: { role: 'prop' } }, '/missing-source', 'free');
    expect(logs.join('\n')).toContain('guide assets:');
    expect(logs.join('\n')).toMatch(/\.\.\.[0-9]+ more/);
    logs.length = 0;
    await runGuideAssets({ command: 'guide-assets', flags: { assetId: 'barrel' } }, '/missing-source', 'free');
    expect(logs.join('\n')).toContain('barrel: prop');

    const expectNoGuideAssetMatch = async (flags: Record<string, string>): Promise<void> => {
      await expect(
        runGuideAssets({ command: 'guide-assets', flags }, '/missing-source', 'free')
      ).rejects.toThrow(/guide-assets selection did not match/);
    };
    await expectNoGuideAssetMatch({ assetId: 'missing-asset' });
    await expectNoGuideAssetMatch({ scenarioId: 'missing-scenario' });
    await expectNoGuideAssetMatch({ page: '9999' });
    await expectNoGuideAssetMatch({ editionScope: 'reference' });
    await expectNoGuideAssetMatch({ publicApi: 'missingApi' });
    await expectNoGuideAssetMatch({ role: 'missing-role' });
  });

  it('covers source-root success and validation exit paths', async () => {
    const sourceRoot = writeSyntheticSourceRoot('source-root');
    await runDoctor({ command: 'doctor', flags: {} }, sourceRoot, 'free');
    await runExtract({ command: 'extract', flags: { out: 'extract-out', force: true } }, sourceRoot, 'free');
    await runDeclarations({ command: 'declarations', flags: {} }, sourceRoot, 'free');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    try {
      await expect(
        runCompatibility(
          {
            command: 'compatibility',
            flags: { asset: writeGltf('flat.gltf', [0, 0, 0], [0, 0.5, 0]), id: 'flat' },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      await expect(
        runValidatePlan(
          {
            command: 'validate-plan',
            flags: { plan: writeJson('invalid-plan.json', invalidPlan()), allowUnknownAssets: true },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      await expect(
        runValidateRecipe(
          {
            command: 'validate-recipe',
            flags: { recipe: writeJson('invalid-recipe.json', invalidRecipe()) },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      await expect(
        runValidateManifest(
          { command: 'validate-manifest', flags: { manifest: writeJson('invalid-manifest.json', []) } },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }

    expect(logs.join('\n')).toContain('Extracted 1 free assets to');
  });

  it('covers patrol-routes validation, spawn, JSON, scenario, and error exits', async () => {
    const planPath = writeJson('patrol.plan.json', patrolPlan());
    const routesPath = writeJson('patrol.routes.json', {
      seed: 'file-seed',
      routes: [{ id: 'watch', count: 2, start: '0,0', loop: false }],
    });

    await expect(
      runPatrolRoutes({ command: 'patrol-routes', flags: { plan: planPath } }, '/missing-source', 'free')
    ).rejects.toThrow(/requires --routes/);
    await expect(
      runPatrolRoutes(
        { command: 'patrol-routes', flags: { scenario: writeJson('patrol.bad-scenario.json', []) } },
        '/missing-source',
        'free'
      )
    ).rejects.toThrow(/must be a JSON object/);

    logs.length = 0;
    await runPatrolRoutes(
      { command: 'patrol-routes', flags: { plan: planPath, routes: routesPath, json: true } },
      '/missing-source',
      'free'
    );
    expect(JSON.parse(logs.at(-1) ?? '{}')).toMatchObject({
      seed: 'file-seed',
      routeCount: 1,
      errors: [],
    });
    logs.length = 0;
    await runPatrolRoutes(
      { command: 'patrol-routes', flags: { plan: planPath, routes: routesPath, out: 'patrol.out.json' } },
      '/missing-source',
      'free'
    );
    expect(logs.join('\n')).toContain('Wrote patrol route plan to');

    const scenarioPath = writeJson('patrol.scenario.json', {
      schemaVersion: '1.0.0',
      board: {
        schemaVersion: '1.0.0',
        options: { seed: 'scenario-plan-seed', shape: { kind: 'rectangle', width: 2, height: 1 } },
        steps: [],
      },
      patrolRoutes: [{ id: 'scenario-watch', count: 2, start: '0,0', loop: false }],
    });
    logs.length = 0;
    await runPatrolRoutes(
      { command: 'patrol-routes', flags: { scenario: scenarioPath, json: true } },
      '/missing-source',
      'free'
    );
    expect(JSON.parse(logs.at(-1) ?? '{}')).toMatchObject({
      seed: 'scenario-plan-seed:patrol-routes',
    });
    logs.length = 0;
    await runPatrolRoutes(
      { command: 'patrol-routes', flags: { scenario: scenarioPath, seed: 'override-seed', json: true } },
      '/missing-source',
      'free'
    );
    expect(JSON.parse(logs.at(-1) ?? '{}')).toMatchObject({ seed: 'override-seed' });

    const invalidPlanPath = writeJson('patrol.invalid-plan.json', invalidPlan());
    const badGroupsPath = writeJson('patrol.bad-groups.json', [{ id: 'party', count: 3 }]);
    const badRoutesPath = writeJson('patrol.bad-routes.json', {
      routes: [{ id: 'bad-watch', count: 1, start: '0,0' }],
    });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    try {
      await expect(
        runPatrolRoutes(
          { command: 'patrol-routes', flags: { plan: invalidPlanPath, routes: routesPath } },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      await expect(
        runPatrolRoutes(
          { command: 'patrol-routes', flags: { plan: planPath, routes: routesPath, groups: badGroupsPath } },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      await expect(
        runPatrolRoutes(
          { command: 'patrol-routes', flags: { plan: planPath, routes: badRoutesPath } },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }

    const joined = logs.join('\n');
    expect(joined).toContain('validation: 1 error(s), 0 warning(s)');
    expect(joined).toContain('groups: 1');
    expect(joined).toContain('error: Spawn group party selected 2/3 requested location(s)');
    expect(joined).toContain('error: Patrol route bad-watch requires at least 2 waypoints');
  });

  it('covers place-piece validation, selection, output, and readable exits', async () => {
    const planPath = writeJson('piece.plan.json', patrolPlan());
    const registryPath = writeJson('pieces.json', pieceRegistry());

    await expect(
      runPlacePiece(
        { command: 'place-piece', flags: { pieces: registryPath } },
        '/missing-source',
        'free'
      )
    ).rejects.toThrow(/requires exactly one/);
    await expect(
      runPlacePiece(
        {
          command: 'place-piece',
          flags: {
            plan: planPath,
            recipe: writeJson('piece.recipe.json', invalidRecipe()),
            pieces: registryPath,
          },
        },
        '/missing-source',
        'free'
      )
    ).rejects.toThrow(/requires exactly one/);
    await expect(
      runPlacePiece(
        { command: 'place-piece', flags: { plan: planPath } },
        '/missing-source',
        'free'
      )
    ).rejects.toThrow(/requires --pieces/);
    await expect(
      runPlacePiece(
        {
          command: 'place-piece',
          flags: { plan: planPath, pieces: registryPath, pieceId: 'missing-piece' },
        },
        '/missing-source',
        'free'
      )
    ).rejects.toThrow(/matched no pieces/);
    await expect(
      runPlacePiece(
        { command: 'place-piece', flags: { plan: planPath, pieces: registryPath } },
        '/missing-source',
        'free'
      )
    ).rejects.toThrow(/matched 3 pieces/);

    await runPlacePiece(
      {
        command: 'place-piece',
        flags: {
          plan: planPath,
          pieces: registryPath,
          pieceId: 'prop-crate',
          count: '2',
          seed: 'crate-seed',
          idPrefix: 'placed-crate',
          json: true,
        },
      },
      '/missing-source',
      'free'
    );
    const payload = JSON.parse(logs.at(-1) ?? '{}') as {
      pieceId: string;
      placements: Array<{ id: string }>;
    };
    expect(payload.pieceId).toBe('prop-crate');
    expect(payload.placements.map((placement) => placement.id)).toEqual([
      'placed-crate:0',
      'placed-crate:1',
    ]);

    logs.length = 0;
    await runPlacePiece(
      {
        command: 'place-piece',
        flags: {
          plan: planPath,
          pieces: registryPath,
          assetId: 'fixture:crate',
          out: 'piece-inspection.json',
          outPlan: 'piece-plan.json',
        },
      },
      '/missing-source',
      'free'
    );
    expect(logs.join('\n')).toContain('Wrote placed GameboardPlan to');
    expect(logs.join('\n')).toContain('Wrote piece placement inspection to');

    logs.length = 0;
    await runPlacePiece(
      {
        command: 'place-piece',
        flags: { plan: planPath, pieces: registryPath, id: 'prop-crate', minCount: '1' },
      },
      '/missing-source',
      'free'
    );
    expect(logs.join('\n')).toContain('piece: prop-crate');
    expect(logs.join('\n')).toContain('placement tiles:');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    try {
      await expect(
        runPlacePiece(
          {
            command: 'place-piece',
            flags: {
              plan: writeJson('piece.invalid-plan.json', invalidPlan()),
              pieces: registryPath,
              pieceId: 'prop-crate',
            },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      await expect(
        runPlacePiece(
          {
            command: 'place-piece',
            flags: {
              plan: planPath,
              pieces: registryPath,
              pieceId: 'blocked-crate',
              minCount: '1',
            },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }
  });

  it('covers piece defaults, stdout output, and report exit branches', async () => {
    await expect(
      runPiece({ command: 'piece', flags: {} }, '/missing-source', 'free')
    ).rejects.toThrow(/piece requires --asset/);

    await runPiece(
      {
        command: 'piece',
        flags: { asset: writeGltf('piece-default.gltf', [-0.2, 0, -0.2], [0.2, 0.5, 0.2]) },
      },
      '/missing-source',
      'free'
    );
    const declaration = JSON.parse(logs.at(-1) ?? '{}') as {
      id: string;
      assetId: string;
      source: string;
      tags: string[];
    };
    expect(declaration).toMatchObject({
      id: 'piece-default',
      assetId: 'piece-default',
      source: 'external',
      tags: [],
    });
    expect(declaration).not.toHaveProperty('declaration');

    logs.length = 0;
    await runPiece(
      {
        command: 'piece',
        flags: {
          asset: writeGltf('piece-out.gltf', [-0.2, 0, -0.2], [0.2, 0.5, 0.2]),
          id: 'fixture:piece-out',
          pieceId: 'fixture-piece:piece-out',
          sourcePack: 'fixture-pack',
          creator: 'Fixture Creator',
          license: 'CC0-1.0',
          role: 'prop',
          tags: 'fixture,piece',
          includeReport: true,
          out: 'piece-out.json',
        },
      },
      '/missing-source',
      'free'
    );
    expect(logs.join('\n')).toContain('Wrote piece declaration to');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    try {
      await expect(
        runPiece(
          {
            command: 'piece',
            flags: {
              asset: writeGltf('piece-warning.gltf', [-0.1, 0, -0.4], [0.1, 0.5, 0.4]),
              failOnWarning: true,
            },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');

      await expect(
        runPiece(
          {
            command: 'piece',
            flags: { asset: writeGltf('piece-error.gltf', [0, 0, 0], [0, 0.5, 0]) },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }
  });

  it('covers pieces validation, payload variants, and exit branches', async () => {
    const planPath = writeJson('pieces.plan.json', patrolPlan());
    const registryPath = writeJson('pieces.registry.json', pieceRegistry());

    await expect(
      runPieces({ command: 'pieces', flags: {} }, '/missing-source', 'free')
    ).rejects.toThrow(/pieces requires --pieces/);
    await expect(
      runPieces(
        {
          command: 'pieces',
          flags: { pieces: registryPath, plan: planPath, recipe: writeJson('pieces.recipe.json', validRecipe()) },
        },
        '/missing-source',
        'free'
      )
    ).rejects.toThrow(/requires exactly one/);

    await runPieces(
      {
        command: 'pieces',
        flags: {
          pieces: registryPath,
          plan: planPath,
          ids: 'prop-crate',
          emitRules: true,
          emitSourceUrls: true,
          pieceSourceRoot: '/assets/pieces',
          outPlan: 'pieces.placed-plan.json',
          json: true,
        },
      },
      '/missing-source',
      'free'
    );
    expect(logs.join('\n')).toContain('Wrote piece-filled GameboardPlan to');
    const payload = JSON.parse(logs.at(-1) ?? '{}') as {
      rules?: unknown[];
      sourceUrls?: Record<string, string>;
      placementInspection?: { selectedPieceCount: number };
    };
    expect(payload.rules).toHaveLength(1);
    expect(payload.sourceUrls).toEqual({});
    expect(payload.placementInspection?.selectedPieceCount).toBe(1);

    logs.length = 0;
    await runPieces(
      { command: 'pieces', flags: { pieces: registryPath, ids: 'prop-crate', emitRules: true } },
      '/missing-source',
      'free'
    );
    expect(JSON.parse(logs.at(-1) ?? '{}')).toMatchObject({ rules: [{ id: 'piece:prop-crate' }] });

    logs.length = 0;
    await runPieces(
      { command: 'pieces', flags: { pieces: registryPath, out: 'pieces.analysis.json' } },
      '/missing-source',
      'free'
    );
    expect(logs.join('\n')).toContain('Wrote piece registry output to');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    try {
      await expect(
        runPieces(
          {
            command: 'pieces',
            flags: {
              pieces: writeJson('pieces.incompatible-registry.json', incompatiblePieceRegistry()),
              ids: 'pool-crate,pool-tree',
              mode: 'pool',
            },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');

      await expect(
        runPieces(
          {
            command: 'pieces',
            flags: { pieces: writeJson('pieces.empty-registry.json', { pieces: [] }), failOnWarning: true },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');

      await expect(
        runPieces(
          {
            command: 'pieces',
            flags: {
              pieces: registryPath,
              plan: planPath,
              ids: 'prop-crate',
              count: '1',
              maxCount: '0',
              failOnWarning: true,
            },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }
  });

  it('covers analyze-layout rule parsing, output modes, and exit branches', async () => {
    const planPath = writeJson('layout.plan.json', patrolPlan());
    const validRulesPath = writeJson('layout.rules.json', {
      seed: 'file-layout-seed',
      rules: [{ id: 'crate-fill', archetype: 'prop', assetId: 'fixture:crate', count: 1 }],
    });

    await expect(
      runAnalyzeLayout({ command: 'analyze-layout', flags: {} }, '/missing-source', 'free')
    ).rejects.toThrow(/requires exactly one/);
    await expect(
      runAnalyzeLayout(
        { command: 'analyze-layout', flags: { plan: planPath } },
        '/missing-source',
        'free'
      )
    ).rejects.toThrow(/requires --rules/);
    await expect(
      runAnalyzeLayout(
        {
          command: 'analyze-layout',
          flags: { plan: planPath, rules: writeJson('layout.invalid-rules.json', {}) },
        },
        '/missing-source',
        'free'
      )
    ).rejects.toThrow(/must be a rule array/);

    await runAnalyzeLayout(
      {
        command: 'analyze-layout',
        flags: { plan: planPath, rules: validRulesPath, seed: 'cli-layout-seed', json: true },
      },
      '/missing-source',
      'free'
    );
    expect(JSON.parse(logs.at(-1) ?? '{}')).toMatchObject({
      seed: 'cli-layout-seed',
      placementCount: 1,
      errorCount: 0,
    });

    logs.length = 0;
    await runAnalyzeLayout(
      {
        command: 'analyze-layout',
        flags: {
          plan: planPath,
          rules: validRulesPath,
          out: 'layout-analysis.json',
          outPlan: 'layout-plan.json',
        },
      },
      '/missing-source',
      'free'
    );
    expect(logs.join('\n')).toContain('Wrote compiled GameboardPlan to');
    expect(logs.join('\n')).toContain('Wrote layout analysis to');

    const arrayRulesPath = writeJson('layout.array-rules.json', [
      { id: 'selected-prop', archetype: 'prop', assetId: 'fixture:prop', count: 1 },
      {
        id: 'water-prop',
        archetype: 'prop',
        assetId: 'fixture:water-prop',
        count: 1,
        criteria: { terrain: ['water'] },
      },
      { id: 'missing-asset', archetype: 'prop', count: 1 },
    ]);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    try {
      logs.length = 0;
      await expect(
        runAnalyzeLayout(
          { command: 'analyze-layout', flags: { plan: planPath, rules: arrayRulesPath } },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      expect(logs.join('\n')).toContain('layout seed: patrol-command:layout-fill');
      expect(logs.join('\n')).toContain('rejected tiles:');
      expect(logs.join('\n')).toContain('assets: fixture:prop');
      expect(logs.join('\n')).toContain('selected tiles:');
      expect(logs.join('\n')).toContain('warning: Layout fill rule water-prop matched no candidate sites');
      expect(logs.join('\n')).toContain('error: Layout fill rule missing-asset requires assetId or assets');

      logs.length = 0;
      await expect(
        runAnalyzeLayout(
          {
            command: 'analyze-layout',
            flags: {
              plan: planPath,
              rules: writeJson('layout.warning-rules.json', {
                rules: [{ id: 'overflow-prop', archetype: 'prop', assetId: 'fixture:prop', count: 3, maxCount: 1 }],
              }),
              failOnWarning: true,
              json: true,
            },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
      expect(JSON.parse(logs.at(-1) ?? '{}')).toMatchObject({
        errorCount: 0,
        warningCount: 1,
      });

      await expect(
        runAnalyzeLayout(
          {
            command: 'analyze-layout',
            flags: { plan: writeJson('layout.invalid-plan.json', invalidPlan()), rules: validRulesPath },
          },
          '/missing-source',
          'free'
        )
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }
  });

  it('covers summarize-plan input variants, readable fallbacks, and warning exits', async () => {
    const summarize = (flags: Record<string, string | boolean>): Promise<void> =>
      runSummarizePlan({ command: 'summarize-plan', flags }, '/missing-source', 'free');
    const expectRejects = async (
      flags: Record<string, string | boolean>,
      expected: string | RegExp
    ): Promise<void> => {
      await expect(summarize(flags)).rejects.toThrow(expected);
    };
    const planPath = writeJson('summary.plan.json', patrolPlan());

    await expectRejects({}, /requires exactly one/);
    await expectRejects({ plan: writeJson('summary.bad-plan.json', []) }, /must be a JSON object/);
    await expectRejects({ recipe: writeJson('summary.bad-recipe-shape.json', []) }, /must be a JSON object/);
    await expectRejects({ scenario: writeJson('summary.bad-scenario-shape.json', []) }, /must be a JSON object/);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    try {
      await expectRejects({ recipe: writeJson('summary.invalid-recipe.json', invalidRecipe()) }, 'process.exit 1');
      await expectRejects(
        { recipe: writeJson('summary.invalid-recipe-allowed.json', invalidRecipe()), allowInvalid: true },
        /did not compile to a GameboardPlan/
      );
      await expectRejects({ scenario: writeJson('summary.invalid-scenario.json', invalidScenario()) }, 'process.exit 1');
      await expectRejects(
        { scenario: writeJson('summary.invalid-scenario-allowed.json', invalidScenario()), allowInvalid: true },
        /did not compile to a GameboardPlan/
      );
      await expectRejects({ plan: writeJson('summary.invalid-plan.json', invalidPlan()) }, 'process.exit 1');

      logs.length = 0;
      await expectRejects(
        { plan: writeJson('summary.warning-plan.json', warningPlan()), failOnWarning: true },
        'process.exit 1'
      );
      expect(logs.join('\n')).toContain('validation: 0 error(s), 1 warning(s)');
    } finally {
      exitSpy.mockRestore();
    }

    logs.length = 0;
    await summarize({ plan: planPath, outPlan: 'summary.out-plan.json', out: 'summary.out.json', topAssetLimit: '0' });
    expect(logs.join('\n')).toContain('Wrote compiled GameboardPlan to');
    expect(logs.join('\n')).toContain('Wrote plan summary to');

    logs.length = 0;
    await summarize({ recipe: writeJson('summary.valid-recipe.json', validRecipe()), json: true });
    expect(JSON.parse(logs.at(-1) ?? '{}')).toMatchObject({
      source: { kind: 'recipe' },
      validation: { errorCount: 0 },
    });

    logs.length = 0;
    await summarize({ scenario: writeJson('summary.valid-scenario.json', validScenario()), json: true });
    expect(JSON.parse(logs.at(-1) ?? '{}')).toMatchObject({
      source: { kind: 'scenario' },
      validation: { errorCount: 0 },
    });

    logs.length = 0;
    await summarize({ plan: writeJson('summary.extra-plan.json', extraPlacementPlan()) });
    expect(logs.join('\n')).toContain('extra assets: fixture:extra-prop');
    expect(logs.join('\n')).toContain('top assets: fixture:extra-prop*=1, fixture:free-prop=1');

    logs.length = 0;
    await summarize({
      config: writeJson('summary.blueprint-config.json', {
        options: { seed: 'summary-config-seed', shape: { kind: 'rectangle', width: 1, height: 1 } },
      }),
      json: true,
    });
    expect(JSON.parse(logs.at(-1) ?? '{}')).toMatchObject({
      source: { kind: 'blueprint' },
      summary: { seed: 'summary-config-seed' },
    });

    logs.length = 0;
    await summarize({
      blueprint: writeJson('summary.blueprint.json', {
        options: { seed: 'summary-blueprint-seed', shape: { kind: 'rectangle', width: 1, height: 1 } },
      }),
      json: true,
    });
    expect(JSON.parse(logs.at(-1) ?? '{}')).toMatchObject({
      source: { kind: 'blueprint' },
      summary: { seed: 'summary-blueprint-seed' },
    });
  });

  it('covers simulate-scenario validation, JSON, expectation, and blocked-quest exits', async () => {
    const simulate = (flags: Record<string, string | boolean>): Promise<void> =>
      runSimulateScenario({ command: 'simulate-scenario', flags }, '/missing-source', 'free');
    const scenarioPath = writeJson('simulation.scenario.json', blockedQuestScenario());
    const emptyScriptPath = writeJson('simulation.empty-script.json', simulationScript([]));

    await expect(simulate({})).rejects.toThrow(/requires --scenario/);
    await expect(simulate({ scenario: scenarioPath })).rejects.toThrow(/requires --script/);
    await expect(
      simulate({ scenario: writeJson('simulation.bad-scenario-shape.json', []), script: emptyScriptPath })
    ).rejects.toThrow(/must be a JSON object/);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit ${code}`);
    });
    try {
      await expect(
        simulate({
          scenario: writeJson('simulation.invalid-scenario.json', invalidScenario()),
          script: emptyScriptPath,
        })
      ).rejects.toThrow('process.exit 1');

      logs.length = 0;
      await expect(
        simulate({
          scenario: scenarioPath,
          script: writeJson(
            'simulation.failing-script.json',
            blockedQuestScript({ expectedQuestStatus: 'completed' })
          ),
          json: true,
        })
      ).rejects.toThrow('process.exit 1');
      expect(logs.join('\n')).toContain('"success": false');
      expect(logs.join('\n')).toContain('expectation failures:');

      logs.length = 0;
      await expect(
        simulate({
          scenario: scenarioPath,
          script: writeJson(
            'simulation.failing-readable-script.json',
            blockedQuestScript({ expectedQuestStatus: 'completed' })
          ),
        })
      ).rejects.toThrow('process.exit 1');
      expect(logs.join('\n')).toContain('success: no');
      expect(logs.join('\n')).toContain('expectation failures:');

      await expect(
        simulate({
          scenario: scenarioPath,
          script: writeJson(
            'simulation.blocked-script.json',
            blockedQuestScript({ expectedQuestStatus: 'blocked' })
          ),
          failOnBlockedQuest: true,
        })
      ).rejects.toThrow('process.exit 1');
    } finally {
      exitSpy.mockRestore();
    }

    logs.length = 0;
    await simulate({
      scenario: scenarioPath,
      script: writeJson('simulation.readable-script.json', readableSimulationScript()),
      allowInvalid: true,
    });
    expect(logs.join('\n')).toContain('step 0: unknown source found 0/0 reachable; nearest none; no command');
    expect(logs.join('\n')).toContain('actor-removed: ghost not applied');
    expect(logs.join('\n')).toContain('placement-removed: missing-placement not applied');

    logs.length = 0;
    await simulate({
      scenario: scenarioPath,
      script: writeJson(
        'simulation.json-script.json',
        blockedQuestScript({ expectedQuestStatus: 'blocked' })
      ),
      json: true,
      allowExpectationFailures: true,
    });
    expect(JSON.parse(logs.at(-1) ?? '{}')).toMatchObject({
      scenarioId: 'simulation-blocked-quest',
      success: true,
      quests: [{ questId: 'blocked-expectation', status: 'blocked' }],
    });
  });

  function writeSyntheticSourceRoot(name: string): string {
    writeGltf(`${name}/Assets/gltf/tiles/hex_fixture.gltf`, [-0.5, 0, -0.5], [0.5, 0.25, 0.5]);
    return resolve(root, name);
  }

  function writeGltf(
    relativePath: string,
    min: [number, number, number],
    max: [number, number, number]
  ): string {
    return writeJson(relativePath, { asset: { version: '2.0' }, accessors: [{ min, max }], buffers: [{ uri: 'fixture.bin', byteLength: 0 }], materials: [{ name: 'fixture_material' }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }] });
  }

  function writeJson(name: string, payload: unknown): string {
    const path = resolve(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return path;
  }

  function emptyManifest(): unknown {
    return {
      schemaVersion: '1.0.0',
      edition: 'free',
      sourcePack: { name: 'Fixture', version: '1.0.0', creator: 'Fixture', license: 'CC0-1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', sourceRootName: 'fixture', edition: 'free' },
      textureSets: [],
      assets: [],
      assetsById: {},
      counts: { total: 0, byCategory: {}, bySubcategory: {} },
    };
  }

  function invalidPlan(): unknown {
    return {
      schemaVersion: '1.0.0',
      seed: 'invalid-plan',
      shape: { kind: 'rectangle', width: 1, height: 1 },
      textureSet: 'default',
      tiles: [{
        key: '0,0',
        coordinates: { q: 0, r: 0 },
        terrain: 'grass',
        textureSet: 'default',
        elevation: 5,
        baseAssetId: 'hex_grass',
        supportAssetId: 'hex_grass',
        roadEdges: 0,
        riverEdges: 0,
        coastEdges: 0,
        riverWaterless: false,
        riverCurvy: false,
        coastWaterless: false,
        tags: [],
      }],
      placements: [],
      warnings: [],
    };
  }

  function invalidRecipe(): unknown {
    return {
      schemaVersion: '1.0.0',
      options: { seed: 'bad-recipe', shape: { kind: 'rectangle', width: 1, height: 1 } },
      steps: [{ action: 'setTerrain', at: { q: 3, r: 0 }, terrain: 'water' }],
    };
  }

  function validRecipe(seed = 'summary-recipe'): unknown {
    return {
      schemaVersion: '1.0.0',
      options: { seed, shape: { kind: 'rectangle', width: 1, height: 1 } },
      steps: [],
    };
  }

  function validScenario(): unknown {
    return {
      schemaVersion: '1.0.0',
      id: 'summary-scenario',
      board: validRecipe('summary-scenario-board'),
    };
  }

  function blockedQuestScenario(): unknown {
    return {
      schemaVersion: '1.0.0',
      id: 'simulation-blocked-quest',
      board: validRecipe('simulation-blocked-quest'),
      actors: [
        { actorId: 'hero', actorKind: 'player', at: '0,0', assetId: 'flag_blue', kind: 'unit' },
        { actorId: 'cache', actorKind: 'prop', at: '0,0', assetId: 'crate_A_small', kind: 'prop' },
      ],
      quests: [
        {
          id: 'blocked-expectation',
          objectives: [
            {
              id: 'cache-should-block',
              kind: 'collision',
              actor: 'hero',
              targetActor: 'cache',
              expect: 'blocked',
            },
          ],
        },
      ],
    };
  }

  function simulationScript(
    steps: readonly unknown[],
    expectations?: Record<string, unknown>
  ): unknown {
    return {
      schemaVersion: '1.0.0',
      steps,
      ...(expectations ? { expectations } : {}),
    };
  }

  function blockedQuestScript(options: { expectedQuestStatus: 'blocked' | 'completed' }): unknown {
    return simulationScript(
      [{ action: 'run-systems', id: 'advance-quest', systems: { movement: false, patrols: false, quests: { step: 1 } } }],
      { quests: [{ questId: 'blocked-expectation', status: options.expectedQuestStatus }] }
    );
  }

  function readableSimulationScript(): unknown {
    return simulationScript([
      { action: 'inspect-actor-targets', sourceActor: 'missing-actor' },
      { action: 'remove-actor', id: 'remove-missing-actor', actorId: 'ghost', systems: false },
      {
        action: 'remove-placement',
        id: 'remove-missing-placement',
        placementId: 'missing-placement',
        systems: false,
      },
    ]);
  }

  function invalidScenario(): unknown {
    return {
      schemaVersion: '1.0.0',
      id: '',
      board: invalidRecipe(),
    };
  }

  function warningPlan(): GameboardPlan {
    const plan = patrolPlan();
    const tile = plan.tiles[0];
    if (!tile) {
      throw new Error('warningPlan fixture requires at least one tile');
    }
    return {
      ...plan,
      tiles: [{ ...tile, roadEdges: 1 }],
    };
  }

  function extraPlacementPlan(): GameboardPlan {
    const plan = patrolPlan();
    return {
      ...plan,
      placements: [
        {
          id: 'extra-prop',
          tileKey: '0,0',
          coordinates: { q: 0, r: 0 },
          position: { x: 0, y: 0, z: 0 },
          assetId: 'fixture:extra-prop',
          kind: 'prop',
          layer: 'feature',
          textureSet: 'default',
          elevation: 0,
          elevationOffset: 0,
          rotationSteps: 0,
          rotationRadians: 0,
          scale: 1,
          order: 0,
          requiresExtra: true,
          metadata: { feature: 'camp' },
        },
        {
          id: 'free-prop',
          tileKey: '0,0',
          coordinates: { q: 0, r: 0 },
          position: { x: 0, y: 0, z: 0 },
          assetId: 'fixture:free-prop',
          kind: 'prop',
          layer: 'feature',
          textureSet: 'default',
          elevation: 0,
          elevationOffset: 0,
          rotationSteps: 0,
          rotationRadians: 0,
          scale: 1,
          order: 1,
          requiresExtra: false,
          metadata: { feature: 'camp' },
        },
      ],
    };
  }

  function patrolPlan(): GameboardPlan {
    const tiles: GameboardPlan['tiles'] = [
      {
        key: '0,0',
        coordinates: { q: 0, r: 0 },
        terrain: 'grass',
        textureSet: 'default',
        elevation: 0,
        baseAssetId: 'hex_grass',
        supportAssetId: 'hex_grass',
        roadEdges: 0,
        riverEdges: 0,
        coastEdges: 0,
        riverWaterless: false,
        riverCurvy: false,
        coastWaterless: false,
        tags: [],
      },
      {
        key: '1,0',
        coordinates: { q: 1, r: 0 },
        terrain: 'grass',
        textureSet: 'default',
        elevation: 0,
        baseAssetId: 'hex_grass',
        supportAssetId: 'hex_grass',
        roadEdges: 0,
        riverEdges: 0,
        coastEdges: 0,
        riverWaterless: false,
        riverCurvy: false,
        coastWaterless: false,
        tags: [],
      },
    ];
    return {
      schemaVersion: '1.0.0',
      seed: 'patrol-command',
      shape: { kind: 'rectangle', width: 2, height: 1 },
      textureSet: 'default',
      tiles,
      placements: [],
      warnings: [],
    };
  }

  function pieceRegistry(): unknown {
    return {
      pieces: [
        {
          id: 'prop-crate',
          assetId: 'fixture:crate',
          role: 'prop',
          criteria: { terrain: ['grass'], edgePadding: 0 },
        },
        {
          id: 'prop-barrel',
          assetId: 'fixture:barrel',
          role: 'prop',
          criteria: { terrain: ['grass'], edgePadding: 0 },
        },
        {
          id: 'blocked-crate',
          assetId: 'fixture:blocked',
          role: 'prop',
          criteria: { terrain: ['water'], edgePadding: 0 },
        },
      ],
    };
  }

  function incompatiblePieceRegistry(): unknown {
    return {
      pieces: [
        { id: 'pool-crate', assetId: 'fixture:pool-crate', role: 'prop' },
        { id: 'pool-tree', assetId: 'fixture:pool-tree', role: 'tree' },
      ],
    };
  }
});
