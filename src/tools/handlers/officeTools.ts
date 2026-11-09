import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { readText } from '@/lib/ocr';
import { stepper } from '@/lib/pdf';
import { canvasBlob, openPdf, renderPage } from '@/lib/pdfjs';
import { ToolError, type ToolHandler } from '../types';
import { pdfBlocks, type TextBlock } from './pdfToText';

// PDF to Word and PDF to PowerPoint in the browser (server tools in the app). Word: an editable DOCX from the PDF's
// text (headings, lists, paragraphs; Urdu and Arabic paragraphs right to left; scanned pages read by Tesseract when
// asked), or "Keep layout": each page as a picture on a page of the same size. PowerPoint: each page as a slide.

const RTL = /[֐-ࣿ]/;
const pt = (n: number) => Math.round(n * 20); // points to twips

export const pdfToWord: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const f = files[0];
  const docx = await import('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, PageBreak } = docx;

  if (options.mode === 'layout') {
    const view = await openPdf(f);
    const sections = [];
    try {
      for (let i = 0; i < view.numPages; i++) {
        await step(i, view.numPages + 1, t('Page {n} of {total}', { n: i + 1, total: view.numPages }));
        const page = await view.getPage(i + 1);
        const vp = page.getViewport({ scale: 1 });
        const c = await renderPage(view, i, 150);
        const data = new Uint8Array(await (await canvasBlob(c, 'image/jpeg', 0.9)).arrayBuffer());
        c.width = c.height = 0;
        // the page's size in points -> pixels at 96 dpi for the picture
        sections.push({
          properties: { page: { size: { width: pt(vp.width), height: pt(vp.height) }, margin: { top: 0, right: 0, bottom: 0, left: 0 } } },
          children: [new Paragraph({ children: [new ImageRun({ type: 'jpg', data, transformation: { width: Math.round((vp.width * 96) / 72), height: Math.round((vp.height * 96) / 72) } })] })],
        });
      }
    } finally {
      void view.destroy();
    }
    await step(sections.length, sections.length + 1, t('Saving'));
    const blob = await Packer.toBlob(new Document({ sections }));
    return { title: t('Converted to Word'), files: [{ name: `${fileStem(f.name)}.docx`, blob }] };
  }

  const { pages } = await pdfBlocks(f, true, (i, n) => step(i, n + 1, t('Reading page {n} of {total}', { n: i + 1, total: n })));
  // scanned pages (no text of their own), read when asked
  if (options.ocr && pages.some((p) => !p.length)) {
    const view = await openPdf(f);
    try {
      for (let i = 0; i < pages.length; i++) {
        if (pages[i].length) continue;
        await step(i, pages.length + 1, t('Reading page {n} of {total}', { n: i + 1, total: pages.length }));
        const c = await renderPage(view, i, 250);
        const r = await readText(c, ['eng'], (pct, what) => what === 'download' && ctx.onProgress(i, pages.length + 1, `${t('Getting the text reader ready (one time only)…')} ${pct}%`));
        c.width = c.height = 0;
        pages[i] = r.text.split(/\n{2,}/).map((p): TextBlock => ({ kind: 'p', text: p.replace(/\n/g, ' ') }));
      }
    } finally {
      void view.destroy();
    }
  }
  if (!pages.some((p) => p.length)) throw new ToolError(t('No text found in {name}. Turn on "Read scanned pages", or choose Keep layout.', { name: f.name }));
  const para = (b: TextBlock) => {
    const rtl = RTL.test(b.text);
    const base = { bidirectional: rtl, children: [new TextRun({ text: b.text, rightToLeft: rtl })] };
    if (b.kind === 'h1') return new Paragraph({ ...base, heading: HeadingLevel.HEADING_1 });
    if (b.kind === 'h2') return new Paragraph({ ...base, heading: HeadingLevel.HEADING_2 });
    if (b.kind === 'li') return new Paragraph({ ...base, bullet: { level: 0 } });
    return new Paragraph({ ...base, spacing: { after: 160 } });
  };
  const children = pages.flatMap((p, i) => [...p.map(para), ...(i < pages.length - 1 && p.length ? [new Paragraph({ children: [new PageBreak()] })] : [])]);
  await step(pages.length, pages.length + 1, t('Saving'));
  const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
  return { title: t('Converted to Word'), subtitle: t('Text you can edit; check the layout'), files: [{ name: `${fileStem(f.name)}.docx`, blob }] };
};

export const pdfToPpt: ToolHandler = async (ctx) => {
  const { files } = ctx;
  const step = stepper(ctx);
  const f = files[0];
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  const view = await openPdf(f);
  try {
    const first = (await view.getPage(1)).getViewport({ scale: 1 });
    const W = first.width / 72;
    const H = first.height / 72;
    pptx.defineLayout({ name: 'PDF', width: W, height: H });
    pptx.layout = 'PDF';
    for (let i = 0; i < view.numPages; i++) {
      await step(i, view.numPages + 1, t('Page {n} of {total}', { n: i + 1, total: view.numPages }));
      const c = await renderPage(view, i, 150);
      // each page fitted into the slide (pages of other sizes keep their shape)
      const k = Math.min(W / (c.width / 150), H / (c.height / 150));
      const w = (c.width / 150) * k;
      const h = (c.height / 150) * k;
      pptx.addSlide().addImage({ data: c.toDataURL('image/jpeg', 0.9), x: (W - w) / 2, y: (H - h) / 2, w, h });
      c.width = c.height = 0;
    }
  } finally {
    void view.destroy();
  }
  await step(1, 1, t('Saving'));
  const blob = (await pptx.write({ outputType: 'blob' })) as Blob;
  return { title: t('Converted to PowerPoint'), files: [{ name: `${fileStem(f.name)}.pptx`, blob }] };
};
