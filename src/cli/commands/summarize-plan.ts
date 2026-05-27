import type { PackEdition } from '../../types';
import { runSummarizePlan } from '../_shared';
import type { ParsedArgs } from '../_shared';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runSummarizePlan(parsed, sourceRoot, edition);
}
