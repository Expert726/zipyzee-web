// The setup step's main button (the app's SetupStep verbLabel): "Merge 3 PDFs", "Convert 2 photos", "Convert 12
// pages" (or the pages chosen). Pure.
import type { Translate } from '@/i18n';
import { parseRanges } from './ranges';
import type { OptionValues } from './types';

const plural = (t: Translate, n: number, one: string, many: string) => `${n} ${n === 1 ? t(one) : t(many)}`;

/** Pages a "Choose pages" range covers, or undefined when it can't be read yet. */
export function chosenPages(values: OptionValues, pageCount?: number): number | undefined {
  if (values.pages !== 'choose') return pageCount;
  const r = parseRanges(String(values.ranges ?? ''), pageCount);
  if (!r.ok) return undefined;
  return new Set(r.ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))).size;
}

export function verbLabel(t: Translate, verb: string, fileCount: number, values: OptionValues, pageCount?: number, imageCount?: number): string {
  const pages = chosenPages(values, pageCount);
  return t(verb)
    .replace('{count}', String(fileCount))
    .replace('{photos}', plural(t, fileCount, 'photo', 'photos'))
    .replace('{pages}', pages == null ? t('pages') : plural(t, pages, 'page', 'pages'))
    .replace('{images}', !imageCount ? t('images') : plural(t, imageCount, 'image', 'images'));
}
