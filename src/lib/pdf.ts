// pdf-lib in the browser: files never leave the computer.
import { PDFDocument } from 'pdf-lib';
import { t } from '@/i18n';
import { ToolError, type OutputFile, type ToolContext } from '@/tools/types';

export async function loadPdf(file: File): Promise<PDFDocument> {
  const bytes = await file.arrayBuffer();
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (e instanceof Error && /encrypt/i.test(e.message)) throw new ToolError(t('{name} is password protected. Unlock it first.', { name: file.name }));
    throw new ToolError(t('{name} could not be read. It may be damaged.', { name: file.name }));
  }
}

export async function savePdf(doc: PDFDocument, name: string): Promise<OutputFile> {
  const bytes = await doc.save();
  return { name, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) };
}

/** Reports progress, stops when cancelled, and lets the page repaint between units of work. */
export function stepper(ctx: Pick<ToolContext, 'onProgress' | 'signal'>) {
  return async (done: number, total: number, label: string) => {
    if (ctx.signal.cancelled) throw new ToolError(t('Cancelled'));
    ctx.onProgress(done, total, label);
    await new Promise((r) => setTimeout(r, 0));
  };
}
