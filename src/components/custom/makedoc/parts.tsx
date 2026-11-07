'use client';
// Small pieces shared by the Make with Zee screens.
import { useEffect, useRef } from 'react';
import { BookOpen, CalendarDays, CheckSquare, FileQuestion, Layers, Mail, ShoppingCart, Wallet, WandSparkles, type LucideIcon } from 'lucide-react';
import type { DocKind, ZeeDoc } from '@/makedocs/types';
import { checklistDone, questionCount, totalMarks } from '@/makedocs/edit';
import type { Translate } from '@/i18n';

export const KIND_ICONS: Record<DocKind, LucideIcon> = {
  paper: FileQuestion,
  notes: BookOpen,
  todo: CheckSquare,
  expenses: Wallet,
  shopping: ShoppingCart,
  timetable: CalendarDays,
  letter: Mail,
  flashcards: Layers,
  other: WandSparkles,
};

/** "12 questions · 20 marks", "3 of 7 done", "5 parts" (the app's RecentList). */
export function docSummary(d: ZeeDoc, t: Translate): string {
  if (d.kind === 'paper') {
    const n = questionCount(d.blocks);
    const marks = totalMarks(d.blocks);
    const m = marks === 1 ? t('1 mark') : marks ? t('{n} marks', { n: marks }) : '';
    return [n === 1 ? t('1 question') : t('{count} questions', { count: n }), m].filter(Boolean).join(' · ');
  }
  const c = checklistDone(d.blocks);
  if (c.total) return t('{done} of {total} done', { done: c.done, total: c.total });
  return d.blocks.length === 1 ? t('1 part') : t('{count} parts', { count: d.blocks.length });
}

export const deletesIn = (expiresAt: number, t: Translate, now = Date.now()) => {
  const h = Math.max(0, Math.ceil((expiresAt - now) / 3_600_000));
  return h <= 1 ? t('Deletes in 1 h') : t('Deletes in {hoursLeft} h', { hoursLeft: h });
};

/** A textarea that grows with its text. */
export function AutoText({ value, onChange, className = '', ...rest }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} dir="auto" value={value} onChange={(e) => onChange(e.target.value)} className={`w-full resize-none bg-transparent focus:outline-none ${className}`} {...rest} />;
}

/** A plain one-line input in the editor's look. */
export function Field({ value, onChange, className = '', ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onChange: (v: string) => void }) {
  return (
    <input
      dir="auto"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`min-h-10 rounded-lg bg-fill px-3 text-[15px] border border-transparent focus:border-primary focus:bg-surface focus:outline-none ${className}`}
      {...rest}
    />
  );
}

/** Segmented choice (the app's Segmented). */
export function Choice<T extends string>({ label, value, options, onChange }: { label?: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <fieldset>
      {label && <legend className="text-[13px] font-semibold mb-2">{label}</legend>}
      <div className="flex flex-wrap gap-1 p-1 rounded-full bg-fill w-fit max-w-full" role="radiogroup">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            className={`px-4 min-h-9 rounded-full text-sm font-medium ${value === v ? 'bg-ink text-on-ink shadow-soft' : 'text-muted hover:text-text'}`}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** On / off switch with a label (the app's Toggle). */
export function Switch({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-4 cursor-pointer">
      <span className="flex-1">
        <span className="block text-[14px] font-medium">{label}</span>
        {sub && <span className="block text-[12px] text-secondary">{sub}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <span aria-hidden="true" className={`w-11 h-6 shrink-0 rounded-full p-0.5 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-primary ${value ? 'bg-primary' : 'bg-fill-strong'}`}>
        <span className={`block size-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5 rtl:-translate-x-5' : ''}`} />
      </span>
    </label>
  );
}

/** A picture as a JPEG data URL, at most `max` on its long side (EXIF rotation applied). */
export async function pictureDataUrl(file: File, max = 1400): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d')!;
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.82);
}
