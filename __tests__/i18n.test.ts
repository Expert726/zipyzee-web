import { describe, expect, it } from 'vitest';
import { ur } from '@/i18n/ur';
import { urWeb } from '@/i18n/urWeb';
import { usedKeys } from './keys';

// Like the app's __tests__/i18n.test.ts: every key has Urdu (ur.ts = the app's copy, urWeb.ts = web-only text), and
// the {placeholders} match.
const SKIP = new Set(['A4', 'JPG', 'PNG', 'WEBP', 'PDF', '180°', 'Page {n} of {total}']);
const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('Urdu', () => {
  const keys = [...usedKeys()].filter((k) => !SKIP.has(k));
  it('has every key', () => {
    expect(keys.filter((k) => ur[k] == null && urWeb[k] == null)).toEqual([]);
  });
  it('keeps the placeholders', () => {
    expect(keys.filter((k) => (ur[k] ?? urWeb[k]) != null && vars(k) !== vars(ur[k] ?? urWeb[k]))).toEqual([]);
  });
  it('urWeb does not repeat the app dictionary', () => {
    expect(Object.keys(urWeb).filter((k) => k in ur)).toEqual([]);
  });
});
