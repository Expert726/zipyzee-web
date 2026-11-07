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

import { organizePdf } from '@/tools/handlers/organizePdf';
import { addBlank, duplicateSelected, initialPages, rotateSelected } from '@/tools/organize';

describe('Organize PDF', () => {
  it('reorders, rotates, duplicates and adds a blank page', async () => {
    let pages = initialPages(3).reverse(); // 3, 2, 1
    pages = rotateSelected(pages, new Set(['p0'])); // the original first page, now last, turned
    pages = duplicateSelected(pages, new Set(['p2'])); // copy of page 3
    pages = addBlank(pages);
    const r = await organizePdf({ tool: getTool('organize-pdf')!, files: [await pdf('r.pdf', 3)], options: { pages }, onProgress: () => {}, signal: { cancelled: false } });
    const doc = await PDFDocument.load(await r.files[0].blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(5);
    // the blank page looks like the page before it (the app's rule), so it is turned too
    expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 0, 0, 90, 90]);
    expect(r.files[0].name).toBe('r-organized.pdf');
  });

  it('refuses to save no pages', async () => {
    await expect(organizePdf({ tool: getTool('organize-pdf')!, files: [await pdf('r.pdf', 1)], options: { pages: [] }, onProgress: () => {}, signal: { cancelled: false } })).rejects.toThrow('Keep at least one page.');
  });
});

import { annotatePdf } from '@/tools/handlers/annotatePdf';
import type { Item } from '@/tools/annotate/model';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('Annotate and sign', () => {
  const marks: Item[] = [
    { id: 'a', type: 'ink', page: 0, kind: 'pen', points: [{ x: 10, y: 10 }, { x: 60, y: 40 }], color: '#2563EB', width: 2 },
    { id: 'b', type: 'ink', page: 0, kind: 'highlight', points: [{ x: 10, y: 80 }, { x: 200, y: 80 }], color: '#FDE047', width: 14 },
    { id: 'c', type: 'text', page: 0, x: 40, y: 120, w: 200, text: 'Approved by the board', size: 14 },
    { id: 'd', type: 'note', page: 1, x: 40, y: 40, text: 'Check this page' },
    { id: 'e', type: 'signature', page: 1, x: 300, y: 600, w: 120, h: 40, png: PNG, rotation: 90 },
  ];
  const run = (id: string, items: Item[], file: File) => annotatePdf({ tool: getTool(id)!, files: [file], options: { items }, onProgress: () => {}, signal: { cancelled: false } });

  it('writes ink, highlight, text, notes and a turned signature into the pages', async () => {
    const r = await run('annotate-pdf', marks, await pdf('r.pdf', 2));
    expect(r.title).toBe('Changes saved');
    const doc = await PDFDocument.load(await r.files[0].blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(2);
    expect(r.files[0].blob.size).toBeGreaterThan(1500);
    const s = await run('sign-pdf', [marks[4]], await pdf('contract.pdf', 2));
    expect(s.title).toBe('Your PDF is signed');
    expect(s.files[0].name).toBe('contract-signed.pdf');
  });

  it('says when text has letters the PDF font can\'t write', async () => {
    await expect(run('annotate-pdf', [{ id: 'u', type: 'text', page: 0, x: 0, y: 0, w: 100, text: 'منظور', size: 14 }], await pdf('r.pdf', 1))).rejects.toThrow('Latin letters');
  });
});

import { pdfForms } from '@/tools/handlers/pdfForms';

describe('PDF forms', () => {
  async function form() {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const f = doc.getForm();
    f.createTextField('full_name').addToPage(page, { x: 50, y: 700, width: 200, height: 24 });
    f.createCheckBox('agree').addToPage(page, { x: 50, y: 650, width: 16, height: 16 });
    return new File([(await doc.save()) as BlobPart], 'form.pdf', { type: 'application/pdf' });
  }
  const run = async (fields: Record<string, string | boolean>, lock = false) =>
    pdfForms({ tool: getTool('pdf-forms')!, files: [await form()], options: { fields, lock }, onProgress: () => {}, signal: { cancelled: false } });

  it('fills the fields and keeps them editable', async () => {
    const r = await run({ full_name: 'Zain Ahmed', agree: true });
    const doc = await PDFDocument.load(await r.files[0].blob.arrayBuffer());
    expect(doc.getForm().getTextField('full_name').getText()).toBe('Zain Ahmed');
    expect(doc.getForm().getCheckBox('agree').isChecked()).toBe(true);
    expect(r.files[0].name).toBe('form-filled.pdf');
  });

  it('locks them into the page', async () => {
    const r = await run({ full_name: 'Zain Ahmed' }, true);
    expect((await PDFDocument.load(await r.files[0].blob.arrayBuffer())).getForm().getFields()).toHaveLength(0);
  });

  it('leaves Urdu to the viewer, and won\'t lock it', async () => {
    const r = await run({ full_name: 'زین احمد' });
    const doc = await PDFDocument.load(await r.files[0].blob.arrayBuffer());
    expect(doc.getForm().getTextField('full_name').getText()).toBe('زین احمد');
    await expect(run({ full_name: 'زین احمد' }, true)).rejects.toThrow('Latin letters');
  });
});

import { protectPdf } from '@/tools/handlers/protectPdf';
import { unlockPdf } from '@/tools/handlers/unlockPdf';

describe('Protect and Unlock PDF', () => {
  const run = (id: string, file: File, password: string) =>
    (id === 'protect-pdf' ? protectPdf : unlockPdf)({ tool: getTool(id)!, files: [file], options: { password }, onProgress: () => {}, signal: { cancelled: false } });
  const asFile = async (r: { files: { name: string; blob: Blob }[] }) => new File([await r.files[0].blob.arrayBuffer()], r.files[0].name, { type: 'application/pdf' });

  it('locks with a password that a normal open can\'t get past, and unlocks with it', async () => {
    const locked = await asFile(await run('protect-pdf', await pdf('report.pdf', 3), 'S3cret!'));
    expect(locked.name).toBe('report-protected.pdf');
    await expect(PDFDocument.load(await locked.arrayBuffer())).rejects.toThrow(/encrypted/i);
    const open = await run('unlock-pdf', locked, 'S3cret!');
    expect(open.title).toBe('Password removed');
    const doc = await PDFDocument.load(await open.files[0].blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(3);
    expect(doc.isEncrypted).toBe(false);
  });

  it('says when the password is wrong, when there is none, and when there already is one', async () => {
    const locked = await asFile(await run('protect-pdf', await pdf('r.pdf', 1), 'right'));
    await expect(run('unlock-pdf', locked, 'wrong')).rejects.toThrow('That password didn\'t work');
    await expect(run('unlock-pdf', await pdf('plain.pdf', 1), 'x')).rejects.toThrow('has no password');
    await expect(run('protect-pdf', locked, 'again')).rejects.toThrow('already has a password');
  });
});
