import type { PackEdition } from '../../types';
import { runPatrolRoutes } from '../_shared';
import type { ParsedArgs } from '../_shared';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runPatrolRoutes(parsed, sourceRoot, edition);
}
