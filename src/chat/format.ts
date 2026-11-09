// Pure helpers for chat screens (unit-tested): times, expiry, initials, avatar colors, usernames.
// Copied from the app (src/chat/format.ts); only the avatar colours below are local (the app's are in its theme).
/** The app's light avatar colours (src/theme/tokens.ts AVATARS_LIGHT). */
const avatarColors: { bg: string; fg: string }[] = [
  { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#E0F2FE', fg: '#0369A1' },
  { bg: '#DCFCE7', fg: '#166534' },
  { bg: '#EDE9FE', fg: '#5B21B6' },
  { bg: '#FEF3C7', fg: '#92400E' },
];
import type { Chat, ChatLast, Message } from './types';
import { t } from '@/i18n';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** The support chat ("ZipyZee Team", the owner's account in Firestore config/support) keeps messages this long. */
export const SUPPORT_DAYS = 30;

/** A direct chat with the support account (its id is the two uids joined by "_"). */
export const isSupportChat = (chatId: string, supportUid: string | null | undefined) => !!supportUid && chatId.split('_').includes(supportUid);

/** Once everyone it was sent to has seen a message, it deletes this much later (if it wasn't going sooner). */
export const SEEN_LIFE_MS = 60 * 60 * 1000;

/**
 * Messages that everyone has now seen (each member except the sender has opened the chat since it was sent, counting
 * me as reading now) and that still have more than an hour left: their delete time becomes an hour from now.
 * Only other people's messages: the reader shortens them. Never in the support chat (the caller checks).
 */
export function seenToShorten(messages: Message[], members: string[], readAt: Record<string, number>, me: string, now: number): Message[] {
  return messages.filter((m) => {
    // voice messages go a minute after they're played, not when seen
    if (m.kind === 'voice' || m.from === me || !m.createdAt || m.expiresAt <= now + SEEN_LIFE_MS + 5 * 60_000) return false;
    return members.filter((u) => u !== m.from).every((u) => (u === me ? now : readAt[u] ?? 0) >= m.createdAt);
  });
}

/** A voice message deletes this long after everyone it was sent to has played it. */
export const HEARD_LIFE_MS = 60 * 1000;
/** The longest voice message; recording sends itself at this length. */
export const MAX_VOICE_MS = 60 * 1000;

/** Everyone it was sent to has played it, counting `me` as having just played it. */
export function heardByAll(m: Pick<Message, 'from' | 'heard'>, members: string[], me: string): boolean {
  const heard = new Set([...(m.heard ?? []), me]);
  return members.filter((u) => u !== m.from).every((u) => heard.has(u));
}

/** Emergency voice is on for a 1-to-1 chat when both people turned it on. */
export const emergencyOn = (c: Pick<Chat, 'type' | 'members' | 'emergency'>) => c.type === 'direct' && c.members.length === 2 && c.members.every((u) => !!c.emergency?.[u]);

/** 23 -> "0:23", 60 -> "1:00" */
export const clockText = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** How long a new message in this chat lives: 30 days with support, 24 hours everywhere else. */
export const messageLifeMs = (chatId: string, supportUid: string | null | undefined) => (isSupportChat(chatId, supportUid) ? SUPPORT_DAYS * DAY_MS : DAY_MS);

/** Chats list time: "now", "2m", "1h", "Yesterday", or a date like "12 Oct". */
export function chatTime(at: number, now = Date.now()): string {
  const diff = Math.max(0, now - at);
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  const d = new Date(at);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (at >= startOfToday) return `${Math.floor(diff / 3_600_000)}h`;
  if (at >= startOfToday - DAY_MS) return t('Yesterday');
  return `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
}

/** A sent text message can be edited for 5 minutes (like WhatsApp's 15; firestore.rules editText allows the same). */
export const EDIT_WINDOW_MS = 5 * 60_000;

/** I can still edit this message: mine, text, sent less than 5 minutes ago. */
export function canEdit(m: { from: string; kind: string; createdAt: number }, me: string, now = Date.now()): boolean {
  return m.from === me && m.kind === 'text' && now - m.createdAt < EDIT_WINDOW_MS;
}

/** When a message was sent, for a viewer's top bar like WhatsApp: "Today, 3:59 PM", "Yesterday, 3:59 PM", "2 Nov, 3:59 PM". */
/** "3:59 PM": the time on every message (like WhatsApp). */
export function timeOfDay(at: number): string {
  const d = new Date(at);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

const WEEKDAYS = () => [t('Sunday'), t('Monday'), t('Tuesday'), t('Wednesday'), t('Thursday'), t('Friday'), t('Saturday')];

/** Midnight at the start of `at`'s day (the phone's time zone). */
const dayStart = (at: number) => {
  const d = new Date(at);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Same calendar day? (the chat puts a day label between days) */
export const sameDay = (a: number, b: number) => dayStart(a) === dayStart(b);

/**
 * The label between days in a chat, like WhatsApp: "Today", "Yesterday", the weekday for the past week ("Sunday"),
 * then the date ("27 Oct", with the year when it isn't this year).
 */
export function dayLabel(at: number, now = Date.now()): string {
  const days = Math.round((dayStart(now) - dayStart(at)) / DAY_MS);
  if (days <= 0) return t('Today');
  if (days === 1) return t('Yesterday');
  const d = new Date(at);
  if (days < 7) return WEEKDAYS()[d.getDay()];
  const date = `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
  return d.getFullYear() === new Date(now).getFullYear() ? date : `${date} ${d.getFullYear()}`;
}

export function sentLabel(at: number, now = Date.now()): string {
  const d = new Date(at);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const time = timeOfDay(at);
  if (at >= startOfToday) return t('Today, {time}', { time });
  if (at >= startOfToday - DAY_MS) return t('Yesterday, {time}', { time });
  return t('{date}, {time}', { date: `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`, time });
}

/** Whole hours left before it's deleted, at least 1 while it still exists ("23h" chip, "Deletes in 23 h"). */
export function hoursLeft(expiresAt: number, now = Date.now()): number {
  return Math.max(1, Math.floor((expiresAt - now) / 3_600_000));
}

export const isExpired = (expiresAt: number, now = Date.now()) => expiresAt <= now;

/** "Ayesha Khan" -> "AK", "zain" -> "Z". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Stable avatar colors for a uid (pink, sky, green, violet, amber as in design/Chats.dc.html). */
export function avatarColor(uid: string): { bg: string; fg: string } {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 4294967296;
  return avatarColors[h % avatarColors.length];
}

/** Usernames: 3 to 20 of a-z, 0-9, dot and underscore; not starting or ending with a dot. Same rule in firestore.rules. */
export const USERNAME_RE = /^[a-z0-9_](?:[a-z0-9._]{1,18})[a-z0-9_]$/;

/** What the user typed in the @ field, cleaned: lower case, no @ or spaces. */
export const cleanUsername = (s: string) => s.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._]/g, '');

export function usernameProblem(u: string): string | null {
  if (u.length < 3) return t('At least 3 characters');
  if (u.length > 20) return t('At most 20 characters');
  if (!USERNAME_RE.test(u)) return t('Use letters, numbers, dots and _');
  return null;
}

/**
 * The username made for a new Google account: the part of the Gmail address before @ (or the name when that doesn't
 * work), cleaned to the username rule: "Zain.Ahmed+uni@gmail.com" -> "zain.ahmed". At least 3, at most 16 characters,
 * leaving room for a number when it's taken.
 */
export function usernameBase(email: string | null, name: string | null): string {
  const tidy = (s: string) =>
    s.toLowerCase().replace(/\+.*$/, '').replace(/\s+/g, '.').replace(/[^a-z0-9._]/g, '').replace(/\.{2,}/g, '.').replace(/^[.]+|[.]+$/g, '').slice(0, 16).replace(/[.]+$/, '');
  const tries = [email?.split('@')[0] ?? '', name ?? ''].map(tidy);
  const long = tries.find((u) => u.length >= 3);
  if (long) return long;
  const short = tries.find((u) => u.length > 0);
  return short ? (short + '__').slice(0, 3) : 'user'; // "jo" -> "jo_"
}

/** Names to try in order: the base, then base + 2..9, then base + a random 4-digit number. */
export function usernameCandidates(base: string, random = Math.random): string[] {
  const out = [base];
  for (let n = 2; n <= 9; n++) out.push(`${base}${n}`);
  for (let i = 0; i < 5; i++) out.push(`${base}${1000 + Math.floor(random() * 9000)}`);
  return out.filter((u) => !usernameProblem(u));
}

/** Direct chats have a fixed id so two people never get two chats: the two uids, sorted. */
export const directChatId = (a: string, b: string) => [a, b].sort().join('_');

/** "example.edu" from a URL; null if it isn't a web link. Adds https:// when the scheme is missing. */
export function parseLink(input: string): { url: string; domain: string } | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const m = /^https?:\/\/([^/?#:]+)(?::\d+)?(?:[/?#]|$)/i.exec(url);
  if (!m || !m[1].includes('.')) return null;
  return { url, domain: m[1].toLowerCase().replace(/^www\./, '') };
}

/** Invite link / QR payload -> username: zipyzee://u/zain, https://host/u/zain, or @zain. */
export function usernameFromInvite(data: string): string | null {
  const m = /^(?:zipyzee:\/\/u\/|https:\/\/[^/]+\/u\/|@)([a-z0-9._]+)\/?$/i.exec(data.trim());
  return m ? m[1].toLowerCase() : null;
}

/** Second line of a file bubble: "4 pages, 1.2 MB" (pages when known). */
export function fileMeta(size: number, pages: number | undefined, formatBytes: (n: number) => string): string {
  return pages ? `${pages} ${pages === 1 ? t('page') : t('pages')}, ${formatBytes(size)}` : formatBytes(size);
}

/** "PDF" from "lab-report.pdf" ("FILE" without an extension). */
export const fileType = (name: string) => (/\.([a-z0-9]{1,5})$/i.exec(name)?.[1] ?? 'file').toUpperCase();

/**
 * Chats list preview (design/Chats.dc.html): "PDF: lab-report.pdf", "Hamza: shared a link", "You: invoice-oct.pdf",
 * "View-once file, opened". fromName: the sender's first name (groups only).
 */
export function previewText(last: ChatLast, me: string, group: boolean, fromName?: string, now = Date.now()): string {
  if (isExpired(last.expiresAt, now)) return t('Messages deleted');
  // system lines are stored in English (written by the app or Cloud Functions) and translated here
  if (last.kind === 'system') return last.text === 'Group created' ? t('Group created') : last.text === 'Message deleted' ? t('Message deleted') : last.text;
  if (last.kind === 'viewOnce') return last.opened ? t('View-once file, opened') : t('View-once file');
  if (last.kind === 'voice') {
    const body = t('🎤 Voice message');
    return last.from === me ? `You: ${body}` : group && fromName ? `${fromName}: ${body}` : body;
  }
  const mine = last.from === me;
  const body =
    last.kind === 'file' ? (mine ? last.text : `${fileType(last.text)}: ${last.text}`)
      : last.kind === 'link' ? t('shared a link')
        : last.text;
  if (mine) return `You: ${body}`;
  if (group && fromName) return `${fromName}: ${body}`;
  return body.charAt(0).toUpperCase() + body.slice(1);
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * The chat list preview of a message just sent (kind + text of chat.last). The app writes it with the message, so the
 * list works without Cloud Functions; same shape as functions/src/lib.js lastFor.
 */
export function lastPreview(m: { kind: 'text' | 'file' | 'link' | 'voice'; text?: string; viewOnce?: boolean; file?: { name: string }; link?: { url: string } }): {
  kind: ChatLast['kind'];
  text: string;
} {
  if (m.kind === 'voice') return { kind: 'voice', text: '' };
  if (m.kind === 'file') return { kind: m.viewOnce ? 'viewOnce' : 'file', text: (m.file?.name ?? 'File').slice(0, 200) };
  if (m.kind === 'link') return { kind: 'link', text: (m.link?.url ?? '').slice(0, 200) };
  return { kind: 'text', text: (m.text ?? '').slice(0, 200) };
}

/**
 * A received file's name as a safe single file name (release audit): another member could write a message with a
 * name like "../../databases/x" straight to Firestore, skipping the app; it must never reach outside the chat cache.
 */
export function safeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex -- control characters are exactly what must not reach a file name
  const clean = name.replace(/[/\\\u0000-\u001f]/g, '_').replace(/^\.+/, '_').slice(0, 200);
  return clean || 'file';
}
