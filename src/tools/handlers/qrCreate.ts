import { t } from '@/i18n';
import { qrFileName, type CreateKind } from '../qr';
import { ToolError, type ToolHandler } from '../types';

// QR and barcode, Create (the app's handlers/qrCreate.ts): the editor (components/flow/custom/qr/QrCreateView) drew
// the code; this saves it as a 1024 px PNG and, for print at any size, an SVG.
export const qrCreate: ToolHandler = async ({ options, onProgress }) => {
  const png = options.png;
  if (!(png instanceof Blob)) throw new ToolError(t('Could not make the image'));
  onProgress(1, 1, t('Making your QR code'));
  const name = qrFileName((options.kind as CreateKind) ?? 'link');
  return {
    title: t('QR code saved'),
    files: [
      { name, blob: png },
      { name: name.replace(/\.png$/, '.svg'), blob: new Blob([String(options.svg ?? '')], { type: 'image/svg+xml' }) },
    ],
  };
};
