'use client';
// Age calculator (the app's custom/age/AgeStep for the web): date of birth (remembered in this browser) and "Age on"
// (today unless changed), then the age, next birthday, totals, Hijri age and zodiac sign, all live. Copy / Share send
// the app's text summary. The maths: src/tools/age.ts (the app's). Results only render in the browser (they need the
// saved date), so the browser-only t() inside age.ts is safe here.
import { useId, useState, useSyncExternalStore } from 'react';
import { Cake, Copy, Gift, Moon, Share2, Sparkles, type LucideIcon } from 'lucide-react';
import { useT } from '@/i18n/client';
import { useStored } from '@/lib/useStored';
import {
  ageBetween, ageSummary, compare, dateLabel, daysText, grouped, hijriAge, hijriLabel, nextBirthday, spanText, toHijri,
  todayYMD, totals, weekday, zodiac, type YMD,
} from '@/tools/age';
import { Button } from '../ui/Button';

const toInput = (a: YMD | null) => (a ? `${a.y}-${String(a.m).padStart(2, '0')}-${String(a.d).padStart(2, '0')}` : '');
const fromInput = (s: string): YMD | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};

/** Today, read in the browser only (the page is prerendered, so the server can't know the visitor's date). */
let cachedToday: YMD | null = null;
const browserToday = () => {
  const now = todayYMD();
  if (!cachedToday || compare(cachedToday, now) !== 0) cachedToday = now;
  return cachedToday;
};
const noSubscribe = () => () => {};

export function AgeCalculator() {
  const today = useSyncExternalStore(noSubscribe, browserToday, () => null);
  if (!today) return <div className="card p-8 min-h-48" aria-busy="true" />;
  return <AgeCalculatorOn today={today} />;
}

function AgeCalculatorOn({ today }: { today: YMD }) {
  const t = useT();
  const [birth, setBirth] = useStored<YMD | null>('age.birth', null);
  const [on, setOn] = useState<YMD>(today);
  const [copied, setCopied] = useState(false);
  const isToday = compare(on, today) === 0;
  const age = birth ? ageBetween(birth, on) : null;
  const summary = birth && age ? ageSummary(birth, on) : '';

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: summary });
      else await copy();
    } catch {
      // closed the share sheet
    }
  };
  const copy = async () => {
    await navigator.clipboard?.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr] items-start">
      <section className="card p-5 flex flex-col gap-5">
        <DateInput label={t('Date of birth')} value={birth} onChange={setBirth} max={toInput(today)} />
        <DateInput
          label={t('Age on')}
          value={on}
          onChange={(v) => v && setOn(v)}
          accessory={
            !isToday && (
              <button type="button" onClick={() => setOn(today)} className="text-sm font-semibold text-primary hover:underline">
                {t('Today')}
              </button>
            )
          }
        />
        {summary && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={copy} className="flex-1">
              <Copy size={18} aria-hidden="true" className="inline me-2" />
              {copied ? t('Copied') : t('Copy')}
            </Button>
            <Button onClick={share} className="flex-1 !min-h-12">
              <Share2 size={18} aria-hidden="true" className="inline me-2" />
              {t('Share')}
            </Button>
          </div>
        )}
      </section>

      {!birth ? (
        <div className="card p-8 flex flex-col items-center text-center gap-2">
          <Cake size={36} className="text-category" aria-hidden="true" />
          <p className="text-[17px] font-semibold">{t('Choose your date of birth')}</p>
          <p className="text-[15px] text-secondary">{t('Your exact age, next birthday and Hijri age show here.')}</p>
        </div>
      ) : !age ? (
        <p className="card p-5 bg-warning-soft text-warning" role="alert">
          {t('Date of birth must be before the date to calculate on.')}
        </p>
      ) : (
        <Results birth={birth} on={on} />
      )}
    </div>
  );
}

function Results({ birth, on }: { birth: YMD; on: YMD }) {
  const t = useT();
  const age = ageBetween(birth, on)!;
  const next = nextBirthday(birth, on);
  const tot = totals(birth, on);
  const hAge = hijriAge(birth, on);
  const sign = zodiac(birth.m, birth.d);
  return (
    <div className="flex flex-col gap-4" aria-live="polite">
      <div className="lime-fill rounded-card p-6 flex flex-col items-center gap-3 text-center">
        <p className="text-[13px] font-semibold text-ink-muted">{t('Your age')}</p>
        <div className="grid grid-cols-3 gap-4 w-full max-w-md">
          <Big value={age.years} label={t('Years')} />
          <Big value={age.months} label={t('Months')} />
          <Big value={age.days} label={t('Days')} />
        </div>
        <p className="text-[13px] text-ink-muted">{next.today ? t('Happy birthday! 🎂') : t('Born on a {day}', { day: weekday(birth) })}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Info icon={Gift} title={t('Next birthday')}>
          <p className="text-[17px] font-semibold">{next.today ? t('Today!') : t('in {time}', { time: spanText(next.wait) })}</p>
          <p className="text-[13px] text-secondary">{`${weekday(next.date)}, ${dateLabel(next.date)} · ${t('Turns {count}', { count: next.turns })}`}</p>
          {!next.today && <p className="text-[13px] text-secondary">{daysText(next.daysLeft)}</p>}
        </Info>
        <Info icon={Moon} title={t('Hijri (Islamic)')}>
          <p className="text-[17px] font-semibold">{hAge ? spanText(hAge) : '-'}</p>
          <p className="text-[13px] text-secondary">{t('Born {date}', { date: hijriLabel(toHijri(birth)) })}</p>
          <p className="text-[12px] text-secondary">{t('Calculated, may differ by a day from moon sighting.')}</p>
        </Info>
      </div>
      <section className="card p-5">
        <h2 className="text-[13px] font-semibold mb-3">{t('Total')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat value={grouped(tot.months)} label={t('Months')} />
          <Stat value={grouped(tot.weeks)} label={tot.weekDays ? t('Weeks + {days}', { days: daysText(tot.weekDays) }) : t('Weeks')} />
          <Stat value={grouped(tot.days)} label={t('Days')} />
          <Stat value={grouped(tot.hours)} label={t('Hours')} />
          <Stat value={grouped(tot.minutes)} label={t('Minutes')} />
        </div>
      </section>
      <Info icon={Sparkles} title={t('Zodiac sign')}>
        <div className="flex items-center gap-3">
          <span className="text-[32px] text-category" aria-hidden="true">{sign.symbol}</span>
          <div>
            <p className="text-[17px] font-semibold">{sign.name}</p>
            <p className="text-[13px] text-secondary">{sign.range}</p>
          </div>
        </div>
      </Info>
    </div>
  );
}

function DateInput({ label, value, onChange, max, accessory }: { label: string; value: YMD | null; onChange: (v: YMD | null) => void; max?: string; accessory?: React.ReactNode }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center mb-2">
        <label htmlFor={id} className="flex-1 text-[13px] font-semibold">
          {label}
        </label>
        {accessory}
      </div>
      <input
        id={id}
        type="date"
        value={toInput(value)}
        max={max}
        min="1900-01-01"
        onChange={(e) => onChange(fromInput(e.target.value))}
        className="w-full min-h-13 rounded-tile bg-surface border border-line-strong px-4 text-[15px] focus:outline-2 focus:outline-primary"
      />
    </div>
  );
}

function Big({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-[44px] leading-none font-semibold tracking-tight">{value}</p>
      <p className="text-[13px] font-medium text-ink-muted mt-1">{label}</p>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-tile bg-fill p-3">
      <p className="text-[19px] font-semibold">{value}</p>
      <p className="text-[12px] text-secondary">{label}</p>
    </div>
  );
}

function Info({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 flex gap-4 items-start">
      <span className="size-11 shrink-0 rounded-tile bg-category-tint text-category grid place-items-center">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <h2 className="text-[13px] font-semibold text-secondary">{title}</h2>
        {children}
      </div>
    </section>
  );
}
