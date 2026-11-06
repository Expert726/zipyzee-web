// One handler per web tool. Add the id to ./ids.ts too (that's what marks it `web` in the registry).
import type { ToolHandler } from '../types';
import { compressImage, convertImage, resizeImage } from './imageTools';
import { imagesToPdf } from './imagesToPdf';
import { mergePdf } from './mergePdf';
import { pageNumbers } from './pageNumbers';
import { rotatePdf } from './rotatePdf';
import { splitPdf } from './splitPdf';

export const HANDLERS: Record<string, ToolHandler> = {
  'merge-pdf': mergePdf,
  'split-pdf': splitPdf,
  'rotate-pdf': rotatePdf,
  'page-numbers': pageNumbers,
  'images-to-pdf': imagesToPdf,
  'compress-image': compressImage,
  'resize-image': resizeImage,
  'convert-image': convertImage,
};
