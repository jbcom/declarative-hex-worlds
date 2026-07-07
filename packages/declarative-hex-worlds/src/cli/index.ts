#!/usr/bin/env node
/**
 * `src/cli/` — CLI entry point.
 *
 * Currently a single-file home (`./cli`). PRD Epic B3 decomposes it into:
 *
 * - `./index` — `main(argv)` dispatcher (~50 lines)
 * - `./args` — `node:util.parseArgs` wrapper
 * - `./safe-output` — `safeResolveOutput()` helper (Epic C1 path-traversal guard)
 * - `./errors` — `CliError` class
 * - `./commands/` — one file per subcommand (doctor, validate, manifest,
 *   analyze, coverage, extract, simulate, bootstrap, …)
 * - `./formatters/` — output renderers (table, JSON, markdown)
 *
 * That refactor lands in B3 with dynamic per-subcommand imports to bring
 * the CLI cold-start from ~150-250 ms down to ~40 ms (PRD §2 quality bar).
 *
 * @module
 */

// `export *` without a value import lets tsup tree-shake the side-effect runner
// out of dist/cli.js. Force-execute the CLI by also doing a value import so
// the module body actually runs.
import './cli';
export * from './cli';
