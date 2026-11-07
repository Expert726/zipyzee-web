import { toolsIn } from '@/tools/registry';
import type { CategoryId, Tool } from '@/tools/types';

/** Header links to the most used tools that work on the web. */
export const POPULAR = ['merge-pdf', 'split-pdf', 'compress-image'];

/** The Convert menu: to PDF / from PDF / spreadsheets and files (English keys). */
export function convertGroups(): { title: string; tools: Tool[] }[] {
  const all = [...toolsIn('convert')];
  const toPdf = all.filter((x) => x.id.endsWith('-to-pdf'));
  const fromPdf = all.filter((x) => x.id.startsWith('pdf-to-'));
  const other = all.filter((x) => !toPdf.includes(x) && !fromPdf.includes(x));
  return [
    { title: 'Convert to PDF', tools: toPdf },
    { title: 'Convert from PDF', tools: fromPdf },
    { title: 'Spreadsheets and files', tools: other },
  ];
}

/** The All tools menu's columns. PDF is long, so it takes two. */
export const MEGA: { categories: CategoryId[]; wide?: boolean }[] = [
  { categories: ['pdf'], wide: true },
  { categories: ['image'] },
  { categories: ['convert'] },
  { categories: ['scan', 'everyday'] },
];

/** Web-ready tools first. */
export const readyFirst = (list: Tool[]) => [...list.filter((x) => x.web && !x.comingSoon), ...list.filter((x) => !(x.web && !x.comingSoon))];
