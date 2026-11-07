import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { deflate, inflate, losslessPass, unpredict } from '@/tools/pdfShrink';
import { compressPdf } from '@/tools/handlers/compressPdf';
import { getTool } from '@/tools/registry';

async function source() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage();
  for (let i = 0; i < 40; i++) page.drawText(`Line ${i} of the same report, repeated to make a real content stream.`, { x: 40, y: 800 - i * 18, size: 10, font });
  return doc;
}

describe('Compress PDF (lossless)', () => {
  it('keeps repeated streams once, packs plain ones and drops unused objects', async () => {
    const src = await source();
    const doc = await PDFDocument.create();
    // copying the same page in separate calls duplicates its content and font
    for (let i = 0; i < 4; i++) (await doc.copyPages(src, [0])).forEach((p) => doc.addPage(p));
    // an unpacked stream the catalog points to, and one nothing points to
    doc.catalog.set(PDFName.of('ZZPlain'), doc.context.register(doc.context.stream('x'.repeat(4000))));
    doc.context.register(doc.context.stream('orphan'.repeat(500)));
    // like a real file: from its bytes (streams are then raw, as read)
    const bytes = await doc.save({ useObjectStreams: false });
    const loaded = await PDFDocument.load(bytes);
    const before = bytes.length;
    const report = await losslessPass(loaded);
    const after = (await loaded.save()).length;
    expect(report.deduped).toBeGreaterThan(0);
    expect(report.packed).toBeGreaterThan(0);
    expect(report.dropped).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
    // still a valid PDF with every page
    expect((await PDFDocument.load(await loaded.save())).getPageCount()).toBe(4);
  });

  it('round-trips Flate data', async () => {
    const data = new TextEncoder().encode('hello hello hello hello');
    expect(new TextDecoder().decode(await inflate(await deflate(data)))).toBe('hello hello hello hello');
  });

  it('undoes PNG predictors', () => {
    // 2 rows, 2 grey pixels: row 1 "Sub" (left), row 2 "Up"
    const data = new Uint8Array([1, 10, 5, 2, 1, 1]);
    expect([...unpredict(data, 2, 1)]).toEqual([10, 15, 11, 16]);
  });

  it('keeps the original when it can\'t get smaller', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const file = new File([bytes as BlobPart], 'tiny.pdf', { type: 'application/pdf' });
    const r = await compressPdf({ tool: getTool('compress-pdf')!, files: [file], options: { method: 'lossless' }, onProgress: () => {}, signal: { cancelled: false } });
    expect(r.title).toBe('Your PDF is already small');
    expect(r.files[0].blob.size).toBe(file.size);
    expect(r.files[0].name).toBe('tiny-compressed.pdf');
  });
});
