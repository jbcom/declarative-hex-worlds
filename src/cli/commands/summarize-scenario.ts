import type { PackEdition } from '../../types';
import { runSummarizeScenario } from '../_shared';
import type { ParsedArgs } from '../_shared';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runSummarizeScenario(parsed, sourceRoot, edition);
}
