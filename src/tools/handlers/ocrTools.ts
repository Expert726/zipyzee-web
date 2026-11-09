import { degrees } from 'pdf-lib';
import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { readText, textLayerPdf, type OcrLang } from '@/lib/ocr';
import { loadPdf, savePdf, stepper } from '@/lib/pdf';
import { openPdf, renderPage } from '@/lib/pdfjs';
import { toVCard, type CardFields } from '../card';
import { makeBook, xlsxBlob } from '../sheets/book';
import { findTables, tablesToSheets, type PageTables } from '../sheets/table';
import { ToolError, type ToolHandler } from '../types';

// The text-reading tools on the web (src/lib/ocr.ts, Tesseract in the browser; the app reads on the phone or the
// server). Image to text / Urdu OCR and Business card read in their editors; these save the result.

/** Image to text and Urdu OCR: the text the editor read (and the person may have fixed) as a .txt. */
export const ocrText: ToolHandler = async ({ files, options, onProgress }) => {
  const text = String(options.text ?? '').trim();
  if (!text) throw new ToolError(t('No text found in the photo. Take it straight on, in good light.'));
  onProgress(1, 1, t('Saving'));
  // a BOM so Notepad and phones open Urdu as UTF-8
  return { title: t('Text saved'), files: [{ name: `${fileStem(files[0]?.name ?? 'text')}.txt`, blob: new Blob(['﻿', text], { type: 'text/plain;charset=utf-8' }) }] };
};

/** Business card to contact: the checked fields as a .vcf that phones and Outlook import. */
export const businessCard: ToolHandler = async ({ options, onProgress }) => {
  const card = options.card as CardFields | undefined;
  if (!card || !(card.name.trim() || card.company.trim() || card.phones.some(Boolean) || card.emails.some(Boolean))) throw new ToolError(t('Add a name, phone or email first.'));
  onProgress(1, 1, t('Saving'));
  const name = (card.name.trim() || card.company.trim() || 'contact').replace(/[\\/:*?"<>|]/g, '').slice(0, 60);
  return { title: t('Contact ready'), subtitle: t('Open the file to add it to your contacts.'), files: [{ name: `${name}.vcf`, blob: new Blob([toVCard(card)], { type: 'text/vcard' }) }] };
};

const tableNames = () => ({ table: (n: number) => t('Table {n}', { n }), all: t('Tables'), text: t('Text') });

/** Image to Excel (the app's handlers/imageToExcel.ts): each photo read with every word's box, tables found, xlsx. */
export const imageToExcel: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const langs = ((options.languages as OcrLang[]) ?? ['eng']).filter(Boolean);
  const found: PageTables[] = [];
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length + 1, files.length > 1 ? t('Photo {n} of {total}', { n: i + 1, total: files.length }) : t('Reading tables'));
    let r;
    try {
      r = await readText(files[i], langs.length ? langs : ['eng'], (pct, what) => what === 'download' && ctx.onProgress(i, files.length + 1, `${t('Getting the text reader ready (one time only)…')} ${pct}%`));
    } catch {
      throw new ToolError(t('{name} couldn\'t be read. Try another photo.', { name: files[i].name }));
    }
    found.push(findTables(r.words));
  }
  const { count, sheets } = tablesToSheets(found, options.sheets === 'one' ? 'one' : 'each', tableNames());
  if (!sheets[0].rows.length) throw new ToolError(t('No text found in the photo. Take it straight on, in good light.'));
  await step(files.length, files.length + 1, t('Saving'));
  return {
    title: t('Converted to Excel'),
    subtitle: count ? t('Found {n} {value}', { n: count, value: count === 1 ? t('table') : t('tables') }) : t('No tables found, so every line is a row'),
    files: [{ name: `${fileStem(files[0].name)}.xlsx`, blob: xlsxBlob(makeBook(sheets)) }],
  };
};

/**
 * Searchable PDF (a server tool in the app): every page drawn at 300 dpi and read; Tesseract makes a page holding only
 * the invisible text, which goes over the original page, so the look stays exactly the same and the text can be
 * searched, selected and copied. Any script (English, Urdu, Arabic).
 */
export const searchablePdf: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const langs = ((options.languages as OcrLang[]) ?? ['eng']).filter(Boolean);
  const f = files[0];
  const doc = await loadPdf(f);
  const view = await openPdf(f);
  const n = view.numPages;
  try {
    for (let i = 0; i < n; i++) {
      await step(i, n + 1, t('Reading page {n} of {total}', { n: i + 1, total: n }));
      const c = await renderPage(view, i, 300);
      const layer = await textLayerPdf(c, langs.length ? langs : ['eng'], (pct, what) => what === 'download' && ctx.onProgress(i, n + 1, `${t('Getting the text reader ready (one time only)…')} ${pct}%`));
      c.width = c.height = 0;
      const [embedded] = await doc.embedPdf(layer, [0]);
      const page = doc.getPage(i);
      const { width, height } = page.getSize();
      // the text page is the picture's size; stretched over the page as it is shown
      const rot = page.getRotation().angle % 360;
      const turned = rot === 90 || rot === 270;
      page.drawPage(embedded, { x: 0, y: 0, width: turned ? height : width, height: turned ? width : height, ...(rot ? rotatedPlacement(rot, width, height) : {}) });
    }
  } finally {
    void view.destroy();
  }
  await step(n, n + 1, t('Saving your PDF'));
  return { title: t('You can now search and copy text'), files: [await savePdf(doc, `${fileStem(f.name)}-searchable.pdf`)] };
};

/** For a page turned by its /Rotate, the text page goes in turned the same way. */
function rotatedPlacement(rot: number, w: number, h: number) {
  if (rot === 90) return { x: w, y: 0, rotate: degrees(90) };
  if (rot === 180) return { x: w, y: h, rotate: degrees(180) };
  return { x: 0, y: h, rotate: degrees(270) };
}

