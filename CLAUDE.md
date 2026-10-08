# declarative-hex-worlds contributor guidance

Read `README.md`, `CONTRIBUTING.md`, and `AGENTS.md` before making changes.
This pnpm workspace publishes only `packages/declarative-hex-worlds/`;
`packages/examples/` and the Sourcey site in `docs/` are private consumers.

## Setup and checks

- Use Node 22+ and the pinned pnpm 9.15.9.
- Install with `pnpm install --frozen-lockfile`.
- Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` for library changes.
- `pnpm verify` runs lint, typecheck, the production dependency audit, build,
  scenario expectations, unit tests, and enforced coverage.
- Install hooks with `pre-commit install`; run
  `pre-commit run --all-files` for repository hygiene checks.
- Browser checks run through the package's `test:browser:free` script;
  cross-kit flows use `test:e2e:local-assets`. See `CONTRIBUTING.md` for the
  coverage harnesses and asset setup.
- Run `pnpm docs:build` for Sourcey content or generated reference changes.

## Conventions

- Use Conventional Commits and focused feature branches. Keep hooks enabled.
- Prefer Koota state and public runtime helpers over parallel game state.
- Keep cross-domain imports on the domain barrels and preserve deterministic
  seeded generation. Follow the architecture rules in `AGENTS.md`.
- Keep engine-neutral plans and snapshots serializable, and document public
  APIs with useful TypeDoc lifecycle and validation guidance.
- Co-locate unit tests with source; keep integration, browser, and e2e tests
  in their respective test directories. Preserve coverage and screenshot gates.
- The published tarball ships FREE asset manifest metadata, not raw GLTF
  trees. Consumers bootstrap assets; EXTRA and third-party binaries stay local.
- `docs/content/site/` is the canonical human-facing documentation. The
  package-level docs also contain metadata used by catalog and contract tests.
- Keep agent runtime state and machine-specific tool configuration untracked.
