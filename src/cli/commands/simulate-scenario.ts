import type { PackEdition } from '../../types';
import { runSimulateScenario } from '../_shared';
import type { ParsedArgs } from '../_shared';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runSimulateScenario(parsed, sourceRoot, edition);
}
