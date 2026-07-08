#!/usr/bin/env node
/**
 * `declarative-hex-worlds` CLI entry point.
 *
 * Built on `citty` for command routing + help formatting; each subcommand is a
 * lazy `() => import('./commands/<name>')` so the headless paths (`--help`,
 * `doctor`, `validate`) never load the heavy helper graph (`_shared.ts`, the
 * freeManifest tree, the blueprint engine, the simulation surface) — keeping
 * cold-start under the PRD E5 80 ms budget.
 *
 * Each subcommand module exports `run(parsed, sourceRoot, edition)` where
 * `parsed.flags` is a flat string/bool map produced by the local `parseFlags`
 * helper. citty owns the command name + `--help`; subcommands keep their full
 * arbitrary flag surface (so we don't need to re-declare ~200 args across 35
 * commands as a citty arg schema).
 *
 * @module
 */
import { resolve } from 'node:path';
import { defineCommand, runMain } from 'citty';
import { GameboardCliError } from '../errors';
import { defaultSourceRoot } from '../ingest';
import type { PackEdition } from '../types';

interface ParsedArgs {
  command: string;
  flags: Record<string, string | boolean>;
}

type CommandModule = {
  run: (parsed: ParsedArgs, sourceRoot: string, edition: PackEdition) => Promise<void> | void;
};

/**
 * Exported (not just module-local) so tests can assert every dispatchable
 * command name has matching `--help` metadata in `./usage` (completeness
 * test) without duplicating this map.
 */
export const SUBCOMMAND_LOADERS: Record<string, () => Promise<CommandModule>> = {
  doctor: () => import('./commands/doctor'),
  validate: () => import('./commands/validate'),
  manifest: () => import('./commands/manifest'),
  'validate-manifest': () => import('./commands/validate-manifest'),
  analyze: () => import('./commands/analyze'),
  declarations: () => import('./commands/declarations'),
  'guide-permutations': () => import('./commands/guide-permutations'),
  'guide-scenarios': () => import('./commands/guide-scenarios'),
  'guide-usages': () => import('./commands/guide-usages'),
  'guide-render-requests': () => import('./commands/guide-render-requests'),
  'guide-apis': () => import('./commands/guide-apis'),
  'guide-assets': () => import('./commands/guide-assets'),
  'guide-roles': () => import('./commands/guide-roles'),
  coverage: () => import('./commands/coverage'),
  blueprint: () => import('./commands/blueprint'),
  'summarize-plan': () => import('./commands/summarize-plan'),
  'summarize-scenario': () => import('./commands/summarize-scenario'),
  'validate-plan': () => import('./commands/validate-plan'),
  'analyze-layout': () => import('./commands/analyze-layout'),
  'spawn-groups': () => import('./commands/spawn-groups'),
  'patrol-routes': () => import('./commands/patrol-routes'),
  'patrol-script': () => import('./commands/patrol-script'),
  'validate-recipe': () => import('./commands/validate-recipe'),
  'validate-scenario': () => import('./commands/validate-scenario'),
  'validate-simulation': () => import('./commands/validate-simulation'),
  snapshot: () => import('./commands/snapshot'),
  'simulate-scenario': () => import('./commands/simulate-scenario'),
  compatibility: () => import('./commands/compatibility'),
  piece: () => import('./commands/piece'),
  'pieces-from-assets': () => import('./commands/pieces-from-assets'),
  bind: () => import('./commands/bind'),
  init: () => import('./commands/init'),
  pieces: () => import('./commands/pieces'),
  'place-piece': () => import('./commands/place-piece'),
  extract: () => import('./commands/extract'),
  // The docs (pillar 03, `./ingest` subpath) call this workflow "ingest";
  // consumers following that vocabulary should land on the same command.
  ingest: () => import('./commands/extract'),
  bootstrap: () => import('./commands/bootstrap'),
};

function parseFlags(rest: readonly string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index];
    if (!item?.startsWith('--')) {
      continue;
    }
    const key = item.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      flags[key] = next;
      index += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function readEdition(value: string | boolean | undefined): PackEdition {
  if (value === undefined || value === false) {
    return 'free';
  }
  if (value === 'free' || value === 'extra') {
    return value;
  }
  throw new GameboardCliError(`Unsupported edition: ${String(value)}`);
}

/**
 * Build the citty subCommands map: each name lazy-loads its module on demand,
 * adapts citty's `(ctx) => ...` shape back into the existing
 * `run(parsed, sourceRoot, edition)` contract, and forwards citty's
 * `ctx.rawArgs` through the local flag parser so subcommands keep their full
 * arbitrary flag surface unchanged.
 */
const subCommands = Object.fromEntries(
  Object.entries(SUBCOMMAND_LOADERS).map(([name, loader]) => [
    name,
    async () => {
      const mod = await loader();
      return defineCommand({
        meta: { name, description: `\`${name}\` subcommand` },
        async run(ctx) {
          const flags = parseFlags(ctx.rawArgs ?? []);
          const edition = readEdition(flags.edition);
          // `--source` without a value parses as `true`; treating `String(true)`
          // as a path resolves to `<cwd>/true`. Type-check before coercing.
          const sourceRoot = resolve(
            typeof flags.source === 'string' ? flags.source : defaultSourceRoot(edition)
          );
          await mod.run({ command: name, flags }, sourceRoot, edition);
        },
      });
    },
  ])
);

const main = defineCommand({
  meta: {
    name: 'declarative-hex-worlds',
    description:
      'declarative-hex-worlds CLI — asset-source binding, manifest, validate, bootstrap, and scenario tools.',
  },
  subCommands,
});

/**
 * Pre-process argv so the rich hand-curated `./usage` help is preserved for
 * `--help` / `-h` / `help` / no-args paths. citty's auto-generated help only
 * lists subcommand names; the existing usage doc carries per-flag reference
 * (e.g. PRD RB2's `--source github|zip`, `--verify`). Intercepting BEFORE
 * `runMain` is required because citty handles `--help` itself otherwise.
 *
 * `<command> --help` / `<command> -h` is intercepted the same way, one level
 * down: when the first token names a known subcommand (or alias) and a later
 * token is genuinely a help request, print that command's full per-flag
 * reference from `./usage` instead of dispatching to the command's `run()`.
 * Unknown subcommands fall through to `runMain`, which reports them the usual
 * way.
 *
 * `--help` always parses as a boolean flag under {@link parseFlags} (a
 * following `--x` token is never consumed as its value, and a following
 * bare-word token IS consumed as its value, but `--help`'s value is never
 * inspected downstream) - so any `--help` token anywhere after the command
 * name is unambiguously a help request. `-h` is not `--`-prefixed, so
 * `parseFlags` treats it as a VALUE when it immediately follows a `--flag`
 * token (e.g. `guide-assets --assetId -h` means "asset id literally '-h'",
 * not "show help"). Only intercept a bare `-h` when the preceding token does
 * NOT start with `--` (i.e. `-h` is itself a standalone token, as in
 * `bootstrap -h` or `bootstrap --force -h`... the latter's `-h` follows a
 * boolean `--force`, so it is not consumed as a value either).
 */
function isHelpToken(argv: readonly string[], index: number): boolean {
  const arg = argv[index];
  if (arg === '--help') {
    return true;
  }
  if (arg !== '-h') {
    return false;
  }
  const previous = argv[index - 1];
  return previous === undefined || !previous.startsWith('--');
}

async function runCli(argv: readonly string[]): Promise<void> {
  const first = argv[0];
  if (argv.length === 0 || first === '--help' || first === '-h' || first === 'help') {
    const { usage } = await import('./usage');
    usage(0);
    return;
  }
  if (
    first &&
    first in SUBCOMMAND_LOADERS &&
    argv.slice(1).some((_arg, offset) => isHelpToken(argv, offset + 1))
  ) {
    const { commandUsage } = await import('./usage');
    commandUsage(first, 0);
    return;
  }
  // Forward the explicit `argv` so programmatic invocations (and tests that
  // pass a custom array) don't fall back to `process.argv`.
  await runMain(main, { rawArgs: argv as string[] });
}

runCli(process.argv.slice(2)).catch((error: unknown) => {
  // Terse default: only the message. Full stack is gated behind
  // HEX_WORLDS_DEBUG=1 so failure output in CI / user terminals stays
  // quiet, but interactive debugging is one env-var away. Phase 2 security
  // review S-M5.
  const debugEnabled = process.env.HEX_WORLDS_DEBUG === '1';
  if (debugEnabled && error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
});
