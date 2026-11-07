'use client';
// Object URLs for files shown on a page (picked photos, thumbnails), freed when they're no longer shown.
//
// Not freed in the effect's clean-up straight away: React's development mode mounts every component twice (clean-up
// in between) while useMemo keeps the same URLs, so they'd be dead on the second mount and the <img> would fail
// (the Compress image preview showed a file icon, 2026-11-07). The clean-up waits a second, and the next mount with
// the same URLs cancels it.
import { useEffect, useMemo } from 'react';

const pending = new WeakMap<(string | undefined)[], ReturnType<typeof setTimeout>>();

/** One URL per blob (undefined for null), the same array while `blobs` is the same array. */
export function useObjectUrls(blobs: readonly (Blob | null | undefined)[]): (string | undefined)[] {
  const urls = useMemo(() => blobs.map((b) => (b ? URL.createObjectURL(b) : undefined)), [blobs]);
  useEffect(() => {
    const timer = pending.get(urls);
    if (timer) clearTimeout(timer);
    return () => {
      pending.set(urls, setTimeout(() => urls.forEach((u) => u && URL.revokeObjectURL(u)), 1000));
    };
  }, [urls]);
  return urls;
}

/** The same for one blob. */
export function useObjectUrl(blob: Blob | null | undefined): string | undefined {
  const list = useMemo(() => [blob], [blob]);
  return useObjectUrls(list)[0];
}
