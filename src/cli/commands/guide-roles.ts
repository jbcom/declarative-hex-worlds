import type { PackEdition } from '../../types';
import { runGuideRoles } from '../_shared';
import type { ParsedArgs } from '../_shared';

export async function run(parsed: ParsedArgs, _sourceRoot: string, _edition: PackEdition): Promise<void> {
  runGuideRoles(parsed);
}
