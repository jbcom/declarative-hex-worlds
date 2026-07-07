---
title: Design
description: What declarative-hex-worlds aspires to be and why.
sidebar:
  order: 1
---

## Vision

A library that lets a TypeScript game developer ship a real hex-tile world — declarative or procedural — in an evening, with first-class React + Three.js bindings, deterministic seeded generation, and bootstrap-fetched KayKit Medieval Hexagon assets that look great out of the box.

## What we're building that nothing else does

There are hex algebra libraries. There are ECS runtimes. There are gltf loaders. The library combines them into a single coherent abstraction:

- **Declarative gameboard intent**: describe a "harbor with two piers and a fishing village" once; the library compiles it through recipe → blueprint → scenario into a deterministic koota world.
- **Procedural generation that's identity-stable**: same seed produces byte-identical output across processes + platforms (PRD invariant §1). Seed-driven scatter and connectivity rules let consumers ship infinite levels.
- **First-class React + Three.js bindings, not optional peer-dep gating**: `react`, `react-dom`, `three`, `koota` are direct dependencies. The library is unusable without them; we own the integration.
- **KayKit Medieval Hexagon Pack as the default asset model**: bootstrap-fetched at install time. Consumers don't pick textures or build a manifest — the manifest is the product.

## Identity

- **Quality posture**: 100% coverage at every dimension. Determinism. No `any`, no `@ts-ignore`. CI gates that bite.
- **Sub-package discipline**: 20 domain sub-packages with barrel-only cross-domain imports. Enforced by lint.
- **Bootstrap-not-bundle**: assets fetch on install; the tarball stays small. Sidecar integrity verification.
- **One source of truth per concern**: the PRD for rationale, the directive for the queue, the JSDoc for API contracts. None of them drift silently because each has a gate that fails when they do.

## UX principles

For consumers:

1. **Working render in 30 lines**. `npm install` + `npx declarative-hex-worlds bootstrap` + a minimal React component should produce a rendered hex board.
2. **Errors say what to fix, not what failed**. The error taxonomy (PRD D2) lets consumers `instanceof`-branch on `GameboardValidationError` / `GameboardManifestError` etc. without regex'ing messages.
3. **Async-first where I/O happens, sync where it doesn't**. `loadFreeManifest()` is async for shape stability, `freeManifest` is sync for hot paths. Both ship.
4. **Subpath imports beat barrel-bloat**. Every domain has a subpath in `package.json#exports`. Importing `/coordinates` doesn't pull `/react` into your bundle.

For contributors:

1. **`pnpm verify` is the contract**. If it passes locally, CI passes too. PRD G4 keeps this true.
2. **Co-located tests**. Unit tests live at `src/<domain>/__tests__/`. Path bridges don't shift when the layout moves.
3. **Conventional Commits**. release-please derives the changelog.

## What the library is not

- **Not a complete game engine**. It owns the gameboard + assets + ECS runtime + render adapters. Game logic (input, multiplayer, save formats) belongs to consumers.
- **Not a generic tile system**. It's specifically hex-tile + KayKit Medieval Hexagon. The architecture would adapt to other packs (we documented `KayKitUpstreamLayout` for that), but 1.0 ships FREE only.
- **Not a server framework**. The determinism contract enables server-authoritative simulation; no consumer has asked for it yet so we don't ship the network protocol.

## Reference

`docs/PRD/1.0.md` in the repo has the full goal statement. `STANDARDS.md` lists the non-negotiables. This page is the elevator pitch.
