import type { PackEdition } from '../../types';
import { runBootstrap, type ParsedArgs } from '../_shared';

export async function run(
  parsed: ParsedArgs,
  _sourceRoot: string,
  edition: PackEdition
): Promise<void> {
  await runBootstrap(parsed, edition);
}
