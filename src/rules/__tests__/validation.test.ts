import { describe, expect, it } from 'vitest';
import { createGameboardBuilder } from '../../gameboard/index';
import { createManifestBundle } from '../../manifest/schema';
import { applyTileDeclaration, createHexTileRegistry } from '../../scenario/registry';
import type { MedievalHexagonAsset, MedievalHexagonManifest, PackEdition } from '../../types/index';
import { canStackInPlan, validateGameboardPlan } from '../../rules/validation';

describe('engine-neutral plan validation', () => {
  it('validates declaration stack rules without creating a Koota world', () => {
    const registry = createHexTileRegistry([
      {
        id: 'custom_hex_lava',
        assetId: 'custom_hex_lava',
        role: 'base',
        terrain: 'lava',
        stack: { canStack: false },
      },
    ]);
    const plan = createGameboardBuilder({
      seed: 'stack-rule',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    })
      .setTileAsset({
        at: { q: 0, r: 0 },
        assetId: 'custom_hex_lava',
        terrain: 'lava',
        elevation: 1,
      })
      .build();

    const violations = validateGameboardPlan(plan, { registry });

    expect(canStackInPlan(plan, { q: 0, r: 0 }, 1, { registry })).toBe(false);
    expect(violations.map((violation) => violation.code)).toContain('declaration.stack_forbidden');
  });

  it('validates custom adjacency channels and reciprocal edges from registered placements', () => {
    const registry = createHexTileRegistry([
      {
        id: 'custom_hex_path',
        assetId: 'custom_hex_path',
        role: 'road',
        edges: { path: [0] },
        adjacency: [{ channel: 'path', mask: 1 << 0, reciprocal: true }],
      },
    ]);
    const oneWayBuilder = createGameboardBuilder({
      seed: 'one-way',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    applyTileDeclaration(oneWayBuilder, registry, { at: { q: 0, r: 0 }, declaration: 'custom_hex_path' });
    const oneWay = oneWayBuilder.build();

    const connectedBuilder = createGameboardBuilder({
      seed: 'connected',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    applyTileDeclaration(connectedBuilder, registry, { at: { q: 0, r: 0 }, declaration: 'custom_hex_path' });
    applyTileDeclaration(connectedBuilder, registry, {
      at: { q: 1, r: 0 },
      declaration: 'custom_hex_path',
      rotationSteps: 3,
    });
    const connected = connectedBuilder.build();

    expect(validateGameboardPlan(oneWay, { registry }).map((violation) => violation.code)).toContain(
      'declaration.missing_reciprocal_edge'
    );
    expect(
      validateGameboardPlan(connected, { registry }).some(
        (violation) => violation.code === 'declaration.missing_reciprocal_edge'
      )
    ).toBe(false);
  });

  it('validates custom neighbor terrain requirements', () => {
    const registry = createHexTileRegistry([
      {
        id: 'custom_lava_dock',
        assetId: 'custom_lava_dock',
        role: 'surface',
        edges: { lavaDock: [0] },
        adjacency: [
          {
            channel: 'lavaDock',
            mask: 1 << 0,
            reciprocal: false,
            requiresNeighborTerrain: ['lava'],
          },
        ],
      },
    ]);
    const builder = createGameboardBuilder({
      seed: 'terrain-requirement',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    applyTileDeclaration(builder, registry, { at: { q: 0, r: 0 }, declaration: 'custom_lava_dock' });
    const plan = builder.build();

    expect(validateGameboardPlan(plan, { registry }).map((violation) => violation.code)).toContain(
      'declaration.adjacency_required_terrain'
    );
  });

  it('rotates custom adjacency rule masks for registered placement declarations', () => {
    const registry = createHexTileRegistry([
      {
        id: 'custom_lava_dock',
        assetId: 'custom_lava_dock',
        role: 'surface',
        edges: { lavaDock: [0] },
        adjacency: [
          {
            channel: 'lavaDock',
            mask: 1 << 0,
            reciprocal: false,
            requiresNeighborTerrain: ['lava'],
          },
        ],
      },
    ]);
    const builder = createGameboardBuilder({
      seed: 'rotated-terrain-requirement',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    });
    applyTileDeclaration(builder, registry, {
      at: { q: 1, r: 0 },
      declaration: 'custom_lava_dock',
      rotationSteps: 3,
    });
    const plan = builder.build();
    const violations = validateGameboardPlan(plan, { registry });

    expect(violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'declaration.adjacency_required_terrain',
          tileKey: '1,0',
          placementId: expect.stringContaining('custom_lava_dock'),
        }),
      ])
    );
    expect(violations.map((violation) => violation.message).join('\n')).toContain('edge 3');
  });

  it('does not apply registered reciprocal rules to built-in coast masks', () => {
    const registry = createHexTileRegistry([
      { id: 'hex_grass', role: 'base', terrain: 'grass' },
      { id: 'hex_water', role: 'base', terrain: 'water' },
      { id: 'hex_grass_bottom', role: 'support', terrain: 'grass' },
    ]);
    const plan = createGameboardBuilder({
      seed: 'built-in-coast',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    })
      .setCoastEdges({ q: 0, r: 0 }, [0])
      .setTerrain({ q: 1, r: 0 }, 'water')
      .build();

    expect(validateGameboardPlan(plan, { registry }).map((violation) => violation.code)).not.toContain(
      'declaration.missing_reciprocal_edge'
    );
  });

  it('validates plan asset references against an optional manifest catalog', () => {
    const base = createGameboardBuilder({
      seed: 'asset-catalog',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    })
      .addFlag({ q: 0, r: 0 }, 'blue')
      .build();
    const unknownPlacement = {
      ...base,
      placements: base.placements.map((placement) => ({ ...placement, assetId: 'missing_asset' })),
    };
    const unnecessaryExtraFlag = {
      ...base,
      placements: base.placements.map((placement) => ({ ...placement, requiresExtra: true })),
    };

    expect(
      validateGameboardPlan(unknownPlacement, { assetCatalog: freeCatalogFixture() }).map((violation) => violation.code)
    ).toContain('asset.unknown');
    expect(
      validateGameboardPlan(unnecessaryExtraFlag, { assetCatalog: freeCatalogFixture() }).map(
        (violation) => violation.code
      )
    ).toContain('asset.extra_flag_unnecessary');
  });

  it('requires requiresExtra when a placement resolves to an EXTRA manifest asset', () => {
    const base = createGameboardBuilder({
      seed: 'extra-asset-catalog',
      shape: { kind: 'rectangle', width: 1, height: 1 },
    })
      .addFlag({ q: 0, r: 0 }, 'blue')
      .build();
    const plan = {
      ...base,
      placements: base.placements.map((placement) => ({
        ...placement,
        assetId: 'unit_blue_full',
        requiresExtra: false,
      })),
    };
    const catalog = createManifestBundle([
      manifestFixture('extra', [assetFixture({ id: 'unit_blue_full', edition: 'extra', category: 'units' })]),
    ]);

    expect(
      validateGameboardPlan(plan, { assetCatalog: catalog, allowUnknownAssets: true }).map(
        (violation) => violation.code
      )
    ).toContain('asset.extra_flag_missing');
  });

  it('validates layout footprint references and blocking footprint overlap', () => {
    const base = createGameboardBuilder({
      seed: 'footprint-validation',
      shape: { kind: 'rectangle', width: 3, height: 1 },
    })
      .addPlacement({
        at: { q: 0, r: 0 },
        assetId: 'external:gatehouse',
        kind: 'prop',
        layer: 'feature',
        requiresExtra: true,
        metadata: {
          layoutBlocksMovement: true,
          layoutFootprintTiles: '0,0|1,0',
        },
      })
      .addPlacement({
        at: { q: 1, r: 0 },
        assetId: 'building_tower_A_blue',
        kind: 'structure',
        layer: 'structure',
      })
      .build();
    const footprintPlacement = base.placements[0];
    if (!footprintPlacement) {
      throw new Error('Expected footprint placement fixture');
    }
    const missingFootprint = {
      ...base,
      placements: [
        ...base.placements,
        {
          ...footprintPlacement,
          id: 'external:bad-footprint',
          metadata: {
            layoutBlocksMovement: true,
            layoutFootprintTiles: '9,9',
          },
        },
      ],
    };

    expect(validateGameboardPlan(base, { allowUnknownAssets: true }).map((violation) => violation.code)).toContain(
      'placement.blocking_footprint_overlap'
    );
    expect(
      validateGameboardPlan(missingFootprint, { allowUnknownAssets: true }).map((violation) => violation.code)
    ).toContain('placement.footprint_missing_tile');
  });

  it('skips coast-adjacency validation when requireCoastsTouchWater=false (E0a)', () => {
    const plan = createGameboardBuilder({
      seed: 'coast-disabled',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    })
      .setCoastEdges({ q: 0, r: 0 }, [0])
      // No water neighbor — would normally trigger coast.adjacent_land.
      .build();
    const violations = validateGameboardPlan(plan, { requireCoastsTouchWater: false });
    expect(violations.map((v) => v.code)).not.toContain('coast.adjacent_land');
  });

  it('reports stack.max_elevation when tile elevation exceeds global cap (E0a)', () => {
    const plan = createGameboardBuilder({
      seed: 'stack-max-cap',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    })
      .setTileAsset({
        at: { q: 0, r: 0 },
        assetId: 'hex_grass',
        terrain: 'grass',
        elevation: 5,
      })
      .build();
    const violations = validateGameboardPlan(plan, { maxElevation: 1 });
    expect(violations.map((v) => v.code)).toContain('stack.max_elevation');
  });

  it('reports declaration.stack_support_mismatch when tile.supportAssetId differs (E0b)', () => {
    // Covers validation.ts line 173.
    const registry = createHexTileRegistry([
      {
        id: 'cliff',
        assetId: 'cliff',
        role: 'base',
        terrain: 'grass',
        stack: { canStack: true, maxElevation: 3, supportAssetId: 'hex_grass' },
      },
    ]);
    const plan = createGameboardBuilder({
      seed: 'support-mismatch',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    })
      .setTileAsset({
        at: { q: 0, r: 0 },
        assetId: 'cliff',
        terrain: 'grass',
        elevation: 1,
        supportAssetId: 'hex_dirt',
      })
      .build();
    const violations = validateGameboardPlan(plan, { registry });
    expect(violations.map((v) => v.code)).toContain('declaration.stack_support_mismatch');
  });

  it('skips road/river reciprocal validation when both flags disabled (E0b)', () => {
    const plan = createGameboardBuilder({
      seed: 'recip-disabled',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    })
      .setTileAsset({
        at: { q: 0, r: 0 },
        assetId: 'hex_road_A',
        terrain: 'grass',
      })
      .build();
    const violations = validateGameboardPlan(plan, {
      requireReciprocalRoads: false,
      requireReciprocalRivers: false,
    });
    expect(violations.map((v) => v.code)).not.toContain('road.missing_reciprocal_edge');
    expect(violations.map((v) => v.code)).not.toContain('river.missing_reciprocal_edge');
  });

  it('reports declaration.stack_max_elevation when declaration caps elevation (E0a)', () => {
    const registry = createHexTileRegistry([
      {
        id: 'capped',
        assetId: 'capped',
        role: 'base',
        terrain: 'grass',
        stack: { canStack: true, maxElevation: 1 },
      },
    ]);
    const plan = createGameboardBuilder({
      seed: 'stack-decl-cap',
      shape: { kind: 'rectangle', width: 2, height: 1 },
    })
      .setTileAsset({
        at: { q: 0, r: 0 },
        assetId: 'capped',
        terrain: 'grass',
        elevation: 3,
      })
      .build();
    const violations = validateGameboardPlan(plan, { registry });
    expect(violations.map((v) => v.code)).toContain('declaration.stack_max_elevation');
  });
});

function freeCatalogFixture(): MedievalHexagonManifest {
  return manifestFixture('free', [
    assetFixture({ id: 'hex_grass', edition: 'free', category: 'tiles', subcategory: 'base' }),
    assetFixture({ id: 'hex_grass_bottom', edition: 'free', category: 'tiles', subcategory: 'base' }),
    assetFixture({ id: 'flag_blue', edition: 'free', category: 'decoration', subcategory: 'props' }),
  ]);
}

function manifestFixture(
  edition: PackEdition,
  assets: readonly MedievalHexagonAsset[]
): MedievalHexagonManifest {
  return {
    schemaVersion: '1.0.0',
    generatedAt: '2026-05-22T00:00:00.000Z',
    edition,
    sourcePack: {
      name: 'KayKit: Medieval Hexagon Pack',
      version: '1.0',
      edition,
      creator: 'Kay Lousberg',
      license: 'CC0-1.0',
      licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      sourceRootName: `fixture-${edition}`,
    },
    textureSets: ['default'],
    assets,
    assetsById: Object.fromEntries(assets.map((asset) => [asset.id, asset])),
    counts: {
      total: assets.length,
      byCategory: {},
      bySubcategory: {},
    },
  };
}

function assetFixture(
  overrides: Partial<MedievalHexagonAsset> &
    Pick<MedievalHexagonAsset, 'id' | 'edition' | 'category'>
): MedievalHexagonAsset {
  const subcategory = overrides.subcategory ?? 'fixture';
  const { id, edition, category } = overrides;
  return {
    ...overrides,
    id,
    edition,
    category,
    subcategory,
    family: overrides.id,
    faction: undefined,
    unitStyle: undefined,
    textureSet: 'default',
    modelPath: `assets/${overrides.edition}/${overrides.category}/${subcategory}/${overrides.id}.gltf`,
    sourcePath: `${overrides.category}/${subcategory}/${overrides.id}.gltf`,
    bufferPaths: [],
    texturePaths: [],
    materialSlots: [],
    bounds: { min: [0, 0, 0], max: [1, 1, 1], size: [1, 1, 1] },
    fileSizeBytes: 1,
  };
}
