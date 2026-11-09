import * as XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';
import { plural, t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { readText } from '@/lib/ocr';
import { pageWords } from '@/lib/pageWords';
import { savePdf, stepper } from '@/lib/pdf';
import { canvasBlob, openPdf, renderPage } from '@/lib/pdfjs';
import { sheetImage, sheetPages, type SheetFit } from '@/lib/sheetRender';
import { makeBook, rawRows, readBook, stackRows, visibleSheets, xlsxBlob, CSV_MIME } from '../sheets/book';
import { findTables, tablesToSheets, type Cell, type PageTables } from '../sheets/table';
import { ToolError, type OutputFile, type ToolHandler } from '../types';

// The spreadsheet tools on the web (SheetJS in the browser, like the app; src/tools/sheets/book.ts). Titles as in the
// app's handlers.

const tableNames = () => ({ table: (n: number) => t('Table {n}', { n }), all: t('Tables'), text: t('Text') });

/** Excel to PDF: every visible sheet drawn as A4 pages (src/lib/sheetRender.ts), one PDF. */
export const excelToPdf: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const wb = await readBook(files[0]);
  const names = visibleSheets(wb);
  if (!names.length) throw new ToolError(t('This spreadsheet is empty.'));
  const doc = await PDFDocument.create();
  for (let i = 0; i < names.length; i++) {
    await step(i, names.length + 1, t('Sheet {n} of {total}', { n: i + 1, total: names.length }));
    for (const c of sheetPages(wb.Sheets[names[i]], (options.fit as SheetFit) ?? 'actual', options.orientation === 'landscape')) {
      const jpg = await doc.embedJpg(await (await canvasBlob(c, 'image/jpeg', 0.92)).arrayBuffer());
      // 150 dpi pixels to points
      const w = (c.width / 150) * 72;
      const h = (c.height / 150) * 72;
      doc.addPage([w, h]).drawImage(jpg, { x: 0, y: 0, width: w, height: h });
      c.width = c.height = 0;
    }
  }
  await step(names.length, names.length + 1, t('Saving your PDF'));
  return { title: t('Converted to PDF'), files: [await savePdf(doc, `${fileStem(files[0].name)}.pdf`)] };
};

/** Excel to JPG: each visible sheet as one picture. */
export const excelToImage: ToolHandler = async (ctx) => {
  const { files } = ctx;
  const step = stepper(ctx);
  const wb = await readBook(files[0]);
  const names = visibleSheets(wb);
  if (!names.length) throw new ToolError(t('This spreadsheet is empty.'));
  const out: OutputFile[] = [];
  for (let i = 0; i < names.length; i++) {
    await step(i, names.length, t('Sheet {n} of {total}', { n: i + 1, total: names.length }));
    const c = sheetImage(wb.Sheets[names[i]]);
    const safe = names[i].replace(/[\\/:*?"<>|]/g, '').trim() || `sheet-${i + 1}`;
    out.push({ name: names.length === 1 ? `${fileStem(files[0].name)}.jpg` : `${fileStem(files[0].name)}-${safe}.jpg`, blob: await canvasBlob(c, 'image/jpeg', 0.92) });
    c.width = c.height = 0;
  }
  return { title: t('Converted to JPG'), subtitle: plural(out.length, '{count} image', '{count} images'), files: out, zipName: `${fileStem(files[0].name)}-sheets.zip` };
};

/** Excel and CSV: to .xlsx (one file, or one per sheet) or to CSV (one file per sheet, UTF-8 with a BOM). */
export const convertSheet: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const out: OutputFile[] = [];
  const csv = options.format === 'csv';
  for (let f = 0; f < files.length; f++) {
    await step(f, files.length, files.length > 1 ? t('File {n} of {total}', { n: f + 1, total: files.length }) : t('Converting'));
    const wb = await readBook(files[f]);
    const names = visibleSheets(wb);
    const stem = fileStem(files[f].name);
    if (csv || options.split) {
      for (const n of names) {
        const ws = wb.Sheets[n];
        const name = names.length === 1 ? stem : `${stem}-${n.replace(/[\\/:*?"<>|]/g, '').trim()}`;
        out.push(
          csv
            ? { name: `${name}.csv`, blob: new Blob([`﻿${XLSX.utils.sheet_to_csv(ws)}`], { type: CSV_MIME }) }
            : { name: `${name}.xlsx`, blob: xlsxBlob(makeBook([{ name: n, ws }])) },
        );
      }
    } else out.push({ name: `${stem}.xlsx`, blob: xlsxBlob(wb) });
  }
  if (!out.length) throw new ToolError(t('This spreadsheet is empty.'));
  if (csv) return { title: t('Converted to CSV'), subtitle: plural(out.length, '{count} file', '{count} files'), files: out };
  if (options.split) return { title: t('Sheets split into files'), subtitle: plural(out.length, '{count} file', '{count} files'), files: out };
  return { title: t('Converted to Excel'), files: out };
};

/** Merge Excel: every file's sheets in one workbook, or all rows stacked in one sheet (first header kept). */
export const mergeExcel: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  if (files.length < 2) throw new ToolError(t('Choose at least 2 files'));
  const step = stepper(ctx);
  const sheets: { name: string; ws: XLSX.WorkSheet }[] = [];
  for (let i = 0; i < files.length; i++) {
    await step(i, files.length + 1, t('File {n} of {total}', { n: i + 1, total: files.length }));
    const wb = await readBook(files[i]);
    for (const n of visibleSheets(wb)) sheets.push({ name: visibleSheets(wb).length > 1 ? `${fileStem(files[i].name)} ${n}` : fileStem(files[i].name), ws: wb.Sheets[n] });
  }
  await step(files.length, files.length + 1, t('Saving'));
  const book =
    options.mode === 'rows'
      ? makeBook([{ name: t('Merged'), rows: stackRows(sheets.map((s): Cell[][] => rawRows(s.ws)), options.dropHeaders !== false) }])
      : makeBook(sheets);
  return { title: t('Your spreadsheets are merged'), subtitle: plural(files.length, '{count} file joined', '{count} files joined'), files: [{ name: `merged-${fileStem(files[0].name)}.xlsx`, blob: xlsxBlob(book) }] };
};

/** PDF to Excel: every page's words with their boxes (pdf.js; scanned pages read by Tesseract), tables found, xlsx. */
export const pdfToExcel: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const view = await openPdf(files[0]);
  const found: PageTables[] = [];
  try {
    const pages = await pageWords(view);
    for (let i = 0; i < pages.length; i++) {
      await step(i, pages.length + 1, t('Reading page {n} of {total}', { n: i + 1, total: pages.length }));
      let words = pages[i].words;
      if (!words.length) {
        // a scanned page: read the picture, words in page points like the PDF's own
        const c = await renderPage(view, i, 200);
        const r = await readText(c, ['eng'], (pct, what) => what === 'download' && ctx.onProgress(i, pages.length + 1, `${t('Getting the text reader ready (one time only)…')} ${pct}%`));
        const k = pages[i].w / c.width;
        words = r.words.map(([s, x, y, w, h]) => [s, x * k, y * k, w * k, h * k]);
        c.width = c.height = 0;
      }
      found.push(findTables(words));
    }
  } finally {
    void view.destroy();
  }
  const { count, sheets } = tablesToSheets(found, options.sheets === 'one' ? 'one' : 'each', tableNames());
  if (!sheets[0].rows.length) throw new ToolError(t('No text found in this PDF.'));
  await step(found.length, found.length + 1, t('Saving'));
  return {
    title: t('Converted to Excel'),
    subtitle: count ? t('Found {n} {value}', { n: count, value: count === 1 ? t('table') : t('tables') }) : t('No tables found, so every line is a row'),
    files: [{ name: `${fileStem(files[0].name)}.xlsx`, blob: xlsxBlob(makeBook(sheets)) }],
  };
};
