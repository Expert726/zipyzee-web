'use client';
// The "finding the subject" look over a photo (Background remover, Change background): the photo dimmed, small
// four-point sparkles twinkling at scattered spots, a soft light sweeping down, and the status in a pill.
// Keyframes twinkle / sweep in globals.css; still under Reduce motion.
import { Loader2 } from 'lucide-react';

/** Scattered spots (% of the photo) with their own size and delay, so it never looks like a grid. */
const SPOTS = [
  [18, 22, 14, 0], [62, 14, 10, 0.5], [80, 38, 16, 1.1], [34, 46, 12, 0.3], [52, 64, 18, 1.4], [14, 72, 10, 0.8],
  [72, 78, 12, 0.2], [44, 28, 9, 1.7], [88, 60, 10, 0.9], [26, 88, 14, 1.2], [58, 42, 11, 2], [8, 44, 9, 1.5],
  [68, 92, 9, 0.6], [38, 8, 12, 1.9],
] as const;

function Sparkle({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" fill="#E9F27A" />
    </svg>
  );
}

export function FindingSparkles({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-lg bg-black/45" role="status" aria-live="polite">
      <span aria-hidden="true" className="absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-white/15 to-transparent" style={{ animation: 'sweep 2.4s ease-in-out infinite' }} />
      {SPOTS.map(([x, y, size, delay], i) => (
        <span key={i} aria-hidden="true" className="absolute drop-shadow-[0_0_6px_rgba(233,242,122,0.8)]" style={{ left: `${x}%`, top: `${y}%`, animation: `twinkle 1.8s ease-in-out ${delay}s infinite`, opacity: 0 }}>
          <Sparkle size={size} />
        </span>
      ))}
      <p className="absolute bottom-3 inset-x-3 mx-auto w-fit max-w-full flex items-center gap-2 rounded-full bg-black/60 text-white text-[13px] font-medium px-3.5 py-1.5 text-center">
        <Loader2 size={15} className="animate-spin shrink-0" aria-hidden="true" />
        {label}
      </p>
    </div>
  );
}
