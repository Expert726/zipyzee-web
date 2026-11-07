'use client';
// Every image format the web tools can save (the app writes JPG / PNG / WEBP only). All in the browser:
//   JPEG, PNG, WEBP  the browser's canvas (Safari can't write WEBP: a clear message)
//   PNG (small)      up to 256 colours with see-through kept (like TinyPNG): gifenc's quantizer + our PNG writer
//   AVIF             @jsquash/avif (Google's libavif in WebAssembly, Apache-2.0), loaded only when chosen
//   GIF              gifenc (MIT): 256 colours, see-through kept
//   BMP              24-bit, or 32-bit with alpha (BITMAPV4HEADER)
//   TIFF             baseline, uncompressed RGB / RGBA (opens everywhere: print shops, Windows, macOS)
//   ICO              16 to 256 px icons in one file, each a PNG (Windows Vista and later, every browser)
import { t } from '@/i18n';
import { ToolError } from '@/tools/types';
import { deflate } from '@/tools/pdfShrink';
import { fileStem } from './format';

export type OutFormat = 'JPEG' | 'PNG' | 'WEBP' | 'AVIF' | 'GIF' | 'BMP' | 'TIFF' | 'ICO';
export const OUT_EXT: Record<OutFormat, string> = { JPEG: 'jpg', PNG: 'png', WEBP: 'webp', AVIF: 'avif', GIF: 'gif', BMP: 'bmp', TIFF: 'tiff', ICO: 'ico' };
export const OUT_MIME: Record<OutFormat, string> = {
  JPEG: 'image/jpeg', PNG: 'image/png', WEBP: 'image/webp', AVIF: 'image/avif', GIF: 'image/gif', BMP: 'image/bmp', TIFF: 'image/tiff', ICO: 'image/x-icon',
};
/** Formats with a quality setting. */
export const LOSSY: OutFormat[] = ['JPEG', 'WEBP', 'AVIF'];
/** Formats without see-through: drawn on white. */
const OPAQUE: OutFormat[] = ['JPEG'];

/** The format a file is in, from its type or name (unknown: JPEG, like the app). */
export function outFormatOf(f: { name: string; type?: string }): OutFormat {
  const m = (f.type ?? '').toLowerCase();
  const ext = f.name.slice(f.name.lastIndexOf('.') + 1).toLowerCase();
  if (m === 'image/png' || ext === 'png') return 'PNG';
  if (m === 'image/webp' || ext === 'webp') return 'WEBP';
  if (m === 'image/avif' || ext === 'avif') return 'AVIF';
  if (m === 'image/gif' || ext === 'gif') return 'GIF';
  if (m === 'image/bmp' || ext === 'bmp') return 'BMP';
  if (m === 'image/tiff' || ext === 'tif' || ext === 'tiff') return 'TIFF';
  if (m === 'image/x-icon' || m === 'image/vnd.microsoft.icon' || ext === 'ico') return 'ICO';
  return 'JPEG';
}

export const outFileName = (name: string, suffix: string, format: OutFormat) => `${fileStem(name)}${suffix}.${OUT_EXT[format]}`;

/** A canvas with `img` drawn at w x h (white behind it for JPEG). */
export function drawTo(img: CanvasImageSource, w: number, h: number, format: OutFormat, src?: { x: number; y: number; w: number; h: number }): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) throw new ToolError(t('Something went wrong. Try again.'));
  g.imageSmoothingQuality = 'high';
  if (OPAQUE.includes(format)) {
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, c.width, c.height);
  }
  if (src) g.drawImage(img, src.x, src.y, src.w, src.h, 0, 0, c.width, c.height);
  else g.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/**
 * The canvas in `format`. quality 10-100 for JPEG / WEBP / AVIF. `small`: PNG with at most 256 colours (Compress),
 * kept only when it's smaller than the full-colour PNG.
 */
export async function encodeCanvas(c: HTMLCanvasElement, format: OutFormat, quality = 90, small = false): Promise<Blob> {
  switch (format) {
    case 'JPEG':
    case 'WEBP':
      return canvasBlob(c, format, quality);
    case 'PNG': {
      const full = await canvasBlob(c, 'PNG');
      if (!small) return full;
      const few = await png8(c);
      return few.size < full.size ? few : full;
    }
    case 'AVIF':
      return avif(c, quality);
    case 'GIF':
      return gif(c);
    case 'BMP':
      return bmp(c);
    case 'TIFF':
      return tiff(c);
    case 'ICO':
      return ico(c);
  }
}

async function canvasBlob(c: HTMLCanvasElement, format: 'JPEG' | 'PNG' | 'WEBP', quality = 90): Promise<Blob> {
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, OUT_MIME[format], quality / 100));
  if (!blob) throw new ToolError(t('Something went wrong. Try again.'));
  // Safari quietly gives a PNG when asked for WEBP
  if (blob.type !== OUT_MIME[format]) throw new ToolError(t('This browser can\'t save {format}. Try Chrome, Edge or Firefox, or pick another format.', { format: OUT_EXT[format].toUpperCase() }));
  return blob;
}

const pixels = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height);
const opaque = (d: Uint8ClampedArray) => {
  for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return false;
  return true;
};

// ---------- AVIF ----------

async function avif(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  try {
    const { default: encode } = await import('@jsquash/avif/encode');
    const buf = await encode(pixels(c), { quality: Math.max(1, Math.min(100, quality)) });
    return new Blob([buf], { type: OUT_MIME.AVIF });
  } catch (e) {
    console.error(e);
    throw new ToolError(t('This browser can\'t save {format}. Try Chrome, Edge or Firefox, or pick another format.', { format: 'AVIF' }));
  }
}

// ---------- 256 colours (GIF, small PNG) ----------

async function palette(c: HTMLCanvasElement) {
  const { quantize, applyPalette } = await import('gifenc');
  const { data, width, height } = pixels(c);
  const pal = quantize(data, 256, { format: 'rgba4444', oneBitAlpha: false, clearAlpha: true, clearAlphaThreshold: 8 });
  const index = applyPalette(data, pal, 'rgba4444');
  return { pal, index, width, height };
}

async function gif(c: HTMLCanvasElement): Promise<Blob> {
  const { GIFEncoder } = await import('gifenc');
  const { pal, index, width, height } = await palette(c);
  // GIF has one fully see-through colour: the most transparent one
  let clear = -1;
  pal.forEach((p, i) => {
    if ((p[3] ?? 255) < 128 && (clear < 0 || (p[3] ?? 255) < (pal[clear][3] ?? 255))) clear = i;
  });
  const enc = GIFEncoder();
  enc.writeFrame(index, width, height, { palette: pal.map((p) => [p[0], p[1], p[2]]), transparent: clear >= 0, transparentIndex: Math.max(0, clear) });
  enc.finish();
  return new Blob([enc.bytes() as BlobPart], { type: OUT_MIME.GIF });
}

// PNG chunks
const CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** An 8-bit palette PNG (colour type 3) with a tRNS chunk when any colour is see-through. */
async function png8(c: HTMLCanvasElement): Promise<Blob> {
  const { pal, index, width, height } = await palette(c);
  const ihdr = new Uint8Array(13);
  const hv = new DataView(ihdr.buffer);
  hv.setUint32(0, width);
  hv.setUint32(4, height);
  ihdr.set([8, 3, 0, 0, 0], 8);
  const plte = new Uint8Array(pal.length * 3);
  pal.forEach((p, i) => plte.set([p[0], p[1], p[2]], i * 3));
  const alphas = pal.map((p) => p[3] ?? 255);
  const trns = alphas.some((a) => a < 255) ? new Uint8Array(alphas) : null;
  // each row: filter 0 (none), then its palette indexes
  const raw = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y++) raw.set(index.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  const idat = await deflate(raw);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('PLTE', plte), ...(trns ? [chunk('tRNS', trns)] : []), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  return new Blob(parts as BlobPart[], { type: OUT_MIME.PNG });
}

// ---------- BMP ----------

function bmp(c: HTMLCanvasElement): Blob {
  const { data, width: w, height: h } = pixels(c);
  const alpha = !opaque(data);
  const bpp = alpha ? 4 : 3;
  const row = alpha ? w * 4 : Math.ceil((w * 3) / 4) * 4;
  const header = alpha ? 108 : 40;
  const offset = 14 + header;
  const size = offset + row * h;
  const buf = new Uint8Array(size);
  const v = new DataView(buf.buffer);
  buf[0] = 0x42;
  buf[1] = 0x4d; // "BM"
  v.setUint32(2, size, true);
  v.setUint32(10, offset, true);
  v.setUint32(14, header, true);
  v.setInt32(18, w, true);
  v.setInt32(22, h, true); // bottom-up
  v.setUint16(26, 1, true);
  v.setUint16(28, bpp * 8, true);
  v.setUint32(30, alpha ? 3 : 0, true); // BI_BITFIELDS / BI_RGB
  v.setUint32(34, row * h, true);
  v.setInt32(38, 2835, true); // 72 dpi
  v.setInt32(42, 2835, true);
  if (alpha) {
    v.setUint32(54, 0x00ff0000, true);
    v.setUint32(58, 0x0000ff00, true);
    v.setUint32(62, 0x000000ff, true);
    v.setUint32(66, 0xff000000, true);
    v.setUint32(70, 0x73524742, true); // "sRGB"
  }
  for (let y = 0; y < h; y++) {
    const at = offset + (h - 1 - y) * row;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const o = at + x * bpp;
      buf[o] = data[i + 2];
      buf[o + 1] = data[i + 1];
      buf[o + 2] = data[i];
      if (alpha) buf[o + 3] = data[i + 3];
    }
  }
  return new Blob([buf], { type: OUT_MIME.BMP });
}

// ---------- TIFF ----------

function tiff(c: HTMLCanvasElement): Blob {
  const { data, width: w, height: h } = pixels(c);
  const alpha = !opaque(data);
  const spp = alpha ? 4 : 3;
  const tags: [number, number, number, number | number[]][] = []; // tag, type (3 SHORT, 4 LONG, 5 RATIONAL), count, value
  const image = w * h * spp;
  // layout: header 8 | IFD | extra values | pixels
  const count = alpha ? 14 : 13;
  const ifdSize = 2 + count * 12 + 4;
  let extra = 8 + ifdSize;
  const bitsAt = extra;
  extra += spp * 2;
  const xresAt = extra;
  extra += 8;
  const yresAt = extra;
  extra += 8;
  const pixelsAt = extra;
  tags.push([256, 4, 1, w], [257, 4, 1, h], [258, 3, spp, bitsAt], [259, 3, 1, 1], [262, 3, 1, 2], [273, 4, 1, pixelsAt], [277, 3, 1, spp], [278, 4, 1, h], [279, 4, 1, image], [282, 5, 1, xresAt], [283, 5, 1, yresAt], [284, 3, 1, 1], [296, 3, 1, 2]);
  if (alpha) tags.push([338, 3, 1, 2]); // unassociated alpha
  const buf = new Uint8Array(pixelsAt + image);
  const v = new DataView(buf.buffer);
  buf.set([0x49, 0x49, 42, 0]); // "II*\0"
  v.setUint32(4, 8, true);
  v.setUint16(8, tags.length, true);
  tags.forEach(([tag, type, n, val], i) => {
    const o = 10 + i * 12;
    v.setUint16(o, tag, true);
    v.setUint16(o + 2, type, true);
    v.setUint32(o + 4, n, true);
    // SHORT values that fit sit in the entry itself; the rest are offsets
    if (type === 3 && n === 1) v.setUint16(o + 8, val as number, true);
    else v.setUint32(o + 8, val as number, true);
  });
  v.setUint32(10 + tags.length * 12, 0, true);
  for (let i = 0; i < spp; i++) v.setUint16(bitsAt + i * 2, 8, true);
  v.setUint32(xresAt, 72, true);
  v.setUint32(xresAt + 4, 1, true);
  v.setUint32(yresAt, 72, true);
  v.setUint32(yresAt + 4, 1, true);
  let o = pixelsAt;
  for (let i = 0; i < data.length; i += 4) {
    buf[o++] = data[i];
    buf[o++] = data[i + 1];
    buf[o++] = data[i + 2];
    if (alpha) buf[o++] = data[i + 3];
  }
  return new Blob([buf], { type: OUT_MIME.TIFF });
}

// ---------- ICO ----------

const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** The picture fitted (not cut) into square icons, each size the picture is big enough for (16 px at least). */
async function ico(c: HTMLCanvasElement): Promise<Blob> {
  const longest = Math.max(c.width, c.height);
  const sizes = ICON_SIZES.filter((s, i) => i === 0 || s <= Math.max(longest, 16));
  const pngs: Uint8Array[] = [];
  for (const s of sizes) {
    const sq = document.createElement('canvas');
    sq.width = sq.height = s;
    const g = sq.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    const k = s / longest;
    g.drawImage(c, (s - c.width * k) / 2, (s - c.height * k) / 2, c.width * k, c.height * k);
    pngs.push(new Uint8Array(await (await canvasBlob(sq, 'PNG')).arrayBuffer()));
  }
  const head = new Uint8Array(6 + 16 * sizes.length);
  const v = new DataView(head.buffer);
  v.setUint16(2, 1, true); // icon
  v.setUint16(4, sizes.length, true);
  let at = head.length;
  sizes.forEach((s, i) => {
    const o = 6 + i * 16;
    head[o] = s >= 256 ? 0 : s;
    head[o + 1] = s >= 256 ? 0 : s;
    v.setUint16(o + 4, 1, true); // planes
    v.setUint16(o + 6, 32, true); // bits
    v.setUint32(o + 8, pngs[i].length, true);
    v.setUint32(o + 12, at, true);
    at += pngs[i].length;
  });
  return new Blob([head, ...pngs] as BlobPart[], { type: OUT_MIME.ICO });
}
