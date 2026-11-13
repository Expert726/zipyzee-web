'use client';
import { useLayoutEffect } from 'react';
import { applySavedTheme } from './useTheme';

/**
 * Keeps the chosen theme when the language changes (see applySavedTheme): applied before paint on every mount of the
 * layout, and again if anything removes data-theme from <html> later.
 */
export function ThemeKeeper() {
  useLayoutEffect(() => {
    applySavedTheme();
    const watch = new MutationObserver(applySavedTheme);
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => watch.disconnect();
  }, []);
  return null;
}
