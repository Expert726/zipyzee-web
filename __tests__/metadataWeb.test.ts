import piexif from 'piexifjs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { groupsFound, readMeta, removeMeta } from '@/tools/image/metadataWeb';

const bin = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('');
const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

/** A small JPEG carrying location, camera, date and owner details (and a turned orientation). */
async function photo() {
  const jpg = new Uint8Array(await sharp({ create: { width: 16, height: 12, channels: 3, background: '#3f7d1c' } }).jpeg().toBuffer());
  const exif = piexif.dump({
    '0th': { [piexif.ImageIFD.Make]: 'Apple', [piexif.ImageIFD.Model]: 'iPhone 14', [piexif.ImageIFD.Artist]: 'Ali Khan', [piexif.ImageIFD.Orientation]: 6 },
    Exif: { [piexif.ExifIFD.DateTimeOriginal]: '2026:10:12 16:12:00', [piexif.ExifIFD.FNumber]: [18, 10] },
    GPS: {
      [piexif.GPSIFD.GPSLatitudeRef]: 'N', [piexif.GPSIFD.GPSLatitude]: [[31, 1], [31, 1], [0, 1]],
      [piexif.GPSIFD.GPSLongitudeRef]: 'E', [piexif.GPSIFD.GPSLongitude]: [[74, 1], [21, 1], [0, 1]],
    },
  });
  return bytes(piexif.insert(exif, bin(jpg)));
}

describe('Remove metadata (web)', () => {
  it('reads every group and where the photo was taken', async () => {
    const m = readMeta(await photo(), 'a.jpg', 'image/jpeg');
    expect(groupsFound([m]).map((g) => g.group)).toEqual(['location', 'camera', 'date', 'owner']);
    expect(m.lat).toBeCloseTo(31.5167, 3);
    expect(m.lng).toBeCloseTo(74.35, 3);
    expect(m.items.find((x) => x.name === 'Artist')?.value).toBe('Ali Khan');
  });

  it('removes only the chosen groups and keeps the photo upright', async () => {
    const out = removeMeta(await photo(), new Set(['location', 'owner']))!;
    const m = readMeta(out, 'a.jpg', 'image/jpeg');
    expect(groupsFound([m]).map((g) => g.group)).toEqual(['camera', 'date']);
    const d = piexif.load(bin(out)) as unknown as { '0th': Record<number, unknown> };
    expect(d['0th'][piexif.ImageIFD.Orientation]).toBe(6);
  });

  it('removes everything', async () => {
    const out = removeMeta(await photo(), new Set(['location', 'camera', 'date', 'owner', 'software', 'text', 'preview', 'extra']))!;
    expect(groupsFound([readMeta(out, 'a.jpg', 'image/jpeg')])).toEqual([]);
    // still a JPEG sharp can open
    expect((await sharp(out).metadata()).width).toBe(16);
  });
});
