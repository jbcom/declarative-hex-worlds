#!/usr/bin/env tsx
import {
  analyzeScreenshot,
  DEFAULT_SCREENSHOT_THRESHOLDS,
  formatScreenshotStats,
  type ScreenshotThresholds,
  validateScreenshot,
} from './screenshot-quality';

const { paths, thresholds } = parseArgs(process.argv.slice(2));
if (paths.length === 0) {
  throw new Error('Usage: tsx tests/scripts/assert-screenshots.ts [--minWidth n] <png> [...]');
}

const stats = paths.map((path) => analyzeScreenshot(path));
const failures = stats.flatMap((entry) => validateScreenshot(entry, thresholds));

for (const entry of stats) {
  console.log(formatScreenshotStats(entry));
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(failure);
  }
  process.exit(1);
}

function parseArgs(args: readonly string[]): {
  paths: readonly string[];
  thresholds: ScreenshotThresholds;
} {
  const paths: string[] = [];
  const thresholds = { ...DEFAULT_SCREENSHOT_THRESHOLDS };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith('--')) {
      if (arg) {
        paths.push(arg);
      }
      continue;
    }
    const value = args[index + 1];
    if (value === undefined) {
      throw new Error(`${arg} requires a value`);
    }
    index += 1;
    switch (arg) {
      case '--minWidth':
        thresholds.minWidth = readNumberFlag(arg, value);
        break;
      case '--minHeight':
        thresholds.minHeight = readNumberFlag(arg, value);
        break;
      case '--minUniqueColorBuckets':
        thresholds.minUniqueColorBuckets = readNumberFlag(arg, value);
        break;
      case '--minLuminanceStdDev':
        thresholds.minLuminanceStdDev = readNumberFlag(arg, value);
        break;
      case '--minNonBackgroundRatio':
        thresholds.minNonBackgroundRatio = readNumberFlag(arg, value);
        break;
      default:
        throw new Error(`Unknown option ${arg}`);
    }
  }

  return { paths, thresholds };
}

function readNumberFlag(flag: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flag} must be a finite number`);
  }
  return parsed;
}
