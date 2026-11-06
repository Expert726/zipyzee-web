import { t } from '@/i18n';
// Organize PDF editor state (design/OrganizePdf.dc.html). Pure functions; the editor keeps the selection by page id.

/**
 * One page of the result. `src` = 0-based page of the original, null = blank page or a photo. `image` = a photo from
 * the gallery (its uri) placed on a page of its own. `rotation` is extra, in degrees.
 */
export type OrganizePage = { id: string; src: number | null; rotation: number; image?: string };

export function initialPages(count: number): OrganizePage[] {
  return Array.from({ length: count }, (_, i) => ({ id: `p${i}`, src: i, rotation: 0 }));
}

let seq = 0;
/** New unique id for duplicated and blank pages. */
export const newPageId = () => `n${++seq}`;

export function rotateSelected(pages: OrganizePage[], selected: Set<string>): OrganizePage[] {
  return pages.map((p) => (selected.has(p.id) ? { ...p, rotation: (p.rotation + 90) % 360 } : p));
}

/** Each selected page gets a copy right after it. */
export function duplicateSelected(pages: OrganizePage[], selected: Set<string>, makeId = newPageId): OrganizePage[] {
  return pages.flatMap((p) => (selected.has(p.id) ? [p, { ...p, id: makeId() }] : [p]));
}

export function deleteSelected(pages: OrganizePage[], selected: Set<string>): OrganizePage[] {
  return pages.filter((p) => !selected.has(p.id));
}

export function addBlank(pages: OrganizePage[], makeId = newPageId): OrganizePage[] {
  return [...pages, { id: makeId(), src: null, rotation: 0 }];
}

/** Photos from the gallery, each on a new page at the end. */
export function addPhotos(pages: OrganizePage[], uris: string[], makeId = newPageId): OrganizePage[] {
  return [...pages, ...uris.map((image) => ({ id: makeId(), src: null, rotation: 0, image }))];
}

/** "Page 3 selected" (position in the current order) or "3 pages selected". */
export function selectionLabel(pages: OrganizePage[], selected: Set<string>): string {
  if (selected.size === 1) {
    const i = pages.findIndex((p) => selected.has(p.id));
    return t('Page {n} selected', { n: i + 1 });
  }
  return t('{count} pages selected', { count: selected.size });
}
