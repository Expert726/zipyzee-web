// Editor geometry: pages stacked in one zoomable content view. Pure; unit-tested.
// Content is scaled with transformOrigin top-left: screen = pan + content * zoom.

import type { Pt } from './model';

export const PAGE_MARGIN = 16; // board: page inset 16 from the screen edges, 16 between pages
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/** Visual size of a PDF page in points (rotation applied). */
export type PageSize = { width: number; height: number };

/** Where a page sits in content coordinates (dp at zoom 1). pxPerPt converts page points to content dp. */
export type PageLayout = { index: number; left: number; top: number; width: number; height: number; pxPerPt: number };

export function layoutPages(sizes: PageSize[], screenWidth: number): { pages: PageLayout[]; contentHeight: number } {
  const width = screenWidth - PAGE_MARGIN * 2;
  let top = PAGE_MARGIN;
  const pages = sizes.map((s, index) => {
    const pxPerPt = width / s.width;
    const page = { index, left: PAGE_MARGIN, top, width, height: s.height * pxPerPt, pxPerPt };
    top += page.height + PAGE_MARGIN;
    return page;
  });
  return { pages, contentHeight: top };
}

export function screenToContent(p: Pt, zoom: number, pan: Pt): Pt {
  return { x: (p.x - pan.x) / zoom, y: (p.y - pan.y) / zoom };
}

export function contentToScreen(p: Pt, zoom: number, pan: Pt): Pt {
  return { x: pan.x + p.x * zoom, y: pan.y + p.y * zoom };
}

/** Page under a content point (with a little slop so edges are easy to hit). */
export function pageAt(pages: PageLayout[], c: Pt, slop = 0): PageLayout | undefined {
  return pages.find((p) => c.x >= p.left - slop && c.x <= p.left + p.width + slop && c.y >= p.top - slop && c.y <= p.top + p.height + slop);
}

export function contentToPage(c: Pt, page: PageLayout): Pt {
  return { x: (c.x - page.left) / page.pxPerPt, y: (c.y - page.top) / page.pxPerPt };
}

export function pageToContent(p: Pt, page: PageLayout): Pt {
  return { x: page.left + p.x * page.pxPerPt, y: page.top + p.y * page.pxPerPt };
}

/** A touch on screen -> the page under it and the point on that page, at any zoom and scroll. */
export function screenToPage(p: Pt, pages: PageLayout[], zoom: number, pan: Pt): { page: PageLayout; point: Pt } | undefined {
  const c = screenToContent(p, zoom, pan);
  const page = pageAt(pages, c);
  return page ? { page, point: contentToPage(c, page) } : undefined;
}

/** Keeps the content on screen: no gaps at the left/right, top/bottom scroll limits. */
export function clampPan(pan: Pt, zoom: number, viewport: { width: number; height: number }, contentHeight: number): Pt {
  const minX = viewport.width - viewport.width * zoom;
  const minY = Math.min(0, viewport.height - contentHeight * zoom);
  return { x: Math.min(0, Math.max(minX, pan.x)), y: Math.min(0, Math.max(minY, pan.y)) };
}

/** Zoom keeping the content point under `focal` (screen) in place. */
export function zoomAbout(focal: Pt, zoom: number, pan: Pt, nextZoom: number): { zoom: number; pan: Pt } {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  const c = screenToContent(focal, zoom, pan);
  return { zoom: z, pan: { x: focal.x - c.x * z, y: focal.y - c.y * z } };
}
