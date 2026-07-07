/**
 * `src/asset-source/tileset-manifest.ts` — the Zod-validated TilesetManifest
 * (RFC 0001 G2 / RFC0-8).
 *
 * A tileset source is described by a sheet-shaped manifest: named sheets, each a
 * PNG with a cell grid and a role, plus a biome→sheet map. This is the sheet
 * analogue of the FREE GLTF manifest — it enables a `tileset` AssetSource to
 * resolve a placement's biome/edge to a positional cell on a sheet, which the
 * three bridge renders as a textured-hex mesh.
 *
 * The first real tileset is little-legends' 10 sheets (480×830, a 5×10 grid of
 * 96×83 pointy-top hexes). Biome→sheet mapping is the consumer's concern.
 *
 * See `docs/plans/declarative-render-surface.design.md` §"Tileset manifest".
 *
 * @module
 */
import { z } from 'zod';

/** How cells tile a sheet image (pixels). */
const tilesetGridSchema = z.object({
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
  cellWidth: z.number().int().positive(),
  cellHeight: z.number().int().positive(),
});
export type TilesetGrid = z.infer<typeof tilesetGridSchema>;

/**
 * A sheet's role in the tiling:
 *   - `fill`: cells are interchangeable variations of one biome (pick by hash).
 *   - `transition`: cells are positional — an edge mask selects a specific cell.
 */
export const TILESET_SHEET_ROLES = ['fill', 'transition'] as const;
export type TilesetSheetRole = (typeof TILESET_SHEET_ROLES)[number];

/** Biome selection strategy across a fill sheet's usable cells. */
export const TILESET_BIOME_SELECTORS = ['hash', 'first'] as const;
export type TilesetBiomeSelector = (typeof TILESET_BIOME_SELECTORS)[number];

const sheetIdSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9._-]+$/, 'sheet id must be [A-Za-z0-9._-]');

const sheetSchema = z
  .object({
    /** Sheet image URL, relative to the asset root. */
    url: z.string().min(1),
    grid: tilesetGridSchema,
    role: z.enum(TILESET_SHEET_ROLES),
    /**
     * `fill`: cell indices usable as any variation (default: all cells).
     * A cell index is row-major: `row * cols + col`, 0-based.
     */
    variants: z.array(z.number().int().nonnegative()).optional(),
    /**
     * `transition`: canonical edge mask → cell index. Required (and only
     * meaningful) for transition sheets.
     */
    edgeCells: z.record(z.string(), z.number().int().nonnegative()).optional(),
  })
  .superRefine((sheet, ctx) => {
    const cellCount = sheet.grid.cols * sheet.grid.rows;
    if (sheet.role === 'transition') {
      if (!sheet.edgeCells || Object.keys(sheet.edgeCells).length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'transition sheet requires a non-empty edgeCells map',
          path: ['edgeCells'],
        });
      }
    }
    // Every referenced cell index must be within the grid.
    const referenced: number[] = [
      ...(sheet.variants ?? []),
      ...Object.values(sheet.edgeCells ?? {}),
    ];
    for (const cell of referenced) {
      if (cell >= cellCount) {
        ctx.addIssue({
          code: 'custom',
          message: `cell index ${cell} out of range (grid has ${cellCount} cells)`,
          path: ['grid'],
        });
      }
    }
  });
export type TilesetSheet = z.infer<typeof sheetSchema>;

const biomeSchema = z.object({
  sheet: sheetIdSchema,
  select: z.enum(TILESET_BIOME_SELECTORS),
});
export type TilesetBiome = z.infer<typeof biomeSchema>;

/** The full tileset manifest schema. */
export const tilesetManifestSchema = z
  .object({
    schemaVersion: z.string().min(1),
    kind: z.literal('tileset'),
    sheets: z.record(sheetIdSchema, sheetSchema),
    biomes: z.record(z.string().min(1), biomeSchema),
  })
  .superRefine((manifest, ctx) => {
    if (Object.keys(manifest.sheets).length === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'tileset manifest must declare at least one sheet',
        path: ['sheets'],
      });
    }
    // Every biome must reference a declared sheet.
    for (const [biomeKey, biome] of Object.entries(manifest.biomes)) {
      if (!(biome.sheet in manifest.sheets)) {
        ctx.addIssue({
          code: 'custom',
          message: `biome "${biomeKey}" references unknown sheet "${biome.sheet}"`,
          path: ['biomes', biomeKey, 'sheet'],
        });
      }
    }
  });

export type TilesetManifest = z.infer<typeof tilesetManifestSchema>;

/** Parse + validate a tileset manifest, throwing a ZodError on invalid data. */
export function parseTilesetManifest(input: unknown): TilesetManifest {
  return tilesetManifestSchema.parse(input);
}

/** Safe-parse a tileset manifest, returning the Zod result discriminant. */
export function safeParseTilesetManifest(input: unknown) {
  return tilesetManifestSchema.safeParse(input);
}
