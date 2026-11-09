'use client';
// A spreadsheet drawn as pages (Excel to PDF) or one picture per sheet (Excel to JPG) in the browser. The app prints
// sheets through a WebView (src/tools/sheets/html.ts); here each sheet is drawn on a canvas: the file's column widths,
// gridlines, numbers right-aligned, long text clipped to its cell, merged cells drawn as one. The browser shapes Urdu
// and Arabic itself, so they come out joined. Fit: Actual size (wide sheets continue on more pages), Fit width, or One
// page per sheet; Portrait or Landscape.
import * as XLSX from 'xlsx';
import { colWidth } from '@/tools/sheets/book';

export type SheetFit = 'actual' | 'width' | 'page';
const DPI = 150;
const A4 = { w: Math.round((210 / 25.4) * DPI), h: Math.round((297 / 25.4) * DPI) };
const MARGIN = Math.round(0.4 * DPI);
const ROW_H = 30;
const FONT = 15;
const PAD = 7;

type Grid = { rows: string[][]; nums: boolean[][]; widths: number[]; merges: XLSX.Range[]; start: { r: number; c: number } };

/** The used part of a sheet: shown text of every cell, which are numbers, column widths in px. */
export function sheetGrid(ws: XLSX.WorkSheet): Grid {
  const ref = ws['!ref'];
  if (!ref) return { rows: [], nums: [], widths: [], merges: [], start: { r: 0, c: 0 } };
  const r = XLSX.utils.decode_range(ref);
  const rows: string[][] = [];
  const nums: boolean[][] = [];
  for (let y = r.s.r; y <= r.e.r; y++) {
    const row: string[] = [];
    const num: boolean[] = [];
    for (let x = r.s.c; x <= r.e.c; x++) {
      const cell = ws[XLSX.utils.encode_cell({ r: y, c: x })] as XLSX.CellObject | undefined;
      row.push(cell ? (cell.w ?? (cell.v == null ? '' : String(cell.v))) : '');
      num.push(cell?.t === 'n');
    }
    rows.push(row);
    nums.push(num);
  }
  // trailing empty rows and columns don't print
  while (rows.length && rows[rows.length - 1].every((v) => !v)) {
    rows.pop();
    nums.pop();
  }
  let cols = rows.reduce((n, row) => Math.max(n, row.reduce((m, v, i) => (v ? i + 1 : m), 0)), 0);
  cols = Math.max(cols, 1);
  const widths = Array.from({ length: cols }, (_, i) => colWidth(ws, r.s.c + i));
  return { rows: rows.map((row) => row.slice(0, cols)), nums: nums.map((n) => n.slice(0, cols)), widths, merges: (ws['!merges'] as XLSX.Range[] | undefined) ?? [], start: r.s };
}

const fontFamily = () => (typeof document === 'undefined' ? 'sans-serif' : getComputedStyle(document.body).fontFamily || 'sans-serif');

/** Draws rows [r0, r1) and columns [c0, c1) of the grid at (x, y), scale k. */
function drawBlock(g: CanvasRenderingContext2D, grid: Grid, r0: number, r1: number, c0: number, c1: number, x: number, y: number, k: number) {
  const fam = fontFamily();
  g.font = `400 ${FONT * k}px ${fam}`;
  g.textBaseline = 'middle';
  const colX: number[] = [x];
  for (let c = c0; c < c1; c++) colX.push(colX[colX.length - 1] + grid.widths[c] * k);
  const rh = ROW_H * k;
  // merged cells: (row, col) -> its span, and cells covered by another
  const span = new Map<string, { r: number; c: number }>();
  const covered = new Set<string>();
  for (const m of grid.merges) {
    const mr = m.s.r - grid.start.r;
    const mc = m.s.c - grid.start.c;
    span.set(`${mr},${mc}`, { r: m.e.r - m.s.r + 1, c: m.e.c - m.s.c + 1 });
    for (let a = m.s.r; a <= m.e.r; a++) for (let b = m.s.c; b <= m.e.c; b++) if (a !== m.s.r || b !== m.s.c) covered.add(`${a - grid.start.r},${b - grid.start.c}`);
  }
  for (let r = r0; r < r1; r++) {
    const cy = y + (r - r0) * rh;
    for (let c = c0; c < c1; c++) {
      if (covered.has(`${r},${c}`)) continue;
      const sp = span.get(`${r},${c}`);
      const cw = sp ? colX[Math.min(c1, c + sp.c) - c0] - colX[c - c0] : colX[c - c0 + 1] - colX[c - c0];
      const ch = sp ? Math.min(r1 - r, sp.r) * rh : rh;
      const cx = colX[c - c0];
      g.strokeStyle = '#D5D9DE';
      g.lineWidth = Math.max(1, k);
      g.strokeRect(cx, cy, cw, ch);
      const v = grid.rows[r]?.[c];
      if (!v) continue;
      g.save();
      g.beginPath();
      g.rect(cx + 1, cy, cw - 2, ch);
      g.clip();
      g.fillStyle = '#111827';
      const rtl = /[֐-ࣿ]/.test(v);
      const right = grid.nums[r]?.[c] || rtl;
      g.textAlign = right ? 'right' : 'left';
      g.direction = rtl ? 'rtl' : 'ltr';
      g.fillText(v, right ? cx + cw - PAD * k : cx + PAD * k, cy + ch / 2);
      g.restore();
    }
  }
}

const blank = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, c.width, c.height);
  return c;
};

/** A sheet as A4 pages (portrait or landscape) at 150 dpi. */
export function sheetPages(ws: XLSX.WorkSheet, fit: SheetFit, landscape: boolean): HTMLCanvasElement[] {
  const grid = sheetGrid(ws);
  const page = landscape ? { w: A4.h, h: A4.w } : A4;
  const availW = page.w - MARGIN * 2;
  const availH = page.h - MARGIN * 2;
  const totalW = grid.widths.reduce((a, b) => a + b, 0);
  const totalH = grid.rows.length * ROW_H;
  if (!grid.rows.length) return [blank(page.w, page.h)];
  const k = fit === 'page' ? Math.min(1.4, availW / totalW, availH / totalH) : fit === 'width' ? Math.min(1.4, availW / totalW) : 1;
  // column bands that fit the page width (only Actual size makes more than one)
  const bands: [number, number][] = [];
  let c0 = 0;
  while (c0 < grid.widths.length) {
    let w = 0;
    let c1 = c0;
    while (c1 < grid.widths.length && (c1 === c0 || w + grid.widths[c1] * k <= availW + 0.5)) w += grid.widths[c1++] * k;
    bands.push([c0, c1]);
    c0 = c1;
  }
  const perPage = Math.max(1, Math.floor(availH / (ROW_H * k)));
  const out: HTMLCanvasElement[] = [];
  for (let r0 = 0; r0 < grid.rows.length; r0 += perPage)
    for (const [a, b] of bands) {
      const c = blank(page.w, page.h);
      drawBlock(c.getContext('2d')!, grid, r0, Math.min(grid.rows.length, r0 + perPage), a, b, MARGIN, MARGIN, k);
      out.push(c);
    }
  return out;
}

/** A whole sheet as one picture (Excel to JPG): its natural size, at most `maxSide` on the long side. */
export function sheetImage(ws: XLSX.WorkSheet, maxSide = 6000): HTMLCanvasElement {
  const grid = sheetGrid(ws);
  const pad = 24;
  const totalW = grid.widths.reduce((a, b) => a + b, 0);
  const totalH = Math.max(1, grid.rows.length) * ROW_H;
  const k = Math.min(2, maxSide / (Math.max(totalW, totalH) + pad * 2));
  const c = blank((totalW + pad * 2) * k, (totalH + pad * 2) * k);
  if (grid.rows.length) drawBlock(c.getContext('2d')!, grid, 0, grid.rows.length, 0, grid.widths.length, pad * k, pad * k, k);
  return c;
}
