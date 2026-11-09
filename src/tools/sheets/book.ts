// Spreadsheets in the browser (SheetJS, pure JS): read xlsx / xls / csv / ods, write xlsx and csv. Ported from the app
// (src/tools/sheets/book.ts): only readBook differs (a File here, a path there); keep the rest the same.
import * as XLSX from 'xlsx';
import { ToolError } from '../types';
import type { Cell } from './table';
import { t } from '@/i18n';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const CSV_MIME = 'text/csv';

/** Every spreadsheet type the app opens. */
export const SHEET_MIMES = new Set([
  XLSX_MIME,
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  CSV_MIME,
  'text/comma-separated-values',
  'application/csv',
]);

const SHEET_EXT = /\.(xlsx|xlsm|xls|ods|csv)$/i;

/** A spreadsheet by its type or, when the phone doesn't say, its name. */
export const isSheet = (mimeType = '', name = '') => SHEET_MIMES.has(mimeType) || SHEET_EXT.test(name);

/** The type for a spreadsheet's file name (pickers and chat files sometimes come without one). */
export const sheetMime = (name: string) =>
  /\.csv$/i.test(name) ? CSV_MIME : /\.xls$/i.test(name) ? 'application/vnd.ms-excel' : /\.ods$/i.test(name) ? 'application/vnd.oasis.opendocument.spreadsheet' : XLSX_MIME;

const isCsv = (mimeType = '', name = '') => mimeType.includes('csv') || /\.csv$/i.test(name);

/** Bigger than this isn't opened (a phone's memory runs out first). */
export const MAX_SHEET_BYTES = 30 * 1024 * 1024;
const MAX_CELLS = 500_000;

/** Cells a sheet's used range covers. */
export function cellCount(ws: XLSX.WorkSheet) {
  if (!ws['!ref']) return 0;
  const r = XLSX.utils.decode_range(ws['!ref']);
  return (r.e.r - r.s.r + 1) * (r.e.c - r.s.c + 1);
}

/** A workbook from file contents: CSV as text (keeps Urdu and other UTF-8), everything else as base64 with its column
 *  widths and row heights (cellStyles), so they show in the grid and survive an edit. */
export function parseBook(data: string, csv: boolean): XLSX.WorkBook {
  const wb = csv ? XLSX.read(data.replace(/^﻿/, ''), { type: 'string', raw: false }) : XLSX.read(data, { type: 'base64', cellStyles: true });
  const cells = wb.SheetNames.reduce((n, s) => n + cellCount(wb.Sheets[s]), 0);
  if (cells > MAX_CELLS) throw new ToolError(t('This spreadsheet is too big to open on the phone.'));
  return wb;
}

export async function readBook(file: File): Promise<XLSX.WorkBook> {
  if (file.size > MAX_SHEET_BYTES) throw new ToolError(t('This spreadsheet is too big to open on the phone.'));
  const csv = isCsv(file.type, file.name);
  try {
    if (csv) return parseBook(await file.text(), true);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const wb = XLSX.read(bytes, { type: 'array', cellStyles: true });
    const cells = wb.SheetNames.reduce((n, s) => n + cellCount(wb.Sheets[s]), 0);
    if (cells > 500_000) throw new ToolError(t('This spreadsheet is too big to open on the phone.'));
    return wb;
  } catch (e) {
    if (e instanceof ToolError) throw e;
    throw new ToolError(t('{name} couldn\'t be opened. It may be damaged or not a spreadsheet.', { name: file.name }));
  }
}

/** Sheet names in order, without hidden or empty sheets. */
export function visibleSheets(wb: XLSX.WorkBook): string[] {
  const meta = wb.Workbook?.Sheets ?? [];
  return wb.SheetNames.filter((name, i) => !meta[i]?.Hidden && cellCount(wb.Sheets[name]) > 0);
}

/** A sheet's cells as the text Excel shows (number formats applied), at most maxRows x maxCols. */
export function sheetRows(ws: XLSX.WorkSheet, maxRows = Infinity, maxCols = Infinity): { rows: string[][]; more: boolean; start: { r: number; c: number } } {
  if (!ws['!ref']) return { rows: [], more: false, start: { r: 0, c: 0 } };
  const r = XLSX.utils.decode_range(ws['!ref']);
  const e = { r: Math.min(r.e.r, r.s.r + maxRows - 1), c: Math.min(r.e.c, r.s.c + maxCols - 1) };
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '', blankrows: true, range: { s: r.s, e } });
  // a formula typed in the app has no value until Excel works it out: show the formula
  for (const key of Object.keys(ws)) {
    const cell = ws[key] as XLSX.CellObject;
    if (key[0] === '!' || !cell.f || (cell.v != null && cell.t !== 'e')) continue;
    const at = XLSX.utils.decode_cell(key);
    const row = rows[at.r - r.s.r];
    if (row && at.c - r.s.c < e.c - r.s.c + 1 && at.c >= r.s.c) {
      while (row.length <= at.c - r.s.c) row.push('');
      row[at.c - r.s.c] = `=${cell.f}`;
    }
  }
  return { rows, more: e.r < r.e.r || e.c < r.e.c, start: r.s };
}

/** Excel's sheet-name rules: no []:*?/\, at most 31 characters, unique. */
export function sheetName(name: string, used: Set<string>) {
  const base = (name.replace(/[[\]:*?/\\]/g, ' ').trim() || 'Sheet').slice(0, 31);
  let n = base;
  for (let i = 2; used.has(n.toLowerCase()); i++) n = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
  used.add(n.toLowerCase());
  return n;
}

/** A new workbook from sheets given as rows, or as worksheets kept as they are (formulas, merges, widths). */
export function makeBook(sheets: { name: string; rows?: Cell[][]; ws?: XLSX.WorkSheet }[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, s.ws ?? XLSX.utils.aoa_to_sheet(s.rows ?? []), sheetName(s.name, used));
  return wb;
}

/** A grid column's width in design px when the file doesn't set one. */
export const DEFAULT_COL_WIDTH = 112;
/** Excel pixels to the grid's design px (Excel's default 64 px column shows about 83 wide). */
const COL_SCALE = 1.3;
export const MIN_COL_WIDTH = 48;
export const MAX_COL_WIDTH = 360;
const clampWidth = (w: number) => Math.round(Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, w)));

/** Column c's width for the grid (design px), from the file's own widths (Excel px or characters) or the default. */
export function colWidth(ws: XLSX.WorkSheet, c: number): number {
  const col = (ws['!cols'] as XLSX.ColInfo[] | undefined)?.[c];
  if (!col || col.hidden) return DEFAULT_COL_WIDTH;
  const px = col.wpx ?? (col.wch != null ? col.wch * 7 + 5 : col.width != null ? col.width * 7 + 5 : undefined);
  return px == null ? DEFAULT_COL_WIDTH : clampWidth(px * COL_SCALE);
}

/** A grid width (design px) as Excel pixels, for saving. */
export const toExcelPx = (w: number) => Math.round(clampWidth(w) / COL_SCALE);

/** Excel's column letters: 0 -> A, 26 -> AA. */
export const columnLetters = (i: number) => XLSX.utils.encode_col(i);

export const xlsxBase64 = (wb: XLSX.WorkBook): string => XLSX.write(wb, { type: 'base64', bookType: 'xlsx', compression: true });

/** CSV with a byte-order mark, so Excel opens Urdu and other non-English text correctly. */
export const toCsv = (ws: XLSX.WorkSheet) => `﻿${XLSX.utils.sheet_to_csv(ws)}`;

/** Merge Excel's "All rows in one sheet": every file's rows one after another; later header rows dropped if asked. */
export function stackRows(files: Cell[][][], dropHeaders: boolean): Cell[][] {
  return files.flatMap((rows, i) => (dropHeaders && i > 0 ? rows.slice(1) : rows));
}

/** A sheet's rows with raw values (numbers stay numbers), for stacking. */
export const rawRows = (ws: XLSX.WorkSheet): Cell[][] =>
  XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: '', blankrows: false });

/** The workbook as an .xlsx Blob (the web's xlsxBase64). */
export const xlsxBlob = (wb: XLSX.WorkBook): Blob => new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true })], { type: XLSX_MIME });
