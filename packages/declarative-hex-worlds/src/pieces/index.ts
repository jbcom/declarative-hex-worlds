/**
 * `src/pieces/` — reusable piece declarations (third-party tiles, buildings,
 * props, units, landmarks, scatter assets) with placement rules and source
 * metadata.
 *
 * Pieces compose with the registry + layout layers: each declaration carries
 * a footprint, a role (mapped to a built-in layout archetype or `custom`),
 * and the metadata renderers need (faction, texture, occupancy guard).
 *
 * @module
 */

export * from './pieces';
