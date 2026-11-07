'use client';
// Before | After of one picture (the app's steps/BeforeAfter): the After image over the Before, cut at a line you drag
// (or move with the arrow keys). Used by Remove watermark, later Compress's preview.
import { useRef, useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import { useT } from '@/i18n/client';

export function BeforeAfter({ before, after, aspect, busy }: { before?: string; after?: string; aspect: number; busy?: boolean }) {
  const t = useT();
  const [split, setSplit] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const moveTo = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setSplit(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <figure className="w-full flex flex-col items-center gap-2" aria-label={t('Before and after preview')}>
      <div
        ref={box}
        className="relative w-full max-w-md bg-paper rounded-lg shadow-raised overflow-hidden touch-none select-none cursor-ew-resize"
        style={{ aspectRatio: String(aspect) }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          moveTo(e.clientX);
        }}
        onPointerMove={(e) => e.buttons && moveTo(e.clientX)}
        dir="ltr"
      >
        {/* eslint-disable @next/next/no-img-element -- pages drawn in the browser */}
        {before && <img src={before} alt={t('Before')} draggable={false} className="absolute inset-0 size-full object-contain" />}
        {after && <img src={after} alt={t('After')} draggable={false} className="absolute inset-0 size-full object-contain" style={{ clipPath: `inset(0 0 0 ${split}%)` }} />}
        {/* eslint-enable @next/next/no-img-element */}
        <span className="absolute top-2 left-2 text-[11px] font-semibold rounded-full bg-black/60 text-white px-2 py-0.5">{t('Before')}</span>
        <span className="absolute top-2 right-2 text-[11px] font-semibold rounded-full bg-black/60 text-white px-2 py-0.5">{t('After')}</span>
        <div className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: `${split}%` }} aria-hidden="true">
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-9 rounded-full bg-surface shadow-raised grid place-items-center text-primary">
            <MoveHorizontal size={18} />
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(split)}
          onChange={(e) => setSplit(Number(e.target.value))}
          aria-label={t('Drag the line to compare')}
          className="sr-only"
        />
        {busy && <div className="absolute inset-0 bg-surface/50 animate-pulse" aria-hidden="true" />}
      </div>
      <figcaption className="text-[12px] text-secondary">{t('Drag the line to compare')}</figcaption>
    </figure>
  );
}
