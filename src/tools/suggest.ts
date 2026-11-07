// What to do next with a result ("Continue to…"): tools on the web that take the result's file type, the tool's own
// suggestion first (the app's `next`), then the popular ones. Pure, tested.
import { TOOLS, getTool } from './registry';
import type { InputKind, Tool } from './types';

/** 'mixed': photos and PDFs together (Passport photo: the photo and its print sheet). */
export type OutputKind = 'pdf' | 'image' | 'mixed' | null;

const isPdf = (n: string) => /\.pdf$/i.test(n);
/** Photos the image tools can open (src/lib/encoders.ts writes all of these; TIFF only opens in Safari, so not). */
const isImage = (n: string) => /\.(jpe?g|png|webp|avif|gif|bmp|ico)$/i.test(n);

export function outputKind(names: string[]): OutputKind {
  if (!names.length) return null;
  if (names.every(isPdf)) return 'pdf';
  if (names.every(isImage)) return 'image';
  if (names.every((n) => isPdf(n) || isImage(n))) return 'mixed';
  return null;
}

const TAKES: Record<'pdf' | 'image', InputKind[]> = { pdf: ['pdf', 'pdfs'], image: ['image', 'images'] };

export function suggestTools(tool: Tool, names: string[], max = 9): Tool[] {
  const kind = outputKind(names);
  if (!kind) return [];
  const takes = kind === 'mixed' ? [...TAKES.pdf, ...TAKES.image] : TAKES[kind];
  const fits = (x: Tool) => x.web && !x.comingSoon && x.id !== tool.id && takes.includes(x.input);
  const next = tool.next ? getTool(tool.next) : undefined;
  const list = TOOLS.filter(fits);
  const ordered = [...(next && fits(next) ? [next] : []), ...list.filter((x) => x.homePick && x !== next), ...list.filter((x) => !x.homePick && x !== next)];
  return ordered.slice(0, max);
}

/**
 * The files a tool gets: only the kind it takes (a PDF tool gets the PDFs of a mixed result), then all of them for a
 * tool that takes several, else the first.
 */
export function filesFor<T>(tool: Tool, files: T[]): T[] {
  const named = (f: T) => (typeof f === 'object' && f && 'name' in f ? String((f as { name: unknown }).name) : null);
  const want = TAKES.pdf.includes(tool.input) ? isPdf : TAKES.image.includes(tool.input) ? isImage : null;
  const own = want ? files.filter((f) => {
    const n = named(f);
    return n == null || want(n);
  }) : files;
  return ['pdfs', 'images', 'files', 'sheets'].includes(tool.input) ? own : own.slice(0, 1);
}

/** "See all": every tool on the web that takes this kind of file (the suggested order). */
export const allToolsFor = (tool: Tool, names: string[]): Tool[] => suggestTools(tool, names, Infinity);

/** How many "Continue to…" shows before "See all". */
export const CONTINUE_FIRST = 3;
