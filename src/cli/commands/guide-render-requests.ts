import type { PackEdition } from '../../types';
import { runGuideRenderRequests } from '../_shared';
import type { ParsedArgs } from '../_shared';

export async function run(parsed: ParsedArgs, sourceRoot: string, edition: PackEdition): Promise<void> {
  runGuideRenderRequests(parsed, sourceRoot, edition);
}
