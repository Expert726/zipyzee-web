import { t } from '@/i18n';
import { openPdf } from '@/lib/pdfjs';
import { pageWords } from '@/lib/pageWords';
import { comparePages, type PageWords } from '../compare';
import { ToolError, type ToolHandler } from '../types';

// design/FlowComparePdf.dc.html (the app's handlers/comparePdf.ts): pdf.js reads every word and where it is
// (src/lib/pageWords.ts), the words are compared page by page (the app's src/tools/compare.ts). Step 4 "See changes"
// is components/flow/custom/CompareResult, which saves the report when asked.
export const comparePdf: ToolHandler = async ({ files, onProgress, signal }) => {
  const [f1, f2] = files;
  if (!f1 || !f2) throw new ToolError(t('Choose 2 versions to compare.'));
  const read = async (f: File, i: number): Promise<PageWords[]> => {
    onProgress(0.05 + i * 0.4, 1, t('Reading {name}', { name: f.name }));
    const doc = await openPdf(f);
    try {
      return await pageWords(doc, (p, total) => onProgress(0.05 + i * 0.4 + (p / total) * 0.4, 1, t('Reading {name}', { name: f.name })));
    } finally {
      void doc.destroy();
    }
  };
  const v1 = await read(f1, 0);
  if (signal.cancelled) throw new ToolError(t('Cancelled'));
  const v2 = await read(f2, 1);
  if (signal.cancelled) throw new ToolError(t('Cancelled'));
  if (!v1.some((p) => p.words.length) && !v2.some((p) => p.words.length)) {
    throw new ToolError(t('These PDFs have no text to compare. If they are scanned, use Searchable PDF first.'));
  }
  const pages = Math.max(v1.length, v2.length);
  onProgress(0.9, 1, t('Checking page {n} of {count}', { n: pages, count: pages }));
  const compare = comparePages(v1, v2);
  return { title: t('{count} changes found', { count: compare.total }), files: [], compare };
};
