# Review Scope

## Target

Full codebase of `declarative-hex-worlds` — a TypeScript ESM library providing a hex-grid gameboard engine with ECS (koota), movement/patrol/quest systems, simulation scripting, a citty-based CLI, and an Astro Starlight docs site.

Repo root: `/Users/jbogaty/src/jbcom/declarative-hex-worlds`

## Files

- `src/` — ~58 implementation modules across 18 domains:
  - `actors/`, `commands/`, `config/`, `coordinates/`, `errors/`, `gameboard/`, `ingest/`, `internal/`, `interop/`, `koota/`, `manifest/`, `movement/`, `patrol/`, `pieces/`, `quests/`, `react/`, `rules/`, `runtime/`, `scenario/`, `selectors/`, `simulation/`, `systems/`, `three/`, `traits/`, `types/`
  - `cli/` — citty CLI with 30+ subcommands; `cli/commands/bootstrap/` — GitHub zip download + yauzl extraction
- `scripts/` — build helpers
- `tests/` — contract tests, browser visual tests (Playwright + vitest-browser)
- `.github/workflows/ci.yml` + `release.yml`
- `docs-site/src/content/docs/` — Astro Starlight MDX docs
- Root config: `vitest.*.shared.ts`, `tsup.config.ts`, `biome.json`, `package.json`

Total: ~1,397 tracked files

## Flags

- Security Focus: yes (CLI does GitHub HTTPS fetch + zip extraction with path-traversal guard; config has URL template interpolation)
- Performance Critical: no (library, not a server)
- Strict Mode: no
- Framework: TypeScript ESM, vitest, tsup, biome, koota (ECS), three.js, react-three-fiber, citty, yauzl, Astro Starlight

## Review Phases

1. Code Quality & Architecture
2. Security & Performance
3. Testing & Documentation
4. Best Practices & Standards
5. Consolidated Report
