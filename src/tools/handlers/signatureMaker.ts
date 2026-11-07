import { t } from '@/i18n';
import { dayStamp } from '@/lib/format';
import { ToolError, type ToolHandler } from '../types';

// Signature maker (the app's handlers/signatureMaker.ts; no board): the pad (components/flow/custom/
// SignatureMakerEditor) already made a trimmed PNG on a see-through background; this hands it to the result.
export const signatureMaker: ToolHandler = async ({ options, onProgress }) => {
  const png = String(options.png ?? '');
  if (!png.startsWith('data:image/png')) throw new ToolError(t('Draw, type or photograph your signature first.'));
  onProgress(1, 2, t('Saving your signature'));
  const blob = await (await fetch(png)).blob();
  return { title: t('Your signature is ready'), subtitle: t('A transparent PNG: put it on documents, PDFs or photos.'), files: [{ name: `signature-${dayStamp()}.png`, blob }] };
};
