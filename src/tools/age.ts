// Age calculator (new, no board; added on request), the maths (pure, unit-tested). Dates are plain { y, m, d }
// (m 1-12), counted as UTC days, so a time zone can never move a birthday by a day.
// Hijri dates use the tabular Islamic calendar (Kuwaiti algorithm): it can differ by a day from moon sighting.
import { MONTHS } from './months';
import { t } from '@/i18n';

export type YMD = { y: number; m: number; d: number };
export type Span = { years: number; months: number; days: number };

const DAY_MS = 86400000;

export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** Days since 1970-01-01. */
export const dayNumber = (a: YMD) => Math.round(Date.UTC(a.y, a.m - 1, a.d) / DAY_MS);
const fromDayNumber = (n: number): YMD => {
  const x = new Date(n * DAY_MS);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
};
export const compare = (a: YMD, b: YMD) => dayNumber(a) - dayNumber(b);

export function todayYMD(now = new Date()): YMD {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

/** A month later (or several), the day kept or moved to the month's last day (Jan 31 + 1 month = Feb 28). */
function addMonths(a: YMD, months: number): YMD {
  const total = a.y * 12 + (a.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m, d: Math.min(a.d, daysInMonth(y, m)) };
}

/** Whole years and months, then the days left since the last month-day ("monthiversary"). null if born after `on`. */
export function ageBetween(birth: YMD, on: YMD): Span | null {
  if (compare(on, birth) < 0) return null;
  let months = (on.y - birth.y) * 12 + (on.m - birth.m);
  if (on.d < birth.d) months--;
  const last = addMonths(birth, months);
  return { years: Math.floor(months / 12), months: months % 12, days: dayNumber(on) - dayNumber(last) };
}

/** The birthday in a year; Feb 29 is kept on Feb 28 in other years. */
const birthdayIn = (birth: YMD, y: number): YMD => ({ y, m: birth.m, d: birth.m === 2 && birth.d === 29 && !isLeap(y) ? 28 : birth.d });

export type NextBirthday = { date: YMD; turns: number; wait: Span; daysLeft: number; today: boolean };

export function nextBirthday(birth: YMD, on: YMD): NextBirthday {
  const thisYear = birthdayIn(birth, on.y);
  const today = compare(thisYear, on) === 0;
  const date = compare(thisYear, on) > 0 ? thisYear : birthdayIn(birth, on.y + 1);
  return { date, turns: date.y - birth.y, wait: ageBetween(on, date)!, daysLeft: dayNumber(date) - dayNumber(on), today };
}

export type Totals = { months: number; weeks: number; weekDays: number; days: number; hours: number; minutes: number };

export function totals(birth: YMD, on: YMD): Totals {
  const days = dayNumber(on) - dayNumber(birth);
  const span = ageBetween(birth, on) ?? { years: 0, months: 0, days: 0 };
  return { months: span.years * 12 + span.months, weeks: Math.floor(days / 7), weekDays: days % 7, days, hours: days * 24, minutes: days * 24 * 60 };
}

export const WEEKDAYS = () => [t('Sunday'), t('Monday'), t('Tuesday'), t('Wednesday'), t('Thursday'), t('Friday'), t('Saturday')];
export const weekday = (a: YMD) => WEEKDAYS()[new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay()];

/** "14 Mar 1999" */
export const dateLabel = (a: YMD) => `${a.d} ${MONTHS()[a.m - 1]} ${a.y}`;

/** 1234567 -> "1,234,567" */
export const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ---------- Zodiac ----------

/** Each sign from its first day; Capricorn runs over the new year. */
const SIGNS: { m: number; d: number; symbol: string; name: () => string }[] = [
  { m: 1, d: 20, symbol: '♒', name: () => t('Aquarius') },
  { m: 2, d: 19, symbol: '♓', name: () => t('Pisces') },
  { m: 3, d: 21, symbol: '♈', name: () => t('Aries') },
  { m: 4, d: 20, symbol: '♉', name: () => t('Taurus') },
  { m: 5, d: 21, symbol: '♊', name: () => t('Gemini') },
  { m: 6, d: 21, symbol: '♋', name: () => t('Cancer') },
  { m: 7, d: 23, symbol: '♌', name: () => t('Leo') },
  { m: 8, d: 23, symbol: '♍', name: () => t('Virgo') },
  { m: 9, d: 23, symbol: '♎', name: () => t('Libra') },
  { m: 10, d: 23, symbol: '♏', name: () => t('Scorpio') },
  { m: 11, d: 22, symbol: '♐', name: () => t('Sagittarius') },
  { m: 12, d: 22, symbol: '♑', name: () => t('Capricorn') },
];

export type Zodiac = { symbol: string; name: string; range: string };

export function zodiac(m: number, d: number): Zodiac {
  const key = m * 100 + d;
  let i = SIGNS.length - 1; // before Jan 20: Capricorn
  SIGNS.forEach((s, k) => {
    if (key >= s.m * 100 + s.d) i = k;
  });
  const s = SIGNS[i];
  const next = SIGNS[(i + 1) % SIGNS.length];
  const end = fromDayNumber(dayNumber({ y: 2001, m: next.m, d: next.d }) - 1); // a common year
  const months = MONTHS();
  return { symbol: s.symbol, name: s.name(), range: `${months[s.m - 1]} ${s.d} – ${months[end.m - 1]} ${end.d}` };
}

// ---------- Hijri ----------

export const HIJRI_MONTHS = () => [
  t('Muharram'), t('Safar'), t('Rabi al-Awwal'), t('Rabi al-Thani'), t('Jumada al-Awwal'), t('Jumada al-Thani'),
  t('Rajab'), t('Shaban'), t('Ramadan'), t('Shawwal'), t('Dhul Qadah'), t('Dhul Hijjah'),
];

/** Tabular Islamic calendar: odd months 30 days, even 29, Dhul Hijjah 30 in the 11 leap years of each 30. */
export const hijriMonthDays = (y: number, m: number) => (m % 2 === 1 || (m === 12 && (11 * y + 14) % 30 < 11) ? 30 : 29);

export function toHijri(a: YMD): YMD {
  const jd = dayNumber(a) + 2440588; // Julian day number
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const m = Math.floor((24 * l) / 709);
  const d = l - Math.floor((709 * m) / 24);
  return { y: 30 * n + j - 30, m, d };
}

/** Age counted in Hijri years, months and days (a Hijri year is about 11 days shorter). */
export function hijriAge(birth: YMD, on: YMD): Span | null {
  if (compare(on, birth) < 0) return null;
  const b = toHijri(birth);
  const o = toHijri(on);
  let years = o.y - b.y;
  let months = o.m - b.m;
  let days = o.d - b.d;
  if (days < 0) {
    months--;
    const pm = o.m === 1 ? 12 : o.m - 1;
    days += hijriMonthDays(o.m === 1 ? o.y - 1 : o.y, pm);
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  return { years, months, days: Math.max(0, days) };
}

export const hijriLabel = (h: YMD) => `${h.d} ${HIJRI_MONTHS()[h.m - 1]} ${h.y}`;

// ---------- Text ----------

export const yearsText = (n: number) => (n === 1 ? t('1 year') : t('{count} years', { count: n }));
export const monthsText = (n: number) => (n === 1 ? t('1 month') : t('{count} months', { count: n }));
export const daysText = (n: number) => (n === 1 ? t('1 day') : t('{count} days', { count: n }));

/** "25 years, 3 months, 12 days" (zero parts left out; "0 days" when all are zero). */
export function spanText(s: Span): string {
  const parts = [s.years && yearsText(s.years), s.months && monthsText(s.months), s.days && daysText(s.days)].filter(Boolean) as string[];
  return parts.length ? parts.join(', ') : daysText(0);
}

/** What Copy and Share send. */
export function ageSummary(birth: YMD, on: YMD): string {
  const age = ageBetween(birth, on);
  if (!age) return '';
  const next = nextBirthday(birth, on);
  const tot = totals(birth, on);
  const sign = zodiac(birth.m, birth.d);
  const hAge = hijriAge(birth, on);
  return [
    t('Age: {value}', { value: spanText(age) }),
    t('Born: {value}', { value: `${weekday(birth)}, ${dateLabel(birth)}` }),
    t('Next birthday: {value}', { value: `${next.today ? daysText(0) : spanText(next.wait)} (${weekday(next.date)}, ${dateLabel(next.date)})` }),
    t('Total: {days} days, {weeks} weeks, {months} months', { days: grouped(tot.days), weeks: grouped(tot.weeks), months: grouped(tot.months) }),
    t('Hijri: born {date}, age {age}', { date: hijriLabel(toHijri(birth)), age: hAge ? spanText(hAge) : '' }),
    t('Zodiac: {value}', { value: `${sign.symbol} ${sign.name}` }),
  ].join('\n');
}
