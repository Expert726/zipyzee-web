'use client';
// Reading text in the browser (the app: ML Kit text recognition on the phone, Urdu and searchable PDFs on the
// server): Tesseract.js (Apache-2.0). Its worker and WebAssembly core are served from /tesseract
// (scripts/copy-pdfjs.mjs); the language data (English, Urdu, Arabic) comes once from the Tesseract data CDN and is
// kept by the browser. The photo never leaves the page.
import type { Word } from '@/tools/compare';

export type OcrLang = 'eng' | 'urd' | 'ara';
export const RTL_LANGS: OcrLang[] = ['urd', 'ara'];

type TWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;
const workers = new Map<string, Promise<TWorker>>();
let report: ((pct: number, what: 'download' | 'read') => void) | null = null;

function worker(langs: OcrLang[]): Promise<TWorker> {
  const key = [...langs].sort().join('+');
  let w = workers.get(key);
  if (!w) {
    w = import('tesseract.js').then(({ createWorker }) =>
      createWorker(langs, 1, {
        workerPath: '/tesseract/worker.min.js',
        corePath: '/tesseract',
        logger: (m: { status: string; progress: number }) => {
          if (/loading|download/i.test(m.status)) report?.(Math.round(m.progress * 100), 'download');
          else if (/recogniz/i.test(m.status)) report?.(Math.round(m.progress * 100), 'read');
        },
      }),
    );
    w.catch(() => workers.delete(key));
    workers.set(key, w);
  }
  return w;
}

type Source = HTMLCanvasElement | ImageBitmap | Blob;
const asCanvas = async (src: Source): Promise<HTMLCanvasElement> => {
  if (src instanceof HTMLCanvasElement) return src;
  const bmp = src instanceof Blob ? await createImageBitmap(src, { imageOrientation: 'from-image' }) : src;
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d')!.drawImage(bmp, 0, 0);
  return c;
};

export type OcrResult = { text: string; words: Word[]; w: number; h: number; confidence: number };

/**
 * The text in a picture, and every word with its box ([text, x, y, w, h] in the picture's pixels, like a PDF page's
 * words in src/tools/compare.ts). onProgress(%, what): the language download the first time, then the reading.
 */
export async function readText(src: Source, langs: OcrLang[], onProgress?: (pct: number, what: 'download' | 'read') => void): Promise<OcrResult> {
  const c = await asCanvas(src);
  report = onProgress ?? null;
  try {
    const w = await worker(langs);
    const { data } = await w.recognize(c, {}, { text: true, blocks: true });
    const words: Word[] = [];
    for (const b of data.blocks ?? [])
      for (const p of b.paragraphs)
        for (const l of p.lines)
          for (const wd of l.words) if (wd.text.trim()) words.push([wd.text, wd.bbox.x0, wd.bbox.y0, wd.bbox.x1 - wd.bbox.x0, wd.bbox.y1 - wd.bbox.y0]);
    return { text: (data.text ?? '').replace(/\n{3,}/g, '\n\n').trim(), words, w: c.width, h: c.height, confidence: data.confidence ?? 0 };
  } finally {
    report = null;
  }
}

/** A one-page PDF holding only the picture's text, invisible and placed over where it is (any script). */
export async function textLayerPdf(src: Source, langs: OcrLang[], onProgress?: (pct: number, what: 'download' | 'read') => void): Promise<Uint8Array> {
  const c = await asCanvas(src);
  report = onProgress ?? null;
  try {
    const w = await worker(langs);
    const { data } = await w.recognize(c, { pdfTitle: 'ZipyZee', pdfTextOnly: true }, { pdf: true });
    return new Uint8Array(data.pdf as unknown as number[]);
  } finally {
    report = null;
  }
}
