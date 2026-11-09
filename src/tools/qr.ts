// Copied from the app (src/tools/qr.ts); keep the two the same.
import { t } from '@/i18n';
import { linksUrl, readLinksUrl, type LinkRow, type LinksPage } from './qrLinks';
// QR and barcode contents — design/QrResult.dc.html (scan result sheet) and FlowQrScanner.dc.html (Create).
// Pure: parse what the camera read into a typed result, and build the text to encode from the Create form.

export type ScanKind = 'link' | 'links' | 'text' | 'wifi' | 'contact' | 'phone' | 'email' | 'product';

export type WifiInfo = { ssid: string; password: string; security: string; hidden: boolean };
export type ContactInfo = { name: string; phones: string[]; emails: string[]; org?: string; url?: string };

export type ScanResult =
  | { kind: 'link'; raw: string; url: string }
  /** a Links QR (src/tools/qrLinks.ts): several links in one code */
  | { kind: 'links'; raw: string; page: LinksPage }
  | { kind: 'text'; raw: string; text: string }
  | { kind: 'wifi'; raw: string; wifi: WifiInfo }
  | { kind: 'contact'; raw: string; contact: ContactInfo }
  | { kind: 'phone'; raw: string; phone: string }
  | { kind: 'email'; raw: string; email: string }
  | { kind: 'product'; raw: string; code: string };

/** Splits "A:1;B:2;;" on unescaped `;` and unescapes \; \, \: \\ (WIFI: and MECARD: syntax). */
function fields(body: string): [string, string][] {
  const out: [string, string][] = [];
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '\\' && i + 1 < body.length) {
      cur += body[++i];
    } else if (c === ';') {
      if (cur) out.push(splitKey(cur));
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur) out.push(splitKey(cur));
  return out;
}

const splitKey = (s: string): [string, string] => {
  const i = s.indexOf(':');
  return i < 0 ? [s.toUpperCase(), ''] : [s.slice(0, i).toUpperCase(), s.slice(i + 1)];
};

function parseWifi(raw: string): WifiInfo {
  const f = new Map(fields(raw.slice(5)));
  return {
    ssid: f.get('S') ?? '',
    password: f.get('P') ?? '',
    security: (f.get('T') ?? '').toUpperCase() || (f.get('P') ? 'WPA' : 'nopass'),
    hidden: (f.get('H') ?? '').toLowerCase() === 'true',
  };
}

function parseMecard(raw: string): ContactInfo {
  const all = fields(raw.slice(7));
  const get = (k: string) => all.filter(([key]) => key === k).map(([, v]) => v).filter(Boolean);
  // MECARD names are "Last,First"
  const name = (get('N')[0] ?? '').split(',').map((s) => s.trim()).filter(Boolean).reverse().join(' ');
  return { name, phones: get('TEL'), emails: get('EMAIL'), org: get('ORG')[0], url: get('URL')[0] };
}

function parseVcard(raw: string): ContactInfo {
  // unfold continuation lines, then read "KEY;params:value"
  const lines = raw.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const c: ContactInfo = { name: '', phones: [], emails: [] };
  let structured = '';
  for (const line of lines) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).split(';')[0].toUpperCase();
    const value = line.slice(i + 1).replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ').trim();
    if (!value) continue;
    if (key === 'FN') c.name = value;
    else if (key === 'N') structured = value.split(';').slice(0, 2).reverse().filter(Boolean).join(' ');
    else if (key === 'TEL') c.phones.push(value);
    else if (key === 'EMAIL') c.emails.push(value);
    else if (key === 'ORG') c.org = value.split(';')[0];
    else if (key === 'URL') c.url = value;
  }
  if (!c.name) c.name = structured;
  return c;
}

const URL_RE = /^(https?:\/\/|www\.)\S+$/i;

/** What a scanned code holds. `product` = a retail barcode (EAN/UPC: 8, 12 or 13 digits). */
export function parseCode(raw: string, isProductFormat = false): ScanResult {
  const s = raw.trim();
  const upper = s.toUpperCase();
  if (upper.startsWith('WIFI:')) return { kind: 'wifi', raw, wifi: parseWifi(s) };
  if (upper.startsWith('MECARD:')) return { kind: 'contact', raw, contact: parseMecard(s) };
  if (upper.startsWith('BEGIN:VCARD')) return { kind: 'contact', raw, contact: parseVcard(s) };
  if (upper.startsWith('TEL:')) return { kind: 'phone', raw, phone: s.slice(4) };
  if (upper.startsWith('MAILTO:')) return { kind: 'email', raw, email: s.slice(7).split('?')[0] };
  if (upper.startsWith('MATMSG:')) {
    const to = new Map(fields(s.slice(7))).get('TO');
    if (to) return { kind: 'email', raw, email: to };
  }
  const page = readLinksUrl(s);
  if (page) return { kind: 'links', raw, page };
  if (URL_RE.test(s)) return { kind: 'link', raw, url: upper.startsWith('WWW.') ? `https://${s}` : s };
  if (isProductFormat || /^\d{8}$|^\d{12,13}$/.test(s)) return { kind: 'product', raw, code: s };
  return { kind: 'text', raw, text: s };
}

/** Label above the value in the result sheet. */
export const SCAN_LABEL: Record<ScanKind, string> = {
  get link() { return t('Website link'); },
  get links() { return t('Links'); },
  get text() { return t('Text'); },
  get wifi() { return t('Wi-Fi network'); },
  get contact() { return t('Contact'); },
  get phone() { return t('Phone number'); },
  get email() { return t('Email address'); },
  get product() { return t('Barcode'); },
};

/** The one line shown under the label. */
export function scanValue(r: ScanResult): string {
  switch (r.kind) {
    case 'link':
      return r.url;
    case 'links':
      return r.page.title || t('{count} links', { count: r.page.links.length });
    case 'text':
      return r.text;
    case 'wifi':
      return r.wifi.ssid;
    case 'contact':
      return r.contact.name || r.contact.phones[0] || r.contact.emails[0] || '';
    case 'phone':
      return r.phone;
    case 'email':
      return r.email;
    case 'product':
      return r.code;
  }
}

/** A .vcf for "Add to contacts" (opened in the Contacts app). */
export function toVcard(c: ContactInfo): string {
  const esc = (v: string) => v.replace(/([\\,;])/g, '\\$1');
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${esc(c.name)}`,
    `N:${esc(c.name)};;;;`,
    ...c.phones.map((p) => `TEL:${esc(p)}`),
    ...c.emails.map((e) => `EMAIL:${esc(e)}`),
    ...(c.org ? [`ORG:${esc(c.org)}`] : []),
    ...(c.url ? [`URL:${esc(c.url)}`] : []),
    'END:VCARD',
    '',
  ].join('\r\n');
}

// ---------- Create ----------

export type CreateKind = 'link' | 'links' | 'text' | 'wifi' | 'contact' | 'phone';

export const CREATE_KINDS: { label: string; value: CreateKind }[] = [
  { get label() { return t('Link'); }, value: 'link' },
  { get label() { return t('Links'); }, value: 'links' },
  { get label() { return t('Text'); }, value: 'text' },
  { label: 'Wi-Fi', value: 'wifi' },
  { get label() { return t('Contact'); }, value: 'contact' },
  { get label() { return t('Phone'); }, value: 'phone' },
];

/** Form fields per kind, labels as on the board ("Network name", "Password"). */
export const CREATE_FIELDS: Record<CreateKind, { key: string; label: string; secure?: boolean; keyboard?: 'url' | 'phone-pad' | 'email-address'; multiline?: boolean }[]> = {
  link: [{ key: 'url', get label() { return t('Link'); }, keyboard: 'url' }],
  // the rows are their own editor (custom/qr/LinksEditor); these are the fields above them
  links: [
    { key: 'title', get label() { return t('Name'); } },
    { key: 'note', get label() { return t('Short note (optional)'); } },
  ],
  text: [{ key: 'text', get label() { return t('Text'); }, multiline: true }],
  wifi: [
    { key: 'ssid', get label() { return t('Network name'); } },
    { key: 'password', get label() { return t('Password'); }, secure: true },
  ],
  contact: [
    { key: 'name', get label() { return t('Name'); } },
    { key: 'phone', get label() { return t('Phone'); }, keyboard: 'phone-pad' },
    { key: 'email', get label() { return t('Email'); }, keyboard: 'email-address' },
  ],
  phone: [{ key: 'phone', get label() { return t('Phone number'); }, keyboard: 'phone-pad' }],
};

/** Escapes \ ; , : " for WIFI: and MECARD: fields. */
const escField = (v: string) => v.replace(/([\\;,:"])/g, '\\$1');

/** The text to encode, or '' while the form is incomplete. */
export function buildCode(kind: CreateKind, v: Record<string, string>): string {
  const field = (k: string) => (v[k] ?? '').trim();
  switch (kind) {
    case 'link': {
      const url = field('url');
      if (!url) return '';
      return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
    }
    case 'links': {
      // the rows are kept as JSON in values.links (LinkRow[])
      let rows: LinkRow[] = [];
      try {
        rows = JSON.parse(v.links || '[]');
      } catch {
        rows = [];
      }
      return linksUrl({ title: field('title'), note: field('note'), links: rows });
    }
    case 'text':
      return field('text');
    case 'wifi': {
      if (!field('ssid')) return '';
      const pass = v.password ?? '';
      return pass ? `WIFI:T:WPA;S:${escField(field('ssid'))};P:${escField(pass)};;` : `WIFI:T:nopass;S:${escField(field('ssid'))};;`;
    }
    case 'contact': {
      if (!field('name') && !field('phone') && !field('email')) return '';
      const parts = [`N:${escField(field('name'))}`];
      if (field('phone')) parts.push(`TEL:${escField(field('phone'))}`);
      if (field('email')) parts.push(`EMAIL:${escField(field('email'))}`);
      return `MECARD:${parts.join(';')};;`;
    }
    case 'phone':
      return field('phone') ? `tel:${field('phone').replace(/[^\d+]/g, '')}` : '';
  }
}

/** 'qr-wifi.png' as on the board. */
export const qrFileName = (kind: CreateKind) => `qr-${kind}.png`;
