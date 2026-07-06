/**
 * The source-agnostic, Zod-validated AssetSourceSpec (RFC 0001 G0).
 *
 * This is dhw's OWN canonical declaration of an asset source — the single
 * schema any source normalizes into, regardless of kind (KayKit FREE/premium,
 * a tileset pack, a sprite pack, a model pack, or a mix). KayKit is an INPUT
 * that ingest normalizes into this spec; it is not the spec itself.
 *
 * Directory/format conventions the spec encodes (see RFC §CLI):
 *   tiles/    → role 'tile'    → png OR glb/gltf (a hex surface can be image or mesh)
 *   tilesets/ → role 'tileset' → png (a sheet + grid)
 *   sprites/  → role 'sprite'  → png
 *   models/   → role 'model'   → glb/gltf
 *
 * A source is valid iff it `parse`s here — bad data fails fast at the boundary
 * with a precise Zod error, not deep in rendering.
 *
 * @module
 */
import { z } from 'zod';

/** The asset roles a source can declare. Closed set. */
export const ASSET_ROLES = ['tile', 'tileset', 'sprite', 'model'] as const;
export type AssetRole = (typeof ASSET_ROLES)[number];

/** The asset file formats. Closed set. */
export const ASSET_FORMATS = ['png', 'glb', 'gltf'] as const;
export type AssetFormat = (typeof ASSET_FORMATS)[number];

/** Grid metadata for a sprite-sheet tileset: how cells tile the sheet image. */
const gridSchema = z.object({
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
  cellWidth: z.number().int().positive(),
  cellHeight: z.number().int().positive(),
});
export type AssetGrid = z.infer<typeof gridSchema>;

const idSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9._-]+$/, 'asset id must be [A-Za-z0-9._-]');
const pathSchema = z.string().min(1);

// ─── Per-role asset schemas (role gates the valid formats + required fields) ──

/** A hex tile — the surface of a hex. Format-flexible: png OR glb/gltf. */
const tileAssetSchema = z.object({
  id: idSchema,
  role: z.literal('tile'),
  format: z.enum(['png', 'glb', 'gltf']),
  path: pathSchema,
  /** Biome/terrain key this tile represents (grass, water, desert, …). */
  biome: z.string().min(1),
  /** Optional edge mask this tile satisfies, for transition tiles (G3). */
  edgeMask: z.number().int().nonnegative().optional(),
});

/** A sprite-sheet tileset — a png sheet sliced by a grid. */
const tilesetAssetSchema = z.object({
  id: idSchema,
  role: z.literal('tileset'),
  format: z.literal('png'),
  path: pathSchema,
  grid: gridSchema,
  /** Optional biome this whole sheet represents (fill sheets). */
  biome: z.string().min(1).optional(),
  /** Optional per-cell role: 'fill' cells are interchangeable variations;
   * 'transition' cells map an edge mask to a specific cell index (G3). */
  transition: z
    .object({
      /** Canonical edge mask → cell index within the sheet grid. */
      edgeCells: z.record(z.string(), z.number().int().nonnegative()),
    })
    .optional(),
});

/** An individual 2D sprite — a png image billboarded above a tile. */
const spriteAssetSchema = z.object({
  id: idSchema,
  role: z.literal('sprite'),
  format: z.literal('png'),
  path: pathSchema,
});

/** A 3D model — a glb/gltf mesh placed on a tile. */
const modelAssetSchema = z.object({
  id: idSchema,
  role: z.literal('model'),
  format: z.enum(['glb', 'gltf']),
  path: pathSchema,
});

/** One asset, discriminated by role so per-role format/field rules apply. */
export const assetSchema = z.discriminatedUnion('role', [
  tileAssetSchema,
  tilesetAssetSchema,
  spriteAssetSchema,
  modelAssetSchema,
]);
export type AssetSpec = z.infer<typeof assetSchema>;

/** A complete asset source: a named set of assets under an asset root. */
export const assetSourceSpecSchema = z
  .object({
    /** Spec format version (this schema is v1). */
    specVersion: z.literal(1),
    /** Human-readable source name (e.g. "kaykit-free", "my-tileset-pack"). */
    name: z.string().min(1),
    /** Root directory the asset paths are relative to (e.g. "public/assets"). */
    assetRoot: z.string().min(1),
    /** Ordered asset records. */
    assets: z.array(assetSchema).min(1),
  })
  .superRefine((spec, ctx) => {
    // Asset ids must be unique within a source.
    const seen = new Set<string>();
    for (const [i, asset] of spec.assets.entries()) {
      const id = asset.id;
      if (seen.has(id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate asset id "${id}" — asset ids must be unique within a source`,
          path: ['assets', i, 'id'],
        });
      }
      seen.add(id);
    }
  });

export type AssetSourceSpec = z.infer<typeof assetSourceSpecSchema>;

/** Parse + validate a spec, throwing a precise ZodError on invalid input. */
export function parseAssetSourceSpec(input: unknown): AssetSourceSpec {
  return assetSourceSpecSchema.parse(input);
}

/** Non-throwing parse — returns Zod's `{ success, data | error }` result. */
export function safeParseAssetSourceSpec(input: unknown) {
  return assetSourceSpecSchema.safeParse(input);
}
