# Code Quality Review — declarative-hex-worlds

**Date**: 2026-05-28  
**Scope**: Full `src/` tree (67k LOC, excludes `manifest/free.ts` generated literal)  
**Reviewer**: Claude Sonnet 4.6

---

## Executive Summary

The codebase is generally well-structured, correctly uses TypeScript discriminated unions, has good
security hardening in I/O paths (zip-slip guards, redirect allowlists, prototype-pollution defense),
and follows consistent naming. The dominant quality issue is a single 4,059-line "kitchen sink"
module (`src/cli/_shared.ts`) that concentrates almost every CLI concern in one file. Secondary
issues are structural: per-command output tripling (file/JSON/text), shallow module files that exist
only to re-delegate, and several small but measurable maintainability smells across engine files.

No critical security or correctness bugs were found in the reviewed sections. Severity ratings
reflect maintainability and long-term change cost.

---

## Finding 1 — `_shared.ts` is a God Module

**Severity**: High  
**File**: `src/cli/_shared.ts` (4,059 lines)

### Description

`_shared.ts` contains: type definitions, utility functions, every `run*` command implementation
(~20 functions), every `print*` formatter (~18 functions), flag parsers, file readers, GLTF
metadata extraction, source-asset helpers, and output-path security. It serves as the actual
implementation body for ~25 of the 30+ CLI commands, all delegated through one-liner files:

```ts
// src/cli/commands/simulate-scenario.ts (7 lines total)
export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition) {
  runSimulateScenario(parsed, sourceRoot, edition);
}
```

This means the individual command files exist purely for the citty router's benefit — they carry
zero logic, zero tests, and provide no encapsulation. All 384 `writeFileSync/console.log/process.exit`
calls live in one file.

### Problems

- Every modification to any command risks unintended coupling to other commands sharing helpers.
- `ParsedArgs` (`{ command: string; flags: Record<string, string | boolean> }`) is a stringly-typed
  bag that bypasses TypeScript's discriminated-union safety for CLI inputs.
- The 4k-line module cannot be held in a reader's head; cognitive complexity is uncountable at the
  file level.
- Tests in `cli/__tests__/cli.test.ts` (3,120 lines) exercise the CLI end-to-end but cannot isolate
  individual command logic since all logic lives in one unexported namespace.

### Fix Recommendation

**Phase 1 (high value, low risk)**: Extract cohesive groups into co-located modules.

Each command group already has a natural boundary: `guide-*` commands share identical filter/coverage
patterns; `validate-*` commands share the violation-exit pattern; `patrol-*` commands share route
planning. Move each group's `run*` + its `print*` + its flag parsers into `src/cli/commands/<group>/index.ts`.

```
src/cli/commands/
  bootstrap/            ← already exists, good model
  guide/
    index.ts            ← runGuideScenarios, runGuideUsages, runGuideRenderRequests, runGuideAssets, runGuideRoles, runGuidePublicApis, runGuidePermutations + shared filters
    print.ts            ← formatGuideScenarioPages, formatGuideUsageLine, etc.
  patrol/
    index.ts            ← runPatrolRoutes, runPatrolScript + patrolRouteSetFromArgs, readPatrolSimulationAssignments
  validate/
    index.ts            ← runValidateManifest, runValidateSimulation + readSimulationScript
  snapshot/index.ts
  blueprint/index.ts
  _io.ts                ← safeResolveOutput, writeOutput (generic pattern below), defaultOutRoot
  _parse.ts             ← readCsv, readNumberFlag, readModelForward, readBoardForwardEdge, readJson, readRegistry, readPieceRegistry
```

**Phase 2**: Replace `ParsedArgs` with per-command typed option structs validated at parse time by
the citty layer, eliminating `typeof parsed.flags.x === 'string'` guards throughout.

---

## Finding 2 — Tripled Output Pattern (Write/JSON/Text) Repeated 20+ Times

**Severity**: Medium  
**File**: `src/cli/_shared.ts`, lines ~284–2108 (recurring)

### Description

Every `run*` function implements the same three-branch output pattern manually:

```ts
if (typeof parsed.flags.out === 'string') {
  writeFileSync(safeResolveOutput(String(parsed.flags.out)), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote N items to ${safeResolveOutput(String(parsed.flags.out))}`);
} else if (parsed.flags.json === true || parsed.flags.format === 'json') {
  console.log(JSON.stringify(payload, null, 2));
} else {
  // custom text renderer
}
```

This pattern appears in `runGuideScenarios`, `runGuideUsages`, `runGuideRenderRequests`,
`runGuideAssets`, `runGuidePermutations`, `runPatrolRoutes`, `runPatrolScript`, `runPlacePiece`,
`runSpawnGroups`, `runAnalyzeLayout`, `runSummarizePlan`, `runSummarizeScenario`, `runBlueprint`,
`runSnapshot`, and more — approximately 15 verbatim repetitions with only the `payload` and count
message varying.

Additionally, the `safeResolveOutput(String(parsed.flags.out))` call is repeated twice per branch
(resolve for write, resolve again for the confirmation `console.log`), creating a potential
double-resolve inconsistency if the flag changes between calls (it cannot in practice, but the code
structure implies it could).

### Fix Recommendation

Extract a single `emitOutput` helper:

```ts
export interface EmitOutputOptions<T> {
  flags: Record<string, string | boolean>;
  payload: T;
  /** Short summary for the --out confirmation line, e.g. "42 guide scenarios" */
  summary: string;
  /** Text renderer called when neither --out nor --json are active */
  text: () => void;
}

export function emitOutput<T>(options: EmitOutputOptions<T>): void {
  const { flags, payload, summary, text } = options;
  if (typeof flags.out === 'string') {
    const outPath = safeResolveOutput(String(flags.out));
    writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${summary} to ${outPath}`);
    return;
  }
  if (flags.json === true || flags.format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  text();
}
```

This reduces 15 repetitions to 15 single `emitOutput({...})` calls and eliminates the
double-resolve issue.

---

## Finding 3 — Repeated Error-and-Exit Pattern for Validation Failures

**Severity**: Medium  
**File**: `src/cli/_shared.ts`, ~12 locations

### Description

Every command that resolves a plan from a recipe or scenario repeats:

```ts
if (violations.some((violation) => violation.severity === 'error') && parsed.flags.allowInvalid !== true) {
  printViolations(violations);
  process.exit(1);
}
```

The same pattern appears in `runAnalyzeLayout`, `runSpawnGroups`, `runPatrolRoutes`,
`runPatrolScript`, `runPlacePiece`, `inspectPiecesPlacementFromArgs`, and `layoutAnalysisPlanFromArgs`
itself (which means some callers duplicate the check they already called inside this function).

`layoutAnalysisPlanFromArgs` (lines 1212–1259) already calls `printViolations` + `process.exit(1)`
when it encounters a recipe with no compiled plan, but its callers also repeat the error check on
the returned `violations` array. This means the error path can be reached and `process.exit` called
from either location, making the control flow harder to reason about.

### Fix Recommendation

Consolidate into `layoutAnalysisPlanFromArgs` itself: either always exit on errors internally (and
callers trust that), or never exit internally (callers always decide). Currently it does both.
Recommend: internal exit only when `allowInvalid === false`, and remove the post-call checks in
callers that already set `allowInvalid` consistently.

```ts
// After: layoutAnalysisPlanFromArgs handles exit unconditionally when !allowInvalid.
// Callers drop the duplicate violation check they currently perform after calling it.
const { plan, violations } = layoutAnalysisPlanFromArgs(parsed, validationConfig, allowInvalid);
// No further violation check needed — function already exited if errors existed and allowInvalid is false.
```

---

## Finding 4 — `resolveSimulationSpawnActor` Uses Fragile `as` Casts

**Severity**: Medium  
**File**: `src/simulation/engine.ts`, lines 648–666

### Description

```ts
function resolveSimulationSpawnActor(
  runtime: GameboardScenarioRuntime,
  actor: GameboardScenarioActor
): SpawnGameboardActorOptions {
  if (actor.spawnGroupId === undefined) {
    if (actor.at === undefined) {
      throw new GameboardRuntimeError(...);
    }
    return actor as SpawnGameboardActorOptions;  // ← unsafe cast
  }
  const existingClaims = readGameboardActors(runtime.world)
    .map(simulationActorSpawnClaim)
    .filter((claim): claim is GameboardScenarioActor => claim !== undefined);
  return resolveGameboardScenarioActors([...existingClaims, actor], runtime.spawnGroups).at(
    -1
  ) as SpawnGameboardActorOptions;  // ← can return undefined; cast hides it
}
```

Two issues:
1. `actor as SpawnGameboardActorOptions` is a structural cast assuming `GameboardScenarioActor`
   satisfies `SpawnGameboardActorOptions`. If either type gains a required field, this cast silently
   passes TypeScript but produces a runtime error.
2. `.at(-1) as SpawnGameboardActorOptions` — `Array.prototype.at` returns `T | undefined`. The cast
   discards `undefined`, meaning if `resolveGameboardScenarioActors` returns an empty array (which
   could happen if all actors have conflicting spawn claims), the cast produces `undefined` typed as
   `SpawnGameboardActorOptions`. The next call to `spawnGameboardActor` will then receive `undefined`
   and either silently do nothing or throw an unclear error.

### Fix Recommendation

```ts
function resolveSimulationSpawnActor(
  runtime: GameboardScenarioRuntime,
  actor: GameboardScenarioActor
): SpawnGameboardActorOptions {
  if (actor.spawnGroupId === undefined) {
    if (actor.at === undefined) {
      throw new GameboardRuntimeError(
        `Simulation actor ${actor.actorId} has no spawn tile or spawn group`
      );
    }
    // Explicit property projection instead of structural cast:
    return { ...actor, at: actor.at };
  }
  const existingClaims = readGameboardActors(runtime.world)
    .map(simulationActorSpawnClaim)
    .filter((claim): claim is GameboardScenarioActor => claim !== undefined);
  const resolved = resolveGameboardScenarioActors(
    [...existingClaims, actor],
    runtime.spawnGroups
  ).at(-1);
  if (!resolved) {
    throw new GameboardRuntimeError(
      `Simulation actor ${actor.actorId} spawn group ${actor.spawnGroupId} produced no resolved location`
    );
  }
  return resolved as SpawnGameboardActorOptions;
}
```

---

## Finding 5 — `commandHandlerMutations` Switch Exhaustiveness Is Incomplete

**Severity**: Medium  
**File**: `src/simulation/engine.ts`, lines 462–501

### Description

The switch in `commandHandlerMutations` handles four effect types
(`actor-removed`, `placement-removed`, `actor-updated`, `placement-updated`) and ends with:

```ts
const exhaustive: never = effect;
return exhaustive;
```

This `exhaustive` pattern is correct in intent but has a subtle issue: `return exhaustive` returns
a value of type `never`, which is fine in TypeScript, but the function return type is
`GameboardScenarioSimulationMutationRecord[]`. If the `effect` union gains a fifth variant (e.g.
`actor-spawned-via-handler`) and the switch is not updated, TypeScript will not error because the
`never` assignment will fail to compile — which is the correct behavior. However, the runtime will
return `undefined` (the `effect` variable binding) not throw, since `return exhaustive` at runtime
returns whatever `effect` is (not `never`). The `never` guard only works if the compiler enforces it.

This is working correctly today because the union is currently exhausted, but the code pattern is
fragile: a developer adding a new effect type in `commands.ts` may not immediately see a TS error if
they add it to the union definition but forget to update the corresponding consumer tables.

### Fix Recommendation

Replace the silent fallthrough with an explicit throw following the `assertNever` pattern already
used in `runSimulationStep`:

```ts
// At the end of commandHandlerMutations switch:
default: {
  const _exhaustive: never = effect;
  throw new GameboardRuntimeError(
    `unhandled interaction handler effect type: ${JSON.stringify(_exhaustive)}`
  );
}
```

---

## Finding 6 — `readJson<T>` Casts Without Validation

**Severity**: Medium  
**File**: `src/cli/_shared.ts`, line 397–398; used in ~25 locations

### Description

```ts
export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}
```

This is a blanket `unknown → T` cast via a generic. Every caller that passes a user-supplied file
path (e.g., `--plan`, `--scenario`, `--script`, `--routes`) trusts that the file matches the type
parameter. When it does not (malformed JSON, wrong schema version, adversarially crafted file), the
error surfaces as a confusing property-access runtime error rather than a clear validation failure.

Examples of high-risk callers:
- `readJson<GameboardScenario>(resolve(parsed.flags.scenario))` — no schema validation before use
- `readJson<GameboardPatrolSimulationActorAssignment[]>(...)` — array cast with no shape check
- `readJson<GameboardScenarioSimulationScript>(...)` — script with `.steps` cast unconditionally

Several callers do add downstream shape checks (e.g. `readSimulationScript` checks `Array.isArray`),
but many do not, and the pattern gives false confidence to new contributors who see `readJson<X>` and
assume it validates.

### Fix Recommendation

Rename to `parseJsonUnchecked<T>` to signal the lack of validation. For the three highest-risk
public entry points (`--scenario`, `--script`, `--routes`), add minimal shape guards or use the
existing `inspect*` functions before casting:

```ts
export function parseJsonUnchecked<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

// Callers that already have validation via inspect* should route through it:
const scenario = inspectGameboardScenario(parseJsonUnchecked<unknown>(scenarioPath), config);
if (!scenario.plan && !allowInvalid) { ... }
```

This is a naming and documentation fix that costs zero runtime impact and prevents future
contributors from misunderstanding the contract.

---

## Finding 7 — `advancePatrolEntity` Has Excessive Cyclomatic Complexity

**Severity**: Medium  
**File**: `src/patrol/patrol.ts`, lines 230–342 (~113 lines, 7+ branches)

### Description

`advancePatrolEntity` is a single function handling: inactive-agent early return, insufficient-waypoints
deactivation, movement-completion detection, blocked-movement deactivation, in-progress movement
detection, route-end deactivation, wait-tick countdown, next-waypoint resolution, and movement
request creation. It also performs side effects (writes back `nextAgent` and `nextState` via
`setPatrolAgent`/`setPatrolState`) interleaved with the conditional logic.

The function has at least 8 distinct early return paths and 4 branches that each call `setPatrolAgent`
+ `setPatrolState` + `patrolResult`. This means adding any new patrol state (e.g., "paused-at-waypoint
for event") requires understanding all 8 paths and determining the correct insertion point — a
high-risk change for a function that drives all patrol behavior.

### Fix Recommendation

Extract the phase logic into a small state-machine pattern. Each phase returns a result or `null`
to signal "continue to next phase":

```ts
function advancePatrolEntity(world, entity, options): GameboardPatrolAdvanceResult {
  const previousState = readPatrolState(entity);
  const agent = readPatrolAgent(entity);

  return (
    checkInactive(entity, agent, previousState, world) ??
    checkInsufficientWaypoints(entity, agent, previousState, world) ??
    checkMovementCompletion(entity, agent, previousState, world) ??
    checkMovementBlocked(entity, agent, previousState, world, options) ??
    checkMovementInProgress(entity, agent, previousState, world) ??
    checkRouteComplete(entity, agent, previousState, world) ??
    checkWaitTick(entity, agent, previousState, world) ??
    requestNextSegment(entity, agent, previousState, world, options)
  );
}
```

Each phase function is independently testable and has a single responsibility.

---

## Finding 8 — `hashFile` Uses Event Listeners Instead of `stream/promises` Pipeline

**Severity**: Low  
**File**: `src/cli/commands/bootstrap/core.ts`, lines 550–558

### Description

```ts
async function hashFile(path: string): Promise<string> {
  return new Promise<string>((resolveHash, reject) => {
    const stream = createReadStream(path);
    const hash = createHash('sha256');
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolveHash(hash.digest('hex')));
  });
}
```

This pattern misses the `'close'` event: if the stream emits `'close'` before `'end'` (which can
happen on stream truncation or certain OS behaviors), the promise neither resolves nor rejects,
leaking it indefinitely. The file elsewhere uses `pipeline` from `stream/promises` (in
`downloadGithubArchiveZip`) — `hashFile` should use the same approach for consistency and correctness.

Additionally, `copyAndHash` (line 543) reads the entire file into memory with `readFileSync` and
then computes the hash from the buffer. For large asset files this loads the entire file before
returning. For the `verifyBootstrap` path, `hashFile` re-reads files that were already in the OS
page cache, which is fine, but the inconsistency between the two hash paths (buffer vs stream) is
a maintenance hazard.

### Fix Recommendation

```ts
import { pipeline } from 'node:stream/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { Writable } from 'node:stream';

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  const sink = new Writable({
    write(chunk, _enc, cb) { hash.update(chunk); cb(); },
  });
  await pipeline(createReadStream(path), sink);
  return hash.digest('hex');
}
```

---

## Finding 9 — `_shared.ts` Imports from `tests/integration/` at Module Top Level

**Severity**: Medium  
**File**: `src/cli/_shared.ts`, lines 3–7

### Description

```ts
import {
  listSimpleRpgGuidePublicApiExercises,
  runSimpleRpgExecutableGuideApiSmoke,
  summarizeSimpleRpgGuidePublicApiExercises,
} from '../../tests/integration/simple-rpg/simple-rpg';
```

A library source file (`src/cli/_shared.ts`) imports from `tests/`. This means:
1. The `tests/` directory is part of the compiled output boundary — any change to the test helper
   file is a library-level change that could break production CLI behavior.
2. The `tsup` build must include the `tests/` path, or the build fails at import resolution.
3. Tree-shaking is defeated for the `_shared` module: all consumers of `_shared` transitively
   import the integration test runner, even for commands that never touch SimpleRPG.

This is a layering inversion: production code depending on test infrastructure.

### Fix Recommendation

Move `listSimpleRpgGuidePublicApiExercises`, `runSimpleRpgExecutableGuideApiSmoke`, and
`summarizeSimpleRpgGuidePublicApiExercises` into `src/` (e.g.,
`src/cli/commands/coverage/simple-rpg-smoke.ts`) and update the test to import from the new location.
The integration test file in `tests/` should import from `src/`, not the reverse.

---

## Finding 10 — `stageFromZip` Calls `rmSync` in Three Error Branches, Not in `finally`

**Severity**: Low  
**File**: `src/cli/commands/bootstrap/core.ts`, lines 371–406

### Description

```ts
async function stageFromZip(zipPath, layout, edition): Promise<string> {
  const stagingRoot = mkStagingRoot('zip');
  try {
    await extractZipTo(absoluteZip, stagingRoot);
  } catch (error) {
    rmSync(stagingRoot, { recursive: true, force: true });  // cleanup on extraction error
    throw ...;
  }
  const detectedRoot = findPackRoot(stagingRoot);
  if (detectedRoot) {
    const detectedLayout = detectKayKitLayout(detectedRoot);
    if (detectedLayout && detectedLayout.editionName !== edition) {
      rmSync(stagingRoot, { recursive: true, force: true });  // cleanup on edition mismatch
      throw ...;
    }
    if (!detectedLayout) {
      rmSync(stagingRoot, { recursive: true, force: true });  // cleanup on layout mismatch
      throw ...;
    }
  }
  return stagingRoot;
}
```

The staging root is cleaned up manually in each error branch. If a future code path adds a new error
branch and forgets the `rmSync`, the temp directory leaks. The caller (`bootstrapKayKitAssets`) does
use `finally` for the staging root it creates after `stageUpstreamSource`, but `stageFromZip` itself
does not use `finally` for its own staging root.

This is inconsistent with `downloadGithubArchiveZip` which correctly uses a `try/catch` for cleanup
(though also not `finally`).

### Fix Recommendation

```ts
async function stageFromZip(zipPath, layout, edition): Promise<string> {
  const stagingRoot = mkStagingRoot('zip');
  let success = false;
  try {
    await extractZipTo(resolve(zipPath), stagingRoot);
    const detectedRoot = findPackRoot(stagingRoot);
    if (!detectedRoot) {
      throw new GameboardIoError(`zip ${zipPath} does not contain a recognizable KayKit pack root`);
    }
    const detectedLayout = detectKayKitLayout(detectedRoot);
    if (!detectedLayout) {
      throw new GameboardIoError(`zip ${zipPath} missing KayKit layout markers`);
    }
    if (detectedLayout.editionName !== edition) {
      throw new GameboardIoError(
        `zip contains ${detectedLayout.editionName.toUpperCase()} edition but bootstrap asked for ${edition.toUpperCase()}`
      );
    }
    success = true;
    return stagingRoot;
  } finally {
    if (!success) {
      rmSync(stagingRoot, { recursive: true, force: true });
    }
  }
}
```

---

## Finding 11 — Long Lines Reduce Readability in Key Engine Functions

**Severity**: Low  
**File**: `src/patrol/patrol.ts` line 205, `src/movement/movement.ts` lines 445, 569

### Description

Several lines in hot-path functions exceed 120 characters significantly:

```ts
// patrol.ts:205 — 128 chars in sort comparator
.sort((left, right) => left.agent.routeId.localeCompare(right.agent.routeId) || left.placement.id.localeCompare(right.placement.id));

// movement.ts:445 — 139 chars
const entities = placement === undefined ? [...world.query(MovementAgentQuery)] : [requirePlacementEntity(world, placement)];

// movement.ts:569 — 122 chars
return options.movementBudget ?? agent?.remainingMovement ?? agent?.movementBudget ?? profile.movementBudget;
```

These are not bugs but they reduce scannability in code that reviewers and contributors read
frequently. The project uses `biome` as the linter/formatter; check whether the configured
`lineWidth` enforces a limit here.

### Fix Recommendation

Break long lines at logical operators or intermediate variables. For the `movementBudgetFor` function:

```ts
function movementBudgetFor(entity: Entity, profile: GameboardMovementProfile, options: GameboardMovementOptions): number {
  const agent = entity.get(MovementAgent);
  return (
    options.movementBudget ??
    agent?.remainingMovement ??
    agent?.movementBudget ??
    profile.movementBudget
  );
}
```

---

## Finding 12 — `scenario/catalog.ts` (2,401 Lines) May Be Another Cohesion Candidate

**Severity**: Low  
**File**: `src/scenario/catalog.ts`

### Description

At 2,401 lines this is the second-largest non-test, non-generated file. Without reading it fully,
the naming (`catalog`) combined with the co-location of `listKayKit*`, `filter*`, `describe*`, and
`render*` functions (surfaced through `_shared.ts` imports) suggests it may mix taxonomy data
(constant arrays), filter logic, summary computation, and markdown rendering. These are four distinct
responsibilities.

This is flagged as Low because `catalog.ts` was not fully read in this review. It warrants a targeted
follow-up: if it truly mixes data, logic, and rendering, the same cohesion extraction recommended for
`_shared.ts` applies here.

---

## Finding 13 — `resolveCurrentWaypointIndex` in `patrol.ts` Has Implicit Fallback Behavior

**Severity**: Low  
**File**: `src/patrol/patrol.ts`, lines 397+

### Description

`resolveCurrentWaypointIndex` accepts `options.alignToCurrentTile` which attempts to find a
waypoint matching the placement's current tile. If no waypoint matches, it silently falls back to
`options.currentWaypointIndex ?? 0`. This silent fallback means a caller that passes
`alignToCurrentTile: true` with a placement on a non-waypoint tile gets waypoint index 0 without any
warning or indication that alignment failed. This can cause subtle patrol behavior bugs where an actor
silently starts at the wrong waypoint.

### Fix Recommendation

Return an alignment result instead of silently falling back:

```ts
interface CurrentWaypointResolution {
  index: number;
  aligned: boolean;
  alignmentWarning?: string;
}
```

Or at minimum, add a `warnings` push to the patrol agent when alignment fails and `alignToCurrentTile`
was requested.

---

## Summary Table

| # | Severity | File | Finding |
|---|----------|------|---------|
| 1 | **High** | `src/cli/_shared.ts` | God module — 4,059 lines, 20+ command implementations |
| 2 | **Medium** | `src/cli/_shared.ts` | Tripled output pattern repeated 15+ times without abstraction |
| 3 | **Medium** | `src/cli/_shared.ts` | Error-and-exit validation pattern duplicated inside and outside `layoutAnalysisPlanFromArgs` |
| 4 | **Medium** | `src/simulation/engine.ts:648–666` | Unsafe `as` casts in `resolveSimulationSpawnActor`; `.at(-1)` undefined silently cast |
| 5 | **Medium** | `src/simulation/engine.ts:462–501` | Exhaustiveness guard returns `never` silently instead of throwing |
| 6 | **Medium** | `src/cli/_shared.ts:397` | `readJson<T>` provides false type-safety with no validation |
| 7 | **Medium** | `src/patrol/patrol.ts:230–342` | `advancePatrolEntity` — 8 early-return branches in one function |
| 8 | **Low** | `src/cli/commands/bootstrap/core.ts:550` | `hashFile` missing `'close'` event; inconsistent with `pipeline` usage elsewhere |
| 9 | **Medium** | `src/cli/_shared.ts:3–7` | Library source imports from `tests/` — layering inversion |
| 10 | **Low** | `src/cli/commands/bootstrap/core.ts:371–406` | Manual `rmSync` cleanup in three branches instead of `finally` |
| 11 | **Low** | `src/patrol/patrol.ts:205`, `src/movement/movement.ts:445,569` | Long lines in hot-path engine functions |
| 12 | **Low** | `src/scenario/catalog.ts` | 2,401-line file — likely mixed responsibilities (needs targeted follow-up) |
| 13 | **Low** | `src/patrol/patrol.ts` | `resolveCurrentWaypointIndex` alignment failure is silent |

---

## Not Flagged (Deliberate Decisions)

- **`assertNever` in `engine.ts`**: Correctly implemented in `runSimulationStep`.
- **Bootstrap security hardening** (zip-slip, redirect allowlist, prototype-pollution): Well-implemented.
- **`safeResolveOutput` jail check**: Correct and tested.
- **ECS trait add/set split** (`entity.has(Trait) ? entity.set : entity.add`): Correct Koota idiom.
- **`findPackRoot` recursive DFS with depth limit**: Intentional and documented.
- **`KAYKIT_MAX_ZIP_ENTRY_BYTES` defense-in-depth**: Appropriate and commented.
- **`mirrorPackTree` in-process copy**: Correct for the GLTF asset sizes involved.
