// One handler per web tool. Add the id to ./ids.ts too (that's what marks it `web` in the registry).
import type { ToolHandler } from '../types';
import { compressImage, convertImage, resizeImage } from './imageTools';
import { compressPdf } from './compressPdf';
import { pdfToImage } from './pdfToImage';
import { organizePdf } from './organizePdf';
import { removeWatermark } from './removeWatermark';
import { cropPdf } from './cropPdf';
import { annotatePdf } from './annotatePdf';
import { pdfForms } from './pdfForms';
import { protectPdf } from './protectPdf';
import { unlockPdf } from './unlockPdf';
import { comparePdf } from './comparePdf';
import { extractImages } from './extractImages';
import { redactPdf } from './redactPdf';
import { grayscalePdf } from './grayscalePdf';
import { background } from './background';
import { repairPdf } from './repairPdf';
import { cropImage } from './cropImage';
import { passportPhoto } from './passportPhoto';
import { upscaleImage } from './upscaleImage';
import { blurImage } from './blurImage';
import { drawImage } from './drawImage';
import { collage } from './collage';
import { batchEdit } from './batchEdit';
import { stickerMaker } from './stickerMaker';
import { signatureMaker } from './signatureMaker';
import { objectEraser } from './objectEraser';
import { imagesToPdf } from './imagesToPdf';
import { mergePdf } from './mergePdf';
import { pageNumbers } from './pageNumbers';
import { rotatePdf } from './rotatePdf';
import { splitPdf } from './splitPdf';
import { stripMetadata } from './stripMetadata';
import { imageWatermark, pdfWatermark } from './watermarks';

export const HANDLERS: Record<string, ToolHandler> = {
  'merge-pdf': mergePdf,
  'split-pdf': splitPdf,
  'compress-pdf': compressPdf,
  'pdf-to-image': pdfToImage,
  'organize-pdf': organizePdf,
  'remove-watermark': removeWatermark,
  'crop-pdf': cropPdf,
  'annotate-pdf': annotatePdf,
  'sign-pdf': annotatePdf,
  'pdf-forms': pdfForms,
  'protect-pdf': protectPdf,
  'unlock-pdf': unlockPdf,
  'compare-pdf': comparePdf,
  'extract-images': extractImages,
  'redact-pdf': redactPdf,
  'grayscale-pdf': grayscalePdf,
  'remove-bg': background,
  'change-bg': background,
  'repair-pdf': repairPdf,
  'crop-image': cropImage,
  'passport-photo': passportPhoto,
  'upscale-image': upscaleImage,
  'blur-image': blurImage,
  'draw-image': drawImage,
  collage,
  'batch-edit': batchEdit,
  'sticker-maker': stickerMaker,
  'signature-maker': signatureMaker,
  'object-eraser': objectEraser,
  'rotate-pdf': rotatePdf,
  'page-numbers': pageNumbers,
  'images-to-pdf': imagesToPdf,
  'compress-image': compressImage,
  'resize-image': resizeImage,
  'convert-image': convertImage,
  'pdf-watermark': pdfWatermark,
  'image-watermark': imageWatermark,
  'strip-metadata': stripMetadata,
};
