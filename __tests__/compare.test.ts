import { describe, expect, it } from 'vitest';
// Compare PDF's word diff (src/tools/compare.ts), Web page to PDF file names, and the report name.
import { comparePages, countChanges, diff, type PageWords } from '@/tools/compare';
import { reportStem } from '@/components/flow/custom/CompareResult';

const words = (s: string) => s.split(' ');
const apply = (a: string[], b: string[]) => {
  // replaying the ops on a must give b
  const out: string[] = [];
  for (const op of diff(a, b)) {
    if (op.kind === 'same') out.push(a[op.a!]);
    if (op.kind === 'add') out.push(b[op.b!]);
  }
  return out;
};

it('diff turns version 1 into version 2', () => {
  const pairs: [string, string][] = [
    ['the quick brown fox', 'the quick red fox'],
    ['a b c d e', 'a c e f'],
    ['', 'new words here'],
    ['old words here', ''],
    ['same text', 'same text'],
    ['x y z', 'z y x'],
  ];
  for (const [a, b] of pairs) {
    const A = a ? words(a) : [];
    const B = b ? words(b) : [];
    expect(apply(A, B)).toEqual(B);
    // deletions are exactly the words of A not kept
    const kept = diff(A, B).filter((o) => o.kind !== 'add').map((o) => A[o.a!]);
    expect(kept).toEqual(A);
  }
});

it('counts runs of changes, not words', () => {
  expect(countChanges(diff(words('the quick brown fox'), words('the quick red fox')))).toBe(1);
  expect(countChanges(diff(words('a b c d e'), words('a X c d Y')))).toBe(2);
  expect(countChanges(diff(words('same text'), words('same text')))).toBe(0);
});

it('compares page by page, with boxes for removed and added words', () => {
  const page = (...w: string[]): PageWords => ({ w: 600, h: 800, words: w.map((t, i) => [t, 0.1 * i, 0.1, 0.05, 0.02]) });
  const out = comparePages([page('Pay', 'within', '30', 'days')], [page('Pay', 'within', '45', 'days'), page('New', 'page')]);
  expect(out.pages).toHaveLength(2);
  expect(out.pages[0].removed).toEqual([{ x: 0.2, y: 0.1, w: 0.05, h: 0.02 }]);
  expect(out.pages[0].added).toHaveLength(1);
  expect(out.pages[1].added).toHaveLength(2);
  expect(out.total).toBe(2);
  expect([out.pages1, out.pages2]).toEqual([1, 2]);
});

// (the app's Web page to PDF names are tested there; that tool isn't on the web yet)
it('names reports', () => {
  expect(reportStem('contract-v2.pdf')).toBe('contract');
  expect(reportStem('thesis_version_3.pdf')).toBe('thesis');
  expect(reportStem('notes.pdf')).toBe('notes');
});
