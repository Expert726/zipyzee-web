'use client';
import { useCallback, useEffect, useState } from 'react';

/**
 * A value kept in this browser (localStorage), for per-visitor conveniences only: calculator mode and history, the
 * age calculator's date of birth. Starts at `initial` (same on the server and the first paint), then loads.
 */
export function useStored<T>(key: string, initial: T): [T, (v: T | ((cur: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`zz.${key}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- loading the saved value once after the first paint
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      // private mode or bad data: keep the initial value
    }
  }, [key]);
  const set = useCallback(
    (v: T | ((cur: T) => T)) =>
      setValue((cur) => {
        const next = typeof v === 'function' ? (v as (c: T) => T)(cur) : v;
        try {
          localStorage.setItem(`zz.${key}`, JSON.stringify(next));
        } catch {
          // not saved, still works for this visit
        }
        return next;
      }),
    [key],
  );
  return [value, set];
}
