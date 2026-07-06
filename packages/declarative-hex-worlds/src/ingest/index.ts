/**
 * `src/ingest/` — Node-side asset ingest: validates a FREE/EXTRA source root,
 * walks the GLTF tree (with symlink hardening landing in Epic C2), extracts
 * `AssetBounds` from accessor min/max metadata, and emits a normalized
 * `MedievalHexagonManifest` JSON.
 *
 * Precursor to the PRD-RB `bootstrap` flow: same walker, same AssetBounds
 * extraction, different output sink (manifest JSON vs an asset tree mirrored
 * under the consumer's `<out>/addons/...`).
 *
 * @module
 */

export * from './ingest';
