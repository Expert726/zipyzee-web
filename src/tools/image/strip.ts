// Remove metadata without re-encoding (pure, unit-tested). JPEG: drop the EXIF / XMP (APP1), IPTC (APP13) and comment
// segments, keeping the colour profile (APP2) and, when the photo was turned by its EXIF orientation, a tiny EXIF block
// with only that orientation so it still shows upright. PNG: drop text, EXIF and time chunks. Anything else: null
// (the handler re-encodes it, which drops everything).

const APP1 = 0xe1;
const APP13 = 0xed;
const COM = 0xfe;
const SOS = 0xda;

const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = (b: Uint8Array) => b.length > 8 && PNG_SIG.every((v, i) => b[i] === v);

/** EXIF orientation (1-8) in an APP1 payload starting at `start` (after the length), or 1. */
export function exifOrientation(b: Uint8Array, start: number, end: number): number {
  // "Exif\0\0" then a TIFF header
  if (end - start < 14 || String.fromCharCode(...b.subarray(start, start + 4)) !== 'Exif') return 1;
  const tiff = start + 6;
  const le = b[tiff] === 0x49;
  const u16 = (o: number) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number) => (le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return 1;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > end) break;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

/** An APP1 segment holding only the orientation tag (big-endian TIFF). */
export function orientationSegment(orientation: number): Uint8Array {
  const body = [
    0x45, 0x78, 0x69, 0x66, 0, 0, // "Exif\0\0"
    0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, // "MM", 42, first IFD at 8
    0, 1, // one entry
    0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, orientation, 0, 0, // Orientation, SHORT, 1 value
    0, 0, 0, 0, // no next IFD
  ];
  const len = body.length + 2;
  return new Uint8Array([0xff, APP1, len >> 8, len & 0xff, ...body]);
}

export function stripJpeg(b: Uint8Array): Uint8Array | null {
  if (!isJpeg(b)) return null;
  const parts: Uint8Array[] = [b.subarray(0, 2)];
  let orientation = 1;
  let o = 2;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) return null; // not a well-formed segment list: let the handler re-encode
    const marker = b[o + 1];
    if (marker === 0xff) {
      o++; // fill byte
      continue;
    }
    if (marker === SOS) {
      parts.push(b.subarray(o)); // image data to the end, untouched
      break;
    }
    const len = (b[o + 2] << 8) | b[o + 3];
    const end = o + 2 + len;
    if (len < 2 || end > b.length) return null;
    if (marker === APP1) {
      orientation = Math.max(orientation, exifOrientation(b, o + 4, end));
    } else if (marker !== APP13 && marker !== COM) {
      parts.push(b.subarray(o, end));
    }
    o = end;
  }
  // the orientation block goes right after the JFIF header (or SOI)
  if (orientation > 1) {
    const at = parts.length > 1 && parts[1][1] === 0xe0 ? 2 : 1;
    parts.splice(at, 0, orientationSegment(orientation));
  }
  return concat(parts);
}

const PNG_DROP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

export function stripPng(b: Uint8Array): Uint8Array | null {
  if (!isPng(b)) return null;
  const parts: Uint8Array[] = [b.subarray(0, 8)];
  let o = 8;
  while (o + 12 <= b.length) {
    const len = ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
    const type = String.fromCharCode(...b.subarray(o + 4, o + 8));
    const end = o + 12 + len;
    if (end > b.length) return null;
    if (!PNG_DROP.has(type)) parts.push(b.subarray(o, end));
    o = end;
    if (type === 'IEND') break;
  }
  return concat(parts);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
