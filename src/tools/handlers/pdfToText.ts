import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { stepper } from '@/lib/pdf';
import { openPdf } from '@/lib/pdfjs';
import { ToolError, type ToolHandler } from '../types';

// design/FlowPdfToText.dc.html (the app: PdfBox on the phone): every page's text from pdf.js, put back into lines and
// paragraphs by position. Markdown: bigger text becomes headings (#, ##), bullet and numbered lines become lists, when
// "Keep headings and lists" is on. A .txt or .md with a BOM so Urdu opens right everywhere.

type Item = { str: string; x: number; y: number; size: number; w: number };
type Line = { y: number; size: number; text: string; x: number };

function lines(items: Item[]): Line[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const out: Line[] = [];
  for (const it of sorted) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.y - it.y) < Math.max(2, it.size * 0.45)) {
      last.text += (it.x - last.x > 0 && !/\s$/.test(last.text) && !/^\s/.test(it.str) ? ' ' : '') + it.str;
      last.size = Math.max(last.size, it.size);
    } else out.push({ y: it.y, size: it.size, text: it.str, x: it.x });
  }
  return out.map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() }));
}

const BULLET = /^([•·▪◦‣\-–*]|\(?\d{1,3}[.)])\s+/;

/** A block of a PDF's text: heading (level 1 or 2), list item (bulleted or numbered) or paragraph. */
export type TextBlock = { kind: 'h1' | 'h2' | 'li' | 'ol' | 'p'; text: string };

/** Every page's text as blocks, in reading order (pages without text give none). */
export async function pdfBlocks(file: File, structure: boolean, onPage?: (i: number, total: number) => Promise<void> | void): Promise<{ pages: TextBlock[][]; words: number }> {
  const doc = await openPdf(file);
  const pages: Line[][] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      await onPage?.(i - 1, doc.numPages);
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const items: Item[] = (content.items as { str?: string; transform?: number[]; width?: number }[])
        .filter((it) => typeof it.str === 'string' && it.transform)
        .map((it) => ({ str: it.str!, x: it.transform![4], y: it.transform![5], size: Math.hypot(it.transform![2], it.transform![3]) || 10, w: it.width ?? 0 }));
      pages.push(lines(items));
    }
  } finally {
    void doc.destroy();
  }
  const all = pages.flat();
  // the body size: the size most text is in
  const sizes = all.map((l) => Math.round(l.size)).sort((a, b) => a - b);
  const body = sizes[Math.floor(sizes.length / 2)] ?? 10;
  let words = 0;
  const out = pages.map((page) => {
    const blocks: TextBlock[] = [];
    let para: string[] = [];
    const flush = () => {
      if (para.length) blocks.push({ kind: 'p', text: para.join(' ') });
      para = [];
    };
    page.forEach((l, i) => {
      words += l.text.split(/\s+/).filter(Boolean).length;
      const prev = page[i - 1];
      const gap = prev ? prev.y - l.y : 0;
      if (structure && l.size >= body * 1.25 && l.text.length < 120) {
        flush();
        blocks.push({ kind: l.size >= body * 1.6 ? 'h1' : 'h2', text: l.text });
        return;
      }
      if (structure && BULLET.test(l.text)) {
        flush();
        const numbered = /^\(?\d/.test(l.text);
        blocks.push({ kind: numbered ? 'ol' : 'li', text: numbered ? l.text.replace(/^\(?(\d{1,3})[.)]\s+/, '$1. ') : l.text.replace(BULLET, '') });
        return;
      }
      // a bigger gap than a line's height starts a new paragraph
      if (prev && gap > l.size * 1.8) flush();
      para.push(l.text);
    });
    flush();
    return blocks;
  });
  return { pages: out, words };
}

export const pdfToText: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const markdown = options.format !== 'text';
  const structure = markdown && options.structure !== false;
  const { pages, words } = await pdfBlocks(files[0], structure, (i, n) => step(i, n + 1, t('Reading page {n} of {total}', { n: i + 1, total: n })));
  const blocks = pages.flat();
  if (!blocks.length) throw new ToolError(t('No text found in {name}. It\'s probably a scan. Try Image to text.', { name: files[0].name }));
  const md = (b: TextBlock) => (b.kind === 'h1' ? `# ${b.text}` : b.kind === 'h2' ? `## ${b.text}` : b.kind === 'li' ? `- ${b.text}` : b.text);
  const text = blocks.map((b) => (markdown ? md(b) : b.text)).join('\n\n');
  await step(pages.length, pages.length + 1, t('Saving'));
  return {
    title: t('Text ready'),
    subtitle: t('{words} words from {pages} pages', { words: words.toLocaleString('en-US'), pages: pages.length }),
    files: [{ name: `${fileStem(files[0].name)}.${markdown ? 'md' : 'txt'}`, blob: new Blob(['\uFEFF', text], { type: markdown ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' }) }],
  };
};
