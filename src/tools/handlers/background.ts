import { t } from '@/i18n';
import { ToolError, type ToolHandler } from '../types';

// Background remover and Change background (the app's handlers/background.ts): the editor
// (components/flow/custom/BgEditor) makes the final image in the browser; this hands it to the result screen.
export const background: ToolHandler = async (ctx) => {
  const { options, onProgress } = ctx;
  const blob = options.blob;
  if (!(blob instanceof Blob)) throw new ToolError(t('The background could not be found. Try another photo.'));
  const remove = options.remove === true;
  onProgress(1, 1, remove ? t('Saving') : t('Blending edges'));
  return { title: remove ? t('Background removed') : t('New background saved'), files: [{ name: String(options.name), blob }] };
};
