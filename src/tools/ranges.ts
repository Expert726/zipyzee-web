import { t } from '@/i18n';
// Page-range parser for Split PDF: "1-3, 5, 7-9" -> [[1, 3], [5, 5], [7, 9]] (1-based, inclusive).
// Open-ended "8-" runs to the last page. Errors are safe to show to the user.

export type PageRange = [number, number];

export type RangesResult = { ok: true; ranges: PageRange[] } | { ok: false; error: string };

const example = () => t('Check the ranges, for example 1-3, 5');

/**
 * @param pageCount When given, ranges are checked against it and open ends ("8-") resolve to it.
 *   Without it (before the PDF is read) only the format is checked.
 */
export function parseRanges(input: string, pageCount?: number): RangesResult {
  const parts = input
    .replace(/[–—]/g, '-') // en/em dash from some keyboards
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return { ok: false, error: t('Enter at least one page range, for example 1-3') };

  const ranges: PageRange[] = [];
  for (const part of parts) {
    const m = /^(\d+)\s*(?:-\s*(\d*))?$/.exec(part);
    if (!m) return { ok: false, error: example() };
    const from = Number(m[1]);
    const open = m[2] === '';
    const to = m[2] === undefined ? from : open ? pageCount ?? Infinity : Number(m[2]);
    if (from < 1 || to < 1) return { ok: false, error: t('Pages start at 1') };
    if (to < from) return { ok: false, error: t('Write {part} from low to high, like {to}-{from}', { part, to, from }) };
    if (pageCount != null) {
      const last = Math.max(from, to);
      if (last > pageCount) {
        return { ok: false, error: t('Page {last} doesn\'t exist. This PDF has {pageCount} {value}.', { last, pageCount, value: pageCount === 1 ? t('page') : t('pages') }) };
      }
    }
    ranges.push([from, to]);
  }
  return { ok: true, ranges };
}

/** Ranges that cover every page, `size` pages each: 8 pages -> "1-2, 3-4, 5-6, 7-8"; 7 -> "..., 7". */
export function rangesCovering(pageCount: number, size = 2): string {
  const out: string[] = [];
  for (let from = 1; from <= pageCount; from += size) {
    const to = Math.min(pageCount, from + size - 1);
    out.push(from === to ? `${from}` : `${from}-${to}`);
  }
  return out.join(', ');
}

export type SplitPreset = { id: 'pairs' | 'halves' | 'first' | 'last'; ranges: string };

/** Split PDF's quick choices for this many pages; the ones that make only one file are left out. */
export function splitPresets(pageCount: number): SplitPreset[] {
  if (pageCount < 2) return [];
  const half = Math.ceil(pageCount / 2);
  const span = (a: number, b: number) => (a === b ? `${a}` : `${a}-${b}`);
  const out: SplitPreset[] = [
    { id: 'pairs', ranges: rangesCovering(pageCount, 2) },
    { id: 'halves', ranges: `${span(1, half)}, ${span(half + 1, pageCount)}` },
    { id: 'first', ranges: `1, ${span(2, pageCount)}` },
    { id: 'last', ranges: `${span(1, pageCount - 1)}, ${pageCount}` },
  ];
  // two pages: every choice is "1, 2"; keep one
  return out.filter((p, i) => out.findIndex((q) => q.ranges === p.ranges) === i);
}

/** Which quick choice these ranges are (for the PDF they were made for), or null when typed by hand. */
export function presetOf(ranges: string): SplitPreset['id'] | null {
  const nums = (ranges.match(/\d+/g) ?? []).map(Number);
  if (!nums.length) return null;
  const last = Math.max(...nums);
  if (last === 1) return ranges.trim() === '1' ? 'pairs' : null;
  return splitPresets(last).find((p) => p.ranges === ranges.trim())?.id ?? null;
}

/**
 * Split's ranges for a newly chosen PDF: a quick choice (or the example) becomes the same choice for this many pages;
 * no PDF (0) gives `empty` back. Ranges typed by hand stay as they are (null).
 */
export function refitRanges(ranges: string, pageCount: number, empty: string): string | null {
  const id = presetOf(ranges);
  if (!id) return null;
  if (pageCount <= 0) return empty;
  return splitPresets(pageCount).find((p) => p.id === id)?.ranges ?? rangesCovering(pageCount);
}
