// Live previews under the options step's file list (a tool's options shown on the real file as they change).
import type { OptionValues } from '@/tools/types';
import { ImageWatermarkPreview } from './ImageWatermarkPreview';

export type LivePreviewProps = { files: File[]; values: OptionValues };

export const LIVE_PREVIEWS: Record<string, (p: LivePreviewProps) => React.ReactElement> = {
  'image-watermark': ImageWatermarkPreview,
};
