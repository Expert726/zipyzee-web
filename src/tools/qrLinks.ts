/* eslint-disable no-bitwise -- base64 and colour maths work on bits */
// Copied from the app (src/tools/qrLinks.ts); keep the two the same.
// Links QR (added on request): one QR code for several links (a shop's Facebook, Instagram, TikTok, WhatsApp...).
// The links travel inside the code's own URL, after "#": https://<host>/l#<base64url of the JSON>. The page
// (hosting/links.html) reads them in the browser, so they never reach a server: free, no database, any phone's camera
// works. ZipyZee's own scanner shows the list itself (parseCode kind 'links'). Pure and unit-tested.
import { INVITE_URL } from '@/config';
import { t } from '@/i18n';

export type LinkRow = { label: string; url: string };
export type LinksPage = { title: string; note?: string; links: LinkRow[] };

export const MAX_LINKS = 10;
export const MAX_TITLE = 60;
export const MAX_NOTE = 120;
export const MAX_URL = 500;

/** The page's address; the links come after "#". */
export const LINKS_BASE = `${INVITE_URL}/l`;

export type Platform =
  | 'facebook' | 'instagram' | 'tiktok' | 'whatsapp' | 'youtube' | 'x' | 'linkedin' | 'snapchat' | 'telegram' | 'email' | 'phone' | 'website';

const HOSTS: [RegExp, Platform][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me|fb\.watch)$/, 'facebook'],
  [/(^|\.)(instagram\.com|instagr\.am)$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, 'whatsapp'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)(x\.com|twitter\.com)$/, 'x'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)snapchat\.com$/, 'snapchat'],
  [/(^|\.)(t\.me|telegram\.me|telegram\.org)$/, 'telegram'],
];

/** The platform's name as people write it ("Facebook"), used as a row's label when none is typed. */
export const platformName = (p: Platform): string =>
  p === 'facebook' ? 'Facebook' : p === 'instagram' ? 'Instagram' : p === 'tiktok' ? 'TikTok' : p === 'whatsapp' ? 'WhatsApp'
    : p === 'youtube' ? 'YouTube' : p === 'x' ? 'X' : p === 'linkedin' ? 'LinkedIn' : p === 'snapchat' ? 'Snapchat'
      : p === 'telegram' ? 'Telegram' : p === 'email' ? t('Email') : p === 'phone' ? t('Phone') : t('Website');

/**
 * A link people may put in the code: http(s), mailto: or tel: only (never javascript: or data:). A bare
 * "www.shop.com" or "shop.com/menu" gets https://. Returns '' for anything else.
 */
export function safeUrl(input: string): string {
  const s = input.trim();
  if (!s || s.length > MAX_URL || /\s/.test(s)) return '';
  if (/^(https?:\/\/)[^\s/$.?#].[^\s]*$/i.test(s)) return s;
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(s)) return s;
  if (/^tel:\+?[\d\s()-]{5,}$/i.test(s)) return s;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s)) return '';
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(s)) return `mailto:${s}`;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return `https://${s}`;
  return '';
}

export function platformOf(url: string): Platform {
  if (/^mailto:/i.test(url)) return 'email';
  if (/^tel:/i.test(url)) return 'phone';
  const host = /^https?:\/\/([^/?#:]+)/i.exec(url)?.[1]?.toLowerCase() ?? '';
  return HOSTS.find(([re]) => re.test(host))?.[1] ?? 'website';
}

/**
 * A pasted block to a page: "Facebook: https://...", "Instagram - https://..." or a bare link per line. The first
 * line without a link is the title, any other plain line the note.
 */
export function parsePasted(text: string): LinksPage {
  const page: LinksPage = { title: '', links: [] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const found = /(https?:\/\/\S+|www\.\S+|mailto:\S+|tel:[+\d][\d\s()-]+)/i.exec(line);
    const url = found ? safeUrl(found[1].replace(/[),.;]+$/, '')) : '';
    if (url) {
      const label = line.slice(0, found!.index).replace(/[\s:|\-–—=>]+$/, '').trim();
      if (page.links.length < MAX_LINKS) page.links.push({ label: label.slice(0, 40) || platformName(platformOf(url)), url });
    } else if (!page.title) {
      page.title = line.slice(0, MAX_TITLE);
    } else if (!page.note) {
      page.note = line.slice(0, MAX_NOTE);
    }
  }
  return page;
}

/** The rows that go in the code: links that pass safeUrl, labelled (by platform when the label is empty). */
export function cleanLinks(rows: LinkRow[]): LinkRow[] {
  return rows
    .map((r) => ({ label: r.label.trim().slice(0, 40), url: safeUrl(r.url) }))
    .filter((r) => r.url)
    .slice(0, MAX_LINKS)
    .map((r) => ({ label: r.label || platformName(platformOf(r.url)), url: r.url }));
}

// ---------- base64url of UTF-8 (the same code runs in hosting/links.html, so both read Urdu the same) ----------

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}

export function toBase64Url(s: string): string {
  const b = utf8(s);
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '') + (i + 2 < b.length ? B64[n & 63] : '');
  }
  return out;
}

export function fromBase64Url(s: string): string | null {
  const bytes: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buf >> bits) & 255);
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b0 = bytes[i];
    const need = b0 < 0x80 ? 0 : b0 >= 0xf0 ? 3 : b0 >= 0xe0 ? 2 : b0 >= 0xc0 ? 1 : -1;
    if (need < 0 || i + need >= bytes.length + (need ? 0 : 1)) return null;
    let c = need ? b0 & (0x3f >> need) : b0;
    for (let k = 1; k <= need; k++) c = (c << 6) | (bytes[i + k] & 63);
    out += String.fromCodePoint(c);
    i += need + 1;
  }
  return out;
}

/** The code's text: the page address with the links after "#" (short keys keep the code small). */
export function linksUrl(page: LinksPage): string {
  const links = cleanLinks(page.links);
  if (!links.length) return '';
  const data: unknown[] = [page.title.trim().slice(0, MAX_TITLE), (page.note ?? '').trim().slice(0, MAX_NOTE), links.map((l) => [l.label, l.url])];
  return `${LINKS_BASE}#${toBase64Url(JSON.stringify(data))}`;
}

/** A scanned code back to its page, or null when it isn't a links code (or is broken). Links are checked again. */
export function readLinksUrl(raw: string): LinksPage | null {
  const at = raw.indexOf('#');
  if (at < 0 || raw.slice(0, at).replace(/\/$/, '') !== LINKS_BASE) return null;
  const json = fromBase64Url(raw.slice(at + 1));
  if (!json) return null;
  try {
    const [title, note, rows] = JSON.parse(json) as [unknown, unknown, unknown];
    if (!Array.isArray(rows)) return null;
    const links = cleanLinks(rows.filter((r): r is [string, string] => Array.isArray(r) && typeof r[0] === 'string' && typeof r[1] === 'string').map(([label, url]) => ({ label, url })));
    if (!links.length) return null;
    return { title: typeof title === 'string' ? title.slice(0, MAX_TITLE) : '', note: typeof note === 'string' && note ? note.slice(0, MAX_NOTE) : undefined, links };
  } catch {
    return null;
  }
}

/** "Copy all": the page as text, one "Label: link" per line. */
export const linksText = (page: LinksPage) => [page.title, page.note, ...page.links.map((l) => `${l.label}: ${l.url}`)].filter(Boolean).join('\n');
