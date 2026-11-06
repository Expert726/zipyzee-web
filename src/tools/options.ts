// Step 2 (Set options) for each web tool, copied from the app's src/tools/options/index.ts. Labels are English keys,
// translated by OptionFields; validate() runs in the browser and returns translated text (t()).
import { t } from '@/i18n';
import { parseRanges } from './ranges';
import { RESIZE_PRESETS, TARGET_KB } from './image/sizes';
import type { ToolOptions } from './types';

const SPLIT_EXAMPLE = '1-2, 3-4, 5-6';
const PRESET_KEYS: Record<string, string> = { instagram: 'Instagram post', whatsapp: 'WhatsApp DP', facebook: 'Facebook cover', a4: 'A4 print' };

export const TOOL_OPTIONS: Record<string, ToolOptions> = {
  // design/FlowMergePdf.dc.html
  'merge-pdf': { fields: [] },

  // design/FlowSplitPdf.dc.html
  'split-pdf': {
    fields: [
      { kind: 'segmented', key: 'mode', label: 'Split by', default: 'ranges', options: [{ label: 'Page ranges', value: 'ranges' }, { label: 'Every page', value: 'every' }, { label: 'Every N pages', value: 'everyN' }] },
      { kind: 'text', key: 'ranges', label: 'Page ranges', default: SPLIT_EXAMPLE, hint: 'Use commas between ranges' },
      { kind: 'text', key: 'n', label: 'Pages per file', default: '2', numeric: true },
    ],
    visible: (key, v) => (key === 'ranges' ? v.mode === 'ranges' : key === 'n' ? v.mode === 'everyN' : true),
    validate: (v) => {
      if (v.mode === 'ranges') {
        const r = parseRanges(String(v.ranges));
        return r.ok ? null : r.error;
      }
      if (v.mode === 'everyN' && !(Number(v.n) >= 1 && Number.isInteger(Number(v.n)))) return t('Enter how many pages go in each file');
      return null;
    },
  },

  // design/FlowRotatePdf.dc.html (web v1: one direction for all or some pages)
  'rotate-pdf': {
    fields: [
      { kind: 'segmented', key: 'direction', label: 'Rotate', default: 'right', options: [{ label: 'Right', value: 'right' }, { label: 'Left', value: 'left' }, { label: '180°', value: '180' }] },
      { kind: 'segmented', key: 'which', label: 'Pages', default: 'all', options: [{ label: 'All pages', value: 'all' }, { label: 'Page ranges', value: 'ranges' }] },
      { kind: 'text', key: 'ranges', label: 'Page ranges', default: '1', hint: 'Use commas between ranges' },
    ],
    visible: (key, v) => (key === 'ranges' ? v.which === 'ranges' : true),
    validate: (v) => {
      if (v.which !== 'ranges') return null;
      const r = parseRanges(String(v.ranges));
      return r.ok ? null : r.error;
    },
  },

  // design/FlowPageNumbers.dc.html
  'page-numbers': {
    fields: [
      {
        kind: 'chips', key: 'position', label: 'Position', default: 'bottomCenter',
        options: [
          { label: 'Top left', value: 'topLeft' }, { label: 'Top center', value: 'topCenter' }, { label: 'Top right', value: 'topRight' },
          { label: 'Bottom left', value: 'bottomLeft' }, { label: 'Bottom center', value: 'bottomCenter' }, { label: 'Bottom right', value: 'bottomRight' },
        ],
      },
      {
        kind: 'chips', key: 'format', label: 'Format', default: 'pageNOfTotal',
        options: [
          { label: '3', value: 'n' }, { label: '3/12', value: 'slash' }, { label: '3 of 12', value: 'nOfTotal' },
          { label: 'Page 3', value: 'page' }, { label: 'Page 3 of 12', value: 'pageNOfTotal' }, { label: '- 3 -', value: 'dash' },
          { label: 'Custom', value: 'custom' },
        ],
      },
      { kind: 'text', key: 'custom', label: 'Your format', default: '', placeholder: 'Page {n} of {total}', hint: '{n} is the page number, {total} the number of pages' },
      { kind: 'toggle', key: 'skipFirst', label: 'Skip the first page', sub: 'Good for cover pages', default: false },
    ],
    visible: (key, v) => (key === 'custom' ? v.format === 'custom' : true),
    validate: (v) => (v.format === 'custom' && !String(v.custom ?? '').trim() ? t('Type your page number format') : null),
  },

  // design/FlowImagesToPdf.dc.html
  'images-to-pdf': {
    fields: [
      { kind: 'segmented', key: 'pageSize', label: 'Page size', default: 'a4', options: [{ label: 'A4', value: 'a4' }, { label: 'Letter', value: 'letter' }, { label: 'Fit photo', value: 'fit' }] },
      { kind: 'segmented', key: 'orientation', label: 'Orientation', default: 'portrait', options: [{ label: 'Portrait', value: 'portrait' }, { label: 'Landscape', value: 'landscape' }] },
      { kind: 'segmented', key: 'margin', label: 'Margin', default: 'small', options: [{ label: 'None', value: 'none' }, { label: 'Small', value: 'small' }, { label: 'Large', value: 'large' }] },
    ],
  },

  // design/FlowCompressImage.dc.html
  'compress-image': {
    fields: [
      { kind: 'segmented', key: 'target', label: 'Target size', default: 'any', options: [{ label: 'Any', value: 'any' }, ...TARGET_KB.map((kb) => ({ label: `${kb} KB`, value: String(kb) }))] },
      { kind: 'slider', key: 'quality', label: 'Quality', min: 10, max: 95, step: 5, unit: '%', default: 60 },
      { kind: 'segmented', key: 'saveAs', label: 'Save as', default: 'same', options: [{ label: 'Same format', value: 'same' }, { label: 'JPG', value: 'JPEG' }, { label: 'WEBP', value: 'WEBP' }] },
    ],
    visible: (key, v) => (key === 'quality' ? v.target === 'any' : true),
  },

  // design/FlowResizeImage.dc.html
  'resize-image': {
    fields: [
      { kind: 'segmented', key: 'by', label: 'Resize by', default: 'pixels', options: [{ label: 'Pixels', value: 'pixels' }, { label: 'Percent', value: 'percent' }, { label: 'Preset', value: 'preset' }] },
      { kind: 'text', key: 'width', label: 'Width', default: '1080', numeric: true },
      { kind: 'text', key: 'height', label: 'Height', default: '1350', numeric: true },
      { kind: 'toggle', key: 'keep', label: 'Keep proportions', default: true },
      { kind: 'slider', key: 'percent', label: 'Size', min: 10, max: 100, step: 5, unit: '%', default: 50 },
      // English keys of the app's presets (RESIZE_PRESETS labels are getters there)
      { kind: 'chips', key: 'preset', label: 'Presets', default: 'instagram', options: RESIZE_PRESETS.map((p) => ({ label: PRESET_KEYS[p.value], value: p.value })) },
    ],
    visible: (key, v) =>
      key === 'width' || key === 'height' || key === 'keep' ? v.by === 'pixels' : key === 'percent' ? v.by === 'percent' : key === 'preset' ? v.by === 'preset' : true,
    validate: (v) => (v.by === 'pixels' && (!(Number(v.width) > 0) || !(Number(v.height) > 0)) ? t('Enter a width and a height') : null),
  },

  // design/FlowConvertImage.dc.html
  'convert-image': {
    fields: [
      { kind: 'segmented', key: 'to', label: 'Convert to', default: 'JPEG', options: [{ label: 'JPG', value: 'JPEG' }, { label: 'PNG', value: 'PNG' }, { label: 'WEBP', value: 'WEBP' }, { label: 'PDF', value: 'PDF' }] },
      { kind: 'slider', key: 'quality', label: 'Quality', min: 10, max: 100, step: 5, unit: '%', default: 90 },
    ],
    visible: (key, v) => (key === 'quality' ? v.to === 'JPEG' || v.to === 'WEBP' : true),
  },
};

/** What each tool's file input accepts. */
export const ACCEPT: Record<string, string> = {
  pdf: 'application/pdf,.pdf',
  pdfs: 'application/pdf,.pdf',
  image: 'image/jpeg,image/png,image/webp,image/heic,image/heif',
  images: 'image/jpeg,image/png,image/webp,image/heic,image/heif',
};
