# Standards

The non-negotiables for `@jbcom/medieval-hexagon-gameboard`. Pulled from PRD §6. Authoritative source for "what we don't do".

## Code

1. **100 % test coverage at every dimension.** Statements / branches / functions / lines all read 100 % across `src/`. Every public behavior has a unit test. Every render-affecting binding has a browser test asserting against a committed screenshot. Every full flow has an e2e run.
2. **Determinism.** Identical inputs produce byte-identical outputs across processes and platforms.
3. **No `Math.random`, `crypto.randomUUID`, `Date.now`, `performance.now`** in `src/` — except in CLI-output formatters with explicit override flags.
4. **No `any`, no `@ts-ignore`, no `as any`, no non-null assertions** in `src/` or `scripts/`. Biome enforces.
5. **Zero `TODO`, `FIXME`, `it.todo`, empty bodies, stub markers.**
6. **No circular dependencies between modules.**
7. **`splitting: true` stays on** in the tsup build; trait identity test (PRD E4) keeps it honest.
8. **ESM only, Node ≥22, `sideEffects: false`.**
9. **Every CI gate runs locally via `pnpm verify`.**
10. **Public API tier table** in `docs-site/src/content/docs/reference/` is source-of-truth; `package.json#exports` mirrors it.

## Process

- **Conventional Commits** required. release-please derives the changelog.
- **One topic per commit.** Commit freely on feature branches; PRs are squash-merged.
- **Never `--no-verify`** to bypass hooks. Fix the cause.
- **Visual changes need a screenshot in the same commit.** Drift in `tests/browser/__screenshots__/` blocks merge.
- **Docs drift is a bug.** Touch a system → update its docs in the same commit.
- **Reference PRD items** in commit messages (`PRD A9`, `PRD F-Site-3`).

## Dependencies

- `peerDependencies` are **not used**. React, Three, react-dom, koota, honeycomb-grid, seedrandom are direct `dependencies`. Bootstrap-out-of-box is the product.
- `pnpm update --latest` is the cadence; majors go through dedicated commits.
- Adding a library that solves a real problem is encouraged. The published surface is `dist/`; implementation choices behind it don't have to be minimal.

## Performance posture

- Cold-start budget for CLI headless paths (`validate`, `coverage`, `doctor`): under 40 ms.
- Warm-start budget for blueprint → board → runtime → snapshot: under 50 ms median (PRD A3b bench tracks this).
- React selector hooks must hash-stabilize their options (PRD B7); plan-derived indexes must be memoized (PRD B4).

## Security posture

- Every CLI `--out*` flag flows through `safeResolveOutput` (PRD C1).
- File walks in `src/ingest/` skip symlinks + verify `realpathSync` stays inside the root (PRD C2).
- Prototype-pollution guards on every JSON load that uses dynamic keys (PRD C3).
- Production audit (`pnpm audit --prod --audit-level=high`) gates every PR.
- Semgrep p/owasp-top-ten + p/nodejs runs on every PR.

## Errors

Every library-originated throw is a `GameboardError` subclass (PRD D2). Consumers can branch on `instanceof`:

```ts
import { GameboardValidationError } from '@jbcom/medieval-hexagon-gameboard/errors';

try {
  validateScenario(input);
} catch (e) {
  if (e instanceof GameboardValidationError) {
    // structured handling
  }
  throw e;
}
```

Messages are stable; consumers regex'ing them today will keep working. Don't change a message lightly.
