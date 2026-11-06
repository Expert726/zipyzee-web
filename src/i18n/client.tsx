'use client';
import { createContext, useContext, useMemo } from 'react';
import { setLanguage, tr, type Language, type Translate } from './index';

const LanguageContext = createContext<Language>('en');

/** Wraps every page (app/[lang]/layout.tsx). Sets the browser-only t() language too. */
export function I18nProvider({ lang, children }: { lang: Language; children: React.ReactNode }) {
  if (typeof window !== 'undefined') setLanguage(lang);
  return <LanguageContext.Provider value={lang}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);

/** t() for Client Components. */
export function useT(): Translate {
  const lang = useLanguage();
  return useMemo<Translate>(() => (text, vars) => tr(lang, text, vars), [lang]);
}
