// Wraps a rendered page in a complete HTML document for the WebView (preview) and printing (PDF):
// - @page sets A4 or Letter with no printer margins; the page's own padding is repeated at the top and bottom of every
//   page (box-decoration-break: clone), so a long resume continues on page 2 with the same margins and nothing else
//   repeats (no second header).
// - Entries never split across pages; a heading stays with what follows it.
// - The design is drawn in points (595 x 842 = A4); printing scales it to the real paper width.
// - A sidebar's colour is painted down every page; colours print as designed.
// - No ligatures: "fi" stays two letters in the PDF's text, which some hiring systems (ATS) need.
import type { Resume } from '../types';
import type { TemplateConfig } from './index';
import { fontFaces } from './fonts';
import { esc } from './format';
import { PAGE_SIZES, type Page } from './layouts';

/** CSS px per point: 96 / 72. The 595-wide design prints 793.7 px wide, exactly A4. */
const PRINT_ZOOM = 96 / 72;

export function documentHtml(r: Resume, t: TemplateConfig, page: Page, fontBase?: string): string {
  const size = PAGE_SIZES[r.design.pageSize] ?? PAGE_SIZES.A4;
  const s = page.sidebar;
  // the sidebar's column as a share of the page width, so it lines up on screen (595 wide) and on paper alike
  const col = s ? `${((s.width / size.w) * 100).toFixed(4)}%` : '';
  const sidebarBg = s
    ? s.side === 'left'
      ? `linear-gradient(to right, ${s.bg} 0, ${s.bg} ${col}, #FFFFFF ${col})`
      : `linear-gradient(to left, ${s.bg} 0, ${s.bg} ${col}, #FFFFFF ${col})`
    : '#FFFFFF';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${size.w}, initial-scale=1">
<title>${esc(r.personal.fullName.trim() || t.name)}</title>
<style>
${fontFaces(fontBase)}
@page { size: ${r.design.pageSize === 'Letter' ? 'letter' : 'A4'}; margin: 0 }
html { background: ${sidebarBg}; -webkit-print-color-adjust: exact; print-color-adjust: exact }
body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; font-variant-ligatures: no-common-ligatures }
.page, .page aside, .page main, .page > div { -webkit-box-decoration-break: clone; box-decoration-break: clone }
section > div, section > p, li, tr { break-inside: avoid; page-break-inside: avoid }
h2 { break-after: avoid; page-break-after: avoid }
img { display: block }
@media print { .page { zoom: ${PRINT_ZOOM} } }
</style>
</head>
<body>
<div class="page" style="${page.style}">${page.inner}</div>
</body>
</html>
`;
}
