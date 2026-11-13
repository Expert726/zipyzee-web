// ZeeShare's pure parts: room codes, device names, the messages two devices send each other, and how a file is cut
// into pieces. No browser APIs here (unit-tested in __tests__/zeeshare.test.ts).

/** How long a room code works before someone joins. */
export const ROOM_LIFE_MS = 15 * 60_000;
/** A session lasts until someone taps Disconnect; one nobody opens for this long is cleaned up. */
export const SESSION_LIFE_MS = 30 * 24 * 3600_000;
/** Something sent while the other device is away waits this long for it. */
export const ITEM_LIFE_MS = 7 * 24 * 3600_000;
/** A file goes over the direct link in pieces of this size (well under every browser's data channel limit). */
export const PIECE_BYTES = 64 * 1024;
/** Pause sending while this much is still waiting in the channel (keeps memory low on phones). */
export const HIGH_WATER = 4 * 1024 * 1024;
/** Through the relay (when a direct link can't be made), base64 text per Firestore document, and the size limit. */
export const RELAY_PIECE_CHARS = 700_000;
export const RELAY_MAX_BYTES = 15 * 1024 * 1024;
/** Text messages longer than this are refused (they're for links, notes, codes, not books). */
export const MAX_TEXT = 100_000;

/** A 6-digit room code (no leading zero, so it reads well and survives being typed as a number). */
export function roomCode(random: () => number = Math.random): string {
  return String(100000 + Math.floor(random() * 900000));
}

/** "123 456" -> "123456"; null unless it's exactly 6 digits. */
export function cleanCode(typed: string): string | null {
  const digits = typed.replace(/\D/g, '');
  return /^[1-9]\d{5}$/.test(digits) ? digits : null;
}

/** "123456" -> "123 456" (easier to read out loud). */
export const showCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/** The browser and system, from the user agent: "Chrome on Android", "Safari on iPhone"... */
export function deviceName(ua: string): string {
  const os = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'Mac'
            : /CrOS/.test(ua)
              ? 'Chromebook'
              : /Linux/.test(ua)
                ? 'Linux'
                : '';
  const browser = /ZipyZee/.test(ua)
    ? 'ZipyZee'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /OPR\/|Opera/.test(ua)
        ? 'Opera'
        : /SamsungBrowser/.test(ua)
          ? 'Samsung Internet'
          : /Firefox|FxiOS/.test(ua)
            ? 'Firefox'
            : /Chrome|CriOS/.test(ua)
              ? 'Chrome'
              : /Safari/.test(ua)
                ? 'Safari'
                : 'Browser';
  return os ? `${browser} on ${os}` : browser;
}

/** What goes over the direct link as text; a file's bytes follow its `file` message as binary pieces, then `end`. */
export type Wire =
  | { t: 'hello'; name: string }
  | { t: 'text'; id: string; text: string; at: number }
  | { t: 'file'; id: string; name: string; mime: string; size: number; at: number }
  | { t: 'end'; id: string }
  | { t: 'got'; id: string }
  | { t: 'bye' };

/** A message from the other device, checked (never trusted as it comes). */
export function parseWire(raw: string): Wire | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object') return null;
  const m = v as Record<string, unknown>;
  const str = (k: string, max: number) => typeof m[k] === 'string' && (m[k] as string).length <= max;
  const num = (k: string) => typeof m[k] === 'number' && Number.isFinite(m[k]) && (m[k] as number) >= 0;
  switch (m.t) {
    case 'hello':
      return str('name', 60) ? { t: 'hello', name: m.name as string } : null;
    case 'text':
      return str('id', 40) && str('text', MAX_TEXT) && num('at') ? { t: 'text', id: m.id as string, text: m.text as string, at: m.at as number } : null;
    case 'file':
      return str('id', 40) && str('name', 255) && str('mime', 120) && num('size') && num('at')
        ? { t: 'file', id: m.id as string, name: safeName(m.name as string), mime: m.mime as string, size: m.size as number, at: m.at as number }
        : null;
    case 'end':
    case 'got':
      return str('id', 40) ? { t: m.t, id: m.id as string } : null;
    case 'bye':
      return { t: 'bye' };
    default:
      return null;
  }
}

/** A file name that is safe to save (no folders, no control characters). */
export function safeName(name: string): string {
  const n = name.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[\\/:*?"<>|]/g, '_').replace(/^\.+/, '').trim();
  return n.slice(0, 120) || 'file';
}

/** How many pieces a file of `size` bytes takes. */
export const pieceCount = (size: number, piece = PIECE_BYTES) => Math.max(1, Math.ceil(size / piece));

/** A short random id for a shared item. */
export function itemId(random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 16; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(random() * 36)];
  return s;
}

/** Text that is only a web link (shown as a link with Open). */
export function onlyLink(text: string): string | null {
  const s = text.trim();
  return /^https?:\/\/\S+$/i.test(s) && s.length <= 2048 ? s : null;
}
