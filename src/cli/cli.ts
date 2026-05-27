#!/usr/bin/env node
/**
 * `medieval-hexagon-gameboard` CLI entry point.
 *
 * Thin dispatcher (PRD B3 / P-C2). Top-level cost is intentionally tiny:
 * a single argv read, the `parseArgs` helper, and a per-subcommand dynamic
 * import. Headless paths (`--help`, `doctor`, `validate`) never load the
 * heavy helper graph (`_shared.ts`, the freeManifest tree, the blueprint
 * engine, the simulation surface), which keeps cold-start under the PRD E5
 * 80 ms budget.
 *
 * Each subcommand lives in `./commands/<name>.ts` and exports
 * `run(parsed, sourceRoot, edition)`. `_shared.ts` is loaded only by
 * subcommands that actually need its helpers.
 *
 * @module
 */
import { resolve } from 'node:path';
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

const HANDLERS: Record<string, () => Promise<CommandModule>> = {
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
  pieces: () => import('./commands/pieces'),
  'place-piece': () => import('./commands/place-piece'),
  extract: () => import('./commands/extract'),
  bootstrap: () => import('./commands/bootstrap'),
};

function parseArgs(argv: string[]): ParsedArgs {
  const [command = 'help', ...rest] = argv;
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
  return { command, flags };
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

async function main(argv: string[]): Promise<void> {
  const [rawCommand = 'help'] = argv;
  if (rawCommand === 'help' || rawCommand === '--help' || rawCommand === '-h') {
    const { usage } = await import('./usage');
    usage(0);
    return;
  }

  const handler = HANDLERS[rawCommand];
  if (!handler) {
    const { usage } = await import('./usage');
    usage(1);
    return;
  }

  const parsed = parseArgs(argv);
  const edition = readEdition(parsed.flags.edition);
  const sourceRoot = resolve(String(parsed.flags.source ?? defaultSourceRoot(edition)));

  const module = await handler();
  await module.run(parsed, sourceRoot, edition);
}

main(process.argv.slice(2)).catch((error) => {
  // Terse default: only the message. Full stack is gated behind
  // MEDIEVAL_HEXAGON_DEBUG=1 so failure output in CI / user terminals
  // stays quiet, but interactive debugging is one env-var away.
  // Phase 2 security review S-M5.
  const debugEnabled = process.env.MEDIEVAL_HEXAGON_DEBUG === '1';
  if (debugEnabled && error instanceof Error) {
    console.error(error.stack ?? error.message);
  } else {
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exit(1);
});
