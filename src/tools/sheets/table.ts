// Copied from the app (src/tools/sheets/table.ts); keep the two the same.
// Words with their boxes (from a PDF's text or ML Kit on a photo) to tables, for PDF to Excel and Image to Excel.
// Pure and unit-tested. Words are grouped into lines, each line is split into cells at wide gaps, and a run of 2+
// lines with 2+ cells is a table whose columns come from the cells' x-ranges across all its lines.
import type { Word } from '../compare';

export type { Word };
export type Cell = string | number;
export type Rows = Cell[][];

type Span = { x0: number; x1: number; text: string };
type Line = { top: number; bottom: number; words: Word[] };

/** A page's tables, and every line as one-column rows (used when a page has no table, so nothing is lost). */
export type PageTables = { tables: Rows[]; lines: Rows };

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Words into lines: a word joins the line its vertical centre falls in. Lines top to bottom, words left to right. */
export function toLines(words: Word[]): Word[][] {
  const sorted = words.filter((w) => w[0].trim()).sort((a, b) => a[2] + a[4] / 2 - (b[2] + b[4] / 2));
  const lines: Line[] = [];
  for (const w of sorted) {
    const mid = w[2] + w[4] / 2;
    const line = lines.find((l) => mid >= l.top && mid <= l.bottom);
    if (line) {
      line.words.push(w);
      line.top = Math.min(line.top, w[2]);
      line.bottom = Math.max(line.bottom, w[2] + w[4]);
    } else {
      lines.push({ top: w[2], bottom: w[2] + w[4], words: [w] });
    }
  }
  return lines.sort((a, b) => a.top - b.top).map((l) => l.words.sort((a, b) => a[1] - b[1]));
}

/** A line's words joined into cells wherever the gap is wider than about 1.5 characters. */
export function toSpans(line: Word[]): Span[] {
  const charW = median(line.map((w) => w[3] / Math.max(1, w[0].length)));
  const gap = charW * 1.5;
  const spans: Span[] = [];
  for (const w of line) {
    const last = spans[spans.length - 1];
    if (last && w[1] - last.x1 <= gap) {
      last.text += ` ${w[0]}`;
      last.x1 = Math.max(last.x1, w[1] + w[3]);
    } else {
      spans.push({ x0: w[1], x1: w[1] + w[3], text: w[0] });
    }
  }
  return spans;
}

/** Column ranges of a table: the cells' x-ranges merged where they overlap (lines with the usual cell count only). */
function columns(lines: Span[][]): [number, number][] {
  const usual = median(lines.map((l) => l.length));
  const ranges = lines.filter((l) => l.length >= usual).flat().map((s): [number, number] => [s.x0, s.x1]).sort((a, b) => a[0] - b[0]);
  const cols: [number, number][] = [];
  for (const r of ranges) {
    const last = cols[cols.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else cols.push([...r]);
  }
  return cols;
}

/** The column a cell overlaps most (the nearest one if it overlaps none). */
function columnOf(s: Span, cols: [number, number][]) {
  let best = 0;
  let score = -Infinity;
  cols.forEach(([a, b], i) => {
    const overlap = Math.min(b, s.x1) - Math.max(a, s.x0);
    const v = overlap > 0 ? overlap : -Math.abs((a + b) / 2 - (s.x0 + s.x1) / 2);
    if (v > score) {
      score = v;
      best = i;
    }
  });
  return best;
}

function tableRows(lines: Span[][]): Rows {
  const cols = columns(lines);
  return lines.map((l) => {
    const row: string[] = cols.map(() => '');
    for (const s of l) {
      const c = columnOf(s, cols);
      row[c] = row[c] ? `${row[c]} ${s.text}` : s.text;
    }
    return row.map(toCellValue);
  });
}

/** One page's words to its tables (top to bottom) and its plain lines. */
export function findTables(words: Word[]): PageTables {
  const spans = toLines(words).map(toSpans);
  const tables: Rows[] = [];
  let run: Span[][] = [];
  const close = () => {
    if (run.length >= 2) {
      const rows = tableRows(run);
      if (rows[0].length >= 2) tables.push(rows);
    }
    run = [];
  };
  for (const l of spans) {
    if (l.length >= 2) run.push(l);
    else close();
  }
  close();
  return { tables, lines: spans.map((l) => [l.map((s) => s.text).join(' ')]) };
}

const NUMBER = /^\(?[-+]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?\)?$/;

/**
 * "1,234.50", "-12" and "(40.00)" (accounting minus) become numbers, so sums work in Excel. Everything else stays
 * text, including codes with leading zeros, very long digit runs (account and phone numbers) and anything starting
 * with "=" (written as a text cell, never a formula).
 */
export function toCellValue(text: string): Cell {
  const s = text.trim();
  if (!NUMBER.test(s)) return s;
  const digits = s.replace(/\D/g, '');
  if (/^[(+-]?0\d/.test(s) || digits.length > 15) return s;
  const paren = s.startsWith('(') && s.endsWith(')');
  if (s.startsWith('(') !== s.endsWith(')')) return s;
  const n = Number(s.replace(/[(),+]/g, ''));
  if (!Number.isFinite(n)) return s;
  return paren ? -n : n;
}

/** Tables from every page: their own sheets ("each") or stacked in one with a blank row between ("one"). */
export function tablesToSheets(pages: PageTables[], mode: 'each' | 'one', names: { table: (n: number) => string; all: string; text: string }) {
  const tables = pages.flatMap((p) => p.tables);
  if (!tables.length) {
    // no table anywhere: every line as a row, so the text is still there to work with
    return { count: 0, sheets: [{ name: names.text, rows: pages.flatMap((p) => p.lines) }] };
  }
  if (mode === 'one') {
    const rows: Rows = [];
    tables.forEach((tb, i) => {
      if (i) rows.push([]);
      rows.push(...tb);
    });
    return { count: tables.length, sheets: [{ name: names.all, rows }] };
  }
  return { count: tables.length, sheets: tables.map((rows, i) => ({ name: names.table(i + 1), rows })) };
}
