import { t } from '@/i18n';
import { fileStem } from '@/lib/format';
import { stepper } from '@/lib/pdf';
import { ToolError, type ToolHandler } from '../types';

// Protect PDF (the app's handlers/protectPdf.ts): a password to open the file, AES-256 (the strongest standard PDF
// encryption). pdf-lib can't encrypt, so this uses @cantoo/pdf-lib (a maintained pdf-lib fork with encryption), loaded
// only here. The same password is the owner password, so whoever has it can also change the file.
export const protectPdf: ToolHandler = async (ctx) => {
  const { files, options } = ctx;
  const step = stepper(ctx);
  const file = files[0];
  const password = String(options.password ?? '');
  if (!password) throw new ToolError(t('Enter a password'));

  await step(0, 2, t('Encrypting pages'));
  const { PDFDocument, EncryptedPDFError } = await import('@cantoo/pdf-lib');
  let doc;
  try {
    doc = await PDFDocument.load(new Uint8Array(await file.arrayBuffer()), { updateMetadata: false });
  } catch (e) {
    if (e instanceof EncryptedPDFError) throw new ToolError(t('{name} already has a password. Unlock it first.', { name: file.name }));
    throw new ToolError(t('{name} could not be read. It may be damaged.', { name: file.name }));
  }
  doc.encrypt({ userPassword: password, ownerPassword: password });

  await step(1, 2, t('Saving'));
  const bytes = await doc.save();
  return {
    title: t('Your PDF is protected'),
    subtitle: t('It asks for the password when opened'),
    files: [{ name: `${fileStem(file.name)}-protected.pdf`, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }) }],
  };
};
