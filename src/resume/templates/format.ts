// Small pure helpers for the resume templates: escaping, dates, initials, contact line, colours.
import type { Personal } from '../types';

/** Text inside elements (same as the reference's esc()). */
export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Text inside a double-quoted attribute (photo src). */
export const escAttr = (s: string) => esc(s).replace(/"/g, '&quot;');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2021' -> { year: '2021' }, '2025-06' -> { year: '2025', month: 'Jun' }; anything else is kept as written. */
function parse(d: string): { year: string; month?: string; raw?: string } | null {
  const s = d.trim();
  if (!s) return null;
  const m = /^(\d{4})(?:-(\d{1,2}))?$/.exec(s);
  if (!m) return { year: '', raw: s };
  const month = m[2] ? MONTHS[Number(m[2]) - 1] : undefined;
  return { year: m[1], month };
}

const label = (d: NonNullable<ReturnType<typeof parse>>) => d.raw ?? (d.month ? `${d.month} ${d.year}` : d.year);

/**
 * The date range as the templates show it: "2021 – Present", "2018 – 2021", "Jun – Aug 2025" (months in one year),
 * "Jun 2024 – Mar 2025", or a single date ("2019").
 */
export function formatDates(start: string, end: string, current: boolean): string {
  const s = parse(start);
  const e = current ? null : parse(end);
  if (s && !current && e && s.month && e.month && s.year === e.year && !s.raw && !e.raw) return `${s.month} – ${e.month} ${e.year}`;
  const from = s ? label(s) : '';
  const to = current ? 'Present' : e ? label(e) : '';
  return from && to ? `${from} – ${to}` : from || to;
}

const TITLES = new Set(['dr', 'mr', 'mrs', 'ms', 'miss', 'prof', 'engr', 'eng', 'sir']);

/** "Hamza Ali" -> "HA", "Dr. Nadia Hussain" -> "NH" (titles skipped). */
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter((w) => w && !TITLES.has(w.replace(/\./g, '').toLowerCase()));
  if (!words.length) return '';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Email, phone, city, link: the ones filled in, in that order (the personas' contact line). */
export const contactList = (p: Personal) => [p.email, p.phone, p.city, p.link].map((c) => c.trim()).filter(Boolean);

/** '#RRGGBB' + alpha hex (the reference's TINT). */
export const tint = (hex: string, alpha = '1A') => `${hex}${alpha}`;

/** Mixes a colour with black (amount 0-1): a dark shade of the accent for dark sidebars. */
export function shade(hex: string, amount: number): string {
  const ch = (i: number) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount)).toString(16).padStart(2, '0');
  return `#${ch(1)}${ch(3)}${ch(5)}`.toUpperCase();
}
