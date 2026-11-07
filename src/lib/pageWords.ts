'use client';
// Every word on each page and where it is (the app's PdfNative.pageWords, done with pdf.js): the page's text runs are
// split into words, each word's box shared out of its run by its length. Boxes are 0-1 of the page as shown, the
// format src/tools/compare.ts takes.
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { PageWords, Word } from '@/tools/compare';

export async function pageWords(doc: PDFDocumentProxy, onPage?: (i: number, total: number) => void): Promise<PageWords[]> {
  const { Util } = await import('pdfjs-dist');
  const out: PageWords[] = [];
  for (let i = 0; i < doc.numPages; i++) {
    onPage?.(i, doc.numPages);
    const page = await doc.getPage(i + 1);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const words: Word[] = [];
    for (const item of content.items as TextItem[]) {
      if (!item.str?.trim()) continue;
      // the run's baseline start and size on the page as shown (y down)
      const m = Util.transform(vp.transform, item.transform);
      const h = Math.hypot(m[2], m[3]) || 10;
      const x0 = m[4];
      const base = m[5];
      const runW = item.width * (vp.width / page.view[2] || 1);
      const len = item.str.length || 1;
      let at = 0;
      for (const part of item.str.split(/(\s+)/)) {
        if (part && !/^\s+$/.test(part)) {
          const x = x0 + (at / len) * runW;
          const w = (part.length / len) * runW;
          words.push([part, x / vp.width, (base - h) / vp.height, Math.max(w, 1) / vp.width, (h * 1.2) / vp.height]);
        }
        at += part.length;
      }
    }
    out.push({ w: vp.width, h: vp.height, words });
    page.cleanup();
  }
  return out;
}
