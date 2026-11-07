'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Whether this visit has moved between our own pages, so "Back" can go back (keeping the filter and scroll of the
// page you came from) instead of opening a fresh page.
let moved = false;
let first: string | null = null;

/** Mounted once in the layout. */
export function NavHistory() {
  const path = usePathname();
  useEffect(() => {
    if (first == null) first = path;
    else if (path !== first) moved = true;
  }, [path]);
  return null;
}

export const canGoBack = () => moved && window.history.length > 1;
