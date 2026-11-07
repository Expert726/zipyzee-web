// All 70 tools, generated from the app's src/tools/registry.ts (same ids, order, names and copy). Text fields are the
// English keys: translate them where they're shown (t(tool.name)), never here, so this file is the same on the server
// and in the browser. `web` = the tool works on the web site now (see src/tools/handlers/index.ts); the rest show
// "Coming to the web" with a link to the Android app.
import {
  AlignLeft, Archive, Brush, FileArchive, Package, Cake, Calculator, Camera, WandSparkles, Contact, Contrast, CreditCard, Crop, Droplet, Eraser, EyeOff, FileCode, FileImage, FileSearch, FileText,
  FileSpreadsheet, FormInput, GitCompare, Globe, GraduationCap, Hash, Highlighter, ImagePlus, Images, Languages, Layers, LayoutDashboard,
  LayoutGrid, Lock, Merge, NotebookPen, MessagesSquare, Minimize2, Paintbrush, PenLine, Presentation, QrCode, RefreshCw, RotateCw,
  Scaling, ScanLine, ScanText, Scissors, Sheet, ShieldOff, Signature, Sparkles, Split, Stamp, Sticker, TableProperties, Unlock, User, Wrench,
} from 'lucide-react';
import type { CategoryId, Tool } from './types';
import { WEB_TOOLS } from './handlers/ids';

/**
 * Like the app's SERVER_TOOLS_LIVE = false: server tools are "coming soon" (not counted) until the server is live,
 * except the ones the website now does in the browser (in WEB_TOOLS, e.g. Repair PDF).
 */
const SERVER_TOOLS_LIVE = false;

const tool = (x: Omit<Tool, 'web'>): Tool => ({
  ...x,
  comingSoon: x.comingSoon || (x.engine !== 'device' && !SERVER_TOOLS_LIVE && !WEB_TOOLS.has(x.id) && x.category !== 'ai'),
  web: WEB_TOOLS.has(x.id),
});

const ALL_TOOLS: Tool[] = [
  // ---------- PDF (20) ----------
  tool({ id: 'merge-pdf', name: 'Merge PDF', description: 'Combine PDFs in any order', category: 'pdf', icon: Merge, engine: 'device', input: 'pdfs', minFiles: 2, homePick: true, verb: 'Merge {count} PDFs', processing: 'Merging your PDFs', next: 'compress-pdf' }),
  tool({ id: 'split-pdf', name: 'Split PDF', description: 'By range, every page or every N pages', category: 'pdf', icon: Split, engine: 'device', input: 'pdf', homePick: true, verb: 'Split PDF', processing: 'Splitting your PDF', next: 'merge-pdf' }),
  tool({ id: 'compress-pdf', name: 'Compress PDF', description: 'Shrink file size at 3 levels', category: 'pdf', icon: Minimize2, engine: 'device', input: 'pdf', homePick: true, verb: 'Compress PDF', processing: 'Compressing your PDF', next: 'protect-pdf' }),
  tool({ id: 'rotate-pdf', name: 'Rotate PDF', description: 'Rotate all or selected pages', category: 'pdf', icon: RotateCw, engine: 'device', input: 'pdf', verb: 'Save rotated PDF', processing: 'Rotating pages', next: 'organize-pdf' }),
  tool({ id: 'organize-pdf', name: 'Organize PDF', description: 'Reorder, delete or add blank pages', category: 'pdf', icon: LayoutGrid, engine: 'device', input: 'pdf', verb: 'Save changes', processing: 'Saving your PDF', next: 'page-numbers' }),
  tool({ id: 'page-numbers', name: 'Page numbers', description: 'Add numbers in any position and format', category: 'pdf', icon: Hash, engine: 'device', input: 'pdf', verb: 'Add page numbers', processing: 'Adding page numbers', next: 'pdf-watermark' }),
  tool({ id: 'pdf-watermark', name: 'Watermark', description: 'Stamp text or an image on pages', category: 'pdf', icon: Stamp, engine: 'device', input: 'pdf', verb: 'Add watermark', processing: 'Adding watermark', next: 'protect-pdf' }),
  tool({ id: 'remove-watermark', name: 'Remove watermark', description: 'Take off text or logo watermarks', category: 'pdf', icon: Eraser, engine: 'device', input: 'pdf', verb: 'Remove watermark', processing: 'Removing watermark', next: 'compress-pdf' }),
  tool({ id: 'crop-pdf', name: 'Crop PDF', description: 'Trim margins on one page or all', category: 'pdf', icon: Crop, engine: 'device', input: 'pdfs', verb: 'Crop PDF', processing: 'Cropping pages', next: 'rotate-pdf' }),
  tool({ id: 'sign-pdf', name: 'Sign PDF', description: 'Draw, type or upload your signature', category: 'pdf', icon: PenLine, engine: 'device', input: 'pdf', verb: 'Save signed PDF', processing: 'Saving signed PDF', next: 'protect-pdf' }),
  tool({ id: 'annotate-pdf', name: 'Annotate and sign', description: 'Highlight, add notes, draw and sign', category: 'pdf', icon: Highlighter, engine: 'device', input: 'pdf', homePick: true, verb: 'Save', processing: 'Saving your changes', next: 'sign-pdf' }),
  tool({ id: 'pdf-forms', name: 'PDF forms', description: 'Fill forms, add fields and checkboxes', category: 'pdf', icon: FormInput, engine: 'device', input: 'pdf', verb: 'Save form', processing: 'Saving your form', next: 'sign-pdf' }),
  tool({ id: 'protect-pdf', name: 'Protect PDF', description: 'Set a password', category: 'pdf', icon: Lock, engine: 'device', input: 'pdf', verb: 'Protect PDF', processing: 'Protecting your PDF', next: 'pdf-watermark' }),
  tool({ id: 'unlock-pdf', name: 'Unlock PDF', description: 'Remove a password you know', category: 'pdf', icon: Unlock, engine: 'device', input: 'pdf', verb: 'Unlock PDF', processing: 'Unlocking your PDF', next: 'merge-pdf' }),
  tool({ id: 'redact-pdf', name: 'Redact PDF', description: 'Permanently black out text or areas', category: 'pdf', icon: EyeOff, engine: 'device', input: 'pdf', verb: 'Redact', processing: 'Redacting your PDF', next: 'protect-pdf' }),
  tool({ id: 'compare-pdf', name: 'Compare PDF', description: 'Highlight differences between 2 versions', category: 'pdf', icon: GitCompare, engine: 'device', input: 'pdfs', minFiles: 2, verb: 'Compare', processing: 'Comparing versions', next: 'annotate-pdf' }),
  tool({ id: 'repair-pdf', name: 'Repair PDF', description: 'Recover damaged files', category: 'pdf', icon: Wrench, engine: 'server', input: 'pdf', verb: 'Repair PDF', processing: 'Repairing your PDF', next: 'compress-pdf' }),
  tool({ id: 'pdf-to-pdfa', name: 'PDF to PDF/A', description: 'Convert to archival format', category: 'pdf', icon: Archive, engine: 'server', input: 'pdf', verb: 'Convert to PDF/A', processing: 'Converting to PDF/A', next: 'sign-pdf' }),
  tool({ id: 'extract-images', name: 'Extract images', description: 'Save every image inside a PDF', category: 'pdf', icon: Images, engine: 'device', input: 'pdf', verb: 'Extract {images}', processing: 'Extracting images', next: 'images-to-pdf' }),
  tool({ id: 'grayscale-pdf', name: 'Grayscale PDF', description: 'Black and white to save printer ink', category: 'pdf', icon: Contrast, engine: 'device', input: 'pdf', verb: 'Make grayscale', processing: 'Making it grayscale', next: 'compress-pdf' }),

  // ---------- Image (14) ----------
  tool({ id: 'remove-bg', name: 'Background remover', description: 'Cut out a person or product', category: 'image', icon: Scissors, engine: 'device', input: 'image', homePick: true, verb: 'Save', processing: 'Removing background', next: 'change-bg' }),
  tool({ id: 'change-bg', name: 'Change background', description: 'Solid color, blur or a photo', category: 'image', icon: Paintbrush, engine: 'device', input: 'image', verb: 'Save', processing: 'Changing background', next: 'compress-image' }),
  tool({ id: 'compress-image', name: 'Compress image', description: 'Smaller photos to share or upload', category: 'image', icon: Minimize2, engine: 'device', input: 'images', homePick: true, verb: 'Compress {photos}', processing: 'Compressing photos', next: 'resize-image' }),
  tool({ id: 'resize-image', name: 'Resize image', description: 'By pixels, percent or presets', category: 'image', icon: Scaling, engine: 'device', input: 'images', homePick: true, verb: 'Resize', processing: 'Resizing', next: 'crop-image' }),
  tool({ id: 'crop-image', name: 'Crop and rotate', description: 'Free crop or 1:1, 4:5, 16:9', category: 'image', icon: Crop, engine: 'device', input: 'image', verb: 'Save', processing: 'Saving photo', next: 'compress-image' }),
  tool({ id: 'convert-image', name: 'Convert format', description: 'JPG, PNG, WEBP and HEIC', category: 'image', icon: RefreshCw, engine: 'device', input: 'images', verb: 'Convert {photos}', processing: 'Converting photos', next: 'images-to-pdf' }),
  tool({ id: 'passport-photo', name: 'Passport photo', description: 'Country sizes, white background, print sheet', category: 'image', icon: User, engine: 'device', input: 'image', homePick: true, verb: 'Make passport photo', processing: 'Making your photo', next: 'compress-image' }),
  tool({ id: 'upscale-image', name: 'Upscale image', description: 'Make images 2x or 4x sharper', category: 'image', icon: Sparkles, engine: 'api', input: 'image', verb: 'Upscale', processing: 'Upscaling your photo', next: 'compress-image' }),
  tool({ id: 'object-eraser', name: 'Object eraser', description: 'Paint over an object to remove it', category: 'image', icon: Eraser, engine: 'api', input: 'image', verb: 'Erase', processing: 'Erasing object', next: 'upscale-image' }),
  tool({ id: 'blur-image', name: 'Blur faces', description: 'Hide faces, number plates or text', category: 'image', icon: Droplet, engine: 'device', input: 'image', verb: 'Save', processing: 'Blurring', next: 'strip-metadata' }),
  tool({ id: 'draw-image', name: 'Draw on photo', description: 'Pen, highlighter, text and colors', category: 'image', icon: Brush, engine: 'device', input: 'image', verb: 'Save photo', processing: 'Saving your photo', next: 'compress-image' }),
  tool({ id: 'image-watermark', name: 'Image watermark', description: 'Text or logo on one or many images', category: 'image', icon: Stamp, engine: 'device', input: 'images', verb: 'Add watermark', processing: 'Adding watermark', next: 'compress-image' }),
  tool({ id: 'collage', name: 'Collage maker', description: '2 to 9 photos in a grid', category: 'image', icon: LayoutDashboard, engine: 'device', input: 'images', minFiles: 2, verb: 'Save collage', processing: 'Making collage', next: 'image-watermark' }),
  tool({ id: 'strip-metadata', name: 'Remove metadata', description: 'Strip location and camera data', category: 'image', icon: ShieldOff, engine: 'device', input: 'images', verb: 'Remove metadata', processing: 'Cleaning photos', next: 'compress-image' }),
  tool({ id: 'batch-edit', name: 'Batch edit', description: 'Resize, compress or convert many at once', category: 'image', icon: Layers, engine: 'device', input: 'images', verb: 'Edit {photos}', processing: 'Editing photos', next: 'images-to-pdf' }),
  tool({ id: 'sticker-maker', name: 'Sticker maker', description: 'Photo to a WhatsApp sticker', category: 'image', icon: Sticker, engine: 'device', input: 'image', verb: 'Make sticker', processing: 'Making your sticker' }),
  tool({ id: 'signature-maker', name: 'Signature maker', description: 'Clean signature PNG to use anywhere', category: 'image', icon: Signature, engine: 'device', input: 'camera', verb: 'Save signature', processing: 'Saving your signature', next: 'sign-pdf' }),

  // ---------- Scan and OCR (9) ----------
  tool({ id: 'smart-scan', name: 'Smart scan', description: 'Paper to PDF with auto-crop', category: 'scan', icon: ScanLine, engine: 'device', input: 'camera', homePick: true, verb: 'Save PDF', processing: 'Creating your PDF', next: 'ocr' }),
  tool({ id: 'id-scan', name: 'ID card scan', description: 'Front and back on one A4 page', category: 'scan', icon: CreditCard, engine: 'device', input: 'camera', homePick: true, verb: 'Save PDF', processing: 'Creating your PDF', next: 'protect-pdf' }),
  tool({ id: 'qr-scanner', name: 'QR and barcode', description: 'Scan and create codes', category: 'scan', icon: QrCode, engine: 'device', input: 'camera', homePick: true, verb: 'Save QR code', processing: 'Making your QR code' }),
  tool({ id: 'ocr', name: 'Image to text', description: 'Copy text from a photo or screenshot', category: 'scan', icon: ScanText, engine: 'device', input: 'image', homePick: true, verb: 'Get text', processing: 'Reading text' }),
  tool({ id: 'searchable-pdf', name: 'Searchable PDF', description: 'Add a text layer to scanned PDFs', category: 'scan', icon: FileSearch, engine: 'server', input: 'pdf', verb: 'Make searchable', processing: 'Reading pages', next: 'ai-summary' }),
  tool({ id: 'urdu-ocr', name: 'Urdu OCR', description: 'Copy text in Urdu or Arabic script', category: 'scan', icon: Languages, engine: 'server', input: 'image', verb: 'Get text', processing: 'Reading Urdu text' }),
  tool({ id: 'business-card', name: 'Business card to contact', description: 'Scan a card, save the contact', category: 'scan', icon: Contact, engine: 'device', input: 'image', verb: 'Read card', processing: 'Reading the card' }),
  tool({ id: 'image-to-excel', name: 'Image to Excel', description: 'Tables in photos to sheets', category: 'scan', icon: Sheet, engine: 'device', input: 'images', verb: 'Convert to Excel', processing: 'Reading tables', next: 'excel-to-pdf' }),

  // ---------- Convert (16) ----------
  tool({ id: 'word-to-pdf', name: 'Word to PDF', description: 'DOC and DOCX', category: 'convert', icon: FileText, engine: 'server', input: 'office', homePick: true, verb: 'Convert to PDF', processing: 'Converting to PDF', next: 'protect-pdf' }),
  tool({ id: 'ppt-to-pdf', name: 'PowerPoint to PDF', description: 'PPT and PPTX', category: 'convert', icon: Presentation, engine: 'server', input: 'office', verb: 'Convert to PDF', processing: 'Converting slides', next: 'compress-pdf' }),
  tool({ id: 'excel-to-pdf', name: 'Excel to PDF', description: 'XLS, XLSX and CSV', category: 'convert', icon: Sheet, engine: 'device', input: 'sheet', verb: 'Convert to PDF', processing: 'Converting sheets', next: 'merge-pdf' }),
  tool({ id: 'pdf-to-word', name: 'PDF to Word', description: 'Editable DOCX', category: 'convert', icon: FileText, engine: 'server', input: 'pdf', homePick: true, verb: 'Convert to Word', processing: 'Converting to Word', next: 'ai-summary' }),
  tool({ id: 'pdf-to-ppt', name: 'PDF to PowerPoint', description: 'Each page as a slide', category: 'convert', icon: Presentation, engine: 'server', input: 'pdf', verb: 'Convert to PowerPoint', processing: 'Converting to slides', next: 'compress-pdf' }),
  tool({ id: 'pdf-to-excel', name: 'PDF to Excel', description: 'Tables to sheets', category: 'convert', icon: Sheet, engine: 'device', input: 'pdf', verb: 'Convert to Excel', processing: 'Extracting tables', next: 'excel-to-pdf' }),
  tool({ id: 'convert-sheet', name: 'Excel and CSV', description: 'Convert XLSX, XLS, CSV and ODS', category: 'convert', icon: FileSpreadsheet, engine: 'device', input: 'sheet', verb: 'Convert', processing: 'Converting sheets', next: 'excel-to-pdf' }),
  tool({ id: 'edit-sheet', name: 'Edit Excel', description: 'Change cells, rows, columns and sheets', category: 'convert', icon: TableProperties, engine: 'device', input: 'sheet', verb: 'Save', processing: 'Saving your spreadsheet', next: 'excel-to-pdf' }),
  tool({ id: 'excel-to-image', name: 'Excel to JPG', description: 'Each sheet as an image', category: 'convert', icon: FileImage, engine: 'device', input: 'sheet', verb: 'Convert to JPG', processing: 'Making your images', next: 'images-to-pdf' }),
  tool({ id: 'merge-excel', name: 'Merge Excel', description: 'Join spreadsheets into one', category: 'convert', icon: Sheet, engine: 'device', input: 'sheets', minFiles: 2, verb: 'Merge {count} files', processing: 'Merging sheets', next: 'excel-to-pdf' }),
  tool({ id: 'pdf-to-image', name: 'PDF to JPG', description: 'Each page as an image', category: 'convert', icon: FileImage, engine: 'device', input: 'pdf', homePick: true, verb: 'Convert {pages}', processing: 'Converting pages', next: 'collage' }),
  tool({ id: 'images-to-pdf', name: 'Images to PDF', description: 'Turn photos into one PDF', category: 'convert', icon: ImagePlus, engine: 'device', input: 'images', homePick: true, verb: 'Create PDF', processing: 'Creating your PDF', next: 'compress-pdf' }),
  tool({ id: 'url-to-pdf', name: 'Web page to PDF', description: 'Save any web page', category: 'convert', icon: Globe, engine: 'device', input: 'url', verb: 'Save as PDF', processing: 'Saving web page', next: 'ai-summary' }),
  tool({ id: 'extract-archive', name: 'Extract ZIP / RAR', description: 'Open ZIP, RAR and 7z, folder by folder', category: 'convert', icon: FileArchive, engine: 'device', input: 'archive', verb: 'Extract', processing: 'Extracting' }),
  tool({ id: 'make-zip', name: 'Make a ZIP', description: 'Pack files into one ZIP, with a password', category: 'convert', icon: Package, engine: 'device', input: 'files', minFiles: 1, verb: 'Make ZIP', processing: 'Making your ZIP', next: 'extract-archive' }),
  tool({ id: 'pdf-to-text', name: 'PDF to text', description: 'Clean text or Markdown for notes', category: 'convert', icon: FileCode, engine: 'device', input: 'pdf', verb: 'Get text', processing: 'Extracting text', next: 'ai-summary' }),

  // ---------- Everyday (4): Text editor, calculators and Make with Zee, no file ----------
  tool({ id: 'text-editor', name: 'Text editor', description: 'Notes, letters and documents in Urdu and English, saved as PDF or image', category: 'everyday', icon: NotebookPen, engine: 'device', input: 'camera', verb: 'Save PDF', processing: 'Making your file', next: 'pdf-watermark' }),
  tool({ id: 'age-calculator', name: 'Age calculator', description: 'Exact age, next birthday and Hijri age', category: 'everyday', icon: Cake, engine: 'device', input: 'camera', verb: 'Calculate', processing: 'Calculating' }),
  tool({ id: 'make-doc', name: 'Make with Zee', description: 'Papers, notes, to-dos, expenses and more, ready to edit and print', category: 'everyday', icon: WandSparkles, engine: 'device', input: 'camera', verb: 'Save PDF', processing: 'Making your file' }),
  tool({ id: 'calculator', name: 'Calculator', description: 'Basic and scientific, for school and work', category: 'everyday', icon: Calculator, engine: 'device', input: 'camera', verb: 'Calculate', processing: 'Calculating' }),

  // ---------- AI (5): coming soon. The AI tab is replaced by Resume for now; the screens and handlers stay ----------
  tool({ id: 'ai-summary', comingSoon: true, name: 'AI summary', description: 'Short, detailed or key points', category: 'ai', icon: AlignLeft, engine: 'api', input: 'pdf', verb: 'Summarize', processing: 'Reading your PDF' }),
  tool({ id: 'chat-pdf', comingSoon: true, name: 'Chat with PDF', description: 'Ask anything, see the page', category: 'ai', icon: MessagesSquare, engine: 'api', input: 'pdf', verb: 'Start chat', processing: 'Reading your PDF' }),
  tool({ id: 'translate-pdf', comingSoon: true, name: 'Translate PDF', description: 'Translate and keep the layout', category: 'ai', icon: Languages, engine: 'api', input: 'pdf', verb: 'Translate', processing: 'Translating', next: 'chat-pdf' }),
  tool({ id: 'study-helper', comingSoon: true, name: 'Study helper', description: 'Notes, flashcards and a quiz', category: 'ai', icon: GraduationCap, engine: 'api', input: 'pdf', verb: 'Make study set', processing: 'Making your study set' }),
  tool({ id: 'camera-translate', name: 'Camera translate', description: 'Point the camera and translate', category: 'scan', icon: Camera, engine: 'device', input: 'camera', verb: 'Translate', processing: 'Translating' }),
];

/** Every tool; the coming-soon ones last. */
export const TOOLS: Tool[] = [...ALL_TOOLS.filter((x) => !x.comingSoon), ...ALL_TOOLS.filter((x) => x.comingSoon)];

export const HOME_CATEGORIES: CategoryId[] = ['pdf', 'image', 'scan', 'convert', 'everyday'];
export const ALL_CATEGORIES: CategoryId[] = ['pdf', 'image', 'scan', 'convert', 'everyday', 'ai'];

const BY_ID = new Map(TOOLS.map((x) => [x.id, x]));

export const getTool = (id: string): Tool | undefined => BY_ID.get(id);
export const toolsIn = (category: CategoryId): Tool[] => TOOLS.filter((x) => x.category === category && !(x.comingSoon && x.category === 'ai'));
export const homePicks = (category: CategoryId): Tool[] => TOOLS.filter((x) => x.category === category && x.homePick);

/** Tools people can use in the app now (not coming soon): "48 free tools". */
export const TOOL_COUNT = TOOLS.filter((x) => !x.comingSoon).length;
/** Tools that work on the web site already. */
export const WEB_TOOL_COUNT = TOOLS.filter((x) => x.web && !x.comingSoon).length;
