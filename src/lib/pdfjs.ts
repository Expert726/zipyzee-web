'use client';
// PDF pages as pictures in the browser (pdf.js, loaded only when a tool needs it). The worker, character maps and
// standard fonts are served from /pdfjs (scripts/copy-pdfjs.mjs). Scripts inside PDFs never run (isEvalSupported off).
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { t } from '@/i18n';
import { ToolError } from '@/tools/types';

/** Opens a PDF file (or bytes: a document made in the page, like a preview of the result). */
export async function openPdf(file: File | { name: string; bytes: Uint8Array }): Promise<PDFDocumentProxy> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
  try {
    return await pdfjs.getDocument({
      data: file instanceof File ? new Uint8Array(await file.arrayBuffer()) : file.bytes.slice(),
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/pdfjs/standard_fonts/',
      // (isEvalSupported is gone in pdfjs-dist 5.7: pdf.js no longer evaluates code at all)
    }).promise;
  } catch (e) {
    if ((e as { name?: string })?.name === 'PasswordException') throw new ToolError(t('{name} is password protected. Unlock it first.', { name: file.name }));
    throw new ToolError(t('{name} could not be opened. It may be damaged.', { name: file.name }));
  }
}

/** Browsers refuse canvases much bigger than this (Safari: about 16.7 million pixels). */
const MAX_PIXELS = 16_000_000;

/** Page `index` (0-based) drawn at `dpi` on white; scaled down when it would be too big for the browser. */
export async function renderPage(doc: PDFDocumentProxy, index: number, dpi: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(index + 1);
  let scale = dpi / 72;
  const base = page.getViewport({ scale: 1 });
  const pixels = base.width * base.height * scale * scale;
  if (pixels > MAX_PIXELS) scale *= Math.sqrt(MAX_PIXELS / pixels);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

export const canvasBlob = (c: HTMLCanvasElement, type: 'image/jpeg' | 'image/png', quality = 0.9) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), type, quality));
