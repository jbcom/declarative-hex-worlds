import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

interface PngImage {
  width: number;
  height: number;
  channels: number;
  pixels: Uint8Array;
}

export interface ScreenshotStats {
  path: string;
  width: number;
  height: number;
  pixels: number;
  uniqueColorBuckets: number;
  luminanceStdDev: number;
  nonBackgroundRatio: number;
}

export interface ScreenshotThresholds {
  minWidth: number;
  minHeight: number;
  minUniqueColorBuckets: number;
  minLuminanceStdDev: number;
  minNonBackgroundRatio: number;
}

export const DEFAULT_SCREENSHOT_THRESHOLDS: ScreenshotThresholds = {
  minWidth: 256,
  minHeight: 256,
  minUniqueColorBuckets: 24,
  minLuminanceStdDev: 4,
  minNonBackgroundRatio: 0.002,
};

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function analyzeScreenshot(path: string): ScreenshotStats {
  const image = decodePng(readFileSync(resolve(path)));
  const pixels = image.width * image.height;
  const colorBuckets = new Map<number, number>();
  let luminanceSum = 0;
  let luminanceSquareSum = 0;

  for (let pixelIndex = 0; pixelIndex < pixels; pixelIndex += 1) {
    const [red, green, blue, alpha] = readRgba(image, pixelIndex);
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    luminanceSum += luminance;
    luminanceSquareSum += luminance * luminance;
    if (alpha > 0) {
      const bucket = ((red >> 3) << 10) | ((green >> 3) << 5) | (blue >> 3);
      colorBuckets.set(bucket, (colorBuckets.get(bucket) ?? 0) + 1);
    }
  }

  const mean = luminanceSum / pixels;
  const variance = Math.max(luminanceSquareSum / pixels - mean * mean, 0);
  const dominantColorPixels = colorBuckets.size > 0 ? Math.max(...colorBuckets.values()) : 0;
  return {
    path,
    width: image.width,
    height: image.height,
    pixels,
    uniqueColorBuckets: colorBuckets.size,
    luminanceStdDev: Math.sqrt(variance),
    nonBackgroundRatio: (pixels - dominantColorPixels) / pixels,
  };
}

export function validateScreenshot(
  stats: ScreenshotStats,
  thresholds: ScreenshotThresholds = DEFAULT_SCREENSHOT_THRESHOLDS
): readonly string[] {
  const failures: string[] = [];
  if (stats.width < thresholds.minWidth) {
    failures.push(`${stats.path}: width ${stats.width} is below ${thresholds.minWidth}`);
  }
  if (stats.height < thresholds.minHeight) {
    failures.push(`${stats.path}: height ${stats.height} is below ${thresholds.minHeight}`);
  }
  if (stats.uniqueColorBuckets < thresholds.minUniqueColorBuckets) {
    failures.push(
      `${stats.path}: ${stats.uniqueColorBuckets} color buckets is below ${thresholds.minUniqueColorBuckets}`
    );
  }
  if (stats.luminanceStdDev < thresholds.minLuminanceStdDev) {
    failures.push(
      `${stats.path}: luminance stddev ${stats.luminanceStdDev.toFixed(2)} is below ${thresholds.minLuminanceStdDev}`
    );
  }
  if (stats.nonBackgroundRatio < thresholds.minNonBackgroundRatio) {
    failures.push(
      `${stats.path}: non-background ratio ${stats.nonBackgroundRatio.toFixed(4)} is below ${thresholds.minNonBackgroundRatio}`
    );
  }
  return failures;
}

export function formatScreenshotStats(entry: ScreenshotStats): string {
  return [
    `screenshot: ${entry.path}`,
    `${entry.width}x${entry.height}`,
    `${entry.uniqueColorBuckets} color buckets`,
    `luma sd ${entry.luminanceStdDev.toFixed(2)}`,
    `non-dominant ${(entry.nonBackgroundRatio * 100).toFixed(2)}%`,
  ].join(' | ');
}

function decodePng(buffer: Buffer): PngImage {
  if (!buffer.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new Error('File is not a PNG');
  }

  let offset = pngSignature.length;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + length;
    const data = buffer.subarray(chunkStart, chunkEnd);
    offset = chunkEnd + 4;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8] ?? 0;
      colorType = data[9] ?? 0;
      continue;
    }
    if (type === 'IDAT') {
      idatChunks.push(data);
      continue;
    }
    if (type === 'IEND') {
      break;
    }
  }

  if (width <= 0 || height <= 0) {
    throw new Error('PNG is missing a valid IHDR chunk');
  }
  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth ${bitDepth}; expected 8`);
  }

  const channels = channelsForColorType(colorType);
  const rowLength = width * channels;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const pixels = new Uint8Array(width * height * channels);
  let sourceOffset = 0;

  for (let row = 0; row < height; row += 1) {
    const filterType = inflated[sourceOffset] ?? -1;
    sourceOffset += 1;
    const rowStart = row * rowLength;
    for (let column = 0; column < rowLength; column += 1) {
      const raw = inflated[sourceOffset + column] ?? 0;
      const left = column >= channels ? pixels[rowStart + column - channels] ?? 0 : 0;
      const up = row > 0 ? pixels[rowStart + column - rowLength] ?? 0 : 0;
      const upLeft = row > 0 && column >= channels ? pixels[rowStart + column - rowLength - channels] ?? 0 : 0;
      pixels[rowStart + column] = unfilterByte(filterType, raw, left, up, upLeft);
    }
    sourceOffset += rowLength;
  }

  return { width, height, channels, pixels };
}

function channelsForColorType(colorType: number): number {
  if (colorType === 0) {
    return 1;
  }
  if (colorType === 2) {
    return 3;
  }
  if (colorType === 4) {
    return 2;
  }
  if (colorType === 6) {
    return 4;
  }
  throw new Error(`Unsupported PNG color type ${colorType}`);
}

function unfilterByte(filterType: number, raw: number, left: number, up: number, upLeft: number): number {
  switch (filterType) {
    case 0:
      return raw;
    case 1:
      return (raw + left) & 0xff;
    case 2:
      return (raw + up) & 0xff;
    case 3:
      return (raw + Math.floor((left + up) / 2)) & 0xff;
    case 4:
      return (raw + paethPredictor(left, up, upLeft)) & 0xff;
    default:
      throw new Error(`Unsupported PNG filter type ${filterType}`);
  }
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  if (upDistance <= upLeftDistance) {
    return up;
  }
  return upLeft;
}

function readRgba(image: PngImage, pixelIndex: number): [number, number, number, number] {
  const offset = pixelIndex * image.channels;
  if (image.channels === 1) {
    const value = image.pixels[offset] ?? 0;
    return [value, value, value, 255];
  }
  if (image.channels === 2) {
    const value = image.pixels[offset] ?? 0;
    return [value, value, value, image.pixels[offset + 1] ?? 255];
  }
  if (image.channels === 3) {
    return [
      image.pixels[offset] ?? 0,
      image.pixels[offset + 1] ?? 0,
      image.pixels[offset + 2] ?? 0,
      255,
    ];
  }
  return [
    image.pixels[offset] ?? 0,
    image.pixels[offset + 1] ?? 0,
    image.pixels[offset + 2] ?? 0,
    image.pixels[offset + 3] ?? 255,
  ];
}
