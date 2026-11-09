// Business card to contact (pure, unit-tested): the card's text (ML Kit on the phone) split into a name, job title,
// Copied from the app (src/tools/card.ts); keep the two the same.
// company, phones, emails, websites and address, and the vCard Android's Contacts app imports. Cards are messy, so
// every field is shown for fixing before it's saved (src/flow/custom/card/CardResultStep.tsx).

export type CardFields = {
  name: string;
  title: string;
  company: string;
  phones: string[];
  emails: string[];
  websites: string[];
  address: string;
};

export const emptyCard = (): CardFields => ({ name: '', title: '', company: '', phones: [], emails: [], websites: [], address: '' });

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const WEB = /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|pk|io|co|biz|info|edu|gov|me|app|dev|uk|ae|us)(?:\.[a-z]{2})?(?:\/[^\s]*)?\b/gi;
// +92 300 1234567, 0300-1234567, (021) 3456-7890, +1 (415) 555-0100
const PHONE = /\+?\(?\d[\d\s().-]{7,}\d/g;
const JOB = /\b(ceo|cto|cfo|coo|founder|co-founder|director|manager|engineer|developer|designer|consultant|officer|executive|head|lead|president|partner|owner|sales|marketing|accountant|advocate|doctor|dr\.|architect|analyst|specialist|assistant|representative|proprietor|chairman|supervisor|coordinator)\b/i;
const COMPANY = /\b(ltd|limited|pvt|private|inc|llc|llp|corp|corporation|company|co\.|group|solutions|technologies|technology|tech|traders|enterprises|industries|associates|studio|agency|bank|services|systems|international|consultants|holdings|labs?|pharma|textiles?|motors|builders|estate)\b/i;
const ADDRESS = /\b(street|st\.|road|rd\.|block|sector|phase|floor|plaza|avenue|ave\.?|lane|town|colony|market|building|suite|office\s*#?|house\s*#?|plot|near|opp\.?|karachi|lahore|islamabad|rawalpindi|faisalabad|multan|peshawar|quetta|hyderabad|sialkot|gujranwala|pakistan)\b/i;
const LABEL = /^(tel|phone|ph|cell|mobile|mob|m|t|fax|f|whatsapp|wa|office|off|email|e-mail|e|web|website|w|address|add|a)\s*[:.]\s*/i;

const digits = (s: string) => s.replace(/\D/g, '');
/** One space between parts; brackets dropped when they don't pair up. */
function tidyPhone(s: string) {
  const x = s.replace(/\s+/g, ' ').trim();
  const opens = x.split('(').length;
  return opens === x.split(')').length ? x : x.replace(/[()]/g, '').trim();
}

/** The fields found in a card's text. */
export function parseCard(text: string): CardFields {
  const card = emptyCard();
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const used = new Set<number>();

  lines.forEach((line, i) => {
    let rest = line;
    for (const m of line.matchAll(EMAIL)) {
      if (!card.emails.includes(m[0].toLowerCase())) card.emails.push(m[0].toLowerCase());
      rest = rest.replace(m[0], ' ');
      used.add(i);
    }
    for (const m of rest.matchAll(WEB)) {
      const site = m[0].replace(/[.,;]+$/, '');
      if (!card.websites.includes(site.toLowerCase())) card.websites.push(site.toLowerCase());
      rest = rest.replace(m[0], ' ');
      used.add(i);
    }
    for (const m of rest.matchAll(PHONE)) {
      const n = digits(m[0]);
      if (n.length < 9 || n.length > 15) continue;
      if (!card.phones.some((p) => digits(p) === n)) card.phones.push(tidyPhone(m[0]));
      used.add(i);
    }
  });

  // the other lines: job title, company, address, name
  const free = lines.map((l, i) => ({ l: l.replace(LABEL, '').trim(), i })).filter(({ l, i }) => !used.has(i) && /\p{L}/u.test(l));
  for (const { l, i } of free) {
    if (!card.title && JOB.test(l) && !COMPANY.test(l)) {
      card.title = l;
      used.add(i);
    } else if (!card.company && COMPANY.test(l)) {
      card.company = l;
      used.add(i);
    } else if (ADDRESS.test(l) || (/\d/.test(l) && l.includes(','))) {
      card.address = card.address ? `${card.address}, ${l}` : l;
      used.add(i);
    }
  }
  // the name: the first short line of words only (2-4 words), else the first line left
  const left = free.filter(({ i }) => !used.has(i)).map(({ l }) => l);
  card.name = left.find((l) => /^[\p{L}][\p{L}.'\- ]+$/u.test(l) && l.split(' ').length >= 2 && l.split(' ').length <= 4) ?? left[0] ?? '';
  if (!card.company) card.company = left.find((l) => l !== card.name && l === l.toUpperCase() && l.length > 2) ?? '';
  return card;
}

/** vCard text value: backslashes, commas, semicolons and new lines escaped. */
const v = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');

/** The contact as a vCard 3.0, which Android's Contacts app imports. */
export function toVCard(c: CardFields): string {
  const parts = c.name.trim().split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0] ?? '';
  const out = ['BEGIN:VCARD', 'VERSION:3.0', `N:${v(last)};${v(first)};;;`, `FN:${v(c.name.trim() || c.company.trim())}`];
  if (c.company.trim()) out.push(`ORG:${v(c.company.trim())}`);
  if (c.title.trim()) out.push(`TITLE:${v(c.title.trim())}`);
  c.phones.filter((p) => p.trim()).forEach((p, i) => out.push(`TEL;TYPE=${i === 0 ? 'CELL' : 'WORK'}:${p.trim()}`));
  c.emails.filter((e) => e.trim()).forEach((e) => out.push(`EMAIL;TYPE=WORK:${e.trim()}`));
  c.websites.filter((w) => w.trim()).forEach((w) => out.push(`URL:${w.trim()}`));
  if (c.address.trim()) out.push(`ADR;TYPE=WORK:;;${v(c.address.trim())};;;;`);
  out.push('END:VCARD');
  return out.join('\r\n') + '\r\n';
}
