'use client';
// The processing screen, animated like the app's ProcessingStep: soft ripples spread out from the ring, the tool's
// icon gently breathes, the ring and the bar glide to each new value with a light shine sweeping along the bar, and
// each new step line fades in. Rotating tips below. With "reduce motion" on, nothing moves (motion-reduce:*).
// The ring follows the real work but sweeps evenly over at least MIN_PROCESSING_MS (processingPace.ts).
import { useEffect, useState } from 'react';
import { BadgeCheck, ShieldCheck, Smartphone, Zap, type LucideIcon } from 'lucide-react';
import { useT } from '@/i18n/client';
import type { Tool } from '@/tools/types';
import { Button } from '../ui/Button';

const TIPS: { icon: LucideIcon; text: string }[] = [
  { icon: ShieldCheck, text: 'Your files are processed in your browser and never uploaded.' },
  { icon: BadgeCheck, text: 'Free, no watermark' },
  { icon: Zap, text: 'No sign-up' },
  { icon: Smartphone, text: 'ZipyZee is on Android too, with even more tools.' },
];
const TIP_MS = 3200;
const R = 70;
const C = 2 * Math.PI * R;
const GLIDE = 'duration-[450ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] motion-reduce:transition-none';

export function Processing({ tool, progress, label, onCancel }: { tool: Tool; progress: number; label: string; onCancel: () => void }) {
  const t = useT();
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTip((i) => (i + 1) % TIPS.length), TIP_MS);
    return () => clearInterval(timer);
  }, []);
  const Icon = tool.icon;
  const pct = Math.round(progress * 100);
  const Tip = TIPS[tip].icon;
  return (
    <div className="card p-8 sm:p-12 flex flex-col items-center text-center gap-6 max-w-2xl mx-auto overflow-hidden" role="status" aria-live="polite" aria-busy="true">
      <div className="relative size-48 grid place-items-center">
        {/* two soft circles that keep spreading out from the ring and fading */}
        {[0, 1].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className="absolute inset-4 rounded-full bg-category-tint opacity-0 animate-[ripple_2.2s_ease-out_infinite] motion-reduce:hidden"
            style={{ animationDelay: `${i * 1.1}s` }}
          />
        ))}
        <svg viewBox="0 0 160 160" className="relative size-40 -rotate-90" aria-hidden="true">
          <circle cx="80" cy="80" r={R} fill="var(--surface)" stroke="var(--fill-strong)" strokeWidth="9" />
          <circle cx="80" cy="80" r={R} fill="none" stroke="var(--category)" strokeWidth="9" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} className={`transition-[stroke-dashoffset] ${GLIDE}`} />
        </svg>
        {/* the icon breathes */}
        <span className="absolute size-16 rounded-[20px] bg-category-tint text-category grid place-items-center animate-[breathe_1.8s_ease-in-out_infinite] motion-reduce:animate-none">
          <Icon size={30} aria-hidden="true" />
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[22px] font-semibold tracking-tight">{t(tool.processing)}</p>
        <p key={label} className="text-[15px] text-secondary min-h-6 animate-[fade_0.3s_ease-out] motion-reduce:animate-none">
          {label}
        </p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-1.5">
        <div className="h-2.5 rounded-full bg-fill-strong overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('Progress')}>
          <div className={`relative h-full rounded-full bg-category overflow-hidden transition-[width] ${GLIDE}`} style={{ width: `${Math.max(4, pct)}%` }}>
            {/* a light band sweeping along the filled part */}
            <span aria-hidden="true" className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[shine_1.4s_ease-in-out_infinite] motion-reduce:hidden" />
          </div>
        </div>
        <p className="text-[12px] font-medium text-secondary tabular-nums">{pct}%</p>
      </div>

      <p key={tip} className="flex items-center gap-2 text-[14px] text-muted rounded-full bg-fill px-4 py-2 animate-[fade_0.4s_ease-out] motion-reduce:animate-none">
        <Tip size={16} className="text-brand shrink-0" aria-hidden="true" />
        {t(TIPS[tip].text)}
      </p>
      <Button variant="secondary" onClick={onCancel}>
        {t('Cancel')}
      </Button>
    </div>
  );
}
