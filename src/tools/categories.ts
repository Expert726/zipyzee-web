import type { CategoryId } from './types';

/** Category names (English keys), the app's tokens.ts `categories`. */
export const CATEGORY_NAMES: Record<CategoryId, string> = {
  pdf: 'PDF tools',
  image: 'Image tools',
  scan: 'Scan and OCR',
  convert: 'Convert',
  everyday: 'Everyday',
  ai: 'AI tools',
};
