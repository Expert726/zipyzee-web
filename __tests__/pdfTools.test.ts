import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { mergePdf } from '@/tools/handlers/mergePdf';
import { splitPdf } from '@/tools/handlers/splitPdf';
import { rotatePdf } from '@/tools/handlers/rotatePdf';
import { pageNumbers } from '@/tools/handlers/pageNumbers';
import { getTool } from '@/tools/registry';
import { ToolError, type OptionValues, type ToolResult } from '@/tools/types';

async function pdf(name: string, pages: number): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([595, 842]);
  return new File([(await doc.save()) as BlobPart], name, { type: 'application/pdf' });
}

const run = (id: string, files: File[], options: OptionValues = {}) => {
  const handler = { 'merge-pdf': mergePdf, 'split-pdf': splitPdf, 'rotate-pdf': rotatePdf, 'page-numbers': pageNumbers }[id]!;
  return handler({ tool: getTool(id)!, files, options, onProgress: () => {}, signal: { cancelled: false } });
};

const pagesOf = async (r: ToolResult, i = 0) => PDFDocument.load(await r.files[i].blob.arrayBuffer());

describe('web PDF tools', () => {
  it('merges in order', async () => {
    const r = await run('merge-pdf', [await pdf('a.pdf', 2), await pdf('b.pdf', 3)]);
    expect((await pagesOf(r)).getPageCount()).toBe(5);
    expect(r.title).toBe('Your PDFs are merged');
  });

  it('splits by ranges with the app names', async () => {
    const r = await run('split-pdf', [await pdf('report.pdf', 6)], { mode: 'ranges', ranges: '1-2, 5', n: '2' });
    expect(r.files.map((f) => f.name)).toEqual(['report-pages-1-2.pdf', 'report-page-5.pdf']);
    expect((await pagesOf(r, 0)).getPageCount()).toBe(2);
  });

  it('refuses pages past the end', async () => {
    await expect(run('split-pdf', [await pdf('r.pdf', 3)], { mode: 'ranges', ranges: '2-9' })).rejects.toBeInstanceOf(ToolError);
  });

  it('rotates only the chosen pages', async () => {
    const r = await run('rotate-pdf', [await pdf('r.pdf', 3)], { direction: 'right', which: 'ranges', ranges: '2' });
    const doc = await pagesOf(r);
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90, 0]);
  });

  it('adds page numbers', async () => {
    const r = await run('page-numbers', [await pdf('r.pdf', 2)], { position: 'bottomCenter', format: 'pageNOfTotal', skipFirst: false });
    expect(r.files[0].name).toBe('r-numbered.pdf');
    expect(r.files[0].blob.size).toBeGreaterThan(0);
  });

  it('says a broken file could not be read', async () => {
    const bad = new File(['not a pdf'], 'bad.pdf', { type: 'application/pdf' });
    await expect(run('merge-pdf', [bad, bad])).rejects.toThrow('bad.pdf could not be read');
  });
});
