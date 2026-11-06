'use client';
import { useCallback, useSyncExternalStore } from 'react';

// Theme: data-theme on <html> ("light" / "dark"; missing = follow the system), saved in localStorage. The inline
// script in app/[lang]/layout.tsx applies the saved one before paint.
const listeners = new Set<() => void>();
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function isDark() {
  const set = document.documentElement.getAttribute('data-theme');
  return set ? set === 'dark' : media().matches;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const m = media();
  m.addEventListener('change', fn);
  return () => {
    listeners.delete(fn);
    m.removeEventListener('change', fn);
  };
}

export function useTheme() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const toggle = useCallback(() => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // private mode: the switch still works for this visit
    }
    listeners.forEach((fn) => fn());
  }, []);
  return { dark, toggle };
}
