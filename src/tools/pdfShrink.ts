// Compress PDF in the browser (the app does this natively with PdfBox, src/tools/handlers/compressPdf.ts there).
// Two passes over pdf-lib's objects:
//  - lossless: extras dropped (XMP metadata, page thumbnails, editors' private data), identical streams kept once,
//    unpacked streams packed (Flate), objects nothing points to removed; saved with object streams.
//  - images: photos re-encoded as JPEG at the slider's quality and size (JPEG photos, and plain 8-bit RGB / grey
//    images, PNG predictors included). Anything unusual (CMYK, indexed colours, masks drawn as stencils, 16-bit) is left
//    as it is, and a photo is only replaced when the new one is clearly smaller.
// The image part needs a browser (createImageBitmap, canvas); the lossless part runs anywhere with CompressionStream.
import { PDFArray, PDFDict, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFStream, type PDFDocument, type PDFObject } from 'pdf-lib';

const N = (s: string) => PDFName.of(s);

// ---------- streams ----------

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}
/** zlib data, as PDF's FlateDecode wants it. */
export const deflate = (b: Uint8Array) => pipe(b, new CompressionStream('deflate'));
export const inflate = (b: Uint8Array) => pipe(b, new DecompressionStream('deflate'));

/** A stream's filters as names (one or a list). */
function filtersOf(dict: PDFDict): string[] {
  const f = dict.get(N('Filter'));
  if (f instanceof PDFName) return [f.decodeText()];
  if (f instanceof PDFArray) return f.asArray().map((x) => (x instanceof PDFName ? x.decodeText() : '?'));
  return [];
}

// ---------- walking the object graph ----------

/** Every child object of a dict / array / stream. */
function children(obj: PDFObject | undefined): PDFObject[] {
  if (obj instanceof PDFDict) return obj.entries().map(([, v]) => v);
  if (obj instanceof PDFArray) return obj.asArray();
  if (obj instanceof PDFStream) return children(obj.dict);
  return [];
}

/** Points every reference in `from` to its replacement (in place). */
function remapRefs(obj: PDFObject | undefined, map: Map<string, PDFRef>) {
  if (obj instanceof PDFStream) return remapRefs(obj.dict, map);
  if (obj instanceof PDFDict) {
    for (const [k, v] of obj.entries()) {
      const to = v instanceof PDFRef ? map.get(v.toString()) : undefined;
      if (to) obj.set(k, to);
      else remapRefs(v, map);
    }
  } else if (obj instanceof PDFArray) {
    obj.asArray().forEach((v, i) => {
      const to = v instanceof PDFRef ? map.get(v.toString()) : undefined;
      if (to) obj.set(i, to);
      else remapRefs(v, map);
    });
  }
}

/** References reachable from the trailer (document catalog, info, encryption). */
function reachable(doc: PDFDocument): Set<string> {
  const { context } = doc;
  const seen = new Set<string>();
  const t = context.trailerInfo;
  const stack: (PDFObject | undefined)[] = [t.Root, t.Info, t.Encrypt];
  while (stack.length) {
    const o = stack.pop();
    if (!o) continue;
    if (o instanceof PDFRef) {
      const key = o.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      stack.push(context.lookup(o));
    } else {
      stack.push(...children(o));
    }
  }
  return seen;
}

const hash = (b: Uint8Array) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 0x01000193);
  return `${b.length}:${h >>> 0}`;
};
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

// ---------- lossless ----------

export type LosslessReport = { dropped: number; deduped: number; packed: number };

export async function losslessPass(doc: PDFDocument): Promise<LosslessReport> {
  const { context } = doc;
  // extras nobody needs to read the document
  doc.catalog.delete(N('Metadata'));
  doc.catalog.delete(N('PieceInfo'));
  for (const p of doc.getPages()) {
    p.node.delete(N('Thumb'));
    p.node.delete(N('PieceInfo'));
  }

  // identical streams (same dictionary and bytes: fonts and images repeated per page) kept once
  const firstOf = new Map<string, { ref: PDFRef; bytes: Uint8Array }[]>();
  const map = new Map<string, PDFRef>();
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const key = `${obj.dict.toString()}|${hash(obj.contents)}`;
    const list = firstOf.get(key) ?? [];
    const twin = list.find((x) => same(x.bytes, obj.contents));
    if (twin) map.set(ref.toString(), twin.ref);
    else firstOf.set(key, [...list, { ref, bytes: obj.contents }]);
  }
  if (map.size) {
    for (const [, obj] of context.enumerateIndirectObjects()) remapRefs(obj, map);
    remapRefs(doc.catalog, map);
  }

  // unpacked streams packed
  let packed = 0;
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || obj.dict.has(N('Filter')) || obj.contents.length < 64) continue;
    const z = await deflate(obj.contents);
    if (z.length >= obj.contents.length * 0.9) continue;
    const dict = obj.dict.clone(context);
    dict.set(N('Filter'), N('FlateDecode'));
    dict.delete(N('DecodeParms'));
    context.assign(ref, PDFRawStream.of(dict, z));
    packed++;
  }

  // objects nothing points to any more
  const keep = reachable(doc);
  let dropped = 0;
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!keep.has(ref.toString())) {
      context.delete(ref);
      dropped++;
    }
  }
  return { dropped, deduped: map.size, packed };
}

// ---------- images ----------

const num = (o: PDFObject | undefined) => (o instanceof PDFNumber ? o.asNumber() : undefined);

/** Colour channels for the image's colour space: 1 (grey) or 3 (RGB), else null (leave it alone). */
export function channels(doc: PDFDocument, cs: PDFObject | undefined): 1 | 3 | null {
  const v = cs instanceof PDFRef ? doc.context.lookup(cs) : cs;
  if (v instanceof PDFName) return v.decodeText() === 'DeviceRGB' ? 3 : v.decodeText() === 'DeviceGray' ? 1 : null;
  if (v instanceof PDFArray && v.size() === 2) {
    const kind = v.get(0);
    if (kind instanceof PDFName && kind.decodeText() === 'ICCBased') {
      const icc = doc.context.lookup(v.get(1));
      const n = icc instanceof PDFRawStream ? num(icc.dict.get(N('N'))) : undefined;
      return n === 3 ? 3 : n === 1 ? 1 : null;
    }
  }
  return null;
}

/** Undoes PNG row predictors (DecodeParms /Predictor 10-15) on 8-bit samples. */
export function unpredict(data: Uint8Array, columns: number, colors: number): Uint8Array {
  const stride = columns * colors;
  const rows = Math.floor(data.length / (stride + 1));
  const out = new Uint8Array(rows * stride);
  for (let r = 0; r < rows; r++) {
    const type = data[r * (stride + 1)];
    const src = r * (stride + 1) + 1;
    const dst = r * stride;
    for (let i = 0; i < stride; i++) {
      const raw = data[src + i];
      const left = i >= colors ? out[dst + i - colors] : 0;
      const up = r ? out[dst - stride + i] : 0;
      const ul = r && i >= colors ? out[dst - stride + i - colors] : 0;
      let v: number;
      switch (type) {
        case 1:
          v = raw + left;
          break;
        case 2:
          v = raw + up;
          break;
        case 3:
          v = raw + ((left + up) >> 1);
          break;
        case 4: {
          const p = left + up - ul;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - ul);
          v = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : ul);
          break;
        }
        default:
          v = raw;
      }
      out[dst + i] = v & 0xff;
    }
  }
  return out;
}

export async function decodeImage(doc: PDFDocument, s: PDFRawStream, w: number, h: number, colors: 1 | 3): Promise<ImageBitmap | null> {
  const filters = filtersOf(s.dict);
  if (filters.length === 1 && filters[0] === 'DCTDecode') {
    return createImageBitmap(new Blob([s.contents as BlobPart], { type: 'image/jpeg' }));
  }
  if (filters.length !== 1 || filters[0] !== 'FlateDecode') return null;
  let px = await inflate(s.contents);
  const parms = s.dict.lookup(N('DecodeParms'));
  const predictor = parms instanceof PDFDict ? num(parms.get(N('Predictor'))) ?? 1 : 1;
  if (predictor >= 10) px = unpredict(px, num((parms as PDFDict).get(N('Columns'))) ?? w, colors);
  else if (predictor !== 1) return null; // TIFF predictor: rare, leave it
  if (px.length < w * h * colors) return null;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += colors) {
    rgba[i * 4] = px[j];
    rgba[i * 4 + 1] = colors === 3 ? px[j + 1] : px[j];
    rgba[i * 4 + 2] = colors === 3 ? px[j + 2] : px[j];
    rgba[i * 4 + 3] = 255;
  }
  return createImageBitmap(new ImageData(rgba, w, h));
}

export type ImageReport = { found: number; shrunk: number };

/**
 * Re-encodes the document's photos: at most `maxSide` px on the long side, JPEG at `quality` (10-95). Calls
 * onImage(done, total) as it goes and stops between images when `cancelled()` says so.
 */
export async function shrinkImages(
  doc: PDFDocument,
  maxSide: number,
  quality: number,
  onImage: (done: number, total: number) => Promise<void> | void,
): Promise<ImageReport> {
  const { context } = doc;
  const images = context
    .enumerateIndirectObjects()
    .filter((e): e is [PDFRef, PDFRawStream] => e[1] instanceof PDFRawStream && e[1].dict.get(N('Subtype')) === N('Image'));
  let shrunk = 0;
  for (let i = 0; i < images.length; i++) {
    await onImage(i, images.length);
    const [ref, s] = images[i];
    const d = s.dict;
    const w = num(d.get(N('Width'))) ?? 0;
    const h = num(d.get(N('Height'))) ?? 0;
    if (w < 16 || h < 16 || s.contents.length < 8 * 1024) continue; // icons and tiny pictures: no gain
    if (d.get(N('ImageMask')) || d.has(N('Decode')) || d.get(N('Mask')) instanceof PDFArray) continue;
    if ((num(d.get(N('BitsPerComponent'))) ?? 8) !== 8) continue;
    const colors = channels(doc, d.get(N('ColorSpace')));
    if (!colors) continue;
    try {
      const bmp = await decodeImage(doc, s, w, h, colors);
      if (!bmp) continue;
      const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(bmp.width * k));
      c.height = Math.max(1, Math.round(bmp.height * k));
      const g = c.getContext('2d')!;
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close();
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', quality / 100));
      if (!blob || blob.size >= s.contents.length * 0.95) continue;
      const dict = context.obj({
        Type: 'XObject',
        Subtype: 'Image',
        Width: c.width,
        Height: c.height,
        ColorSpace: 'DeviceRGB',
        BitsPerComponent: 8,
        Filter: 'DCTDecode',
      });
      for (const key of ['SMask', 'Intent', 'Interpolate', 'Mask', 'OC', 'Alternates']) {
        const v = d.get(N(key));
        if (v) dict.set(N(key), v);
      }
      context.assign(ref, PDFRawStream.of(dict, new Uint8Array(await blob.arrayBuffer())));
      shrunk++;
    } catch {
      // a photo the browser can't read stays as it was
    }
  }
  return { found: images.length, shrunk };
}
