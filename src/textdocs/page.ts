// The printed page for a Text editor document (the app's src/lib/textPdf.ts textPageHtml, for the browser): A4,
// the document's font, size and alignment, its title, then its cleaned HTML. Pure.
export type PageFont = 'sans' | 'serif';
export type PageSize = 's' | 'm' | 'l';
export type PageAlign = 'start' | 'center';

/** Body text size in points for S / M / L. */
export const PAGE_TEXT_PT: Record<PageSize, number> = { s: 10.5, m: 12, l: 14 };

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The editor's HTML, safe to show and print (the app's sanitizeHtml): no scripts, styles, frames or event handlers,
 * no javascript: links, only pictures stored in the document (data: URLs), and only tick boxes as inputs.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|link|meta|base|form|svg|math)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src|xlink:href)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '')
    .replace(/<img\b[^>]*>/gi, (tag) => (/\ssrc\s*=\s*("|')data:image\//i.test(tag) ? tag : ''))
    .replace(/<input\b[^>]*>/gi, (tag) => (/type\s*=\s*("|')?checkbox/i.test(tag) ? tag.replace(/\s(name|value|form\w*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '') : ''));
}

export type PageOptions = {
  title?: string;
  html: string;
  font?: PageFont;
  size?: PageSize;
  align?: PageAlign;
  /** @font-face rules to include (the site's own Poppins and Noto Naskh, so the print matches the screen). */
  fontFaces?: string;
  /** Font families for sans text, e.g. "'Poppins', 'Noto Naskh Arabic'". */
  sansFamily?: string;
  urduFamily?: string;
};

/** The whole A4 page, ready to print. */
export function textPageHtml({ title, html, font = 'sans', size = 'm', align = 'start', fontFaces = '', sansFamily = 'sans-serif', urduFamily = "'Noto Naskh Arabic'" }: PageOptions): string {
  const pt = PAGE_TEXT_PT[size];
  // the Latin font, then Naskh for Urdu letters, before any generic fallback
  const family = `${font === 'serif' ? 'Georgia, "Times New Roman"' : sansFamily}, ${urduFamily}, ${font === 'serif' ? 'serif' : 'sans-serif'}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title || 'ZipyZee')}</title><style>
${fontFaces}
@page{size:A4;margin:18mm 16mm}
*{font-variant-ligatures:none}
body{margin:0;font-family:${family};font-size:${pt}pt;line-height:1.65;color:#111827;text-align:${align === 'center' ? 'center' : 'start'};-webkit-print-color-adjust:exact;print-color-adjust:exact}
h1.title{font-size:${(pt * 1.6).toFixed(1)}pt;line-height:1.3;margin:0 0 14pt;padding-bottom:10pt;border-bottom:1px solid #E5E7EB}
.rich h1{font-size:${(pt * 1.45).toFixed(1)}pt;line-height:1.3;margin:12pt 0 4pt}
.rich h2{font-size:${(pt * 1.2).toFixed(1)}pt;margin:12pt 0 4pt}
.rich div,.rich p{margin:0 0 6pt}
.rich ul,.rich ol{margin:0 0 8pt;padding-inline-start:18pt;text-align:start}
.rich li{margin:0 0 3pt}
.rich img{max-width:100%;height:auto}
.rich blockquote{border-inline-start:3pt solid #D1D5DB;margin:0 0 8pt;padding-inline-start:9pt;color:#374151}
.rich hr{border:0;border-top:1px solid #9CA3AF;margin:10pt 0}
.rich a{color:#1D4ED8}
.rich p,.rich div,.rich li,.rich h1,.rich h2{unicode-bidi:plaintext}
.x-todo{list-style:none;padding-inline-start:4pt}
.x-todo li{list-style:none}
.x-todo input{margin:0 6pt 0 0;transform:scale(1.15);vertical-align:middle}
</style></head><body>
${title?.trim() ? `<h1 class="title" dir="auto">${esc(title.trim())}</h1>` : ''}
<div class="rich" dir="auto">${sanitizeHtml(html)}</div>
</body></html>`;
}

