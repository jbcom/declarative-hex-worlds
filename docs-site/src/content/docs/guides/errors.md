---
title: Error taxonomy
description: GameboardError + 6 subclasses for structured catch-by-instanceof handling.
sidebar:
  order: 1
---

import { Aside } from '@astrojs/starlight/components';

The library throws structured errors. Every library-originated throw is a `GameboardError` subclass — consumers can branch on `instanceof` without regex'ing messages.

<Aside type="note">
Implementation: `src/errors/index.ts`. 152 throw sites migrated (PRD D2). Messages are stable; consumers that match on text today keep working.
</Aside>

## The hierarchy

```ts
import {
  GameboardError,              // base — catch this to handle ANY library error
  GameboardValidationError,    // input data failed structural validation
  GameboardManifestError,      // manifest is malformed / version-incompatible
  GameboardScenarioError,      // scenario JSON / blueprint / recipe failed to compile or load
  GameboardRuntimeError,       // runtime hit unrecoverable state
  GameboardCliError,           // CLI got invalid flags / illegal output paths
  GameboardIoError,            // ingest / bootstrap / filesystem couldn't proceed
} from '@jbcom/medieval-hexagon-gameboard/errors';
```

Or import from the umbrella:

```ts
import { GameboardValidationError } from '@jbcom/medieval-hexagon-gameboard';
```

## Domain → subclass mapping

| Source domain | Subclass | Examples |
|---|---|---|
| `src/rules/**` (plan + scenario validation) | `GameboardValidationError` | rule conflict, blocked tile, invalid placement |
| `src/manifest/**` shape errors | `GameboardManifestError` | unknown asset category, invalid export identifier |
| `src/ingest/**` filesystem | `GameboardIoError` | missing GLTF source directory |
| `src/cli/commands/bootstrap/**` | `GameboardIoError` | archive-zip download failure, zip extract failure |
| `src/scenario/**` (recipe / blueprint / catalog) | `GameboardScenarioError` | scenario did not compile, recipe missing tiles |
| `src/gameboard/**`, `src/coordinates/**`, `src/simulation/**`, `src/koota/**`, `src/systems/**`, `src/movement/**`, `src/patrol/**`, `src/quests/**`, `src/actors/**`, `src/pieces/**`, `src/interop/**`, `src/commands/**`, `src/selectors/**`, `src/three/**`, `src/react/**` | `GameboardRuntimeError` | unknown entity, broken trait shape, missing tile at coordinates |
| `src/cli/cli.ts` | `GameboardCliError` | missing required flag, illegal path |

## Usage patterns

**Catch a specific category**:

```ts
import { GameboardValidationError, validateGameboardScenario } from '@jbcom/medieval-hexagon-gameboard';

try {
  const scenario = validateGameboardScenario(input);
} catch (e) {
  if (e instanceof GameboardValidationError) {
    console.error('Scenario invalid:', e.message);
    showUserError(e.message);
    return;
  }
  throw e; // re-throw anything unexpected
}
```

**Catch any library error** (separate from genuine bugs like `TypeError`, `ReferenceError`):

```ts
import { GameboardError } from '@jbcom/medieval-hexagon-gameboard';

try {
  await loadAndRun(input);
} catch (e) {
  if (e instanceof GameboardError) {
    // library-originated — show a UI error
    showError(`Library error: ${e.message}`);
    return;
  }
  // genuine bug — let it propagate to the global handler
  throw e;
}
```

**Walk the cause chain** (when `cause` is set):

```ts
try {
  await bootstrapKayKitAssets(options);
} catch (e) {
  if (e instanceof GameboardError && e.cause instanceof Error) {
    console.error('Cause:', e.cause.message);
  }
  throw e;
}
```

## Constructor shape

Every subclass takes `(message, options?)`:

```ts
class GameboardError extends Error {
  constructor(message: string, options?: { cause?: unknown });
}
```

Subclasses set `.name` to their class name automatically (`new.target.name`), so error logs read `GameboardValidationError: ...` not `Error: ...`.

## Stable messages

PRD D2 preserved every existing error message verbatim during the migration. Consumers that grep messages today keep working. Don't change a message lightly; treat it as part of the API contract.

## What's NOT a `GameboardError`

- `TypeError` / `ReferenceError` / `RangeError` — these are bugs in the library or in your usage. Report them.
- Errors thrown from npm dependencies (`tar`, `seedrandom`, etc.) — these propagate unwrapped.
- Browser-side errors from `three.js` / WebGL — these are rendering issues, not library logic errors.
