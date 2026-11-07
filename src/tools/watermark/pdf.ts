// Remove watermark (PDF), the pdf-lib side: each page's drawing instructions decoded, the names they use answered
// from the page's resources (see Resolvers in ./content.ts), and the chosen watermark parts cut out and the page
// written back as one compressed stream. Watermark annotations (/Subtype /Watermark) are taken off the page too.
// What's drawn into a scanned page's picture can't be found here: it isn't a separate part of the page.
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFFlateStream,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
  type PDFDocument,
  type PDFObject,
  type PDFPage,
} from 'pdf-lib';
import { cutRanges, findWatermarks, parseOps, type Op, type Range, type Resolvers, type WmKind } from './content';

export type FoundKind = WmKind | 'notes';
export const FOUND_KINDS: FoundKind[] = ['layer', 'overlay', 'stamp', 'notes'];

/** An image on at least this share of the pages (and on 2 or more) counts as a stamp. */
const STAMP_SHARE = 0.8;

type PageScan = {
  content: string | null;
  ranges: Record<WmKind, Range[]>;
  /** indexes in /Annots of watermark annotations */
  notes: number[];
};

export type WatermarkScan = {
  pages: PageScan[];
  /** pages each kind is on ('notes': how many annotations) */
  found: Record<FoundKind, number>;
};

const safe = <T>(f: () => T): T | undefined => {
  try {
    return f();
  } catch {
    return undefined;
  }
};

const latin1 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return s;
};

const toBytes = (s: string) => {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) % 256;
  return out;
};

function streamText(obj: PDFObject | undefined): string | null {
  if (obj instanceof PDFRawStream) return latin1(decodePDFRawStream(obj).decode());
  if (obj instanceof PDFFlateStream) return latin1(obj.getUnencodedContents());
  return null;
}

/** The page's content streams decoded and joined, or null when a stream can't be read. */
function pageContent(page: PDFPage): string | null {
  const doc = page.doc;
  const contents = safe(() => page.node.Contents());
  if (!contents) return '';
  const parts: string[] = [];
  const list = contents instanceof PDFArray ? contents.asArray() : [contents];
  for (const item of list) {
    const text = safe(() => streamText(doc.context.lookup(item)));
    if (text == null) return null;
    parts.push(text);
  }
  return parts.join('\n');
}

/** Answers for names used on this page, from its /Resources. */
function resolvers(page: PDFPage, stamps: Set<string>): Resolvers & { imageKey: (name: string) => string } {
  const doc = page.doc;
  const res = safe(() => page.node.Resources());
  const entry = (group: string, name: string) => safe(() => res?.lookupMaybe(PDFName.of(group), PDFDict)?.get(PDFName.of(name)));
  const imageKey = (name: string) => {
    const ref = entry('XObject', name);
    const obj = safe(() => doc.context.lookup(ref));
    if (!(obj instanceof PDFStream) || obj.dict.get(PDFName.of('Subtype')) !== PDFName.of('Image')) return '';
    return ref instanceof PDFRef ? ref.toString() : `inline:${name}`;
  };
  return {
    imageKey,
    isImage: (name) => !!imageKey(name),
    isStamp: (name) => stamps.has(imageKey(name)),
    isSeeThrough: (name) => {
      const gs = safe(() => doc.context.lookupMaybe(entry('ExtGState', name), PDFDict));
      const alpha = (k: string) => safe(() => gs?.lookupMaybe(PDFName.of(k), PDFNumber)?.asNumber());
      return [alpha('ca'), alpha('CA')].some((a) => a != null && a < 1);
    },
    isWatermarkGroup: (name) => {
      const ocg = safe(() => doc.context.lookupMaybe(entry('Properties', name), PDFDict));
      const label = safe(() => ocg?.lookup(PDFName.of('Name')));
      const text = label instanceof PDFString || label instanceof PDFHexString ? label.decodeText() : '';
      return /watermark/i.test(text);
    },
  };
}

function watermarkNotes(page: PDFPage): number[] {
  const annots = safe(() => page.node.Annots());
  if (!annots) return [];
  const out: number[] = [];
  annots.asArray().forEach((ref, i) => {
    const dict = safe(() => page.doc.context.lookupMaybe(ref, PDFDict));
    if (dict?.get(PDFName.of('Subtype')) === PDFName.of('Watermark')) out.push(i);
  });
  return out;
}

/** Every page looked at: what's a watermark and where. */
export function scanWatermarks(doc: PDFDocument): WatermarkScan {
  const pages = doc.getPages();
  const contents = pages.map(pageContent);
  const opsOf = contents.map((c) => (c ? safe(() => parseOps(c)) ?? [] : ([] as Op[])));

  // images drawn on most pages: a stamp (a logo on every page)
  const seen = new Map<string, number>();
  pages.forEach((page, i) => {
    const r = resolvers(page, new Set());
    const keys = new Set(opsOf[i].filter((o) => o.op === 'Do' && o.args[0]?.type === 'name').map((o) => r.imageKey((o.args[0] as { value: string }).value)));
    for (const k of keys) if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
  });
  const need = Math.max(2, Math.ceil(pages.length * STAMP_SHARE));
  const stamps = new Set([...seen].filter(([, n]) => n >= need).map(([k]) => k));

  const found: Record<FoundKind, number> = { layer: 0, overlay: 0, stamp: 0, notes: 0 };
  const scans = pages.map((page, i): PageScan => {
    const ranges = findWatermarks(opsOf[i], resolvers(page, stamps));
    const notes = watermarkNotes(page);
    for (const k of ['layer', 'overlay', 'stamp'] as WmKind[]) if (ranges[k].length) found[k]++;
    found.notes += notes.length;
    return { content: contents[i], ranges, notes };
  });
  return { pages: scans, found };
}

/** Takes the chosen kinds off one page; true when something changed. */
export function cleanPage(page: PDFPage, scan: PageScan, kinds: FoundKind[]): boolean {
  let changed = false;
  const cut = (['layer', 'overlay', 'stamp'] as WmKind[]).filter((k) => kinds.includes(k)).flatMap((k) => scan.ranges[k]);
  if (cut.length && scan.content != null) {
    const ctx = page.doc.context;
    const stream = ctx.flateStream(toBytes(cutRanges(scan.content, cut)));
    page.node.set(PDFName.of('Contents'), ctx.register(stream));
    changed = true;
  }
  if (kinds.includes('notes') && scan.notes.length) {
    const annots = page.node.Annots();
    if (annots) {
      const keep = annots.asArray().filter((_, i) => !scan.notes.includes(i));
      page.node.set(PDFName.of('Annots'), page.doc.context.obj(keep));
      changed = true;
    }
  }
  return changed;
}

/** Ticked at first: everything found, except a repeated image when something else was found (it may be a letterhead). */
export function defaultKinds(found: Record<FoundKind, number>): FoundKind[] {
  const on = FOUND_KINDS.filter((k) => found[k] > 0);
  return on.length > 1 ? on.filter((k) => k !== 'stamp') : on;
}

/** Every page cleaned of the chosen kinds; how many pages changed. */
export function cleanAll(doc: PDFDocument, scan: WatermarkScan, kinds: FoundKind[]): number {
  return doc.getPages().filter((page, i) => cleanPage(page, scan.pages[i], kinds)).length;
}
