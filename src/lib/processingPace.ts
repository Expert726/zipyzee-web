// The processing screen's pace (MIN_PROCESSING_MS in config.ts): the progress shown is the real progress, but never
// ahead of an even sweep across the minimum time, so a 1-second job still fills the ring over ~10 seconds. Pure, tested.

/** Progress to show: the real one, held back to the share of the minimum time that has passed. */
export function shownProgress(real: number, elapsedMs: number, minMs: number): number {
  if (minMs <= 0) return real;
  return Math.max(0, Math.min(real, elapsedMs / minMs));
}

/** How much longer to stay on the processing screen once the work is done. */
export const timeLeft = (elapsedMs: number, minMs: number) => Math.max(0, minMs - elapsedMs);

/** Waits `ms`, but stops early (false) when cancelled. */
export async function waitUnlessCancelled(ms: number, signal: { cancelled: boolean }): Promise<boolean> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (signal.cancelled) return false;
    await new Promise((r) => setTimeout(r, Math.min(100, end - Date.now())));
  }
  return !signal.cancelled;
}
