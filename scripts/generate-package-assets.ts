import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  generateManifestFromSource,
  validateSourceRoot,
  writeManifestJson,
  writeManifestModule,
} from '../src/ingest';
import type { MedievalHexagonManifest, PackEdition } from '../src/types';

interface SourceValidation {
  ok: boolean;
  expectedCount: number;
  gltfCount: number;
}

type ValidateSourceRoot = (sourceRoot: string, edition: PackEdition) => SourceValidation;
type GenerateManifest = (options: {
  sourceRoot: string;
  edition: PackEdition;
}) => MedievalHexagonManifest;
type WriteManifest = (manifest: MedievalHexagonManifest, outputPath: string) => void;

export interface ParsedPackageAssetsArgs {
  edition: PackEdition;
  source: string;
  packageRoot: string;
}

export interface GeneratePackageAssetsDependencies {
  validateSourceRootImpl?: ValidateSourceRoot;
  generateManifestFromSourceImpl?: GenerateManifest;
  writeManifestModuleImpl?: WriteManifest;
  writeManifestJsonImpl?: WriteManifest;
  log?: (message: string) => void;
}

export interface GeneratePackageAssetsResult {
  sourceRoot: string;
  packageRoot: string;
  manifest: MedievalHexagonManifest;
}

export function defaultPackageRoot(): string {
  return resolve(import.meta.dirname, '..');
}

export function parsePackageAssetsArgs(
  argv: string[],
  packageRoot = defaultPackageRoot()
): ParsedPackageAssetsArgs {
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
    packageRoot: flags.package ?? packageRoot,
  };
}

export function generatePackageAssets(
  args: ParsedPackageAssetsArgs,
  dependencies: GeneratePackageAssetsDependencies = {}
): GeneratePackageAssetsResult {
  const sourceRoot = resolve(args.source);
  const packageRoot = resolve(args.packageRoot);
  const validate = dependencies.validateSourceRootImpl ?? validateSourceRoot;
  const generate = dependencies.generateManifestFromSourceImpl ?? generateManifestFromSource;
  const validation = validate(sourceRoot, args.edition);

  if (!validation.ok) {
    throw new Error(
      `Expected ${validation.expectedCount} ${args.edition} GLTF files, found ${validation.gltfCount}.`
    );
  }

  const manifest = generate({
    sourceRoot,
    edition: args.edition,
  });

  if (args.edition === 'free') {
    (dependencies.writeManifestModuleImpl ?? writeManifestModule)(
      manifest,
      resolve(packageRoot, 'src/manifest/free.ts')
    );
    (dependencies.writeManifestJsonImpl ?? writeManifestJson)(
      manifest,
      resolve(packageRoot, 'assets/free/manifest.json')
    );
  }
  (dependencies.log ?? console.log)(
    `Generated manifest for ${manifest.counts.total} ${args.edition} assets`
  );

  return { sourceRoot, packageRoot, manifest };
}

export function runGeneratePackageAssets(
  argv = process.argv.slice(2),
  dependencies: GeneratePackageAssetsDependencies = {}
): GeneratePackageAssetsResult {
  return generatePackageAssets(parsePackageAssetsArgs(argv), dependencies);
}

function isDirectRun(): boolean {
  return process.argv[1]
    ? resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()
    : false;
}

if (isDirectRun()) {
  runGeneratePackageAssets();
}
