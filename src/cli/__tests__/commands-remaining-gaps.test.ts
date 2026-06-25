import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { run as runCompatibility } from '../commands/compatibility';
import { run as runDeclarations } from '../commands/declarations';
import { run as runDoctor } from '../commands/doctor';
import { run as runExtract } from '../commands/extract';
import { run as runGuideApis } from '../commands/guide-apis';
import { run as runGuideAssets } from '../commands/guide-assets';
import { run as runGuideRoles } from '../commands/guide-roles';
import { run as runGuideUsages } from '../commands/guide-usages';
import { run as runPatrolRoutes } from '../commands/patrol-routes';
import { run as runPlacePiece } from '../commands/place-piece';
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
});
