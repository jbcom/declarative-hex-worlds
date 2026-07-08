import { describe, expect, it } from 'vitest';
import { inferTilesetGrid, readPngDimensions } from '../png-dimensions';

/** Build the minimal PNG head (signature + IHDR chunk) encoding width×height. */
function pngHead(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); // signature
  // IHDR chunk length (13) is bytes 8–11; not read, leave 0.
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  bytes[16] = (width >>> 24) & 0xff;
  bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff;
  bytes[21] = (height >>> 16) & 0xff;
  bytes[22] = (height >>> 8) & 0xff;
  bytes[23] = height & 0xff;
  return bytes;
}

describe('readPngDimensions', () => {
  it('reads width + height from the IHDR chunk', () => {
    expect(readPngDimensions(pngHead(480, 830))).toEqual({ width: 480, height: 830 });
    expect(readPngDimensions(pngHead(1, 1))).toEqual({ width: 1, height: 1 });
  });

  it('throws on data shorter than an IHDR', () => {
    expect(() => readPngDimensions(new Uint8Array(10))).toThrow(/fewer than 24/);
  });

  it('throws on a bad signature', () => {
    const bad = pngHead(480, 830);
    bad[0] = 0x00;
    expect(() => readPngDimensions(bad)).toThrow(/bad signature/);
  });

  it('throws when the first chunk is not IHDR', () => {
    const bad = pngHead(480, 830);
    bad[12] = 0x00; // corrupt the "I" of IHDR
    expect(() => readPngDimensions(bad)).toThrow(/not IHDR/);
  });
});

describe('inferTilesetGrid', () => {
  it('derives cell size from atlas dimensions + cols/rows', () => {
    expect(inferTilesetGrid({ width: 480, height: 830 }, 5, 10)).toEqual({
      cols: 5,
      rows: 10,
      cellWidth: 96,
      cellHeight: 83,
    });
  });

  it('throws when the atlas does not divide evenly', () => {
    expect(() => inferTilesetGrid({ width: 480, height: 830 }, 7, 10)).toThrow(/divide evenly/);
  });

  it('throws on non-positive-integer cols/rows', () => {
    expect(() => inferTilesetGrid({ width: 96, height: 96 }, 0, 1)).toThrow(/positive integers/);
    expect(() => inferTilesetGrid({ width: 96, height: 96 }, 1.5, 1)).toThrow(/positive integers/);
  });
});
