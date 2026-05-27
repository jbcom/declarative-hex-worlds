---
title: Determinism Contract
description: Seed model, replay guarantees, where Date / Math.random are (and aren't) permitted.
sidebar:
  order: 3
---

The library is deterministic: identical inputs (seed + scenario + script) produce **byte-identical outputs** across processes and platforms. This is PRD invariant §1, and the test suite has a cross-process gate (Epic E1) that spawns N subprocesses and asserts byte-identity to keep it honest.

## What "deterministic" means here

Given the same:

- **Seed** (`"my-seed"` or any string passed to `createSeededGameboardPlan(...)`).
- **Scenario** (the compiled `GameboardScenario` JSON).
- **Simulation script** (the array of timed commands).

…you get the same:

- Generated plan: same tiles in the same order, same placements with the same attributes.
- Simulation event records: same event types, same ordering, same timestamps.
- Runtime snapshots: same actor positions, quest progress, patrol waypoints.

…across Node 22 and Node 24, across macOS / Linux / Windows, across `pnpm test` runs separated by months.

## The seed model

The library uses [seedrandom](https://github.com/davidbau/seedrandom) under `src/scenario/recipe.ts` and `src/coordinates/layout.ts`. Every random decision threads through a `seedrandom.PRNG` instance derived from the seed:

```ts
import { createSeededGameboardPlan } from '@jbcom/medieval-hexagon-gameboard';

const plan = createSeededGameboardPlan({
  seed: 'harbor-village-7',
  shape: { kind: 'rectangle', width: 8, height: 6 },
});
// `plan.tiles`, `plan.placements`, `plan.warnings` — all reproducible from "harbor-village-7"
```

Pass the same seed twice, get the same plan twice. Pass a different seed, get a different plan.

## Where `Date.now`, `Math.random`, `performance.now` are forbidden

PRD invariant §2: **never** in `src/`. Their use would inject system entropy into a "pure" runtime function and break the determinism contract.

The lint config (`biome.json`) has `noGlobalIsNan`-style rules to flag them. The single exception is `src/cli/cli.ts:2296` where a `generatedAt` timestamp gets a default from `Date.now()` — and even there it's overridable via `--generatedAt`.

## What about RNG inside three.js / koota?

Neither uses non-determinism in their hot paths. three's geometry math is pure; koota's entity allocation is monotonic. The library doesn't expose three's `Math.random()`-using helpers (e.g. `THREE.MathUtils.randFloat`) — consumers who want random placement decisions thread through the library's seeded helpers instead.

## Replay guarantees

For a saved scenario, you can:

1. **Re-derive the plan** from `scenario.seed + scenario.shape`.
2. **Re-execute the simulation** from `scenario.scriptId + scenario.script`.
3. **Snapshot the world** at any tick and serialize via `runtime.snapshot()` → matches across runs.

This is what enables:

- Server-authoritative simulation (server runs the script; clients verify by replay).
- Save games (just store the seed + script, not the world state).
- Cross-process testing (the E1 gate compares JSON snapshots across spawned subprocesses).

## What breaks determinism (and what doesn't)

| Breaks ❌ | Safe ✅ |
|---|---|
| Mutating `freeManifest` at runtime | Reading `freeManifest` |
| Calling `Date.now()` inside a custom action | Passing a fixed `generatedAt` ISO string to CLI commands |
| Iterating `Map` / `Set` insertion-order across processes with different V8 versions | The library uses `[...].sort()` everywhere insertion-order matters |
| Concurrent `async` decisions in actions | Synchronous action handlers (the default) |
| Using `JSON.stringify(...)` on objects with circular refs | `structuredClone(plan)` (B8 replaced the JSON dance) |

## Testing your own determinism

```ts
import { createSeededGameboardPlan } from '@jbcom/medieval-hexagon-gameboard';
import { expect, test } from 'vitest';

test('same seed → same plan', () => {
  const a = createSeededGameboardPlan({ seed: 's', shape: { kind: 'rectangle', width: 4, height: 4 } });
  const b = createSeededGameboardPlan({ seed: 's', shape: { kind: 'rectangle', width: 4, height: 4 } });
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});
```

For cross-process determinism, mirror what the E1 gate does: spawn `node --eval` subprocesses with the same script, capture stdout, compare.

## Future

PRD Epic E1 ratchets this from a contract to a permanent test gate. Once E1 lands, every PR runs the cross-process determinism check.
