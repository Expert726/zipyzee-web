// From the app's src/textdocs/edit.ts (the parts the web editor uses; pure).
export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);

/** The text without its marks, on one line (lists and previews). */
export const plainLine = (text: string) =>
  text.replace(/^(#{1,6}\s+|[-*•]\s+|\d+[.)]\s+)/gm, '').replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();

/** The document's name: its title, or its first words, or "Untitled". */
export function titleOf(doc: { title: string; text: string }, untitled: string): string {
  const own = doc.title.trim();
  if (own) return own;
  const first = plainLine(doc.text.split('\n').find((l) => l.trim()) ?? '');
  return first ? (first.length > 40 ? `${first.slice(0, 39).trimEnd()}…` : first) : untitled;
}

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

/** The rich editor's HTML as plain text (word count, the list's preview line, the title): one line per block. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#?\w+);/g, (all, e: string) => (ENTITIES[e] ?? (e.startsWith('#') ? String.fromCodePoint(Number(e.slice(1).replace(/^x/i, '0x'))) : all)))
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}
