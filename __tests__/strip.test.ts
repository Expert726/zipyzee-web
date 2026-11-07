import { describe, expect, it } from 'vitest';
import { exifOrientation, orientationSegment, stripJpeg, stripPng } from '@/tools/image/strip';

const seg = (marker: number, body: number[]) => [0xff, marker, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
const exif = (orientation: number) => [...orientationSegment(orientation).subarray(4)];
// SOI, JFIF, EXIF (GPS would live here), ICC, comment, SOS + data, EOI
const jpeg = (orientation: number) =>
  new Uint8Array([
    0xff, 0xd8,
    ...seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0]),
    ...seg(0xe1, exif(orientation)),
    ...seg(0xe2, [1, 2, 3]),
    ...seg(0xfe, [0x68, 0x69]),
    ...seg(0xda, [9, 9]), 1, 2, 3, 0xff, 0xd9,
  ]);

const markers = (b: Uint8Array) => {
  const out: number[] = [];
  let o = 2;
  while (b[o + 1] !== 0xda) {
    out.push(b[o + 1]);
    o += 2 + ((b[o + 2] << 8) | b[o + 3]);
  }
  return out;
};

describe('Remove metadata', () => {
  it('drops EXIF and comments from a JPEG, keeps JFIF, ICC and the image data', () => {
    const out = stripJpeg(jpeg(1))!;
    expect(markers(out)).toEqual([0xe0, 0xe2]);
    // the scan and everything after it, byte for byte
    expect([...out.subarray(-10)]).toEqual([...jpeg(1).subarray(-10)]);
  });

  it('keeps only the orientation of a turned photo', () => {
    const out = stripJpeg(jpeg(6))!;
    expect(markers(out)).toEqual([0xe0, 0xe1, 0xe2]);
    const at = 2 + 2 + 5 + 2; // after SOI + JFIF segment
    expect(exifOrientation(out, at + 4, out.length)).toBe(6);
  });

  it('drops PNG text chunks only', () => {
    const chunk = (type: string, data: number[]) => [0, 0, 0, data.length, ...[...type].map((c) => c.charCodeAt(0)), ...data, 0, 0, 0, 0];
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...chunk('IHDR', [1]), ...chunk('tEXt', [2]), ...chunk('IDAT', [3]), ...chunk('IEND', [])]);
    const out = stripPng(png)!;
    expect(out.length).toBe(png.length - 13);
    expect(new TextDecoder().decode(out)).not.toContain('tEXt');
  });

  it('leaves other files to the re-encoder', () => {
    expect(stripJpeg(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(stripPng(new Uint8Array([1, 2, 3, 4]))).toBeNull();
  });
});
