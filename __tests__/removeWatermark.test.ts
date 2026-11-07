// The app's __tests__/removeWatermark.test.tsx (the finder and removal parts; the phone screen tests stay there).
import { describe, expect, it } from 'vitest';
import { decodePDFRawStream, PDFArray, PDFDocument, PDFName, PDFRawStream, StandardFonts, type PDFPage } from 'pdf-lib';
import { cutRanges, findWatermarks, parseOps, type Resolvers } from '@/tools/watermark/content';
import { cleanAll, defaultKinds, scanWatermarks } from '@/tools/watermark/pdf';
import { drawWatermark } from '@/tools/pdfOps';
import { WM_DEFAULTS } from '@/tools/pdfWatermark';

const none: Resolvers = { isWatermarkGroup: () => false, isSeeThrough: () => false, isImage: () => false, isStamp: () => false };

/** The page's drawing instructions as text. */
function contentOf(page: PDFPage): string {
  const c = page.node.Contents()!;
  const list = c instanceof PDFArray ? c.asArray() : [c];
  return list
    .map((ref) => {
      const s = page.doc.context.lookup(ref);
      return Buffer.from(s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : (s as unknown as { getUnencodedContents(): Uint8Array }).getUnencodedContents()).toString('latin1');
    })
    .join('\n');
}

const reload = async (doc: PDFDocument) => PDFDocument.load(await doc.save());

describe('content tokenizer', () => {
  it('reads strings with escapes, hex strings, arrays, nested dicts and inline images', () => {
    const ops = parseOps('BT (a \\) b (c)) Tj <414243> Tj [(x) -20 (y)] TJ ET /P <</MCID 3 /A <</B [1 2]>>>> BDC EMC BI /W 2 /H 1 ID \x00EI\xff EI Q % note\nq');
    expect(ops.map((o) => o.op)).toEqual(['BT', 'Tj', 'Tj', 'TJ', 'ET', 'BDC', 'EMC', 'BI', 'Q', 'q']);
    expect(ops[5].args[1].type).toBe('dict');
    expect(ops[3].args[0].type).toBe('array');
  });
});

describe('finding watermarks', () => {
  it('a marked watermark layer, nested marks included', () => {
    const s = 'BT (Hello) Tj ET /Artifact <</Type /Pagination /Subtype /Watermark>> BDC q /P <<>> BDC (x) Tj EMC Q EMC BT (World) Tj ET';
    const found = findWatermarks(parseOps(s), none);
    expect(found.layer).toHaveLength(1);
    expect(cutRanges(s, found.layer)).not.toMatch(/Watermark|\(x\)/);
    expect(cutRanges(s, found.layer)).toMatch(/\(Hello\) Tj ET\s+BT \(World\)/);
  });

  it('an optional-content group named Watermark', () => {
    const found = findWatermarks(parseOps('/OC /MC0 BDC (x) Tj EMC /OC /MC1 BDC (y) Tj EMC'), { ...none, isWatermarkGroup: (n) => n === 'MC0' });
    expect(found.layer).toHaveLength(1);
  });

  it('a see-through overlay of text or an image, not shapes or solid text', () => {
    const r: Resolvers = { ...none, isSeeThrough: (n) => n === 'GS1', isImage: (n) => n === 'Im1' };
    expect(findWatermarks(parseOps('q /GS1 gs BT /F1 40 Tf (DRAFT) Tj ET Q'), r).overlay).toHaveLength(1);
    expect(findWatermarks(parseOps('q /GS1 gs 100 0 0 50 0 0 cm /Im1 Do Q'), r).overlay).toHaveLength(1);
    // a see-through box is a highlight, not a watermark
    expect(findWatermarks(parseOps('q /GS1 gs 0 0 10 10 re f Q'), r).overlay).toHaveLength(0);
    expect(findWatermarks(parseOps('q BT (text) Tj ET Q'), r).overlay).toHaveLength(0);
  });

  it('a stamp with its own q ... Q, or just the Do inside a bigger group', () => {
    const r: Resolvers = { ...none, isImage: () => true, isStamp: (n) => n === 'Logo' };
    const s = 'q 50 0 0 20 10 10 cm /Logo Do Q q BT (text) Tj ET 1 0 0 1 5 5 cm /Logo Do /Photo Do Q';
    const found = findWatermarks(parseOps(s), r);
    expect(found.stamp).toHaveLength(2);
    const left = cutRanges(s, found.stamp);
    expect(left).not.toMatch(/Logo/);
    expect(left).toMatch(/\/Photo Do/);
    expect(left).toMatch(/\(text\) Tj/);
  });

  it('nothing on an ordinary page', () => {
    const found = findWatermarks(parseOps('q 1 0 0 1 0 0 cm BT /F1 12 Tf 72 700 Td (Invoice) Tj ET 0 0 1 rg 10 10 100 100 re f Q'), none);
    expect(found).toEqual({ layer: [], overlay: [], stamp: [] });
  });
});

describe('removing from a PDF', () => {
  async function textPdf(pages: number) {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < pages; i++) doc.addPage([600, 800]).drawText(`Body text ${i + 1}`, { x: 50, y: 700, size: 12, font });
    return { doc, font };
  }

  it('takes off ZipyZee\'s own watermark and keeps the page\'s text', async () => {
    const { doc } = await textPdf(3);
    const font = await doc.embedFont(StandardFonts.HelveticaBold); // the web's watermark font
    for (const p of doc.getPages()) drawWatermark(p, { ...WM_DEFAULTS, text: 'CONFIDENTIAL' }, { kind: 'text', font });
    const saved = await reload(doc);
    expect(contentOf(saved.getPage(0))).toMatch(/\/Artifact <<\/Type \/Pagination \/Subtype \/Watermark>> BDC/);

    const scan = scanWatermarks(saved);
    expect(scan.found.layer).toBe(3);
    expect(defaultKinds(scan.found)).toContain('layer');
    expect(cleanAll(saved, scan, ['layer'])).toBe(3);

    const clean = await reload(saved);
    const text = contentOf(clean.getPage(1));
    expect(text).not.toMatch(/Artifact|BDC/);
    expect(text).toMatch(/Tj/); // the body text is still drawn
    expect(scanWatermarks(clean).found).toEqual({ layer: 0, overlay: 0, stamp: 0, notes: 0 });
  });

  it('see-through text drawn by another app, watermark notes, and a logo on every page', async () => {
    const { doc, font } = await textPdf(2);
    const logo = await doc.embedPng(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    );
    for (const p of doc.getPages()) {
      p.drawText('DRAFT', { x: 100, y: 300, size: 80, font, opacity: 0.2 });
      p.drawImage(logo, { x: 10, y: 10, width: 40, height: 40 });
      const note = doc.context.obj({ Type: 'Annot', Subtype: 'Watermark', Rect: [0, 0, 10, 10] });
      p.node.set(PDFName.of('Annots'), doc.context.obj([doc.context.register(note)]));
    }
    const saved = await reload(doc);
    const scan = scanWatermarks(saved);
    expect(scan.found).toEqual({ layer: 0, overlay: 2, stamp: 2, notes: 2 });
    // the repeated image may be a letterhead: off at first while something else was found
    expect(defaultKinds(scan.found)).toEqual(['overlay', 'notes']);

    expect(cleanAll(saved, scan, ['overlay', 'stamp', 'notes'])).toBe(2);
    const clean = await reload(saved);
    const text = contentOf(clean.getPage(0));
    expect(text).not.toMatch(/ Do\b/);
    expect(text).toMatch(/Tj/);
    expect(clean.getPage(0).node.Annots()?.size()).toBe(0);
    expect(scanWatermarks(clean).found).toEqual({ layer: 0, overlay: 0, stamp: 0, notes: 0 });
  });

  it('finds nothing on a plain PDF', async () => {
    const { doc } = await textPdf(2);
    const scan = scanWatermarks(await reload(doc));
    expect(scan.found).toEqual({ layer: 0, overlay: 0, stamp: 0, notes: 0 });
    expect(defaultKinds(scan.found)).toEqual([]);
  });
});
