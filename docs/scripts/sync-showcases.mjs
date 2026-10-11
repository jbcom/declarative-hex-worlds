import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const source = fileURLToPath(new URL('../../packages/declarative-hex-worlds/docs/showcases/sculpt-camp.png', import.meta.url));
const target = fileURLToPath(new URL('../content/site/assets/sculpt-camp.png', import.meta.url));
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
