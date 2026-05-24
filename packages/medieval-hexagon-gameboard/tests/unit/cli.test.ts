import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../src/gameboard';
import { createGameboardRecipe } from '../../src/recipe';
import { createGameboardScenario } from '../../src/scenario';
import type { MedievalHexagonManifest } from '../../src/types';

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(testDir, '../..');
const workspaceRoot = resolve(packageRoot, '../..');
const docsRecipePath = resolve(workspaceRoot, 'docs/examples/generated-piece-scenario.recipe.json');
const docsScenarioPath = resolve(workspaceRoot, 'docs/examples/simple-rpg-scenario.json');
const freeManifestPath = resolve(packageRoot, 'assets/free/manifest.json');
const createdRoots: string[] = [];

describe('CLI', () => {
  afterEach(() => {
    for (const root of createdRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports doctor status without requiring local references to exist', () => {
    const missingSource = resolve(createTempRoot(), 'missing-source');
    const output = runCli(['doctor', '--source', missingSource]);

    expect(output).toContain('edition: free');
    expect(output).toContain(`source: ${missingSource}`);
    expect(output).toContain('source exists: no');
    expect(output).toContain('gltf count: 0/221');
  });

  it('generates manifests and extracts GLTF trees from a source folder', () => {
    const sourceRoot = createFixtureSourceRoot();
    const manifestPath = resolve(createTempRoot(), 'manifest.json');
    const extractRoot = resolve(createTempRoot(), 'extracted');

    const manifestOutput = runCli([
      'manifest',
      '--source',
      sourceRoot,
      '--assetBasePath',
      'assets/free',
      '--out',
      manifestPath,
    ]);
    expect(manifestOutput).toContain(`Wrote manifest to ${manifestPath}`);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as MedievalHexagonManifest;
    expect(manifest.counts.total).toBe(1);
    expect(manifest.assetsById.hex_grass).toMatchObject({
      category: 'tiles',
      subcategory: 'base',
      modelPath: 'assets/free/tiles/base/hex_grass.gltf',
    });

    const normalizedManifestPath = resolve(createTempRoot(), 'normalized-manifest.json');
    const validationOutput = runCli([
      'validate-manifest',
      '--manifest',
      manifestPath,
      '--outManifest',
      normalizedManifestPath,
    ]);
    expect(validationOutput).toContain(`Wrote normalized manifest to ${normalizedManifestPath}`);
    expect(validationOutput).toContain('assets: 1');
    expect(validationOutput).toContain('validation: 0 error(s), 0 warning(s)');
    expect(existsSync(normalizedManifestPath)).toBe(true);

    const extractOutput = runCli(['extract', '--source', sourceRoot, '--out', extractRoot]);
    expect(extractOutput).toContain(`Extracted 1 free assets to ${extractRoot}`);
    expect(existsSync(resolve(extractRoot, 'assets/tiles/base/hex_grass.gltf'))).toBe(true);
    expect(existsSync(resolve(extractRoot, 'manifest.json'))).toBe(true);
  });

  it('normalizes stale manifest indexes for every manifest-consuming command', () => {
    const sourceRoot = createFixtureSourceRoot();
    const staleManifestPath = resolve(createTempRoot(), 'stale-manifest.json');
    const manifest = JSON.parse(
      runCli(['manifest', '--source', sourceRoot, '--assetBasePath', 'assets/free'])
    ) as MedievalHexagonManifest;
    writeFileSync(
      staleManifestPath,
      `${JSON.stringify(
        {
          ...manifest,
          assetsById: {},
          counts: { total: 0, byCategory: {}, bySubcategory: {} },
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const validationPayload = JSON.parse(
      runCli(['validate-manifest', '--manifest', staleManifestPath, '--json'])
    ) as {
      errorCount: number;
      warningCount: number;
      counts: { total: number };
      issues: Array<{ code: string }>;
    };
    const analysisPayload = JSON.parse(
      runCli(['analyze', '--manifest', staleManifestPath, '--json'])
    ) as {
      tileCount: number;
      analyzedCount: number;
    };

    expect(validationPayload).toMatchObject({
      errorCount: 0,
      warningCount: 2,
      counts: { total: 1 },
    });
    expect(validationPayload.issues.map((issue) => issue.code)).toEqual([
      'manifest.counts_stale',
      'manifest.assets_by_id_stale',
    ]);
    expect(analysisPayload).toMatchObject({ tileCount: 1, analyzedCount: 1 });
  });

  it('fails validate-manifest on malformed local manifest JSON', () => {
    const manifestPath = resolve(createTempRoot(), 'invalid-manifest.json');
    writeFileSync(
      manifestPath,
      `${JSON.stringify(
        {
          schemaVersion: '1.0.0',
          edition: 'extra',
          sourcePack: {
            name: 'Fixture',
            version: '1.0',
            creator: 'Fixture',
            edition: 'extra',
            license: 'CC0-1.0',
            licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
            sourceRootName: 'fixture',
          },
          textureSets: ['default'],
          assets: [
            {
              id: 'bad-local-asset',
              edition: 'free',
              category: 'bad-category',
              subcategory: 'fixture',
              family: 'bad-local-asset',
              textureSet: 'default',
              modelPath: 'assets/extra/bad-local-asset.gltf',
              sourcePath: 'bad-local-asset.gltf',
              bufferPaths: [],
              texturePaths: [],
              materialSlots: [],
              bounds: { min: [0, 0], max: [1, 1, 1], size: [1, 1, 1] },
              fileSizeBytes: 1,
            },
          ],
          assetsById: {},
          counts: { total: 0, byCategory: {}, bySubcategory: {} },
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const output = runCliExpectFailure(['validate-manifest', '--manifest', manifestPath]);

    expect(output).toContain('validation: 3 error(s), 0 warning(s)');
    expect(output).toContain('manifest.asset_edition_mismatch');
    expect(output).toContain('manifest.asset_category');
    expect(output).toContain('manifest.asset_bounds_vector');
    expect(runCliExpectFailure(['analyze', '--manifest', manifestPath, '--json'])).toContain(
      'Invalid manifest'
    );
  });

  it('validates plans and recipes through the published command surface', () => {
    const tempRoot = createTempRoot();
    const compiledPlanPath = resolve(tempRoot, 'compiled-plan.json');
    const invalidRecipePath = resolve(tempRoot, 'invalid-archetype.recipe.json');

    const recipeOutput = runCli([
      'validate-recipe',
      '--recipe',
      docsRecipePath,
      '--outPlan',
      compiledPlanPath,
    ]);
    expect(recipeOutput).toContain(`Wrote compiled GameboardPlan to ${compiledPlanPath}`);
    expect(recipeOutput).toContain('validation: 0 error(s), 0 warning(s)');

    const planOutput = runCli(['validate-plan', '--plan', compiledPlanPath]);
    expect(planOutput).toContain('validation: 0 error(s), 0 warning(s)');

    writeFileSync(
      invalidRecipePath,
      `${JSON.stringify(
        createGameboardRecipe(
          { seed: 'cli-invalid-archetype', shape: { kind: 'rectangle', width: 1, height: 1 } },
          [],
          {
            layoutFills: [{ id: 'bad-fill', archetype: 'missing-archetype', assetId: 'crate_A_small', count: 1 }],
          }
        ),
        null,
        2
      )}\n`,
      'utf8'
    );
    const invalidOutput = runCliExpectFailure(['validate-recipe', '--recipe', invalidRecipePath]);
    expect(invalidOutput).toContain('recipe.layout_archetype_missing');
    expect(invalidOutput).not.toContain('recipe.compile_failed');
  });

  it('summarizes plans, recipes, scenarios, and blueprints through the CLI', () => {
    const root = createTempRoot();
    const planPath = resolve(root, 'summary-plan.json');
    const recipeCompiledPlanPath = resolve(root, 'summary-recipe.plan.json');
    const blueprintPath = resolve(root, 'summary-blueprint.json');
    const blueprintSummaryPath = resolve(root, 'summary-blueprint.summary.json');
    const blueprintPlanPath = resolve(root, 'summary-blueprint.plan.json');
    const plan = createGameboardBuilder({
      seed: 'cli-summary-plan',
      shape: { kind: 'rectangle', width: 4, height: 3 },
    })
      .addHarbor({ at: { q: 1, r: 1 }, facing: 1, faction: 'green', kind: 'shipyard' })
      .addRoadPath([
        { q: 0, r: 1 },
        { q: 1, r: 1 },
        { q: 2, r: 1 },
      ])
      .addMountainStack({ at: { q: 3, r: 0 }, height: 2, variant: 'A', withTrees: true })
      .build();
    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    writeFileSync(
      blueprintPath,
      `${JSON.stringify(
        {
          seed: 'cli-summary-blueprint',
          shape: { kind: 'rectangle', width: 5, height: 4 },
          waterFill: 0.2,
          maxElevation: 2,
          towns: 0,
          harbors: 0,
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const textOutput = runCli(['summarize-plan', '--plan', planPath, '--topAssetLimit', '5']);
    const planPayload = JSON.parse(
      runCli(['summarize-plan', '--plan', planPath, '--json', '--topAssetLimit', '100'])
    ) as {
      source: { kind: string; path: string };
      validation: { errorCount: number; warningCount: number };
      summary: {
        seed: string;
        tileTerrainCounts: Record<string, number>;
        tileElevationCounts: Record<string, number>;
        placementFeatureCounts: Record<string, number>;
        extraAssetIds: string[];
        topAssets: Array<{ assetId: string; requiresExtra: boolean; features: string[] }>;
      };
    };
    const recipeOutput = runCli([
      'summarize-plan',
      '--recipe',
      docsRecipePath,
      '--manifest',
      freeManifestPath,
      '--json',
      '--outPlan',
      recipeCompiledPlanPath,
    ]);
    const recipePayload = JSON.parse(jsonPayload(recipeOutput)) as {
      source: { kind: string };
      validation: { errorCount: number };
      summary: { tileCount: number; placementCount: number };
    };
    const scenarioPayload = JSON.parse(
      runCli([
        'summarize-plan',
        '--scenario',
        docsScenarioPath,
        '--manifest',
        freeManifestPath,
        '--json',
      ])
    ) as {
      source: { kind: string };
      validation: { errorCount: number };
      summary: { tileCount: number; placementCount: number; tileTerrainCounts: Record<string, number> };
    };
    const blueprintOutput = runCli([
      'summarize-plan',
      '--blueprint',
      blueprintPath,
      '--out',
      blueprintSummaryPath,
      '--outPlan',
      blueprintPlanPath,
      '--topAssetLimit',
      '8',
    ]);
    const blueprintPayload = JSON.parse(readFileSync(blueprintSummaryPath, 'utf8')) as {
      source: { kind: string };
      validation: { errorCount: number };
      summary: { seed: string; tileCount: number; placementCount: number };
    };

    expect(textOutput).toContain(`source: plan ${planPath}`);
    expect(textOutput).toContain('terrain:');
    expect(textOutput).toContain('features:');
    expect(textOutput).toContain('extra assets: anchor, boat, building_shipyard_green');
    expect(planPayload).toMatchObject({
      source: { kind: 'plan', path: planPath },
      validation: { errorCount: 0, warningCount: 0 },
      summary: {
        seed: 'cli-summary-plan',
      },
    });
    expect(planPayload.summary.tileTerrainCounts.coast).toBeGreaterThan(0);
    expect(planPayload.summary.tileElevationCounts['2']).toBeGreaterThan(0);
    expect(planPayload.summary.placementFeatureCounts.harbor).toBe(1);
    expect(planPayload.summary.extraAssetIds).toContain('building_shipyard_green');
    expect(planPayload.summary.topAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: 'building_shipyard_green',
          requiresExtra: true,
          features: ['harbor'],
        }),
      ])
    );
    expect(recipeOutput).toContain(`Wrote compiled GameboardPlan to ${recipeCompiledPlanPath}`);
    expect(recipePayload).toMatchObject({
      source: { kind: 'recipe' },
      validation: { errorCount: 0 },
    });
    expect(recipePayload.summary.tileCount).toBeGreaterThan(0);
    expect(recipePayload.summary.placementCount).toBeGreaterThan(0);
    expect(existsSync(recipeCompiledPlanPath)).toBe(true);
    expect(scenarioPayload).toMatchObject({
      source: { kind: 'scenario' },
      validation: { errorCount: 0 },
    });
    expect(scenarioPayload.summary.tileCount).toBeGreaterThan(0);
    expect(scenarioPayload.summary.tileTerrainCounts.road).toBeGreaterThan(0);
    expect(blueprintOutput).toContain(`Wrote compiled GameboardPlan to ${blueprintPlanPath}`);
    expect(blueprintOutput).toContain(`Wrote plan summary to ${blueprintSummaryPath}`);
    expect(blueprintPayload).toMatchObject({
      source: { kind: 'blueprint' },
      validation: { errorCount: 0 },
      summary: { seed: 'cli-summary-blueprint' },
    });
    expect(blueprintPayload.summary.tileCount).toBeGreaterThan(0);
    expect(blueprintPayload.summary.placementCount).toBeGreaterThan(0);
    expect(existsSync(blueprintPlanPath)).toBe(true);
  });

  it('summarizes scenario actors, spawns, patrols, quests, and local-only assets through the CLI', () => {
    const root = createTempRoot();
    const scenarioPath = resolve(root, 'scenario-summary.json');
    const summaryPath = resolve(root, 'scenario-summary.out.json');
    const board = createGameboardRecipe(
      { seed: 'cli-scenario-summary', shape: { kind: 'rectangle', width: 4, height: 2 } },
      [
        {
          action: 'setTileAsset',
          at: { q: 0, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['player-spawn'],
        },
        {
          action: 'setTileAsset',
          at: { q: 3, r: 0 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['enemy-spawn'],
        },
        {
          action: 'setTileAsset',
          at: { q: 2, r: 1 },
          assetId: 'hex_grass',
          terrain: 'grass',
          tags: ['watch-point'],
        },
      ]
    );
    const scenario = createGameboardScenario('cli:scenario-summary', board, {
      spawnGroups: {
        groups: [
          { id: 'player', count: 1, tileTags: ['player-spawn'] },
          { id: 'enemy', count: 1, tileTags: ['enemy-spawn'], pathToGroups: ['player'] },
        ],
      },
      patrolRoutes: [
        { id: 'enemy-watch', count: 2, startGroupId: 'enemy', tileTags: ['watch-point'] },
      ],
      actors: [
        {
          actorId: 'player',
          actorKind: 'player',
          team: 'blue',
          spawnGroupId: 'player',
          assetId: 'flag_blue',
          kind: 'unit',
          movementAgent: { profile: 'ground' },
        },
        {
          actorId: 'raider',
          actorKind: 'enemy',
          team: 'red',
          hostile: true,
          blocksMovement: true,
          spawnGroupId: 'enemy',
          assetId: 'unit_red_full',
          kind: 'unit',
          requiresExtra: true,
          movementAgent: { profile: 'ground' },
          patrolAgent: { routeId: 'enemy-watch' },
        },
      ],
      quests: [
        {
          id: 'cli:scenario-summary:quest',
          objectives: [
            { id: 'spot-raider', kind: 'collision', actor: 'player', targetActor: 'raider', expect: 'hostile' },
            { id: 'defeat-raider', kind: 'defeat-actor', targetActor: 'raider' },
          ],
        },
      ],
    });
    writeFileSync(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`, 'utf8');

    const textOutput = runCli([
      'summarize-scenario',
      '--scenario',
      scenarioPath,
      '--manifest',
      freeManifestPath,
      '--allowUnknownAssets',
      '--topAssetLimit',
      '10',
    ]);
    const jsonOutput = runCli([
      'summarize-scenario',
      '--scenario',
      scenarioPath,
      '--manifest',
      freeManifestPath,
      '--allowUnknownAssets',
      '--json',
      '--topAssetLimit',
      '100',
    ]);
    const outOutput = runCli([
      'summarize-scenario',
      '--scenario',
      scenarioPath,
      '--manifest',
      freeManifestPath,
      '--allowUnknownAssets',
      '--out',
      summaryPath,
    ]);
    const summary = JSON.parse(jsonOutput) as {
      scenarioId: string;
      validation: { errorCount: number; warningCount: number };
      actorCount: number;
      hostileActorCount: number;
      blockingActorCount: number;
      actorExtraAssetIds: string[];
      actorKindCounts: Record<string, number>;
      objectiveKindCounts: Record<string, number>;
      spawnRouteFoundCount: number;
      patrolRouteFoundCount: number;
      topActorAssets: Array<{ assetId: string; requiresExtra: boolean; actorKinds: string[] }>;
    };

    expect(textOutput).toContain(`source: scenario ${scenarioPath}`);
    expect(textOutput).toContain('actors: 2 authored, 2 resolved');
    expect(textOutput).toContain('actor extra assets: unit_red_full');
    expect(textOutput).toContain('spawn groups: 2 group(s), 2 location(s), 1/1 route check(s) found');
    expect(outOutput).toContain(`Wrote scenario summary to ${summaryPath}`);
    expect(existsSync(summaryPath)).toBe(true);
    expect(summary).toMatchObject({
      scenarioId: 'cli:scenario-summary',
      validation: { errorCount: 0, warningCount: 0 },
      actorCount: 2,
      hostileActorCount: 1,
      blockingActorCount: 1,
      actorKindCounts: { enemy: 1, player: 1 },
      objectiveKindCounts: { collision: 1, 'defeat-actor': 1 },
      spawnRouteFoundCount: 1,
      patrolRouteFoundCount: 1,
    });
    expect(summary.actorExtraAssetIds).toEqual(['unit_red_full']);
    expect(summary.topActorAssets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: 'unit_red_full',
          requiresExtra: true,
          actorKinds: ['enemy'],
        }),
      ])
    );
  });

  it('emits release-readiness coverage JSON and Markdown through the CLI', () => {
    const root = createTempRoot();
    const jsonPath = resolve(root, 'release-readiness.json');
    const markdownPath = resolve(root, 'release-readiness.md');

    const output = runCli([
      'coverage',
      '--checksPassed',
      '--generatedAt',
      '2026-05-24T00:00:00.000Z',
      '--outJson',
      jsonPath,
      '--outMarkdown',
      markdownPath,
    ]);
    const doctorOutput = runCli(['doctor', '--coverage', '--checksPassed']);
    const report = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
      generatedAt: string;
      guide: {
        pageCount: number;
        assetCounts: { unique: number; free: number; extra: number };
      };
      manifest: {
        manifestAssetCount: number;
        freeGuideAssetsInManifest: number;
        extraGuideAssetsLocalOnly: string[];
      };
      publicApi: unknown[];
      visualArtifacts: Array<{ path: string; status: string }>;
      references: unknown[];
      packageChecks: Array<{ status: string }>;
    };
    const markdown = readFileSync(markdownPath, 'utf8');

    expect(output).toContain(`Wrote coverage JSON to ${jsonPath}`);
    expect(output).toContain(`Wrote coverage Markdown to ${markdownPath}`);
    expect(output).toContain('coverage status:');
    expect(report.generatedAt).toBe('2026-05-24T00:00:00.000Z');
    expect(report.guide).toMatchObject({
      pageCount: 19,
      assetCounts: { unique: 404, free: 221, extra: 183 },
    });
    expect(report.manifest.manifestAssetCount).toBe(221);
    expect(report.manifest.freeGuideAssetsInManifest).toBe(221);
    expect(report.manifest.extraGuideAssetsLocalOnly).toHaveLength(183);
    expect(report.publicApi).toHaveLength(74);
    expect(report.visualArtifacts.map((artifact) => artifact.path)).toContain(
      'docs/assets/showcases/free-blueprint-builder-showcase.png'
    );
    expect(report.visualArtifacts.map((artifact) => artifact.path)).toContain(
      'docs/assets/kaykit-guide/pages/page-16.png'
    );
    expect(report.references).toHaveLength(4);
    expect(report.packageChecks.every((check) => check.status === 'passed')).toBe(true);
    expect(markdown).toContain('# Release Readiness Coverage');
    expect(markdown).toContain('| Status | Command | Summary |');
    expect(doctorOutput).toContain('guide pages: 19/19');
    expect(doctorOutput).toContain('manifest: 221 asset(s), 221/221 FREE guide asset(s)');
  });

  it('compiles high-level blueprint board specs through the CLI', () => {
    const root = createTempRoot();
    const blueprintPath = resolve(root, 'campaign-blueprint.json');
    const recipePath = resolve(root, 'campaign-blueprint.recipe.json');
    const planPath = resolve(root, 'campaign-blueprint.plan.json');
    const scenarioPath = resolve(root, 'campaign-blueprint.scenario.json');
    const scenarioInspectionPath = resolve(root, 'campaign-blueprint.scenario-inspection.json');
    const interopPath = resolve(root, 'campaign-blueprint.interop.json');
    const inspectionPath = resolve(root, 'campaign-blueprint.inspection.json');
    writeFileSync(
      blueprintPath,
      `${JSON.stringify(
        {
          scenarioId: 'cli-blueprint-board:intro',
          title: 'CLI Blueprint Board Intro',
          seed: 'cli-blueprint-board',
          shape: { kind: 'rectangle', width: 7, height: 5 },
          faction: 'green',
          waterFill: 0.18,
          maxElevation: 3,
          mountainRanges: [
            {
              id: 'north-ridge',
              path: [
                { q: 1, r: 0 },
                { q: 3, r: 0 },
                { q: 5, r: 1 },
              ],
              width: 1,
              height: 3,
            },
          ],
          towns: [
            {
              id: 'green-market',
              center: { q: 3, r: 2 },
              includeWalls: true,
              buildings: ['market', 'home_A', 'home_B', 'well'],
            },
          ],
          harbors: [
            {
              id: 'green-harbor',
              at: { q: 5, r: 3 },
              facing: 1,
              kind: 'watermill',
              roadTo: { q: 3, r: 2 },
            },
          ],
          roads: [
            {
              id: 'ridge-road',
              path: [
                { q: 1, r: 1 },
                { q: 2, r: 2 },
                { q: 3, r: 2 },
                { q: 5, r: 3 },
              ],
            },
          ],
          rivers: [
            {
              id: 'ridge-river',
              path: [
                { q: 0, r: 0 },
                { q: 1, r: 1 },
                { q: 2, r: 2 },
                { q: 3, r: 3 },
                { q: 4, r: 4 },
              ],
              curvy: true,
            },
          ],
          biomeFills: [{ id: 'fall-market', textureSet: 'fall', fill: 0.2, center: { q: 3, r: 2 }, radius: 2 }],
          propClusterDressing: {
            auto: false,
            clusters: [{ id: 'cli-worksite', at: { q: 1, r: 3 }, kind: 'worksite', placement: 'single', density: 0.4 }],
          },
          transitionPolicy: {
            biomeTransitions: true,
            elevationRamps: true,
            roadSlopes: true,
            bridges: true,
          },
          spawnGroups: {
            seed: 'cli-blueprint-board:spawns',
            profile: {
              blockedTerrain: ['water'],
              maxElevationStep: 3,
              blockingPlacementKinds: ['unit'],
            },
            groups: [
              { id: 'party', count: 1, terrain: ['grass', 'road', 'coast'], edgePadding: 1 },
              {
                id: 'raiders',
                count: 1,
                terrain: ['grass', 'forest', 'hill', 'road'],
                edgePadding: 1,
                minDistanceFromGroups: 2,
                pathToGroups: ['party'],
                routeProfile: {
                  blockedTerrain: ['water'],
                  maxElevationStep: 3,
                  blockingPlacementKinds: ['unit'],
                },
              },
            ],
          },
          actors: [
            {
              actorId: 'player',
              actorKind: 'player',
              team: 'green',
              spawnGroupId: 'party',
              assetId: 'flag_green',
              kind: 'unit',
            },
            {
              actorId: 'raider',
              actorKind: 'enemy',
              hostile: true,
              spawnGroupId: 'raiders',
              assetId: 'flag_red',
              kind: 'unit',
            },
          ],
          quests: [
            {
              id: 'cli-blueprint-board:intro-quest',
              objectives: [{ id: 'reach-harbor', kind: 'reach-tile', actor: 'player', tile: '5,3' }],
            },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const output = runCli([
      'blueprint',
      '--blueprint',
      blueprintPath,
      '--allowUnknownAssets',
      '--outRecipe',
      recipePath,
      '--outPlan',
      planPath,
      '--outScenario',
      scenarioPath,
      '--outScenarioInspection',
      scenarioInspectionPath,
      '--outInterop',
      interopPath,
      '--out',
      inspectionPath,
    ]);
    const recipe = JSON.parse(readFileSync(recipePath, 'utf8')) as {
      steps: Array<{ action: string; assetId?: string }>;
    };
    const plan = JSON.parse(readFileSync(planPath, 'utf8')) as {
      tiles: Array<{ textureSet?: string }>;
      placements: Array<{ assetId: string; metadata: Record<string, unknown> }>;
    };
    const inspection = JSON.parse(readFileSync(inspectionPath, 'utf8')) as {
      counts: Record<string, number>;
      validation: { errorCount: number };
      scenarioValidation: { errorCount: number; warningCount: number };
    };
    const scenario = JSON.parse(readFileSync(scenarioPath, 'utf8')) as {
      id: string;
      spawnGroups?: { groups: Array<{ id: string }> };
      actors?: Array<{ actorId: string; spawnGroupId?: string }>;
    };
    const scenarioInspection = JSON.parse(readFileSync(scenarioInspectionPath, 'utf8')) as {
      violations: Array<{ severity: string }>;
      spawnGroups?: { groupCount: number; groups: Array<{ id: string; selectedCount: number }> };
    };
    const interop = JSON.parse(readFileSync(interopPath, 'utf8')) as {
      scenario?: { id: string };
      entities: Array<{ id: string; kind: string }>;
      relations: Array<{ name: string }>;
      spawnLocations: Array<{ id: string }>;
    };

    expect(output).toContain(`Wrote blueprint GameboardRecipe to ${recipePath}`);
    expect(output).toContain(`Wrote blueprint GameboardPlan to ${planPath}`);
    expect(output).toContain(`Wrote blueprint GameboardScenario to ${scenarioPath}`);
    expect(output).toContain(`Wrote blueprint scenario inspection to ${scenarioInspectionPath}`);
    expect(output).toContain(`Wrote blueprint interop snapshot with`);
    expect(output).toContain(`Wrote blueprint inspection to ${inspectionPath}`);
    expect(inspection.validation.errorCount).toBe(0);
    expect(inspection.scenarioValidation.errorCount).toBe(0);
    expect(inspection.counts.mountainStacks).toBeGreaterThan(0);
    expect(inspection.counts.townBuildings).toBeGreaterThanOrEqual(4);
    expect(inspection.counts.harbors).toBe(1);
    expect(inspection.counts.rivers).toBe(1);
    expect(inspection.counts.bridges).toBeGreaterThan(0);
    expect(inspection.counts.biomeTiles).toBeGreaterThan(0);
    expect(inspection.counts.propClusters).toBe(1);
    expect(recipe.steps.some((step) => step.action === 'setTextureSet')).toBe(true);
    expect(recipe.steps.some((step) => step.action === 'addPropCluster')).toBe(true);
    expect(plan.tiles.some((tile) => tile.textureSet === 'fall')).toBe(true);
    expect(plan.placements.some((placement) => placement.assetId === 'building_watermill_green')).toBe(true);
    expect(plan.placements.some((placement) => placement.assetId.startsWith('hex_river_'))).toBe(true);
    expect(plan.placements.some((placement) => placement.assetId === 'hex_transition')).toBe(true);
    expect(plan.placements.some((placement) => placement.metadata.clusterId === 'cli-worksite')).toBe(true);
    expect(scenario).toMatchObject({
      id: 'cli-blueprint-board:intro',
      spawnGroups: { groups: [{ id: 'party' }, { id: 'raiders' }] },
    });
    expect(scenario.actors?.map((actor) => [actor.actorId, actor.spawnGroupId])).toEqual([
      ['player', 'party'],
      ['raider', 'raiders'],
    ]);
    expect(scenarioInspection.violations.filter((violation) => violation.severity === 'error')).toEqual([]);
    expect(scenarioInspection.spawnGroups).toMatchObject({
      groupCount: 2,
      groups: [
        { id: 'party', selectedCount: 1 },
        { id: 'raiders', selectedCount: 1 },
      ],
    });
    expect(interop.scenario?.id).toBe('cli-blueprint-board:intro');
    expect(interop.spawnLocations.map((spawn) => spawn.id)).toEqual(
      expect.arrayContaining(['spawn:party:0', 'spawn:raiders:0'])
    );
    expect(interop.entities.map((entity) => entity.id)).toEqual(
      expect.arrayContaining([
        'actor:player',
        'actor:raider',
        'quest:cli-blueprint-board:intro-quest',
        'spawn-group:party',
        'spawn-group:raiders',
      ])
    );
    expect(interop.relations.some((relation) => relation.name === 'ActorOnTile')).toBe(true);
    expect(interop.relations.some((relation) => relation.name === 'SpawnGroupHasLocation')).toBe(
      true
    );

    const jsonOutput = JSON.parse(
      runCli([
        'blueprint',
        '--blueprint',
        blueprintPath,
        '--allowUnknownAssets',
        '--json',
        '--includePlan',
        '--includeScenario',
        '--includeScenarioInspection',
        '--includeInterop',
      ])
    ) as {
      tileCount: number;
      placementCount: number;
      plan?: { tiles: unknown[] };
      scenario?: { id: string };
      scenarioInspection?: { spawnGroups?: { groupCount: number } };
      scenarioValidation?: { errorCount: number };
      interopSummary?: {
        actorCount: number;
        questCount: number;
        spawnGroupCount: number;
      };
      interop?: { scenario?: { id: string }; entities: unknown[] };
    };
    expect(jsonOutput.tileCount).toBe(plan.tiles.length);
    expect(jsonOutput.placementCount).toBe(plan.placements.length);
    expect(jsonOutput.plan?.tiles.length).toBe(plan.tiles.length);
    expect(jsonOutput.scenario?.id).toBe('cli-blueprint-board:intro');
    expect(jsonOutput.scenarioInspection?.spawnGroups?.groupCount).toBe(2);
    expect(jsonOutput.scenarioValidation?.errorCount).toBe(0);
    expect(jsonOutput.interopSummary).toMatchObject({
      actorCount: 2,
      questCount: 1,
      spawnGroupCount: 2,
    });
    expect(jsonOutput.interop?.scenario?.id).toBe('cli-blueprint-board:intro');
    expect(jsonOutput.interop?.entities.length).toBe(interop.entities.length);
  });

  it('analyzes layout fill rules against a saved plan through the CLI', () => {
    const root = createTempRoot();
    const planPath = resolve(root, 'layout-plan.json');
    const rulesPath = resolve(root, 'layout-rules.json');
    const analysisPath = resolve(root, 'layout-analysis.json');
    const plan = createGameboardBuilder({
      seed: 'cli-layout-analysis',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    })
      .addForest({ q: 0, r: 0 })
      .build();
    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    writeFileSync(
      rulesPath,
      `${JSON.stringify(
        {
          seed: 'cli-layout-fill',
          rules: [
            {
              id: 'oversized-grove',
              archetype: 'tree',
              assetId: 'tree_single_A',
              count: 5,
              minCount: 4,
            },
            { id: 'overflow-crates', archetype: 'scatter', assetId: 'crate_A_small', count: 1 },
            { id: 'missing-asset', archetype: 'prop', count: 1 },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const output = runCliExpectFailure([
      'analyze-layout',
      '--plan',
      planPath,
      '--rules',
      rulesPath,
      '--out',
      analysisPath,
    ]);
    const payload = JSON.parse(readFileSync(analysisPath, 'utf8')) as {
      placementCount: number;
      warningCount: number;
      errorCount: number;
      rules: Array<{
        id: string;
        candidateCount: number;
        rejectedSiteCount: number;
        rejectionCounts: Record<string, number>;
        selectedCount: number;
        errors: string[];
      }>;
    };

    expect(output).toContain(`Wrote layout analysis to ${analysisPath}`);
    expect(payload).toMatchObject({
      placementCount: 3,
      warningCount: 4,
      errorCount: 1,
    });
    expect(payload.rules[0]).toMatchObject({
      id: 'oversized-grove',
      candidateCount: 3,
      selectedCount: 3,
    });
    expect(payload.rules[1]).toMatchObject({
      id: 'overflow-crates',
      candidateCount: 0,
      rejectedSiteCount: 1,
      rejectionCounts: { 'slots-full': 1 },
      selectedCount: 0,
    });
    expect(payload.rules[2]?.errors).toEqual([
      'Layout fill rule missing-asset requires assetId or assets',
    ]);
  });

  it('plans separated spawn groups and route diagnostics through the CLI', () => {
    const root = createTempRoot();
    const planPath = resolve(root, 'spawn-groups.plan.json');
    const groupsPath = resolve(root, 'spawn-groups.json');
    const outputPath = resolve(root, 'spawn-groups.output.json');
    const plan = createGameboardBuilder({
      seed: 'cli-spawn-groups',
      shape: { kind: 'rectangle', width: 4, height: 2 },
    })
      .setTileAsset({
        at: { q: 0, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['player-spawn'],
      })
      .setTileAsset({
        at: { q: 3, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['enemy-spawn'],
      })
      .addPlacement({
        at: { q: 1, r: 0 },
        assetId: 'building_tower_A_blue',
        kind: 'structure',
        layer: 'structure',
      })
      .build();
    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    writeFileSync(
      groupsPath,
      `${JSON.stringify(
        {
          seed: 'cli-spawn-groups',
          groups: [
            { id: 'player', count: 1, tileTags: ['player-spawn'] },
            {
              id: 'enemy',
              count: 1,
              tileTags: ['enemy-spawn'],
              minDistanceFromGroups: 2,
              pathToGroups: ['player'],
            },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const output = runCli([
      'spawn-groups',
      '--plan',
      planPath,
      '--groups',
      groupsPath,
      '--out',
      outputPath,
    ]);
    const payload = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      selectedLocationCount: number;
      errors: string[];
      groups: Array<{ id: string; selectedCount: number; locations: Array<{ key: string }> }>;
      routeChecks: Array<{
        fromGroupId: string;
        toGroupId: string;
        found: boolean;
        pathKeys: string[];
      }>;
    };

    expect(output).toContain(`Wrote spawn group plan to ${outputPath}`);
    expect(payload.errors).toEqual([]);
    expect(payload.selectedLocationCount).toBe(2);
    expect(payload.groups.map((group) => [group.id, group.selectedCount])).toEqual([
      ['player', 1],
      ['enemy', 1],
    ]);
    expect(payload.groups[0]?.locations[0]?.key).toBe('0,0');
    expect(payload.groups[1]?.locations[0]?.key).toBe('3,0');
    expect(payload.routeChecks).toEqual([
      expect.objectContaining({ fromGroupId: 'enemy', toGroupId: 'player', found: true }),
    ]);
    expect(payload.routeChecks[0]?.pathKeys).not.toContain('1,0');
  });

  it('plans patrol routes through the CLI from explicit route files and scenario routes', () => {
    const root = createTempRoot();
    const planPath = resolve(root, 'patrol-routes.plan.json');
    const groupsPath = resolve(root, 'patrol-groups.json');
    const routesPath = resolve(root, 'patrol-routes.json');
    const outputPath = resolve(root, 'patrol-routes.output.json');
    const scenarioOutputPath = resolve(root, 'patrol-scenario.output.json');
    const scriptPath = resolve(root, 'patrol-script.json');
    const scenarioScriptPath = resolve(root, 'patrol-scenario-script.json');
    const plan = createGameboardBuilder({
      seed: 'cli-patrol-routes',
      shape: { kind: 'rectangle', width: 5, height: 2 },
    })
      .setTileAsset({
        at: { q: 0, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['enemy-spawn'],
      })
      .setTileAsset({
        at: { q: 2, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['watch-point'],
      })
      .setTileAsset({
        at: { q: 4, r: 1 },
        assetId: 'hex_grass',
        terrain: 'grass',
        tags: ['watch-point'],
      })
      .build();
    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    writeFileSync(
      groupsPath,
      `${JSON.stringify({ groups: [{ id: 'enemy', count: 1, tileTags: ['enemy-spawn'] }] }, null, 2)}\n`,
      'utf8'
    );
    writeFileSync(
      routesPath,
      `${JSON.stringify(
        {
          seed: 'cli-patrol-routes',
          routes: [
            {
              id: 'enemy-watch',
              count: 3,
              startGroupId: 'enemy',
              tileTags: ['watch-point'],
            },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const output = runCli([
      'patrol-routes',
      '--plan',
      planPath,
      '--groups',
      groupsPath,
      '--routes',
      routesPath,
      '--out',
      outputPath,
    ]);
    const payload = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      errors: string[];
      routes: Array<{
        id: string;
        found: boolean;
        selectedWaypointCount: number;
        waypoints: Array<{ key: string; source: string; spawnGroupId?: string }>;
        segments: Array<{ found: boolean }>;
      }>;
    };

    expect(output).toContain(`Wrote patrol route plan to ${outputPath}`);
    expect(payload.errors).toEqual([]);
    expect(payload.routes[0]).toMatchObject({
      id: 'enemy-watch',
      found: true,
      selectedWaypointCount: 3,
    });
    expect(payload.routes[0]?.waypoints[0]).toMatchObject({
      key: '0,0',
      source: 'spawn-group',
      spawnGroupId: 'enemy',
    });
    expect(payload.routes[0]?.segments.every((segment) => segment.found)).toBe(true);

    const scenarioOutput = runCli([
      'patrol-routes',
      '--scenario',
      docsScenarioPath,
      '--out',
      scenarioOutputPath,
    ]);
    const scenarioPayload = JSON.parse(readFileSync(scenarioOutputPath, 'utf8')) as typeof payload;

    expect(scenarioOutput).toContain(`Wrote patrol route plan to ${scenarioOutputPath}`);
    expect(scenarioPayload.routes.map((route) => route.id)).toEqual(['bandit-watch']);
    expect(scenarioPayload.routes[0]?.waypoints).toHaveLength(3);

    const scriptOutput = runCli([
      'patrol-script',
      '--routes',
      outputPath,
      '--routeId',
      'enemy-watch',
      '--actorId',
      'bandit',
      '--out',
      scriptPath,
    ]);
    const scriptPayload = JSON.parse(readFileSync(scriptPath, 'utf8')) as {
      schemaVersion: string;
      steps: Array<{ action: string; sourceActor: string; target: string }>;
    };
    expect(scriptOutput).toContain(`Wrote patrol simulation script to ${scriptPath}`);
    expect(scriptPayload.schemaVersion).toBe('1.0.0');
    expect(scriptPayload.steps).toHaveLength(payload.routes[0]?.segments.length ?? 0);
    expect(scriptPayload.steps[0]).toMatchObject({
      action: 'command',
      sourceActor: 'bandit',
    });

    const scenarioScriptOutput = runCli([
      'patrol-script',
      '--scenario',
      docsScenarioPath,
      '--routeId',
      'bandit-watch',
      '--actorId',
      'bandit',
      '--out',
      scenarioScriptPath,
    ]);
    const scenarioScriptPayload = JSON.parse(readFileSync(scenarioScriptPath, 'utf8')) as typeof scriptPayload;
    expect(scenarioScriptOutput).toContain(`Wrote patrol simulation script to ${scenarioScriptPath}`);
    expect(scenarioScriptPayload.steps).toHaveLength(scenarioPayload.routes[0]?.segments.length ?? 0);
  });

  it('analyzes layout fill rules from recipes and scenarios through the CLI', () => {
    const root = createTempRoot();
    const recipePath = resolve(root, 'layout.recipe.json');
    const scenarioPath = resolve(root, 'layout.scenario.json');
    const rulesPath = resolve(root, 'layout-rules.json');
    const compiledPlanPath = resolve(root, 'compiled-plan.json');
    const recipe = createGameboardRecipe(
      { seed: 'cli-layout-recipe', shape: { kind: 'rectangle', width: 3, height: 3 } },
      [
        { action: 'setTerrain', at: { q: 1, r: 2 }, terrain: 'water' },
        { action: 'setCoastEdges', at: { q: 1, r: 1 }, waterEdges: [1] },
      ]
    );
    const scenario = createGameboardScenario('cli-layout-scenario', recipe);
    writeFileSync(recipePath, `${JSON.stringify(recipe, null, 2)}\n`, 'utf8');
    writeFileSync(scenarioPath, `${JSON.stringify(scenario, null, 2)}\n`, 'utf8');
    writeFileSync(
      rulesPath,
      `${JSON.stringify(
        {
          seed: 'cli-layout-recipe-fill',
          rules: [
            { id: 'recipe-harbor', archetype: 'harbor', assetId: 'building_docks_blue', count: 1 },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const recipeOutput = runCli([
      'analyze-layout',
      '--recipe',
      recipePath,
      '--rules',
      rulesPath,
      '--allowUnknownAssets',
      '--outPlan',
      compiledPlanPath,
      '--json',
    ]);
    const recipePayload = JSON.parse(jsonPayload(recipeOutput)) as {
      placementCount: number;
      errorCount: number;
      rules: Array<{ id: string; selectedTileKeys: string[] }>;
    };
    const scenarioPayload = JSON.parse(
      jsonPayload(
        runCli([
          'analyze-layout',
          '--scenario',
          scenarioPath,
          '--rules',
          rulesPath,
          '--allowUnknownAssets',
          '--json',
        ])
      )
    ) as typeof recipePayload;

    expect(recipeOutput).toContain(`Wrote compiled GameboardPlan to ${compiledPlanPath}`);
    expect(recipePayload).toMatchObject({
      placementCount: 1,
      errorCount: 0,
      rules: [{ id: 'recipe-harbor', selectedTileKeys: ['1,1'] }],
    });
    expect(scenarioPayload).toMatchObject(recipePayload);
    expect(existsSync(compiledPlanPath)).toBe(true);
  });

  it('validates scenarios through the published command surface', () => {
    const compiledPlanPath = resolve(createTempRoot(), 'scenario-plan.json');

    const output = runCli([
      'validate-scenario',
      '--scenario',
      docsScenarioPath,
      '--manifest',
      freeManifestPath,
      '--outPlan',
      compiledPlanPath,
    ]);

    expect(output).toContain('scenario: docs-simple-rpg-scenario');
    expect(output).toContain('actors: 3');
    expect(output).toContain('quests: 1');
    expect(output).toContain('spawn groups: 3 group(s), 3 location(s), 2/2 route(s)');
    expect(output).toContain('validation: 0 error(s), 0 warning(s)');
    expect(existsSync(compiledPlanPath)).toBe(true);
  });

  it('emits guide permutation metadata through the published command surface', () => {
    const outputPath = resolve(createTempRoot(), 'guide-permutations.json');
    const output = runCli([
      'guide-permutations',
      '--manifest',
      freeManifestPath,
      '--out',
      outputPath,
    ]);
    const payload = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      count: number;
      counts: Record<string, number>;
      missingAssetIds: string[];
      permutations: Array<{ id: string; assetId: string; kind: string }>;
    };

    expect(output).toContain(`Wrote 298 guide permutations to ${outputPath}`);
    expect(payload).toMatchObject({
      count: 298,
      counts: {
        road: 78,
        river: 144,
        'river-curvy': 12,
        'river-crossing': 4,
        coast: 60,
      },
      missingAssetIds: [],
    });
    expect(payload.permutations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'road:A:water:r0', assetId: 'hex_road_A' }),
        expect.objectContaining({
          id: 'river-curvy:A:waterless:r5',
          assetId: 'hex_river_A_curvy_waterless',
        }),
        expect.objectContaining({
          id: 'river-crossing:B:waterless:r0',
          assetId: 'hex_river_crossing_B_waterless',
        }),
        expect.objectContaining({ id: 'coast:E:waterless:r5', assetId: 'hex_coast_E_waterless' }),
      ])
    );
  });

  it('filters guide scenarios and emits per-page treatment joins through the CLI', () => {
    const outputPath = resolve(createTempRoot(), 'guide-scenario-page-14.json');
    const output = runCli([
      'guide-scenarios',
      '--source',
      resolve(createTempRoot(), 'missing-guide-source'),
      '--assetScope',
      'all',
      '--page',
      '14',
      '--includeTreatments',
      '--out',
      outputPath,
    ]);
    const payload = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      count: number;
      pages: number[];
      assetCounts: {
        total: number;
        selected: number;
        free: number;
        extra: number;
        occurrences: number;
        checked: number;
      };
      selection: { pages: number[] };
      scenarioCoverage: Array<{
        scenario: { id: string; page: number };
        page: { scenarioId: string; extraAssets: number };
        assetCounts: { unique: number; extra: number; occurrences: number };
        treatments: Array<{ assetId: string; role: string; publicApi: string[] }>;
      }>;
    };

    expect(output).toContain(`Wrote 1 guide scenarios to ${outputPath}`);
    expect(payload).toMatchObject({
      count: 1,
      pages: [14],
      assetCounts: {
        total: 404,
        selected: 137,
        free: 0,
        extra: 137,
        occurrences: 137,
        checked: 137,
      },
      selection: { pages: [14] },
    });
    expect(payload.scenarioCoverage).toHaveLength(1);
    expect(payload.scenarioCoverage[0]).toMatchObject({
      scenario: { id: 'page-14-units', page: 14 },
      page: { scenarioId: 'page-14-units', extraAssets: 137 },
      assetCounts: { unique: 137, extra: 137, occurrences: 137 },
    });
    expect(payload.scenarioCoverage[0]?.treatments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetId: 'unit_blue_full',
          role: 'colored-unit-part',
          publicApi: expect.arrayContaining(['GameboardBuilder.addUnitPreset']),
        }),
      ])
    );

    const markdownPath = resolve(createTempRoot(), 'guide-scenario-page-14.md');
    const markdownOutput = runCli([
      'guide-scenarios',
      '--page',
      '14',
      '--markdown',
      '--out',
      markdownPath,
    ]);
    const markdown = readFileSync(markdownPath, 'utf8');
    expect(markdownOutput).toContain(`Wrote 1 guide scenario markdown rows to ${markdownPath}`);
    expect(markdown).toContain('# Guide Scenario Coverage');
    expect(markdown).toContain('Scenario: `page-14-units`');
    expect(markdown).not.toContain('Scenario: `page-13-transition-tiles`');
    expect(markdown).toContain('GameboardBuilder.addUnitPreset');
  });

  it('emits renderer-ready guide usage rows through the CLI', () => {
    const outputPath = resolve(createTempRoot(), 'guide-usages-pages-16-18.json');
    const output = runCli([
      'guide-usages',
      '--source',
      resolve(createTempRoot(), 'missing-guide-source'),
      '--page',
      '16,17,18',
      '--out',
      outputPath,
    ]);
    const payload = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      count: number;
      occurrenceCounts: {
        total: number;
        free: number;
        extra: number;
        uniqueAssets: number;
        scenarios: number;
        pages: number;
        missing: number;
      };
      selection: { pages: number[]; minimumEdition: string };
      pages: number[];
      scenarioIds: string[];
      assetIds: string[];
      sourceImages: string[];
      docs: string[];
      visualArtifacts: string[];
      missingAssetIds: string[];
      usages: Array<{
        scenarioId: string;
        page: number;
        assetId: string;
        minimumEdition: string;
        role: string;
        sourcePath: string;
        label: string;
        caption: string;
      }>;
    };

    expect(output).toContain(`Wrote 462 guide usage rows to ${outputPath}`);
    expect(payload).toMatchObject({
      count: 462,
      occurrenceCounts: {
        total: 462,
        free: 33,
        extra: 429,
        scenarios: 3,
        pages: 3,
        missing: 0,
      },
      selection: { pages: [16, 17, 18], minimumEdition: 'all' },
      pages: [16, 17, 18],
      scenarioIds: [
        'page-16-stables-and-horses',
        'page-17-workshop-and-siege',
        'page-18-unit-combinations',
      ],
      missingAssetIds: [],
    });
    expect(payload.occurrenceCounts.uniqueAssets).toBeGreaterThan(100);
    expect(payload.sourceImages).toEqual([
      'docs/assets/kaykit-guide/pages/page-16.png',
      'docs/assets/kaykit-guide/pages/page-17.png',
      'docs/assets/kaykit-guide/pages/page-18.png',
    ]);
    expect(payload.docs.length).toBeGreaterThan(0);
    expect(payload.visualArtifacts).toEqual(
      expect.arrayContaining([
        'packages/medieval-hexagon-gameboard/tests/browser/__screenshots__/extra-local-all-units-full-accent-neutral-siege.png',
      ])
    );
    expect(payload.usages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenarioId: 'page-16-stables-and-horses',
          page: 16,
          assetId: 'building_stables_blue',
          minimumEdition: 'extra',
          role: 'faction-building',
        }),
        expect.objectContaining({
          scenarioId: 'page-17-workshop-and-siege',
          page: 17,
          assetId: 'building_workshop_blue',
          minimumEdition: 'extra',
          role: 'faction-building',
        }),
        expect.objectContaining({
          scenarioId: 'page-18-unit-combinations',
          page: 18,
          assetId: 'unit_blue_full',
          minimumEdition: 'extra',
          role: 'colored-unit-part',
        }),
      ])
    );

    const freePayload = JSON.parse(
      runCli(['guide-usages', '--manifest', freeManifestPath, '--minimumEdition', 'free', '--json'])
    ) as typeof payload;
    expect(freePayload).toMatchObject({
      count: 474,
      occurrenceCounts: { total: 474, free: 474, extra: 0, missing: 0 },
      selection: { minimumEdition: 'free' },
    });

    const propClusterPayload = JSON.parse(
      runCli([
        'guide-usages',
        '--source',
        resolve(createTempRoot(), 'missing-guide-source'),
        '--publicApi',
        'GameboardBuilder.addPropCluster',
        '--json',
      ])
    ) as typeof payload;
    expect(propClusterPayload).toMatchObject({
      count: 74,
      occurrenceCounts: { total: 74 },
      selection: { publicApis: ['GameboardBuilder.addPropCluster'] },
    });
    expect(propClusterPayload.usages.every((usage) => usage.role === 'prop')).toBe(true);

    const roadPayload = JSON.parse(
      runCli(['guide-usages', '--manifest', freeManifestPath, '--assetId', 'hex_road_M', '--json'])
    ) as typeof payload;
    expect(roadPayload).toMatchObject({
      count: 2,
      pages: [3, 9],
      scenarioIds: ['page-03-road-variations', 'page-09-world-design-example'],
      assetIds: ['hex_road_M'],
      occurrenceCounts: { total: 2, free: 2, extra: 0, missing: 0 },
    });
    expect(roadPayload.usages.map((usage) => usage.label)).toEqual([
      'p03:hex_road_M',
      'p09:hex_road_M',
    ]);
  });

  it('emits URL-resolved guide render queues through the CLI', () => {
    const outputPath = resolve(createTempRoot(), 'guide-render-pages-16-18.json');
    const output = runCli([
      'guide-render-requests',
      '--source',
      resolve(createTempRoot(), 'missing-guide-source'),
      '--page',
      '16,17,18',
      '--assetBaseUrl',
      '/@fs/references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA/Assets/gltf',
      '--includeGroups',
      '--out',
      outputPath,
    ]);
    const payload = JSON.parse(readFileSync(outputPath, 'utf8')) as {
      count: number;
      groupCount: number;
      render: { assetBaseUrl: string | null; urlResolvedCount: number };
      occurrenceCounts: {
        total: number;
        free: number;
        extra: number;
        uniqueAssets: number;
        scenarios: number;
        pages: number;
        missing: number;
      };
      selection: { pages: number[]; minimumEdition: string };
      pages: number[];
      scenarioIds: string[];
      missingAssetIds: string[];
      requests: Array<{
        scenarioId: string;
        page: number;
        assetId: string;
        sourcePath: string;
        url: string;
        role: string;
        label: string;
      }>;
      groups: Array<{
        scenarioId: string;
        page: number;
        count: number;
        requests: Array<{ assetId: string; url: string }>;
      }>;
    };

    expect(output).toContain(`Wrote 462 guide render requests to ${outputPath}`);
    expect(payload).toMatchObject({
      count: 462,
      groupCount: 3,
      render: {
        assetBaseUrl: '/@fs/references/KayKit_Medieval_Hexagon_Pack_1.0_EXTRA/Assets/gltf',
        urlResolvedCount: 462,
      },
      occurrenceCounts: {
        total: 462,
        free: 33,
        extra: 429,
        scenarios: 3,
        pages: 3,
        missing: 0,
      },
      selection: { pages: [16, 17, 18], minimumEdition: 'all' },
      pages: [16, 17, 18],
      scenarioIds: [
        'page-16-stables-and-horses',
        'page-17-workshop-and-siege',
        'page-18-unit-combinations',
      ],
      missingAssetIds: [],
    });
    expect(payload.groups.map((group) => [group.page, group.scenarioId, group.count])).toEqual([
      [16, 'page-16-stables-and-horses', 155],
      [17, 'page-17-workshop-and-siege', 170],
      [18, 'page-18-unit-combinations', 137],
    ]);
    expect(payload.groups.flatMap((group) => group.requests)).toHaveLength(462);
    expect(payload.requests[0]).toMatchObject({
      scenarioId: 'page-16-stables-and-horses',
      page: 16,
    });
    expect(payload.requests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenarioId: 'page-16-stables-and-horses',
          page: 16,
          assetId: 'building_stables_blue',
          role: 'faction-building',
        }),
      ])
    );
    expect(payload.requests[0]?.url).toContain('/@fs/references/');

    const freeOutputPath = resolve(createTempRoot(), 'guide-render-free.json');
    const freeOutput = runCli([
      'guide-render-requests',
      '--manifest',
      freeManifestPath,
      '--minimumEdition',
      'free',
      '--assetBaseUrl',
      '/assets/free',
      '--out',
      freeOutputPath,
    ]);
    const freePayload = JSON.parse(readFileSync(freeOutputPath, 'utf8')) as typeof payload;
    expect(freeOutput).toContain(`Wrote 474 guide render requests to ${freeOutputPath}`);
    expect(freePayload).toMatchObject({
      count: 474,
      groupCount: 12,
      render: { assetBaseUrl: '/assets/free', urlResolvedCount: 474 },
      occurrenceCounts: { total: 474, free: 474, extra: 0, missing: 0 },
      selection: { minimumEdition: 'free' },
    });
    expect(freePayload.requests[0]?.url).toBe('/assets/free/decoration/props/barrel.gltf');

    const propClusterOutput = runCli([
      'guide-render-requests',
      '--source',
      resolve(createTempRoot(), 'missing-guide-source'),
      '--publicApi',
      'GameboardBuilder.addPropCluster',
      '--assetBaseUrl',
      '/custom',
    ]);
    expect(propClusterOutput).toContain('guide render requests: 74');
    expect(propClusterOutput).toContain('groups: 5');
    expect(propClusterOutput).toContain('asset base URL: /custom');
  });

  it('emits public API guide coverage and filters scenarios by API surface', () => {
    const apiOutputPath = resolve(createTempRoot(), 'guide-api-harbor.json');
    const apiOutput = runCli([
      'guide-apis',
      '--publicApi',
      'GameboardBuilder.addHarbor',
      '--out',
      apiOutputPath,
    ]);
    const apiPayload = JSON.parse(readFileSync(apiOutputPath, 'utf8')) as {
      count: number;
      publicApis: string[];
      coverage: Array<{
        publicApi: string;
        pages: number[];
        assetCounts: { unique: number; free: number; extra: number };
        treatmentRoles: string[];
      }>;
    };

    expect(apiOutput).toContain(`Wrote 1 guide public API coverages to ${apiOutputPath}`);
    expect(apiPayload).toMatchObject({
      count: 1,
      publicApis: ['GameboardBuilder.addHarbor'],
      coverage: [
        {
          publicApi: 'GameboardBuilder.addHarbor',
          pages: [2, 5, 7, 15],
          treatmentRoles: expect.arrayContaining(['coast-tile', 'faction-building', 'prop']),
        },
      ],
    });
    expect(apiPayload.coverage[0]?.assetCounts.free).toBeGreaterThan(0);
    expect(apiPayload.coverage[0]?.assetCounts.extra).toBeGreaterThan(0);

    const bridgePayload = JSON.parse(
      runCli(['guide-apis', '--publicApi', 'GameboardBuilder.addBridge', '--json'])
    ) as typeof apiPayload;
    expect(bridgePayload).toMatchObject({
      count: 1,
      publicApis: ['GameboardBuilder.addBridge'],
      coverage: [
        {
          publicApi: 'GameboardBuilder.addBridge',
          pages: [2, 7, 9],
          treatmentRoles: ['neutral-structure'],
          assetCounts: { unique: 2, free: 2, extra: 0 },
        },
      ],
    });

    const rampPayload = JSON.parse(
      runCli(['guide-apis', '--publicApi', 'GameboardBuilder.addElevationRamp', '--json'])
    ) as typeof apiPayload;
    expect(rampPayload).toMatchObject({
      count: 1,
      publicApis: ['GameboardBuilder.addElevationRamp'],
      coverage: [
        {
          publicApi: 'GameboardBuilder.addElevationRamp',
          pages: [8, 10],
          treatmentRoles: ['base-tile'],
          assetCounts: { unique: 2, free: 2, extra: 0 },
        },
      ],
    });

    const fortificationPayload = JSON.parse(
      runCli(['guide-apis', '--publicApi', 'GameboardBuilder.addFortification', '--json'])
    ) as typeof apiPayload;
    expect(fortificationPayload).toMatchObject({
      count: 1,
      publicApis: ['GameboardBuilder.addFortification'],
      coverage: [
        {
          publicApi: 'GameboardBuilder.addFortification',
          pages: [2, 16, 17],
          treatmentRoles: ['neutral-structure'],
          assetCounts: { unique: 11, free: 11, extra: 0 },
        },
      ],
    });

    const constructionPayload = JSON.parse(
      runCli(['guide-apis', '--publicApi', 'GameboardBuilder.addConstructionSite', '--json'])
    ) as typeof apiPayload;
    expect(constructionPayload).toMatchObject({
      count: 1,
      publicApis: ['GameboardBuilder.addConstructionSite'],
      coverage: [
        {
          publicApi: 'GameboardBuilder.addConstructionSite',
          pages: [2, 17],
          treatmentRoles: ['neutral-structure'],
          assetCounts: { unique: 7, free: 7, extra: 0 },
        },
      ],
    });

    const projectilePayload = JSON.parse(
      runCli(['guide-apis', '--publicApi', 'GameboardBuilder.addSiegeProjectile', '--json'])
    ) as typeof apiPayload;
    expect(projectilePayload).toMatchObject({
      count: 1,
      publicApis: ['GameboardBuilder.addSiegeProjectile'],
      coverage: [
        {
          publicApi: 'GameboardBuilder.addSiegeProjectile',
          pages: [2, 17],
          treatmentRoles: ['neutral-structure'],
          assetCounts: { unique: 1, free: 1, extra: 0 },
        },
      ],
    });

    const propClusterPayload = JSON.parse(
      runCli(['guide-apis', '--publicApi', 'GameboardBuilder.addPropCluster', '--json'])
    ) as typeof apiPayload;
    expect(propClusterPayload).toMatchObject({
      count: 1,
      publicApis: ['GameboardBuilder.addPropCluster'],
      coverage: [
        {
          publicApi: 'GameboardBuilder.addPropCluster',
          pages: [2, 5, 15, 16, 17],
          treatmentRoles: ['prop'],
          assetCounts: { unique: 31, free: 22, extra: 9 },
        },
      ],
    });

    const scenarioOutput = runCli([
      'guide-scenarios',
      '--publicApi',
      'GameboardBuilder.addHarbor',
      '--json',
    ]);
    const scenarioPayload = JSON.parse(scenarioOutput) as { count: number; pages: number[] };
    expect(scenarioPayload).toMatchObject({ count: 4, pages: [2, 5, 7, 15] });
  }, 15_000);

  it('emits asset guide coverage and filters scenarios by asset id', () => {
    const assetOutputPath = resolve(createTempRoot(), 'guide-asset-road-m.json');
    const assetOutput = runCli([
      'guide-assets',
      '--assetId',
      'hex_road_M',
      '--out',
      assetOutputPath,
    ]);
    const assetPayload = JSON.parse(readFileSync(assetOutputPath, 'utf8')) as {
      count: number;
      assetIds: string[];
      coverage: Array<{
        assetId: string;
        role: string;
        pages: number[];
        publicApi: string[];
        occurrences: number;
      }>;
    };

    expect(assetOutput).toContain(`Wrote 1 guide asset coverages to ${assetOutputPath}`);
    expect(assetPayload).toMatchObject({
      count: 1,
      assetIds: ['hex_road_M'],
      coverage: [
        {
          assetId: 'hex_road_M',
          role: 'road-tile',
          pages: [3, 9],
          publicApi: expect.arrayContaining(['selectRoadVariant', 'GameboardBuilder.addRoadPath']),
          occurrences: 2,
        },
      ],
    });
    expect(assetPayload.coverage[0]?.publicApi).not.toContain('GameboardBuilder.addForest');

    const scenarioOutput = runCli(['guide-scenarios', '--assetId', 'hex_road_M', '--json']);
    const scenarioPayload = JSON.parse(scenarioOutput) as { count: number; pages: number[] };
    expect(scenarioPayload).toMatchObject({ count: 2, pages: [3, 9] });
  });

  it('emits public role guide coverage and filters scenarios by role', () => {
    const roleOutputPath = resolve(createTempRoot(), 'guide-role-road.json');
    const roleOutput = runCli([
      'guide-roles',
      '--role',
      'road-tile',
      '--out',
      roleOutputPath,
    ]);
    const rolePayload = JSON.parse(readFileSync(roleOutputPath, 'utf8')) as {
      count: number;
      roles: string[];
      coverage: Array<{
        role: string;
        pages: number[];
        assetCounts: { unique: number; free: number; extra: number; occurrences: number };
        publicApi: string[];
      }>;
    };

    expect(roleOutput).toContain(`Wrote 1 guide role coverages to ${roleOutputPath}`);
    expect(rolePayload).toMatchObject({
      count: 1,
      roles: ['road-tile'],
      coverage: [
        {
          role: 'road-tile',
          pages: [3, 9],
          assetCounts: { unique: 15, free: 15, extra: 0, occurrences: 30 },
          publicApi: expect.arrayContaining(['selectRoadVariant', 'GameboardBuilder.addRoadPath']),
        },
      ],
    });

    const scenarioOutput = runCli(['guide-scenarios', '--guideRole', 'colored-unit-part', '--json']);
    const scenarioPayload = JSON.parse(scenarioOutput) as { count: number; pages: number[] };
    expect(scenarioPayload).toMatchObject({ count: 4, pages: [14, 16, 17, 18] });
  });

  it('scans local GLTF folders into compatibility-backed piece registries', () => {
    const assetRoot = createExternalPackFixtureRoot();
    const registryPath = resolve(createTempRoot(), 'pieces.json');
    const overridesPath = resolve(createTempRoot(), 'piece-overrides.json');
    const sourceRootsPath = resolve(createTempRoot(), 'piece-source-roots.json');
    writeFileSync(
      overridesPath,
      `${JSON.stringify(
        {
          overrides: {
            'tower-hexagon-base': {
              footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
              criteria: { terrain: ['grass', 'road'], edgePadding: 1 },
              metadata: { placementPreset: 'tower-footprint' },
            },
            'tree-large': {
              criteria: { maxPerTile: 3, slotGroup: 'soft-feature' },
              tags: ['forest'],
            },
            missing: {
              tags: ['unused'],
            },
          },
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    writeFileSync(
      sourceRootsPath,
      `${JSON.stringify({ sourceRoots: { 'Fixture Castle Kit': '/fixture-assets' } }, null, 2)}\n`,
      'utf8'
    );

    const output = runCli([
      'pieces-from-assets',
      '--assets',
      assetRoot,
      '--sourcePack',
      'Fixture Castle Kit',
      '--intendedRole',
      'tile',
      '--assetIdPrefix',
      'fixture',
      '--pieceIdPrefix',
      'fixture-piece',
      '--tags',
      'castle,test',
      '--pieceOverrides',
      overridesPath,
      '--includeReports',
      '--out',
      registryPath,
    ]);
    const payload = JSON.parse(readFileSync(registryPath, 'utf8')) as {
      pieces: Array<{
        id: string;
        assetId: string;
        source: string;
        role: string;
        requiresExtra: boolean;
        tags: string[];
        criteria: Record<string, unknown>;
        metadata: Record<string, unknown>;
      }>;
      assets: string[];
      sourceAssets: Array<{
        id: string;
        relativePath: string;
        fileName: string;
        extension: string;
        path?: string;
      }>;
      reports: Array<{
        id: string;
        compatibleAsTile: boolean;
        suggestedRole: string;
        warnings: string[];
      }>;
      summary: {
        assetCount: number;
        warningCount: number;
        pieceRoles: Record<string, number>;
        overrideWarnings: string[];
      };
    };

    expect(output).toContain(`Wrote 2 piece declarations to ${registryPath}`);
    expect(payload.summary).toMatchObject({
      assetCount: 2,
      pieceRoles: { tree: 1, landmark: 1 },
    });
    expect(payload.summary.warningCount).toBeGreaterThan(0);
    expect(payload.summary.overrideWarnings).toEqual([
      'Piece override missing did not match any scanned asset id',
    ]);
    expect(payload.assets).toEqual(['tower-hexagon-base.gltf', 'tree-large.gltf']);
    expect(payload.sourceAssets).toEqual([
      {
        id: 'tower-hexagon-base',
        relativePath: 'tower-hexagon-base.gltf',
        fileName: 'tower-hexagon-base.gltf',
        extension: '.gltf',
      },
      {
        id: 'tree-large',
        relativePath: 'tree-large.gltf',
        fileName: 'tree-large.gltf',
        extension: '.gltf',
      },
    ]);
    expect(payload.reports.every((report) => report.compatibleAsTile === false)).toBe(true);
    expect(payload.reports.map((report) => report.suggestedRole)).toEqual(['prop', 'prop']);
    expect(payload.reports.map((report) => report.warnings.join('\n')).join('\n')).toContain(
      'does not match the KayKit hex footprint'
    );

    const tower = payload.pieces.find((piece) => piece.id === 'fixture-piece:tower-hexagon-base');
    expect(tower).toMatchObject({
      assetId: 'fixture:tower-hexagon-base',
      source: 'Fixture Castle Kit',
      role: 'landmark',
      requiresExtra: true,
      tags: ['castle', 'test'],
      metadata: {
        externalAsset: true,
        suggestedRole: 'prop',
        placementPreset: 'tower-footprint',
        sourceRelativePath: 'tower-hexagon-base.gltf',
        sourceFileName: 'tower-hexagon-base.gltf',
        localAsset: true,
      },
    });
    expect(tower?.metadata).not.toHaveProperty('sourcePath');
    expect(tower?.criteria).toMatchObject({
      footprint: { kind: 'adjacent', edges: [0, 1], includeCenter: true },
      terrain: ['grass', 'road'],
      edgePadding: 1,
    });
    expect(payload.pieces.find((piece) => piece.id === 'fixture-piece:tree-large')).toMatchObject({
      tags: ['castle', 'test', 'forest'],
      criteria: {
        maxPerTile: 3,
        slotGroup: 'soft-feature',
      },
    });

    const rulesOutput = runCli([
      'pieces',
      '--pieces',
      registryPath,
      '--role',
      'landmark',
      '--emitRules',
      '--emitSourceUrls',
      '--pieceSourceRoots',
      sourceRootsPath,
      '--count',
      '1',
      '--json',
    ]);
    const rulesPayload = JSON.parse(rulesOutput) as {
      rules: Array<{ assetId: string; count: number }>;
      sourceUrls: Record<string, string>;
    };
    expect(rulesPayload.rules).toHaveLength(1);
    expect(rulesPayload.rules[0]).toMatchObject({
      assetId: 'fixture:tower-hexagon-base',
      count: 1,
    });
    expect(rulesPayload.sourceUrls).toMatchObject({
      'fixture:tower-hexagon-base': '/fixture-assets/tower-hexagon-base.gltf',
      'fixture:tree-large': '/fixture-assets/tree-large.gltf',
    });
  });

  it('inspects and appends one declared piece through the published command surface', () => {
    const root = createTempRoot();
    const recipePath = resolve(root, 'place-piece.recipe.json');
    const piecesPath = resolve(root, 'place-piece.pieces.json');
    const inspectionPath = resolve(root, 'place-piece.inspection.json');
    const placedPlanPath = resolve(root, 'place-piece.plan.json');
    const recipe = createGameboardRecipe(
      { seed: 'cli-place-piece-recipe', shape: { kind: 'rectangle', width: 4, height: 3 } },
      [
        { action: 'setTerrain', at: { q: 0, r: 2 }, terrain: 'water' },
        { action: 'setTerrain', at: { q: 1, r: 2 }, terrain: 'water' },
        { action: 'setTerrain', at: { q: 2, r: 2 }, terrain: 'water' },
        { action: 'setTerrain', at: { q: 3, r: 2 }, terrain: 'water' },
        { action: 'setCoastEdges', at: { q: 0, r: 1 }, waterEdges: [1] },
        { action: 'setCoastEdges', at: { q: 1, r: 1 }, waterEdges: [1] },
        { action: 'setCoastEdges', at: { q: 2, r: 1 }, waterEdges: [1] },
        { action: 'setCoastEdges', at: { q: 3, r: 1 }, waterEdges: [1] },
      ]
    );
    writeFileSync(recipePath, `${JSON.stringify(recipe, null, 2)}\n`, 'utf8');
    writeFileSync(
      piecesPath,
      `${JSON.stringify(
        {
          pieces: [
            {
              id: 'local-shipyard',
              assetId: 'local:shipyard',
              source: 'Local Harbor Fixtures',
              role: 'harbor',
              metadata: { fixture: true },
            },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const output = runCli([
      'place-piece',
      '--recipe',
      recipePath,
      '--pieces',
      piecesPath,
      '--pieceId',
      'local-shipyard',
      '--count',
      '1',
      '--seed',
      'cli-place-piece',
      '--idPrefix',
      'cli-shipyard',
      '--out',
      inspectionPath,
      '--outPlan',
      placedPlanPath,
    ]);
    const inspection = JSON.parse(readFileSync(inspectionPath, 'utf8')) as {
      pieceId: string;
      siteInspection: { selectedCount: number; candidateCount: number };
      placements: Array<{
        id: string;
        assetId: string;
        kind: string;
        requiresExtra: boolean;
        metadata: Record<string, unknown>;
      }>;
    };
    const placedPlan = JSON.parse(readFileSync(placedPlanPath, 'utf8')) as {
      placements: Array<{ id: string; assetId: string; metadata: Record<string, unknown> }>;
    };

    expect(output).toContain(`Wrote piece placement inspection to ${inspectionPath}`);
    expect(output).toContain(`Wrote placed GameboardPlan to ${placedPlanPath}`);
    expect(inspection).toMatchObject({
      pieceId: 'local-shipyard',
      siteInspection: {
        selectedCount: 1,
        candidateCount: 4,
      },
      placements: [
        {
          id: 'cli-shipyard:0',
          assetId: 'local:shipyard',
          kind: 'structure',
          requiresExtra: true,
          metadata: {
            fixture: true,
            pieceId: 'local-shipyard',
            pieceRole: 'harbor',
            pieceSource: 'Local Harbor Fixtures',
          },
        },
      ],
    });
    expect(
      placedPlan.placements.find((placement) => placement.id === 'cli-shipyard:0')
    ).toMatchObject({
      assetId: 'local:shipyard',
      metadata: {
        layoutArchetype: 'harbor',
        pieceId: 'local-shipyard',
      },
    });
  });

  it('inspects and appends selected piece fills through the pieces command', () => {
    const root = createTempRoot();
    const planPath = resolve(root, 'piece-fill.plan.json');
    const piecesPath = resolve(root, 'piece-fill.pieces.json');
    const inspectionPath = resolve(root, 'piece-fill.inspection.json');
    const placedPlanPath = resolve(root, 'piece-fill.placed-plan.json');
    const plan = createGameboardBuilder({
      seed: 'cli-piece-fill-plan',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    }).build();
    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    writeFileSync(
      piecesPath,
      `${JSON.stringify(
        {
          pieces: [
            {
              id: 'fixture-large-tree',
              assetId: 'fixture:tree-large',
              source: 'Fixture Pack',
              role: 'tree',
              tags: ['forest'],
            },
            {
              id: 'fixture-small-tree',
              assetId: 'fixture:tree-small',
              source: 'Fixture Pack',
              role: 'tree',
              tags: ['forest'],
            },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const output = runCli([
      'pieces',
      '--pieces',
      piecesPath,
      '--plan',
      planPath,
      '--role',
      'tree',
      '--tags',
      'forest',
      '--mode',
      'pool',
      '--count',
      '2',
      '--seed',
      'cli-piece-fill',
      '--out',
      inspectionPath,
      '--outPlan',
      placedPlanPath,
    ]);
    const payload = JSON.parse(readFileSync(inspectionPath, 'utf8')) as {
      placementInspection: {
        rules: Array<{ id: string; assets: string[] }>;
        analysis: { placementCount: number; errorCount: number };
        placements: Array<{ assetId: string; metadata: Record<string, unknown> }>;
        selections: Array<{ selectedPieceIds: string[]; errors: string[] }>;
      };
    };
    const placedPlan = JSON.parse(readFileSync(placedPlanPath, 'utf8')) as {
      placements: Array<{ assetId: string; metadata: Record<string, unknown> }>;
    };

    expect(output).toContain(`Wrote piece-filled GameboardPlan to ${placedPlanPath}`);
    expect(output).toContain(`Wrote piece registry output to ${inspectionPath}`);
    expect(payload.placementInspection).toMatchObject({
      rules: [{ id: 'piece:pool:0', assets: ['fixture:tree-large', 'fixture:tree-small'] }],
      analysis: { placementCount: 2, errorCount: 0 },
      selections: [{ selectedPieceIds: ['fixture-large-tree', 'fixture-small-tree'], errors: [] }],
    });
    expect(
      payload.placementInspection.placements.map((placement) => placement.assetId).sort()
    ).toEqual(['fixture:tree-large', 'fixture:tree-small']);
    expect(
      placedPlan.placements.filter((placement) => placement.metadata.pieceCollectionSize === 2)
    ).toHaveLength(2);
  });

  it('emits scenario interop snapshots through the published command surface', () => {
    const root = createTempRoot();
    const snapshotPath = resolve(root, 'scenario-snapshot.json');
    const actorOnlySnapshotPath = resolve(root, 'scenario-snapshot-actors-only.json');

    const output = runCli([
      'snapshot',
      '--scenario',
      docsScenarioPath,
      '--manifest',
      freeManifestPath,
      '--spawnCount',
      '2',
      '--spawnSeed',
      'cli-snapshot',
      '--out',
      snapshotPath,
    ]);
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as {
      entities: Array<{ id: string; kind: string }>;
      relations: Array<{ name: string; fromId: string; toId: string }>;
      spawnLocations: Array<{ id: string }>;
      scenario?: { id: string };
    };

    expect(output).toContain('Wrote interop snapshot with');
    expect(snapshot.scenario?.id).toBe('docs-simple-rpg-scenario');
    expect(snapshot.spawnLocations.map((spawn) => spawn.id)).toEqual(
      expect.arrayContaining([
        'spawn:0',
        'spawn:1',
        'spawn:player-start:0',
        'spawn:elder:0',
        'spawn:enemy:0',
      ])
    );
    expect(
      snapshot.entities.some((entity) => entity.kind === 'actor' && entity.id === 'actor:player')
    ).toBe(true);
    expect(snapshot.entities.some((entity) => entity.kind === 'quest')).toBe(true);
    expect(
      snapshot.entities.some(
        (entity) => entity.kind === 'spawn-group' && entity.id === 'spawn-group:enemy'
      )
    ).toBe(true);
    expect(snapshot.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'SpawnGroupHasLocation',
          fromId: 'spawn-group:player-start',
        }),
        expect.objectContaining({ name: 'SpawnGroupRouteCheck', fromId: 'spawn-group:enemy' }),
        expect.objectContaining({
          name: 'ActorPatrolRoute',
          fromId: 'actor:bandit',
          toId: 'patrol-route:bandit-watch',
        }),
        expect.objectContaining({ name: 'ActorOnTile', fromId: 'actor:player' }),
        expect.objectContaining({ name: 'QuestReferencesActor' }),
      ])
    );

    runCli([
      'snapshot',
      '--scenario',
      docsScenarioPath,
      '--manifest',
      freeManifestPath,
      '--spawnCount',
      '2',
      '--spawnSeed',
      'cli-snapshot',
      '--excludeSpawnGroups',
      '--out',
      actorOnlySnapshotPath,
    ]);
    const actorOnlySnapshot = JSON.parse(readFileSync(actorOnlySnapshotPath, 'utf8')) as {
      entities: Array<{ id: string; kind: string }>;
      spawnLocations: Array<{ id: string }>;
    };
    expect(actorOnlySnapshot.spawnLocations.map((spawn) => spawn.id)).toEqual([
      'spawn:0',
      'spawn:1',
    ]);
    expect(actorOnlySnapshot.entities.some((entity) => entity.kind === 'spawn-group')).toBe(false);
  });

  it('runs scenario simulation scripts through the published command surface', () => {
    const root = createTempRoot();
    const scenarioPath = resolve(root, 'simulation-scenario.json');
    const scriptPath = resolve(root, 'simulation-script.json');
    const reportPath = resolve(root, 'simulation-report.json');
    const finalPlanPath = resolve(root, 'simulation-plan.json');
    const interopPath = resolve(root, 'simulation-interop.json');
    writeFileSync(
      scenarioPath,
      `${JSON.stringify(
        {
          schemaVersion: '1.0.0',
          id: 'cli-simulation-scenario',
          board: {
            schemaVersion: '1.0.0',
            options: {
              seed: 'cli-simulation-scenario',
              shape: { kind: 'rectangle', width: 4, height: 1 },
            },
            steps: [
              {
                action: 'addRoadPath',
                path: [
                  { q: 0, r: 0 },
                  { q: 1, r: 0 },
                  { q: 2, r: 0 },
                  { q: 3, r: 0 },
                ],
              },
              {
                action: 'setTileAsset',
                at: { q: 3, r: 0 },
                assetId: 'hex_grass',
                terrain: 'road',
                tags: ['watch-point'],
              },
            ],
          },
          patrolRoutes: [
            {
              id: 'raider-watch',
              count: 2,
              start: '1,0',
              tileTags: ['watch-point'],
              loop: false,
            },
          ],
          actors: [
            {
              id: 'hero-placement',
              actorId: 'hero',
              actorKind: 'player',
              team: 'blue',
              at: '0,0',
              assetId: 'flag_blue',
              kind: 'unit',
              movementAgent: { profile: 'worker', movementBudget: 5 },
            },
            {
              id: 'raider-placement',
              actorId: 'raider',
              actorKind: 'enemy',
              team: 'red',
              hostile: true,
              at: '1,0',
              assetId: 'flag_red',
              kind: 'unit',
              patrolAgent: { routeId: 'raider-watch', movement: { profile: 'ground' } },
            },
            {
              id: 'elder-placement',
              actorId: 'elder',
              actorKind: 'npc',
              team: 'blue',
              at: '2,0',
              assetId: 'flag_green',
              kind: 'prop',
            },
          ],
          quests: [
            {
              id: 'cli-simulation-scenario:intro',
              objectives: [
                {
                  id: 'enemy-blocks',
                  kind: 'collision',
                  actor: 'hero',
                  targetActor: 'raider',
                  expect: 'blocked',
                },
                { id: 'defeat-raider', kind: 'defeat-actor', targetActor: 'raider' },
                { id: 'reach-elder', kind: 'reach-actor', actor: 'hero', targetActor: 'elder' },
              ],
            },
          ],
          expectations: {
            requiredEventTypes: ['command-handler-required', 'quest-completed'],
            mutations: [{ type: 'actor-removed', actorId: 'raider', removed: true }],
            actors: [
              { actorId: 'hero', tileKey: '2,0' },
              { actorId: 'raider', exists: false },
            ],
            quests: [{ questId: 'cli-simulation-scenario:intro', status: 'completed' }],
          },
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    writeFileSync(
      scriptPath,
      `${JSON.stringify(
        {
          schemaVersion: '1.0.0',
          defaultSourceActor: 'hero',
          steps: [
            {
              action: 'inspect-actor-targets',
              id: 'scan-raider',
              sourceActor: 'hero',
              targeting: { hostileToSource: true, approach: 'nearest', includeUnreachable: true },
            },
            {
              action: 'run-systems',
              id: 'raider-patrol',
              systems: {
                patrols: { movement: { profile: 'ground' } },
                movement: { steps: 10 },
                quests: false,
              },
            },
            {
              action: 'actor-target-command',
              id: 'attack-raider',
              targetActorId: 'raider',
              requireReachable: true,
              targeting: { hostileToSource: true, approach: 'nearest', maxPathCost: 6 },
              systems: { patrols: false, movement: false, quests: { step: 1 } },
            },
            {
              action: 'remove-actor',
              id: 'resolve-combat',
              actorId: 'raider',
              systems: { patrols: false, movement: false, quests: { step: 2 } },
            },
            {
              action: 'command',
              id: 'walk-to-elder',
              target: '2,0',
              systems: { patrols: false, movement: { steps: 10 }, quests: { step: 3 } },
            },
          ],
          expectations: {
            actorTargets: [
              {
                stepId: 'scan-raider',
                sourceActorId: 'hero',
                targetActorIds: ['raider'],
                reachableActorIds: ['raider'],
                nearestActorId: 'raider',
                targetActorId: 'raider',
                targetCommandKind: 'attack-actor',
                targetCommandCanExecute: true,
              },
              {
                stepId: 'attack-raider',
                sourceActorId: 'hero',
                targetActorIds: ['raider'],
                reachableActorIds: ['raider'],
                nearestActorId: 'raider',
                targetActorId: 'raider',
                targetCommandKind: 'attack-actor',
                targetCommandCanExecute: true,
              },
            ],
          },
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const validationOutput = runCli([
      'validate-simulation',
      '--scenario',
      scenarioPath,
      '--script',
      scriptPath,
      '--manifest',
      freeManifestPath,
    ]);
    expect(validationOutput).toContain('scenario: cli-simulation-scenario');
    expect(validationOutput).toContain('steps: 5');
    expect(validationOutput).toContain('validation: 0 error(s), 0 warning(s)');

    const output = runCli([
      'simulate-scenario',
      '--scenario',
      scenarioPath,
      '--script',
      scriptPath,
      '--manifest',
      freeManifestPath,
      '--out',
      reportPath,
      '--outPlan',
      finalPlanPath,
      '--outInterop',
      interopPath,
    ]);
    const report = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      scenarioId: string;
      steps: Array<{
        id: string;
        command?: { kind: string; status: string };
        actorTargets?: {
          sourceActorId?: string;
          targetActorIds: string[];
          reachableActorIds: string[];
          nearestTarget?: { actorId: string; commandKind: string; commandCanExecute: boolean };
        };
      }>;
      success: boolean;
      expectationFailures: unknown[];
      eventRecords: Array<{ type: string }>;
      commands: Array<{
        stepId: string;
        eventType: string;
        command: { kind: string; status: string };
      }>;
      patrols: Array<{
        stepId: string;
        eventType: string;
        patrol: { actorId?: string; routeId: string; targetKey?: string };
      }>;
      actorTargets: Array<{
        stepId: string;
        sourceActorId: string;
        targetActorIds: string[];
        reachableActorIds: string[];
        nearestTarget?: { actorId: string; commandKind: string; commandCanExecute: boolean };
      }>;
      movements: Array<{ stepId: string; eventType: string; movement: { moved: boolean } }>;
      mutations: Array<{ type: string; actorId: string; removed: boolean }>;
      actors: Array<{ actorId: string; placement: { tileKey: string } }>;
      quests: Array<{ status: string }>;
    };
    const interop = JSON.parse(readFileSync(interopPath, 'utf8')) as {
      scenario?: { id: string; metadata: { success: boolean; source: string } };
      entities: Array<{ id: string; kind: string; components: Record<string, unknown> }>;
      relations: Array<{ name: string; fromId: string; toId: string }>;
    };

    expect(output).toContain(`Wrote final simulated GameboardPlan to ${finalPlanPath}`);
    expect(output).toContain(`Wrote simulation interop snapshot to ${interopPath}`);
    expect(output).toContain(`Wrote scenario simulation report to ${reportPath}`);
    expect(output).toContain('actor target records: 2');
    expect(output).toContain('scan-raider: hero found 1/1 reachable; nearest raider');
    expect(output).toContain('attack-raider: hero found 1/1 reachable; nearest raider');
    expect(report.scenarioId).toBe('cli-simulation-scenario');
    expect(report.success).toBe(true);
    expect(report.expectationFailures).toEqual([]);
    expect(report.steps.find((step) => step.id === 'scan-raider')).toMatchObject({
      id: 'scan-raider',
      actorTargets: {
        sourceActorId: 'hero',
        targetActorIds: ['raider'],
        reachableActorIds: ['raider'],
        nearestTarget: {
          actorId: 'raider',
          commandKind: 'attack-actor',
          commandCanExecute: true,
        },
      },
    });
    expect(report.steps.find((step) => step.id === 'attack-raider')).toMatchObject({
      id: 'attack-raider',
      command: { kind: 'attack-actor', status: 'requires-game-handler' },
      actorTargets: {
        sourceActorId: 'hero',
        targetActorIds: ['raider'],
        reachableActorIds: ['raider'],
        nearestTarget: {
          actorId: 'raider',
          commandKind: 'attack-actor',
          commandCanExecute: true,
        },
      },
    });
    expect(report.eventRecords.map((event) => event.type)).toContain('patrol-move-requested');
    expect(report.eventRecords.map((event) => event.type)).toContain('quest-completed');
    expect(report.commands).toEqual([
      expect.objectContaining({
        stepId: 'attack-raider',
        eventType: 'command-handler-required',
        command: expect.objectContaining({ kind: 'attack-actor', status: 'requires-game-handler' }),
      }),
      expect.objectContaining({
        stepId: 'walk-to-elder',
        eventType: 'movement-requested',
        command: expect.objectContaining({ kind: 'move', status: 'requested-move' }),
      }),
    ]);
    expect(report.patrols).toEqual([
      expect.objectContaining({
        stepId: 'raider-patrol',
        eventType: 'patrol-move-requested',
        patrol: expect.objectContaining({
          actorId: 'raider',
          routeId: 'raider-watch',
          targetKey: '3,0',
        }),
      }),
    ]);
    expect(report.actorTargets).toEqual([
      expect.objectContaining({
        stepId: 'scan-raider',
        sourceActorId: 'hero',
        targetActorIds: ['raider'],
        reachableActorIds: ['raider'],
        nearestTarget: expect.objectContaining({
          actorId: 'raider',
          commandKind: 'attack-actor',
          commandCanExecute: true,
        }),
      }),
      expect.objectContaining({
        stepId: 'attack-raider',
        sourceActorId: 'hero',
        targetActorIds: ['raider'],
        reachableActorIds: ['raider'],
        nearestTarget: expect.objectContaining({
          actorId: 'raider',
          commandKind: 'attack-actor',
          commandCanExecute: true,
        }),
      }),
    ]);
    expect(report.movements).toEqual([
      expect.objectContaining({ stepId: 'raider-patrol', eventType: 'movement-stepped' }),
      expect.objectContaining({ stepId: 'raider-patrol', eventType: 'movement-completed' }),
      expect.objectContaining({ stepId: 'walk-to-elder', eventType: 'movement-requested' }),
      expect.objectContaining({ stepId: 'walk-to-elder', eventType: 'movement-stepped' }),
      expect.objectContaining({ stepId: 'walk-to-elder', eventType: 'movement-completed' }),
    ]);
    expect(report.mutations).toMatchObject([
      { type: 'actor-removed', actorId: 'raider', removed: true },
    ]);
    expect(report.actors.find((actor) => actor.actorId === 'hero')?.placement.tileKey).toBe('2,0');
    expect(report.quests).toEqual([expect.objectContaining({ status: 'completed' })]);
    expect(existsSync(finalPlanPath)).toBe(true);
    expect(interop.scenario).toEqual({
      id: 'cli-simulation-scenario',
      metadata: { success: true, source: 'simulation-report' },
    });
    expect(interop.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'simulation:cli-simulation-scenario', kind: 'simulation' }),
        expect.objectContaining({ kind: 'simulation-command' }),
        expect.objectContaining({ kind: 'simulation-actor-targets' }),
        expect.objectContaining({ kind: 'simulation-patrol' }),
        expect.objectContaining({ kind: 'simulation-movement' }),
        expect.objectContaining({ kind: 'simulation-mutation' }),
        expect.objectContaining({
          id: 'actor:raider',
          kind: 'actor',
          components: {
            GameboardActorReference: {
              actorId: 'raider',
              exists: false,
              source: 'simulation-timeline',
            },
          },
        }),
      ])
    );
    expect(interop.relations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'SimulationStepActorTargets' }),
        expect.objectContaining({ name: 'ActorTargetsSourceActor', toId: 'actor:hero' }),
        expect.objectContaining({ name: 'ActorTargetsTargetActor', toId: 'actor:raider' }),
        expect.objectContaining({ name: 'PatrolActor', toId: 'actor:raider' }),
        expect.objectContaining({ name: 'PatrolPlacement', toId: 'placement:raider-placement' }),
        expect.objectContaining({ name: 'MovementActor', toId: 'actor:hero' }),
        expect.objectContaining({ name: 'MutationActor', toId: 'actor:raider' }),
      ])
    );
    expect(existsSync(interopPath)).toBe(true);

    writeFileSync(
      scriptPath,
      `${JSON.stringify(
        {
          schemaVersion: '1.0.0',
          steps: [{ action: 'run-systems', systems: { movement: false, quests: { step: 1 } } }],
          expectations: {
            actors: [{ actorId: 'hero', tileKey: '2,0' }],
          },
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    const failedOutput = runCliExpectFailure([
      'simulate-scenario',
      '--scenario',
      scenarioPath,
      '--script',
      scriptPath,
      '--manifest',
      freeManifestPath,
      '--out',
      reportPath,
    ]);
    const failedReport = JSON.parse(readFileSync(reportPath, 'utf8')) as {
      success: boolean;
      expectationFailures: Array<{ path: string }>;
    };
    expect(failedOutput).toContain('expectation failures:');
    expect(failedReport.success).toBe(false);
    expect(failedReport.expectationFailures).toEqual([
      expect.objectContaining({ path: 'expectations.actors.hero.tileKey' }),
    ]);

    writeFileSync(
      scriptPath,
      `${JSON.stringify(
        {
          schemaVersion: '1.0.0',
          steps: [{ action: 'command', target: { actorId: 'missing-raider' } }],
          expectations: {
            requiredEventTypes: ['not-a-system-event'],
          },
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    const invalidScriptOutput = runCliExpectFailure([
      'simulate-scenario',
      '--scenario',
      scenarioPath,
      '--script',
      scriptPath,
      '--manifest',
      freeManifestPath,
    ]);
    expect(invalidScriptOutput).toContain('validation: 2 error(s), 0 warning(s)');
    expect(invalidScriptOutput).toContain('simulation.command_target_actor_missing');
    expect(invalidScriptOutput).toContain('simulation.expectation_event_type');

    const validateInvalidScriptOutput = runCliExpectFailure([
      'validate-simulation',
      '--scenario',
      scenarioPath,
      '--script',
      scriptPath,
      '--manifest',
      freeManifestPath,
    ]);
    expect(validateInvalidScriptOutput).toContain('validation: 2 error(s), 0 warning(s)');
    expect(validateInvalidScriptOutput).toContain('simulation.command_target_actor_missing');
    expect(validateInvalidScriptOutput).toContain('simulation.expectation_event_type');
  });

  it('rejects scenario JSON with duplicate actors before creating a runtime world', () => {
    const scenarioPath = resolve(createTempRoot(), 'invalid-scenario.json');
    writeFileSync(
      scenarioPath,
      `${JSON.stringify(
        {
          schemaVersion: '1.0.0',
          id: 'invalid-cli-scenario',
          board: {
            schemaVersion: '1.0.0',
            options: {
              seed: 'invalid-cli-scenario',
              shape: { kind: 'rectangle', width: 2, height: 2 },
            },
            steps: [],
          },
          actors: [
            { actorId: 'player', at: '0,0', assetId: 'flag_blue', kind: 'unit' },
            { actorId: 'player', at: '1,1', assetId: 'missing_actor_asset', kind: 'prop' },
          ],
          quests: [
            {
              id: 'invalid-cli-quest',
              objectives: [
                { id: 'missing', kind: 'reach-actor', actor: 'player', targetActor: 'elder' },
              ],
            },
          ],
        },
        null,
        2
      )}\n`,
      'utf8'
    );

    const output = runCliExpectFailure([
      'validate-scenario',
      '--scenario',
      scenarioPath,
      '--manifest',
      freeManifestPath,
    ]);

    expect(output).toContain('validation: 3 error(s), 0 warning(s)');
    expect(output).toContain('scenario.actor_duplicate');
    expect(output).toContain('scenario.actor_unknown_asset');
    expect(output).toContain('scenario.objective_missing_target_actor');

    const allowedOutput = runCliExpectFailure([
      'validate-scenario',
      '--scenario',
      scenarioPath,
      '--manifest',
      freeManifestPath,
      '--allowUnknownAssetIds',
      'missing_actor_asset',
    ]);
    expect(allowedOutput).toContain('validation: 2 error(s), 0 warning(s)');
    expect(allowedOutput).not.toContain('scenario.actor_unknown_asset');
  });

  it('exits non-zero when source validation fails', () => {
    const sourceRoot = createFixtureSourceRoot();

    expect(() => runCli(['validate', '--source', sourceRoot])).toThrow(
      /Expected 221 free GLTF files, found 1/
    );
  });
});

function runCli(args: readonly string[]): string {
  return execFileSync('pnpm', ['exec', 'tsx', 'src/cli.ts', ...args], {
    cwd: packageRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function runCliExpectFailure(args: readonly string[]): string {
  try {
    runCli(args);
  } catch (error) {
    const output = error as { stderr?: unknown; stdout?: unknown };
    return `${String(output.stdout ?? '')}${String(output.stderr ?? '')}`;
  }
  throw new Error(`Expected CLI failure for ${args.join(' ')}`);
}

function jsonPayload(output: string): string {
  const index = output.indexOf('{');
  if (index === -1) {
    throw new Error(`Output did not contain a JSON object: ${output}`);
  }
  return output.slice(index);
}

function createTempRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), 'medieval-hexagon-cli-'));
  createdRoots.push(root);
  return root;
}

function createFixtureSourceRoot(): string {
  const root = createTempRoot();
  const assetDir = resolve(root, 'Assets/gltf/tiles/base');
  mkdirSync(assetDir, { recursive: true });
  writeFileSync(
    resolve(assetDir, 'hex_grass.gltf'),
    `${JSON.stringify(
      {
        asset: { version: '2.0' },
        accessors: [{ min: [-1, 0, -1.1547], max: [1, 0.4, 1.1547] }],
        buffers: [{ uri: 'hex_grass.bin', byteLength: 0 }],
        images: [{ uri: 'hexagons_medieval.png' }],
        materials: [{ name: 'hexagons_medieval' }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  writeFileSync(resolve(assetDir, 'hex_grass.bin'), '');
  writeFileSync(resolve(assetDir, 'hexagons_medieval.png'), '');
  return root;
}

function createExternalPackFixtureRoot(): string {
  const root = createTempRoot();
  writeGltfBounds(resolve(root, 'tower-hexagon-base.gltf'), [-0.45, 0, -0.39], [0.45, 1.25, 0.39]);
  writeGltfBounds(resolve(root, 'tree-large.gltf'), [-0.22, 0, -0.18], [0.22, 1.6, 0.18]);
  return root;
}

function writeGltfBounds(
  path: string,
  min: [number, number, number],
  max: [number, number, number]
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        asset: { version: '2.0' },
        accessors: [{ min, max }],
        buffers: [{ uri: `${basename(path, '.gltf')}.bin`, byteLength: 0 }],
        materials: [{ name: 'fixture_material' }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
}
