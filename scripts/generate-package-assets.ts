import { resolve } from 'node:path';
import {
  generateManifestFromSource,
  validateSourceRoot,
  writeManifestJson,
  writeManifestModule,
} from '../src/ingest';
import type { PackEdition } from '../src/types';

interface ParsedArgs {
  edition: PackEdition;
  source: string;
  packageRoot: string;
}

const args = parseArgs(process.argv.slice(2));
const sourceRoot = resolve(args.source);
const packageRoot = resolve(args.packageRoot);
const validation = validateSourceRoot(sourceRoot, args.edition);

if (!validation.ok) {
  throw new Error(
    `Expected ${validation.expectedCount} ${args.edition} GLTF files, found ${validation.gltfCount}.`
  );
}

const manifest = generateManifestFromSource({
  sourceRoot,
  edition: args.edition,
});

if (args.edition === 'free') {
  writeManifestModule(manifest, resolve(packageRoot, 'src/manifest/free.ts'));
  writeManifestJson(manifest, resolve(packageRoot, 'assets/free/manifest.json'));
}
console.log(`Generated manifest for ${manifest.counts.total} ${args.edition} assets`);

function parseArgs(argv: string[]): ParsedArgs {
  const flags: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item?.startsWith('--')) {
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${item}`);
    }
    flags[item.slice(2)] = value;
    index += 1;
  }

  const edition = flags.edition;
  if (edition !== 'free' && edition !== 'extra') {
    throw new Error('--edition must be free or extra');
  }
  if (!flags.source) {
    throw new Error('--source is required');
  }
  return {
    edition,
    source: flags.source,
    packageRoot: flags.package ?? resolve(import.meta.dirname, '..'),
  };
}
