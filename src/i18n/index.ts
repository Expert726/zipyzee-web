// English text is the key: t('Merge {count} PDFs', { count: 3 }). Urdu lives in ./ur.ts (copied from the app; keep the
// two in step), anything missing there shows in English.
//
// Web: the language comes from the URL (/en/..., /ur/...). Server Components and pages call tr(lang, text). Client
// Components use useT() from ./client. The plain t() below is for code that only runs in the browser (tool handlers,
// pdfOps, ranges): I18nProvider sets its language, and the browser only ever shows one language at a time.
import { ur } from './ur';
import { urWeb } from './urWeb';
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from './languages';

export { DEFAULT_LANGUAGE, LANGUAGES, type Language };

export const isLanguage = (x: string): x is Language => (LANGUAGES as readonly string[]).includes(x);
export const isRTLLanguage = (l: Language) => l === 'ur';

type Vars = Record<string, string | number>;

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (all, k) => (k in vars ? String(vars[k]) : all)) : s);

/** Text in `l`, with {placeholders} filled in. Safe on the server (no shared state). */
export function tr(l: Language, text: string, vars?: Vars): string {
  return fill(l === 'ur' ? ur[text] ?? urWeb[text] ?? text : text, vars);
}

let current: Language = DEFAULT_LANGUAGE;

/** I18nProvider only (browser). */
export function setLanguage(l: Language) {
  current = l;
}

export const lang = () => current;
export const isRTL = () => current === 'ur';

/** Browser-only code (handlers, pdfOps): text in the language the page shows. */
export const t = (text: string, vars?: Vars) => tr(current, text, vars);

/** t() of the singular or plural text, with {count} filled in. */
export const plural = (n: number, one: string, many: string, vars?: Vars) => t(n === 1 ? one : many, { count: n, ...vars });

export type Translate = (text: string, vars?: Vars) => string;
