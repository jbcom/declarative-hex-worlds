---
title: Determinism replay
description: Save the seed + script, reproduce the exact same world + simulation across every machine.
sidebar:
  order: 10
---

import { Aside } from '@astrojs/starlight/components';

<Aside type="note">
Screenshot embedding lands once the F-Gallery test harness flips on with the RB browser-CI gate.
</Aside>

## Problem

Your game has a "share replay" button. The user records 5 minutes of gameplay; you want any other player on any machine to reproduce that 5 minutes exactly — same world layout, same NPC paths, same combat outcomes — by loading just the seed + the input script.

## Snippet

```ts
import { createGameboardRuntimeFromScenario } from '@jbcom/medieval-hexagon-gameboard/runtime';
import { runGameboardScenarioSimulationScript } from '@jbcom/medieval-hexagon-gameboard/simulation';

const runtime = createGameboardRuntimeFromScenario(scenario);
const result = runGameboardScenarioSimulationScript(scenario, replayScript, {
  rounds: 300,
});

// Same scenario + same script always produces the same `result.events`.
// `result.events` is byte-identical to what the recorder produced.
```

## What the library handles

- **Seed threading.** Every random decision routes through `seedrandom`; same seed → same outputs.
- **Script replay.** `runGameboardScenarioSimulationScript` executes recorded commands in order; the event records become a fingerprint.
- **Cross-process gate.** PRD E1's `tests/unit/determinism.test.ts` spawns N subprocesses + asserts byte-identity. The gate runs in default `pnpm test` — regressions can't sneak in.

## API cross-links

- [`createSeededGameboardPlan`](/reference/rules/)
- [`runGameboardScenarioSimulationScript`](/reference/simulation/)
- [Determinism contract guide](/guides/determinism/)

## Related features

- [Quests](/features/quests/)
- [Movement and patrols](/features/movement-and-patrols/)
