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

function saved(): 'light' | 'dark' | null {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

/**
 * Puts the saved theme back on <html>. Needed after switching language: the root layout lives under [lang], so
 * English <-> Urdu remounts <html>, and React 19 clears the attributes it didn't set (data-theme among them).
 */
export function applySavedTheme() {
  const t = saved();
  const el = document.documentElement;
  if (t && el.getAttribute('data-theme') !== t) {
    el.setAttribute('data-theme', t);
    listeners.forEach((fn) => fn());
  }
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
