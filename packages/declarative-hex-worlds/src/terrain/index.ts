/**
 * `src/terrain/` — the `declarative-hex-worlds/terrain` tier: continuous,
 * seamless terrain under a hex board.
 *
 * Koota-free, three-free and DOM-free. Everything here is deterministic from
 * its inputs and seed:
 *
 * - `./field` — height fields: creation, bilinear sampling, slope, normals, resampling
 * - `./compose` — declarative composition: measured elevation, fractal relief,
 *   ridges, hills, channels, flattened areas, vertical exaggeration
 * - `./inpaint` — harmonic in-painting: erases excavations and earthworks from measured ground
 * - `./biomes` — feathered, domain-warped biome painting and RGBA packing for renderers
 * - `./scatter` — Poisson-disc scatter with density thinning and stable variants
 * - `./hexes` — per-hex summaries (height, slope, biome shares) for gameplay
 * - `./parcels` — field parcels and their fence/lane boundary network
 * - `./drainage` — stream networks by depression filling and flow accumulation, and carved beds
 * - `./routing` — least-cost roads across the relief and spanning road networks between sites
 * - `./geometry2d`, `./noise` — the planar geometry (including polyline
 *   simplification and smoothing) and seeded noise underneath
 *
 * @module
 */
export * from './biomes';
export * from './compose';
export * from './drainage';
export * from './field';
export * from './geometry2d';
export * from './hexes';
export * from './inpaint';
export * from './noise';
export * from './parcels';
export * from './routing';
export * from './scatter';
