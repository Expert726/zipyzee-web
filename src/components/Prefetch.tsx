'use client';
// Starts the AI tools' background downloads (src/lib/prefetch.ts) once the page has loaded. In the layout, so it
// runs on whichever page a visitor lands on first (usually the home page).
import { useEffect } from 'react';
import { prefetchModels } from '@/lib/prefetch';

export function Prefetch() {
  useEffect(() => prefetchModels(), []);
  return null;
}
