'use client';
// Page thumbnails of a PDF (the app's usePdfPages): pdf.js draws each page small, one after another, so the first ones
// show at once. Object URLs, freed when the file changes or the component goes.
import { useEffect, useState } from 'react';
import { ToolError } from '@/tools/types';
import { canvasBlob, openPdf, renderPage } from './pdfjs';

export type Thumbs = { count: number | null; urls: (string | undefined)[]; error: string | null };

/** Long side of a thumbnail, in px (sharp at 2x on a ~150 px tile). */
const THUMB_DPI = 40;

/** `dpi`: 40 for small thumbnails; the Annotate editor draws pages bigger. `maxPages`: draw only the first ones. */
export function usePdfThumbs(file: File | undefined, dpi = THUMB_DPI, maxPages = Infinity): Thumbs {
  const [state, setState] = useState<Thumbs>({ count: null, urls: [], error: null });
  useEffect(() => {
    if (!file) return;
    let live = true;
    const made: string[] = [];
    (async () => {
      try {
        const doc = await openPdf(file);
        if (!live) return void doc.destroy();
        setState({ count: doc.numPages, urls: new Array(doc.numPages).fill(undefined), error: null });
        for (let i = 0; i < Math.min(doc.numPages, maxPages) && live; i++) {
          const c = await renderPage(doc, i, dpi);
          const url = URL.createObjectURL(await canvasBlob(c, 'image/jpeg', 0.8));
          c.width = c.height = 0;
          made.push(url);
          if (!live) break;
          setState((s) => ({ ...s, urls: s.urls.map((u, j) => (j === i ? url : u)) }));
        }
        void doc.destroy();
      } catch (e) {
        if (live) setState({ count: null, urls: [], error: e instanceof ToolError ? e.message : String(e) });
      }
    })();
    return () => {
      live = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [file, dpi, maxPages]);
  return state;
}
