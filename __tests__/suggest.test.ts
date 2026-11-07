import { describe, expect, it } from 'vitest';
import { allToolsFor, filesFor, outputKind, suggestTools } from '@/tools/suggest';
import { getTool } from '@/tools/registry';
import { shownProgress, timeLeft } from '@/lib/processingPace';

describe('Continue to…', () => {
  it('knows the result type', () => {
    expect(outputKind(['a.pdf', 'b.PDF'])).toBe('pdf');
    expect(outputKind(['a.jpg', 'b.png'])).toBe('image');
    expect(outputKind(['a.pdf', 'b.jpg'])).toBe('mixed');
    expect(outputKind(['a.zip'])).toBeNull();
  });

  it('suggests web tools that take the result, never the same tool', () => {
    const merge = getTool('merge-pdf')!;
    const list = suggestTools(merge, ['merged.pdf']);
    expect(list.length).toBeGreaterThan(2);
    expect(list.every((x) => x.web && ['pdf', 'pdfs'].includes(x.input))).toBe(true);
    expect(list.map((x) => x.id)).not.toContain('merge-pdf');
    const images = suggestTools(getTool('resize-image')!, ['a.jpg']).map((x) => x.id);
    expect(images).toContain('compress-image');
    expect(images).not.toContain('split-pdf');
  });

  it('See all lists only tools that work on the web, in the suggested order', () => {
    const merge = getTool('merge-pdf')!;
    const all = allToolsFor(merge, ['m.pdf']);
    expect(all.slice(0, 3)).toEqual(suggestTools(merge, ['m.pdf'], 3));
    expect(all.every((x) => x.web && !x.comingSoon && ['pdf', 'pdfs'].includes(x.input))).toBe(true);
    expect(all.map((x) => x.id)).toContain('compress-pdf');
    expect(all.map((x) => x.id)).not.toContain('pdf-to-pdfa'); // a server tool, app-only for now
  });

  it('hands one file to single-file tools and all to the others', () => {
    expect(filesFor(getTool('split-pdf')!, [1, 2])).toEqual([1]);
    expect(filesFor(getTool('merge-pdf')!, [1, 2])).toEqual([1, 2]);
    // a mixed result: each tool gets only its own kind
    const mixed = [{ name: 'p.jpg' }, { name: 's.pdf' }];
    expect(filesFor(getTool('merge-pdf')!, mixed)).toEqual([{ name: 's.pdf' }]);
    expect(filesFor(getTool('compress-image')!, mixed)).toEqual([{ name: 'p.jpg' }]);
  });

  it('paces the progress over the minimum time', () => {
    expect(shownProgress(1, 3000, 6000)).toBe(0.5);
    expect(shownProgress(0.2, 5000, 6000)).toBe(0.2);
    expect(timeLeft(2000, 6000)).toBe(4000);
    expect(shownProgress(0.7, 10, 0)).toBe(0.7);
  });
});

import { verbLabel } from '@/tools/verb';
import { tr } from '@/i18n';

describe('the main button', () => {
  const t = (s: string, v?: Record<string, string | number>) => tr('en', s, v);
  it('fills in files, photos and pages like the app', () => {
    expect(verbLabel(t, 'Merge {count} PDFs', 3, {})).toBe('Merge 3 PDFs');
    expect(verbLabel(t, 'Convert {photos}', 1, {})).toBe('Convert 1 photo');
    expect(verbLabel(t, 'Convert {pages}', 1, { pages: 'all' }, 12)).toBe('Convert 12 pages');
    expect(verbLabel(t, 'Convert {pages}', 1, { pages: 'choose', ranges: '2, 4-5' }, 12)).toBe('Convert 3 pages');
    expect(verbLabel(t, 'Convert {pages}', 1, { pages: 'all' })).toBe('Convert pages');
    expect(tr('ur', 'Convert {pages}')).not.toBe('Convert {pages}');
  });
});
