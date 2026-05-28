---
title: State
description: Current published version, in-flight initiatives, links to PRD + directive.
sidebar:
  order: 4
---

## Current state (pre-1.0)

The library is pre-1.0. The published npm version is below the major-version stability boundary; APIs can move.

The 1.0 stabilization PR (`codex/1.0-stabilization-phase-2`) closes the gap to 1.0 by working through 4 phases:

- **Phase R** — restructure (de-monorepo, decompose `src/` into 20 sub-packages, co-locate tests, drop bundled assets).
- **Phase A–E** — foundation gates (lint, typecheck, audit, coverage), perf criticals, security criticals, architectural debt, test debt to 100/100/100/100.
- **Phase F** — documentation (Astro Starlight site at [docs-site](/), SimpleRPG-driven feature gallery, marketing README, full audit).
- **Phase G** — release readiness (SLSA L3, SBOM, version bump, npm publish).

## In-flight initiatives

The authoritative work queue is [`.agent-state/directive.md`](https://github.com/jbcom/declarative-hex-worlds/blob/main/.agent-state/directive.md). Open items at a glance:

- **Asset bootstrap rollout** — `bootstrapKayKitAssets()` ships; bringing the FREE browser visuals CI job out of `RUN_BROWSER_VISUALS` gating once the bootstrap step is wired into CI.
- **SimpleRPG `game/` decomposition** — the test-driver implementation grows from a single 1,005-line file into per-domain sibling modules (scenarios, pieces, systems, render, cli) to expose every public API.
- **Feature gallery** — `docs-site/src/content/docs/features/` fills with screenshot-driven pages (harbors, bridges, multi-depth, prop injection, cross-kit composition, determinism) produced by SimpleRPG.
- **Marketing README rebuild** — replaces the current feature-enumeration with a 3-screenshot hero strip + 30-line quickstart + "why this exists" pitch.
- **Coverage ratchet to 100%** — the E0-E10 sub-epic closes the remaining ~35% gap between the current floor and the PRD §6 invariant of 100/100/100/100.

## Reference

| | Where |
|---|---|
| PRD 1.0 | `docs/PRD/1.0.md` in the repo |
| Work queue | `.agent-state/directive.md` |
| Test trinity overview | [`/guides/testing/`](/guides/testing/) |
| Release flow | [`/about/deployment/`](/about/deployment/) |
| Architecture | [`/about/architecture/`](/about/architecture/) |
| Design pitch | [`/about/design/`](/about/design/) |
| API reference | [`/reference/`](/reference/) (1107 pages generated from JSDoc) |
