// Remove metadata on the web (the app reads EXIF natively and offers Location / Camera / Date / Owner, Remove or
// Keep; design/FlowStripMetadata.dc.html). Here every detail in the photo is read and shown, grouped, and each group
// can be removed or kept:
//   JPG: EXIF (piexifjs, MIT) by tag; XMP, IPTC and comments (other segments) as one group; the small preview
//        picture inside EXIF as its own group. Removing everything is the lossless strip (./strip.ts); keeping some
//        groups writes a new EXIF with only those tags (the orientation tag always stays, so the photo stays upright).
//   PNG: text chunks (tEXt / iTXt / zTXt), eXIf and tIME, removed by chunk.
//   Anything else (WEBP, HEIC, GIF...): details can't be read here; saving makes a clean copy (re-encoded).
import piexif from 'piexifjs';
import { stripJpeg, stripPng } from './strip';

export type MetaGroup = 'location' | 'camera' | 'date' | 'owner' | 'software' | 'text' | 'preview' | 'extra';
export const GROUP_ORDER: MetaGroup[] = ['location', 'camera', 'date', 'owner', 'software', 'text', 'preview', 'extra'];
/** English keys (shown through t()). */
export const GROUP_LABEL: Record<MetaGroup, string> = {
  location: 'Location',
  camera: 'Camera and settings',
  date: 'Date taken',
  owner: 'Owner and copyright',
  software: 'Software and device',
  text: 'Descriptions and notes',
  preview: 'Hidden preview picture',
  extra: 'Other data (XMP, IPTC, comments)',
};

export type MetaItem = { group: MetaGroup; name: string; value: string };
export type PhotoMeta = { kind: 'jpeg' | 'png' | 'other'; items: MetaItem[]; lat?: number; lng?: number };

// ---------- binary string helpers (piexifjs works on them) ----------

const toBinary = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return s;
};
const fromBinary = (s: string) => {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
};

// ---------- EXIF tags by group ----------

const I = piexif.ImageIFD;
const E = piexif.ExifIFD;
const TAG_GROUP: Record<string, Record<number, MetaGroup>> = {
  '0th': {
    [I.Make]: 'camera', [I.Model]: 'camera',
    [I.DateTime]: 'date',
    [I.Artist]: 'owner', [I.Copyright]: 'owner',
    [I.Software]: 'software', [I.HostComputer]: 'software', [I.ProcessingSoftware]: 'software',
    [I.ImageDescription]: 'text', [I.XPComment]: 'text', [I.XPTitle]: 'text', [I.XPSubject]: 'text', [I.XPKeywords]: 'text', [I.XPAuthor]: 'owner',
  },
  Exif: {
    [E.DateTimeOriginal]: 'date', [E.DateTimeDigitized]: 'date', [0x9010]: 'date', [0x9011]: 'date', [0x9012]: 'date', // OffsetTime, -Original, -Digitized
    [E.SubSecTime]: 'date', [E.SubSecTimeOriginal]: 'date', [E.SubSecTimeDigitized]: 'date',
    [E.CameraOwnerName]: 'owner', [E.BodySerialNumber]: 'software', [E.LensSerialNumber]: 'software', [E.ImageUniqueID]: 'software',
    [E.UserComment]: 'text', [E.MakerNote]: 'software',
  },
};
/** Exif tags not listed above are camera settings (exposure, ISO, lens...). */
const groupOf = (ifd: string, tag: number): MetaGroup => (ifd === 'GPS' ? 'location' : TAG_GROUP[ifd]?.[tag] ?? (ifd === 'Exif' ? 'camera' : 'software'));
/** Tags that describe the picture itself (size, colour, layout): never shown, always kept. */
const STRUCTURE = new Set<number>([I.Orientation, I.XResolution, I.YResolution, I.ResolutionUnit, I.YCbCrPositioning, I.ExifTag, I.GPSTag, E.ColorSpace, E.PixelXDimension, E.PixelYDimension, E.ExifVersion, E.ComponentsConfiguration, E.FlashpixVersion, E.InteroperabilityTag]);

const dec = new TextDecoder();
function show(v: unknown, tag: number): string {
  if (tag === E.MakerNote) return `${String(v).length} bytes of camera-maker data`;
  if (Array.isArray(v)) {
    // a rational [n, d] or a list of them
    if (v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number') return v[1] ? String(Math.round((v[0] / v[1]) * 1000) / 1000) : String(v[0]);
    if (v.every((x) => typeof x === 'number') && v.length > 8) {
      // XP* tags: UTF-16 bytes
      const u16 = new Uint16Array(new Uint8Array(v as number[]).buffer.slice(0, v.length - (v.length % 2)));
      return String.fromCharCode(...u16).replace(/\0+$/, '');
    }
    return v.map((x) => show(x, -1)).join(', ');
  }
  if (typeof v === 'string') {
    if (tag === E.UserComment) return v.replace(/^(ASCII\0\0\0|UNICODE\0|\0{8})/, '').replace(/\0+$/, '') || '(empty)';
    const clean = v.replace(/\0+$/, '');
    return /[\x00-\x08\x0e-\x1f]/.test(clean) ? `${clean.length} bytes` : clean;
  }
  return String(v);
}
const tagName = (ifd: string, tag: number) => {
  const table = ifd === 'GPS' ? piexif.TAGS.GPS : ifd === 'Exif' ? piexif.TAGS.Exif : piexif.TAGS.Image;
  return (table[tag]?.name ?? `Tag ${tag}`).replace(/([a-z])([A-Z])/g, '$1 $2');
};

/** Degrees from EXIF [[d,1],[m,1],[s,100]] and N / S / E / W. */
function degrees(v: unknown, ref: unknown): number | undefined {
  if (!Array.isArray(v) || v.length < 3) return undefined;
  const [d, m, s] = (v as number[][]).map(([n, q]) => (q ? n / q : 0));
  const deg = d + m / 60 + s / 3600;
  return ref === 'S' || ref === 'W' ? -deg : deg;
}

// ---------- JPEG segments other than EXIF ----------

/** XMP / IPTC / comment segments a JPEG carries (names for the list). */
function otherSegments(b: Uint8Array): string[] {
  const out: string[] = [];
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const m = b[i + 1];
    if (m === 0xda) break;
    const len = (b[i + 2] << 8) | b[i + 3];
    const head = String.fromCharCode(...b.subarray(i + 4, i + 4 + Math.min(29, len - 2)));
    if (m === 0xe1 && head.startsWith('http://ns.adobe.com/xap')) out.push('XMP');
    else if (m === 0xed) out.push('IPTC / Photoshop');
    else if (m === 0xfe) out.push('Comment');
    i += 2 + len;
  }
  return out;
}

// ---------- PNG chunks ----------

type Chunk = { type: string; start: number; end: number };
function pngChunks(b: Uint8Array): Chunk[] {
  const out: Chunk[] = [];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = String.fromCharCode(...b.subarray(i + 4, i + 8));
    out.push({ type, start: i, end: i + 12 + len });
    i += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}
const PNG_GROUP: Record<string, MetaGroup> = { tEXt: 'text', iTXt: 'text', zTXt: 'text', eXIf: 'camera', tIME: 'date' };

// ---------- read ----------

export function readMeta(bytes: Uint8Array, name: string, mime: string): PhotoMeta {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  if (jpeg) {
    const items: MetaItem[] = [];
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const d = piexif.load(toBinary(bytes)) as unknown as Record<string, Record<number, unknown> | string | null>;
      for (const ifd of ['0th', 'Exif', 'GPS'] as const) {
        const tags = d[ifd] as Record<number, unknown> | undefined;
        for (const [k, v] of Object.entries(tags ?? {})) {
          const tag = Number(k);
          if (ifd !== 'GPS' && STRUCTURE.has(tag)) continue;
          items.push({ group: groupOf(ifd, tag), name: tagName(ifd, tag), value: show(v, tag) });
        }
      }
      const gps = d.GPS as Record<number, unknown> | undefined;
      if (gps) {
        lat = degrees(gps[piexif.GPSIFD.GPSLatitude], gps[piexif.GPSIFD.GPSLatitudeRef]);
        lng = degrees(gps[piexif.GPSIFD.GPSLongitude], gps[piexif.GPSIFD.GPSLongitudeRef]);
      }
      if (d.thumbnail) items.push({ group: 'preview', name: 'Preview picture', value: `${(d.thumbnail as string).length} bytes` });
    } catch {
      // no EXIF or one piexif can't read
    }
    for (const s of otherSegments(bytes)) items.push({ group: 'extra', name: s, value: '' });
    return { kind: 'jpeg', items, lat, lng };
  }
  if (png) {
    const items: MetaItem[] = [];
    for (const c of pngChunks(bytes)) {
      const g = PNG_GROUP[c.type];
      if (!g) continue;
      const body = bytes.subarray(c.start + 8, c.end - 4);
      if (c.type === 'tEXt' || c.type === 'iTXt') {
        const zero = body.indexOf(0);
        const key = dec.decode(body.subarray(0, Math.max(0, zero)));
        const raw = dec.decode(body.subarray(zero + 1)).replace(/^[\0\x01]{0,2}[^\0]*\0[^\0]*\0/, (m) => (c.type === 'iTXt' ? '' : m));
        items.push({ group: g, name: key || c.type, value: raw.slice(0, 160) });
      } else if (c.type === 'tIME') {
        const y = (body[0] << 8) | body[1];
        items.push({ group: g, name: 'Last changed', value: `${y}-${String(body[2]).padStart(2, '0')}-${String(body[3]).padStart(2, '0')} ${String(body[4]).padStart(2, '0')}:${String(body[5]).padStart(2, '0')}` });
      } else items.push({ group: g, name: c.type, value: `${body.length} bytes` });
    }
    return { kind: 'png', items };
  }
  void name;
  void mime;
  return { kind: 'other', items: [] };
}

/** The groups present across photos, in order, with how many photos have each. */
export function groupsFound(metas: PhotoMeta[]): { group: MetaGroup; photos: number }[] {
  return GROUP_ORDER.map((g) => ({ group: g, photos: metas.filter((m) => m.items.some((x) => x.group === g)).length })).filter((x) => x.photos > 0);
}

// ---------- remove ----------

/** The photo without the `remove` groups; null when it can't be done in place (the handler re-encodes it). */
export function removeMeta(bytes: Uint8Array, remove: Set<MetaGroup>): Uint8Array | null {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50;
  if (png) {
    if (GROUP_ORDER.every((g) => remove.has(g))) return stripPng(bytes);
    const parts: Uint8Array[] = [bytes.subarray(0, 8)];
    for (const c of pngChunks(bytes)) {
      const g = PNG_GROUP[c.type];
      if (g && remove.has(g)) continue;
      parts.push(bytes.subarray(c.start, c.end));
    }
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  }
  if (!jpeg) return null;
  const exifGroups: MetaGroup[] = ['location', 'camera', 'date', 'owner', 'software', 'text', 'preview'];
  const keepExif = exifGroups.some((g) => !remove.has(g));
  // XMP / IPTC / comments kept: start from the photo as it is; else from the lossless strip (orientation kept)
  const base = remove.has('extra') ? stripJpeg(bytes) : bytes;
  if (!base) return null;
  if (!keepExif) {
    if (remove.has('extra')) return base;
    // only the EXIF goes: piexif removes the EXIF block and nothing else; put the orientation back
    const orientation = readOrientation(bytes);
    const noExif = fromBinary(piexif.remove(toBinary(bytes)));
    return orientation > 1 ? fromBinary(piexif.insert(piexif.dump({ '0th': { [I.Orientation]: orientation } }), toBinary(noExif))) : noExif;
  }
  // some EXIF stays: a new EXIF with only the kept tags (and the picture's own structure tags)
  let d: Record<string, unknown>;
  try {
    d = piexif.load(toBinary(bytes)) as unknown as Record<string, unknown>;
  } catch {
    return base;
  }
  const filter = (ifd: string) => {
    const tags = (d[ifd] as Record<number, unknown> | undefined) ?? {};
    const kept: Record<number, unknown> = {};
    for (const [k, v] of Object.entries(tags)) {
      const tag = Number(k);
      if ((ifd !== 'GPS' && STRUCTURE.has(tag)) || !remove.has(groupOf(ifd, tag))) kept[tag] = v;
    }
    return kept;
  };
  const next: Record<string, unknown> = { '0th': filter('0th'), Exif: filter('Exif'), GPS: remove.has('location') ? {} : filter('GPS'), Interop: d.Interop ?? {} };
  if (!remove.has('preview') && d.thumbnail) {
    next['1st'] = d['1st'];
    next.thumbnail = d.thumbnail;
  }
  try {
    const exif = piexif.dump(next as never);
    return fromBinary(piexif.insert(exif, toBinary(base)));
  } catch {
    return base;
  }
}

function readOrientation(bytes: Uint8Array): number {
  try {
    const d = piexif.load(toBinary(bytes)) as unknown as { '0th'?: Record<number, unknown> };
    const o = Number(d['0th']?.[I.Orientation] ?? 1);
    return o >= 1 && o <= 8 ? o : 1;
  } catch {
    return 1;
  }
}
