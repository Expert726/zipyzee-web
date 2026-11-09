// Step 2 (Set options) for each web tool, copied from the app's src/tools/options/index.ts. Labels are English keys,
// translated by OptionFields; validate() runs in the browser and returns translated text (t()).
import { t } from '@/i18n';
import { parseRanges } from './ranges';
import { TARGET_KB } from './image/sizes';
import { PRESET_GROUPS } from './image/presets';
import { WM_COLORS, WM_DEFAULTS } from './pdfWatermark';
import { DEFAULT_QUALITY, MAX_QUALITY, MIN_QUALITY } from './pdfCompress';
import type { ToolOptions } from './types';

const SPLIT_EXAMPLE = '1-2, 3-4, 5-6';

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

  // design/FlowPdfWatermark.dc.html + the app's PdfWatermarkStep (logo, color, weight, size, angle, position, pages)
  'pdf-watermark': {
    fields: [
      { kind: 'segmented', key: 'kind', label: 'Type', default: 'text', options: [{ label: 'Text', value: 'text' }, { label: 'Logo', value: 'logo' }] },
      { kind: 'text', key: 'text', label: 'Text', default: WM_DEFAULTS.text },
      { kind: 'image', key: 'logo', label: 'Choose a logo', change: 'Change logo', hint: 'A PNG with a see-through background looks best.', default: null },
      { kind: 'color', key: 'color', label: 'Color', colors: WM_COLORS, default: WM_DEFAULTS.color },
      { kind: 'toggle', key: 'bold', label: 'Bold', default: WM_DEFAULTS.bold },
      { kind: 'slider', key: 'opacity', label: 'Opacity', min: 10, max: 100, step: 5, unit: '%', default: WM_DEFAULTS.opacity * 100 },
      { kind: 'slider', key: 'size', label: 'Size', min: 10, max: 100, step: 5, unit: '%', default: WM_DEFAULTS.size },
      { kind: 'slider', key: 'angle', label: 'Angle', min: -90, max: 90, step: 5, unit: '°', default: WM_DEFAULTS.angle },
      {
        kind: 'chips', key: 'position', label: 'Position', default: WM_DEFAULTS.position,
        options: [
          { label: 'Center', value: 'center' }, { label: 'Tiled', value: 'tiled' }, { label: 'Top', value: 'top' }, { label: 'Bottom', value: 'bottom' },
          { label: 'Top left', value: 'topLeft' }, { label: 'Top right', value: 'topRight' }, { label: 'Bottom left', value: 'bottomLeft' }, { label: 'Bottom right', value: 'bottomRight' },
        ],
      },
      { kind: 'segmented', key: 'which', label: 'Pages', default: 'all', options: [{ label: 'All pages', value: 'all' }, { label: 'Choose pages', value: 'ranges' }] },
      { kind: 'text', key: 'pages', label: 'Page ranges', default: '1', hint: 'Use commas between ranges' },
    ],
    visible: (key, v) =>
      key === 'text' || key === 'color' || key === 'bold' ? v.kind === 'text' : key === 'logo' ? v.kind === 'logo' : key === 'pages' ? v.which === 'ranges' : true,
    validate: (v) => {
      if (v.kind === 'text' && !String(v.text ?? '').trim()) return t('Enter the watermark text');
      if (v.kind === 'logo' && !(v.logo instanceof File)) return t('Choose a logo');
      if (v.which === 'ranges') {
        const r = parseRanges(String(v.pages ?? ''));
        if (!r.ok) return r.error;
      }
      return null;
    },
  },

  // design/FlowCompressPdf.dc.html (the app's method and slider; "Turn pages into images" needs page rendering, later)
  'compress-pdf': {
    fields: [
      { kind: 'segmented', key: 'method', label: 'Method', default: 'quality', options: [{ label: 'Quality reduction', value: 'quality' }, { label: 'Lossless', value: 'lossless' }] },
      { kind: 'slider', key: 'quality', label: 'Quality', min: MIN_QUALITY, max: MAX_QUALITY, step: 5, unit: '%', default: DEFAULT_QUALITY },
      { kind: 'note', text: 'Quality reduction makes the photos smaller. Text stays sharp and can still be selected.' },
    ],
    visible: (key, v) => (key === 'quality' ? v.method !== 'lossless' : true),
  },

  // design/FlowPdfToImage.dc.html (choosing pages: page ranges until there are page thumbnails)
  'pdf-to-image': {
    fields: [
      { kind: 'segmented', key: 'format', label: 'Format', default: 'jpg', options: [{ label: 'JPG', value: 'jpg' }, { label: 'PNG', value: 'png' }] },
      { kind: 'segmented', key: 'quality', label: 'Quality', default: 'normal', options: [{ label: 'Normal', value: 'normal' }, { label: 'High (for print)', value: 'high' }] },
      { kind: 'segmented', key: 'pages', label: 'Pages', default: 'all', options: [{ label: 'All pages', value: 'all' }, { label: 'Choose pages', value: 'choose' }] },
      { kind: 'text', key: 'ranges', label: 'Page ranges', default: '1', hint: 'Use commas between ranges' },
    ],
    visible: (key, v) => (key === 'ranges' ? v.pages === 'choose' : true),
    validate: (v) => {
      if (v.pages !== 'choose') return null;
      const r = parseRanges(String(v.ranges ?? ''));
      return r.ok ? null : r.error;
    },
  },

  // design/FlowCropPdf.dc.html
  'crop-pdf': {
    fields: [
      { kind: 'segmented', key: 'mode', label: 'Mode', default: 'whiteMargins', options: [{ label: 'Remove white margins', value: 'whiteMargins' }] },
      { kind: 'note', text: 'Every page is trimmed to its content, with a small margin kept. Nothing is deleted: the crop can be undone in a PDF editor.' },
    ],
  },

  // design/FlowProtectPdf.dc.html
  'protect-pdf': {
    fields: [
      { kind: 'text', key: 'password', label: 'Password', default: '', secure: true },
      { kind: 'text', key: 'confirm', label: 'Type it again', default: '', secure: true },
      { kind: 'note', text: 'Keep this password safe. Nobody, including us, can recover it.' },
    ],
    validate: (v) => (!v.password ? t('Enter a password') : v.password !== v.confirm ? t('Passwords don\'t match') : null),
  },

  // design/FlowUnlockPdf.dc.html
  'unlock-pdf': {
    fields: [
      { kind: 'text', key: 'password', label: 'Password', default: '', secure: true, hint: 'The password you use to open this file' },
      { kind: 'note', text: 'Only unlock files you own or have permission to change.' },
    ],
    validate: (v) => (!v.password ? t('Enter the password') : null),
  },

  // design/FlowComparePdf.dc.html: two versions, compared in the browser
  'compare-pdf': {
    fields: [{ kind: 'note', text: 'Compares the text on each page. Layout and image changes are not shown.' }],
    validate: (_v, files) => (files.length !== 2 ? t('Choose 2 versions to compare.') : null),
  },

  // design/FlowExtractImages.dc.html
  'extract-images': {
    fields: [
      { kind: 'segmented', key: 'format', label: 'Save as', default: 'original', options: [{ label: 'Original', value: 'original' }, { label: 'JPG', value: 'jpg' }, { label: 'PNG', value: 'png' }] },
      { kind: 'toggle', key: 'skipTiny', label: 'Skip tiny images', sub: 'Icons and logos under 10 KB', default: true },
    ],
  },

  // Grayscale PDF (no board; the app's options)
  'grayscale-pdf': {
    fields: [
      { kind: 'segmented', key: 'quality', label: 'Quality', default: 'standard', options: [{ label: 'Standard', value: 'standard' }, { label: 'High', value: 'high' }] },
      { kind: 'note', text: 'Pages become pictures, so their text can\'t be selected or searched.' },
    ],
  },

  // design/FlowRepairPdf.dc.html
  'repair-pdf': {
    fields: [{ kind: 'note', text: 'We rebuild the file and recover as many pages as we can. Some damaged images may not come back.' }],
  },

  // design/FlowUpscaleImage.dc.html (web: no "Fix faces" yet)
  'upscale-image': {
    fields: [
      { kind: 'segmented', key: 'scale', label: 'Size', default: '2', options: [{ label: '2x', value: '2' }, { label: '4x', value: '4' }] },
      { kind: 'note', text: 'Done in your browser. The first time, the upscaler downloads once (about 7 MB for 2x, 21 MB for 4x).' },
    ],
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
  // design/FlowBatchEdit.dc.html (the app's card around the settings is left out: they show under the steps)
  'batch-edit': {
    fields: [
      {
        kind: 'chips', key: 'steps', label: 'Do these steps in order', multi: true, default: ['resize', 'compress', 'strip'],
        options: [
          { label: 'Resize', value: 'resize' },
          { label: 'Compress', value: 'compress' },
          { label: 'Convert to JPG', value: 'convert' },
          { label: 'Remove metadata', value: 'strip' },
          { label: 'Rename', value: 'rename' },
        ],
      },
      { kind: 'text', key: 'longest', label: 'Longest side', default: '1600', numeric: true, suffix: 'px' },
      { kind: 'slider', key: 'quality', label: 'Quality', min: 10, max: 95, step: 5, unit: '%', default: 75 },
      { kind: 'text', key: 'name', label: 'New name', default: 'photo-{n}', hint: '{n} becomes 1, 2, 3...' },
    ],
    visible: (key, v) => {
      const steps = (v.steps as string[]) ?? [];
      if (key === 'longest') return steps.includes('resize');
      if (key === 'quality') return steps.includes('compress');
      if (key === 'name') return steps.includes('rename');
      return true;
    },
    validate: (v) => {
      const steps = (v.steps as string[]) ?? [];
      if (!steps.length) return t('Choose at least one step');
      if (steps.includes('resize') && !(Number(v.longest) > 0)) return t('Enter the longest side in pixels');
      return null;
    },
  },

  // Sticker maker (the app's options; the note says where it happens on the web)
  'sticker-maker': {
    fields: [
      { kind: 'toggle', key: 'outline', label: 'White outline', sub: 'Like WhatsApp stickers', default: true },
      { kind: 'note', text: 'The subject is cut out in your browser and saved as a 512 × 512 WebP under 100 KB, the size WhatsApp takes. The first time, the cut-out tool downloads once (about 44 MB).' },
    ],
  },

  // Image to Excel (the app's options) and the languages to read (web: Tesseract)
  'image-to-excel': {
    fields: [
      { kind: 'chips', key: 'languages', label: 'Languages in the file', multi: true, default: ['eng'], options: [{ label: 'English', value: 'eng' }, { label: 'Urdu', value: 'urd' }, { label: 'Arabic', value: 'ara' }] },
      { kind: 'segmented', key: 'sheets', label: 'Put tables in', default: 'each', options: [{ label: 'One sheet each', value: 'each' }, { label: 'All in one sheet', value: 'one' }] },
      { kind: 'note', text: 'Read in your browser. The first time, the text reader downloads once for each language.' },
    ],
    validate: (v) => ((v.languages as string[] | undefined)?.length ? null : t('Choose at least one language')),
  },
  // Searchable PDF (a server tool in the app): an invisible text layer over every page, the look unchanged
  'searchable-pdf': {
    fields: [
      { kind: 'chips', key: 'languages', label: 'Languages in the file', multi: true, default: ['eng'], options: [{ label: 'English', value: 'eng' }, { label: 'Urdu', value: 'urd' }, { label: 'Arabic', value: 'ara' }] },
      { kind: 'note', text: 'Text is added invisibly behind the pages, so they look exactly the same. Read in your browser; big files take a while.' },
    ],
    validate: (v) => ((v.languages as string[] | undefined)?.length ? null : t('Choose at least one language')),
  },

  // the spreadsheet tools (the app's options)
  'excel-to-pdf': {
    fields: [
      { kind: 'segmented', key: 'fit', label: 'Fit', default: 'actual', options: [{ label: 'Actual size', value: 'actual' }, { label: 'Fit width', value: 'width' }, { label: 'One page per sheet', value: 'page' }] },
      { kind: 'segmented', key: 'orientation', label: 'Orientation', default: 'portrait', options: [{ label: 'Portrait', value: 'portrait' }, { label: 'Landscape', value: 'landscape' }] },
    ],
  },
  'convert-sheet': {
    fields: [
      { kind: 'segmented', key: 'format', label: 'Save as', default: 'xlsx', options: [{ label: 'Excel (.xlsx)', value: 'xlsx' }, { label: 'CSV', value: 'csv' }] },
      { kind: 'toggle', key: 'split', label: 'One file per sheet', sub: 'Each sheet saved as its own file', default: false },
      { kind: 'note', text: 'CSV keeps only the values: one file per sheet, without formatting or formulas.' },
    ],
    visible: (key, v) => (key === 'split' ? v.format !== 'csv' : true),
  },
  'merge-excel': {
    fields: [
      { kind: 'segmented', key: 'mode', label: 'Put in', default: 'sheets', options: [{ label: 'One sheet per file', value: 'sheets' }, { label: 'All rows in one sheet', value: 'rows' }] },
      { kind: 'toggle', key: 'dropHeaders', label: 'Keep only the first header row', sub: 'Skip the first row of every other file', default: true },
    ],
    visible: (key, v) => (key === 'dropHeaders' ? v.mode === 'rows' : true),
  },
  'pdf-to-excel': {
    fields: [
      { kind: 'segmented', key: 'sheets', label: 'Put tables in', default: 'each', options: [{ label: 'One sheet each', value: 'each' }, { label: 'All in one sheet', value: 'one' }] },
      { kind: 'note', text: 'Works best on clear printed tables. Scanned pages are read in your browser, which takes longer.' },
    ],
  },

  'pdf-to-text': {
    fields: [
      { kind: 'segmented', key: 'format', label: 'Save as', default: 'markdown', options: [{ label: 'Plain text', value: 'text' }, { label: 'Markdown', value: 'markdown' }] },
      { kind: 'toggle', key: 'structure', label: 'Keep headings and lists', default: true },
    ],
    visible: (key, v) => (key === 'structure' ? v.format === 'markdown' : true),
  },

  // Make a ZIP (the app's options)
  'make-zip': {
    fields: [
      { kind: 'text', key: 'name', label: 'ZIP name', default: '', placeholder: 'files', hint: '.zip is added for you' },
      { kind: 'segmented', key: 'level', label: 'Compression', default: 'normal', options: [{ label: 'Normal', value: 'normal' }, { label: 'Maximum', value: 'max' }, { label: 'Fast', value: 'fast' }] },
      { kind: 'toggle', key: 'protect', label: 'Password protect', sub: 'AES-256: nobody opens it without the password', default: false },
      { kind: 'text', key: 'password', label: 'Password', default: '', secure: true },
      { kind: 'text', key: 'confirm', label: 'Type it again', default: '', secure: true },
    ],
    visible: (key, v) => (key === 'password' || key === 'confirm' ? !!v.protect : true),
    validate: (v) => (!v.protect ? null : !String(v.password ?? '') ? t('Enter a password') : v.password !== v.confirm ? t('The passwords don\'t match') : null),
  },

  // PDF to Word in the browser: editable text (default) or the exact look (pages as pictures)
  'pdf-to-word': {
    fields: [
      { kind: 'segmented', key: 'mode', label: 'Result', default: 'text', options: [{ label: 'Editable text', value: 'text' }, { label: 'Keep layout', value: 'layout' }] },
      { kind: 'toggle', key: 'ocr', label: 'Read scanned pages (OCR)', sub: 'Slower, needed for photos of pages', default: false },
      { kind: 'note', text: 'Editable text keeps headings, lists and paragraphs; Keep layout puts each page in as a picture, exactly as it looks.' },
    ],
    visible: (key, v) => (key === 'ocr' ? v.mode === 'text' : true),
  },

  'compress-image': {
    fields: [
      { kind: 'segmented', key: 'target', label: 'Target size', default: 'any', options: [{ label: 'Any', value: 'any' }, ...TARGET_KB.map((kb) => ({ label: `${kb} KB`, value: String(kb) }))] },
      { kind: 'slider', key: 'quality', label: 'Quality', min: 10, max: 95, step: 5, unit: '%', default: 60 },
      // the board's Same format / JPG / WEBP, and AVIF and PNG on the web (src/lib/encoders.ts; PNG = up to 256 colours)
      {
        kind: 'chips', key: 'saveAs', label: 'Save as', default: 'same',
        options: [{ label: 'Same format', value: 'same' }, { label: 'JPG', value: 'JPEG' }, { label: 'WEBP', value: 'WEBP' }, { label: 'AVIF', value: 'AVIF' }, { label: 'PNG', value: 'PNG' }],
      },
      { kind: 'note', text: 'AVIF is the smallest for the same quality; PNG keeps see-through parts and uses up to 256 colours.' },
    ],
    visible: (key, v) => (key === 'quality' ? v.target === 'any' && v.saveAs !== 'PNG' : true),
  },

  // design/FlowImageWatermark.dc.html
  'image-watermark': {
    fields: [
      { kind: 'segmented', key: 'type', label: 'Type', default: 'text', options: [{ label: 'Text', value: 'text' }, { label: 'Logo', value: 'logo' }] },
      { kind: 'text', key: 'text', label: 'Text', default: '', placeholder: '@yourname' },
      { kind: 'image', key: 'logo', label: 'Choose logo', change: 'Change logo', default: null },
      // web: text colour, size and all four corners, seen live on the photo (components/flow/previews)
      { kind: 'color', key: 'color', label: 'Text color', colors: ['#FFFFFF', '#111827', '#E5533D', '#F59E0B', '#3F7D1C', '#2563EB'], default: '#FFFFFF' },
      { kind: 'slider', key: 'size', label: 'Size', min: 40, max: 250, step: 10, unit: '%', default: 100 },
      { kind: 'slider', key: 'opacity', label: 'Opacity', min: 10, max: 100, step: 5, unit: '%', default: 80 },
      {
        kind: 'chips', key: 'position', label: 'Position', default: 'corner',
        options: [
          { label: 'Bottom right', value: 'corner' }, { label: 'Bottom left', value: 'bl' }, { label: 'Top right', value: 'tr' }, { label: 'Top left', value: 'tl' },
          { label: 'Center', value: 'center' }, { label: 'Tiled', value: 'tiled' },
        ],
      },
    ],
    visible: (key, v) => (key === 'text' || key === 'color' ? v.type === 'text' : key === 'logo' ? v.type === 'logo' : true),
    validate: (v) => (v.type === 'logo' ? (v.logo instanceof File ? null : t('Choose a logo')) : String(v.text ?? '').trim() ? null : t('Type the watermark text')),
  },

  // design/FlowStripMetadata.dc.html (web: everything is removed; JPG and PNG are not re-encoded)
  'strip-metadata': {
    fields: [{ kind: 'note', text: 'Location, camera, date and owner details are removed. JPG and PNG keep their full quality.' }],
  },

  // design/FlowResizeImage.dc.html
  'resize-image': {
    fields: [
      { kind: 'segmented', key: 'by', label: 'Resize by', default: 'pixels', options: [{ label: 'Pixels', value: 'pixels' }, { label: 'Percent', value: 'percent' }, { label: 'Preset', value: 'preset' }] },
      { kind: 'text', key: 'width', label: 'Width', default: '1080', numeric: true },
      { kind: 'text', key: 'height', label: 'Height', default: '1350', numeric: true },
      { kind: 'toggle', key: 'keep', label: 'Keep proportions', default: true },
      { kind: 'slider', key: 'percent', label: 'Size', min: 10, max: 100, step: 5, unit: '%', default: 50 },
      // the app's 4 presets and many more, by platform (src/tools/image/presets.ts)
      {
        kind: 'groups', key: 'preset', label: 'Presets', default: 'instagram',
        groups: PRESET_GROUPS.map((g) => ({ label: g.label, options: g.presets.map((p) => ({ label: p.label, value: p.value, hint: `${p.w} × ${p.h}` })) })),
      },
    ],
    visible: (key, v) =>
      key === 'width' || key === 'height' || key === 'keep' ? v.by === 'pixels' : key === 'percent' ? v.by === 'percent' : key === 'preset' ? v.by === 'preset' : true,
    validate: (v) => (v.by === 'pixels' && (!(Number(v.width) > 0) || !(Number(v.height) > 0)) ? t('Enter a width and a height') : null),
  },

  // design/FlowConvertImage.dc.html
  'convert-image': {
    fields: [
      // the board's JPG / PNG / WEBP / PDF, and every other format the browser can write (src/lib/encoders.ts)
      {
        kind: 'chips', key: 'to', label: 'Convert to', default: 'JPEG',
        options: ['JPEG', 'PNG', 'WEBP', 'AVIF', 'GIF', 'BMP', 'TIFF', 'ICO', 'PDF'].map((f) => ({ label: f === 'JPEG' ? 'JPG' : f, value: f })),
      },
      { kind: 'slider', key: 'quality', label: 'Quality', min: 10, max: 100, step: 5, unit: '%', default: 90 },
      { kind: 'note', text: 'ICO makes a Windows or website icon (16 to 256 px). GIF uses up to 256 colours.' },
    ],
    visible: (key, v) => (key === 'quality' ? v.to === 'JPEG' || v.to === 'WEBP' || v.to === 'AVIF' : true),
  },
};

/** What each tool's file input accepts. */
export const ACCEPT: Record<string, string> = {
  pdf: 'application/pdf,.pdf',
  pdfs: 'application/pdf,.pdf',
  // what browsers can open (HEIC: Safari)
  image: 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,image/x-icon,image/heic,image/heif,.ico',
  images: 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/bmp,image/x-icon,image/heic,image/heif,.ico',
  sheet: '.xlsx,.xlsm,.xls,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.oasis.opendocument.spreadsheet,text/csv',
  sheets: '.xlsx,.xlsm,.xls,.ods,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.oasis.opendocument.spreadsheet,text/csv',
  archive: '.zip,.rar,.7z,application/zip,application/x-rar-compressed,application/vnd.rar,application/x-7z-compressed',
  office: '.doc,.docx,.ppt,.pptx,.odt,.odp,.rtf',
  files: '',
};
