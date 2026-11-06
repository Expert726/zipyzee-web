// Pure pdf-lib page operations used by the tool handlers. No React Native imports, so they run in Jest.
import { degrees, PDFDocument, PDFName, PDFOperator, PDFOperatorNames as Ops, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import type { OrganizePage } from './organize';
import { stampCenters, stampWidth, type WmSpec } from './pdfWatermark';
import { parseRanges } from './ranges';
import { ToolError } from './types';
import { t } from '@/i18n';

export const pagesLabel = (n: number) => `${n} ${n === 1 ? t('page') : t('pages')}`;

/**
 * A page as the reader sees it: visual width/height (after /Rotate) and a mapping from visual
 * coordinates (origin bottom-left of the visible crop box, y up) to PDF user space.
 * `angle(a)` turns a visual text angle into the PDF angle so text reads upright.
 */
export function pageFrame(page: PDFPage) {
  const box = page.getCropBox();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const { x: bx, y: by, width: w, height: h } = box;
  const sideways = rotation === 90 || rotation === 270;
  const vw = sideways ? h : w;
  const vh = sideways ? w : h;
  const toPdf = (vx: number, vy: number): [number, number] => {
    switch (rotation) {
      case 90:
        return [bx + w - vy, by + vx];
      case 180:
        return [bx + w - vx, by + h - vy];
      case 270:
        return [bx + vy, by + h - vx];
      default:
        return [bx + vx, by + vy];
    }
  };
  return { box, rotation, vw, vh, toPdf, angle: (a: number) => a + rotation };
}

const rad = (d: number) => (d * Math.PI) / 180;

/** Draws text whose visual baseline starts at (vx, vy), turned `visualAngle` degrees (counter-clockwise). */
export function drawVisualText(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  vx: number,
  vy: number,
  visualAngle: number,
  color: ReturnType<typeof rgb>,
  opacity = 1,
) {
  const f = pageFrame(page);
  const [x, y] = f.toPdf(vx, vy);
  page.drawText(text, { x, y, size, font, color, opacity, rotate: degrees(f.angle(visualAngle)) });
}

// ---------- Split ----------

export type SplitMode = 'ranges' | 'every' | 'everyN';

/** Groups of 0-based page indexes, one group per output file. */
export function splitGroups(mode: SplitMode, rangesText: string, n: number, pageCount: number): number[][] {
  if (mode === 'every') return Array.from({ length: pageCount }, (_, i) => [i]);
  if (mode === 'everyN') {
    if (!Number.isInteger(n) || n < 1) throw new ToolError(t('Enter how many pages go in each file'));
    const groups: number[][] = [];
    for (let s = 0; s < pageCount; s += n) groups.push(range(s, Math.min(s + n, pageCount) - 1));
    return groups;
  }
  const parsed = parseRanges(rangesText, pageCount);
  if (!parsed.ok) throw new ToolError(parsed.error);
  return parsed.ranges.map(([a, b]) => range(a - 1, b - 1));
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** 'report', [0, 1] -> 'report-pages-1-2.pdf'; [4] -> 'report-page-5.pdf' (design/FlowSplitPdf.dc.html). */
export function splitName(stem: string, group: number[]) {
  const a = group[0] + 1;
  const b = group[group.length - 1] + 1;
  return a === b ? `${stem}-page-${a}.pdf` : `${stem}-pages-${a}-${b}.pdf`;
}

// ---------- Rotate ----------

export type RotateDirection = 'left' | 'right' | '180';

/** Turns a page by quarter turns (1 = 90° clockwise, as shown); a real PDF rotation, so text stays as it is. */
export function turnPage(page: PDFPage, quarterTurns: number) {
  const next = (((page.getRotation().angle + quarterTurns * 90) % 360) + 360) % 360;
  page.setRotation(degrees(next));
}

/** Where a page goes, drawn mirrored (left <-> right) onto a page of the same size: flipped at its right edge. */
export const mirrorPlacement = (width: number) => ({ x: width, y: 0, xScale: -1, yScale: 1 });

/**
 * Mirrors page `index` in place: the page is embedded as a picture-free copy of itself (vector, text stays sharp)
 * and drawn flipped on a new page of the same size and rotation, which takes its place.
 */
export async function mirrorPage(doc: PDFDocument, index: number) {
  const page = doc.getPage(index);
  const { width, height } = page.getSize();
  const embedded = await doc.embedPage(page);
  const flipped = doc.insertPage(index, [width, height]);
  flipped.drawPage(embedded, mirrorPlacement(width));
  flipped.setRotation(page.getRotation());
  doc.removePage(index + 1);
}

export function rotatePage(page: PDFPage, direction: RotateDirection) {
  const delta = direction === 'left' ? -90 : direction === 'right' ? 90 : 180;
  const next = (((page.getRotation().angle + delta) % 360) + 360) % 360;
  page.setRotation(degrees(next));
}

// ---------- Page numbers ----------

export type NumberPosition = 'topLeft' | 'topCenter' | 'topRight' | 'bottomLeft' | 'bottomCenter' | 'bottomRight';
/** n "3", slash "3/12", nOfTotal "3 of 12", page "Page 3", pageNOfTotal "Page 3 of 12", dash "- 3 -", custom: typed. */
export type NumberFormat = 'n' | 'slash' | 'nOfTotal' | 'page' | 'pageNOfTotal' | 'dash' | 'custom';

/** A chip's value (string[]) or a plain value (older saved choices), as one string. */
export const oneOf = <T extends string>(v: unknown, fallback: T): T => ((Array.isArray(v) ? v[0] : v) || fallback) as T;

/**
 * The label for page n of total. Custom (added on request): what was typed, with {n} the page and {total} the count
 * ("Sheet {n}/{total}"); typed text without {n} gets the number after it; nothing typed is just the number.
 */
export function pageNumberLabel(format: NumberFormat, n: number, total: number, custom = '') {
  switch (format) {
    case 'n':
      return `${n}`;
    case 'slash':
      return `${n}/${total}`;
    case 'nOfTotal':
      return `${n} of ${total}`;
    case 'page':
      return `Page ${n}`;
    case 'dash':
      return `- ${n} -`;
    case 'custom': {
      const typed = custom.replace(/\s+/g, ' ').trim();
      if (!typed) return `${n}`;
      const filled = typed.replace(/\{n\}/gi, String(n)).replace(/\{total\}/gi, String(total));
      return /\{n\}/i.test(typed) ? filled : `${filled} ${n}`;
    }
    default:
      return `Page ${n} of ${total}`;
  }
}

const INK = rgb(0x11 / 255, 0x18 / 255, 0x27 / 255); // #111827
const NUMBER_SIZE = 11;
const NUMBER_EDGE = 24;

export function drawPageNumber(page: PDFPage, font: PDFFont, label: string, position: NumberPosition) {
  const { vw, vh } = pageFrame(page);
  const width = font.widthOfTextAtSize(label, NUMBER_SIZE);
  const vx = position.endsWith('Left') ? NUMBER_EDGE : position.endsWith('Center') ? (vw - width) / 2 : vw - NUMBER_EDGE - width;
  const vy = position.startsWith('top') ? vh - NUMBER_EDGE - font.heightAtSize(NUMBER_SIZE, { descender: false }) : NUMBER_EDGE;
  drawVisualText(page, label, font, NUMBER_SIZE, vx, vy, 0, INK);
}

// ---------- Watermark ----------

/** A text watermark's font or a logo, embedded in the document once. */
export type WmMark = { kind: 'text'; font: PDFFont } | { kind: 'logo'; image: PDFImage };

const hexRgb = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);

/**
 * Stamps the watermark on a page as displayed (rotated pages too): text or logo, sized as a share of the page
 * width, turned `angle` degrees around its own center, at the spec's position (src/tools/pdfWatermark.ts).
 * Drawn inside "/Artifact <</Type /Pagination /Subtype /Watermark>> BDC ... EMC", the standard watermark mark, so
 * Remove watermark (and Acrobat) can find it as its own layer.
 */
export function drawWatermark(page: PDFPage, spec: WmSpec, mark: WmMark) {
  const f = pageFrame(page);
  const { vw, vh } = f;
  const w = stampWidth(vw, spec.size);
  const label = spec.text.trim();
  let h: number;
  let size = 0;
  if (mark.kind === 'text') {
    if (!label) return;
    size = w / mark.font.widthOfTextAtSize(label, 1);
    h = mark.font.heightAtSize(size, { descender: false });
  } else {
    h = (w * mark.image.height) / mark.image.width;
  }
  const a = rad(spec.angle);
  const opacity = Math.max(0, Math.min(1, spec.opacity));
  page.pushOperators(PDFOperator.of(Ops.BeginMarkedContentSequence, [PDFName.of('Artifact'), '<</Type /Pagination /Subtype /Watermark>>']));
  for (const c of stampCenters(vw, vh, w, h, spec.angle, spec.position)) {
    // stampCenters measures y down from the top; PDF pages measure it up from the bottom
    const cx = c.x;
    const cy = vh - c.y;
    // start corner = center - R(a) * (w/2, h/2), then turned around it
    const vx = cx - (Math.cos(a) * w) / 2 + (Math.sin(a) * h) / 2;
    const vy = cy - (Math.sin(a) * w) / 2 - (Math.cos(a) * h) / 2;
    if (mark.kind === 'text') {
      drawVisualText(page, label, mark.font, size, vx, vy, spec.angle, hexRgb(spec.color), opacity);
    } else {
      const [x, y] = f.toPdf(vx, vy);
      page.drawImage(mark.image, { x, y, width: w, height: h, opacity, rotate: degrees(f.angle(spec.angle)) });
    }
  }
  page.pushOperators(PDFOperator.of(Ops.EndMarkedContent));
}

// ---------- Crop ----------

/** Fixed breathing room kept around the detected content, in points (~6 mm). */
export const CROP_MARGIN = 18;

/**
 * bounds = [left, top, right, bottom] as 0-1 fractions of the page as displayed (PdfRenderer output).
 * Sets the crop box to that area plus `margin`, clamped to the current crop box. Returns false when unchanged.
 */
export function cropToBounds(page: PDFPage, bounds: number[], margin = CROP_MARGIN): boolean {
  if (bounds.length !== 4) return false;
  const f = pageFrame(page);
  const [l, tp, r, b] = bounds;
  // fractions are top-down; visual coordinates are bottom-up
  const [x1, y1] = f.toPdf(l * f.vw, (1 - b) * f.vh);
  const [x2, y2] = f.toPdf(r * f.vw, (1 - tp) * f.vh);
  const left = Math.max(f.box.x, Math.min(x1, x2) - margin);
  const bottom = Math.max(f.box.y, Math.min(y1, y2) - margin);
  const right = Math.min(f.box.x + f.box.width, Math.max(x1, x2) + margin);
  const top = Math.min(f.box.y + f.box.height, Math.max(y1, y2) + margin);
  if (right - left < 1 || top - bottom < 1) return false;
  const same =
    Math.abs(left - f.box.x) < 0.5 && Math.abs(bottom - f.box.y) < 0.5 &&
    Math.abs(right - (f.box.x + f.box.width)) < 0.5 && Math.abs(top - (f.box.y + f.box.height)) < 0.5;
  if (same) return false;
  page.setCropBox(left, bottom, right - left, top - bottom);
  return true;
}

// ---------- Images to PDF ----------

export type PageSize = 'a4' | 'letter' | 'fit';
export type Orientation = 'portrait' | 'landscape';
export type Margin = 'none' | 'small' | 'large';

const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;
const MARGINS = { none: 0, small: 18, large: 36 } as const;
/** "Fit photo": the page takes the photo's shape, long side as long as A4. */
const FIT_LONG_SIDE = 841.89;

/** Page size and where the image goes (centered, kept in proportion). */
export function imagePlacement(imgW: number, imgH: number, size: PageSize, orientation: Orientation, margin: Margin) {
  const m = MARGINS[margin];
  let pageW: number;
  let pageH: number;
  if (size === 'fit') {
    const k = FIT_LONG_SIDE / Math.max(imgW, imgH);
    pageW = imgW * k + 2 * m;
    pageH = imgH * k + 2 * m;
  } else {
    const [a, b] = SIZES[size];
    [pageW, pageH] = orientation === 'landscape' ? [b, a] : [a, b];
  }
  const k = Math.min((pageW - 2 * m) / imgW, (pageH - 2 * m) / imgH);
  const w = imgW * k;
  const h = imgH * k;
  return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}

// ---------- Split preview ----------

/** For each page (0-based), the index of the output file it goes to, or -1 when it isn't in any file. */
export function splitGroupIndex(groups: number[][], pageCount: number): number[] {
  const out = new Array<number>(pageCount).fill(-1);
  groups.forEach((g, gi) => g.forEach((p) => {
    if (p < pageCount && out[p] === -1) out[p] = gi;
  }));
  return out;
}

// ---------- Organize ----------

/** Margin around a photo added in Organize, in points (a quarter inch). */
const PHOTO_MARGIN = 18;

/**
 * A photo on a page the size of `base`, turned to match the photo (landscape photo, landscape page), the photo
 * fitted inside the margin and centered.
 */
export function photoPage(imgW: number, imgH: number, baseW: number, baseH: number, margin = PHOTO_MARGIN) {
  const landscape = imgW > imgH;
  const pageW = landscape === baseW > baseH ? baseW : baseH;
  const pageH = pageW === baseW ? baseH : baseW;
  const k = Math.min((pageW - margin * 2) / imgW, (pageH - margin * 2) / imgH);
  const w = imgW * k;
  const h = imgH * k;
  return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}

/**
 * Builds the organized document: pages in the new order with their extra rotation. A blank page takes the size
 * and orientation of the page before it (the first page when it comes first), plus its own extra rotation. A photo
 * page (`image`) uses that size too, turned to the photo; `photos` maps each photo's uri to its JPEG (base64).
 */
export async function applyOrganize(
  src: PDFDocument,
  pages: OrganizePage[],
  onPage?: (i: number, total: number) => Promise<void> | void,
  photos: Record<string, string> = {},
): Promise<PDFDocument> {
  const out = await PDFDocument.create();
  const first = src.getPage(0);
  for (let i = 0; i < pages.length; i++) {
    await onPage?.(i, pages.length);
    const op = pages[i];
    let page: PDFPage;
    let base: number;
    if (op.src == null && op.image) {
      const prev = out.getPageCount() ? out.getPage(out.getPageCount() - 1) : first;
      const { width, height } = prev.getSize();
      const jpg = await out.embedJpg(photos[op.image]);
      const p = photoPage(jpg.width, jpg.height, width, height);
      page = out.addPage([p.pageW, p.pageH]);
      page.drawImage(jpg, { x: p.x, y: p.y, width: p.w, height: p.h });
      base = 0;
    } else if (op.src == null) {
      // a blank page looks like the page before it (size and orientation)
      const prev = out.getPageCount() ? out.getPage(out.getPageCount() - 1) : first;
      const { width, height } = prev.getSize();
      page = out.addPage([width, height]);
      base = prev.getRotation().angle;
    } else {
      [page] = await out.copyPages(src, [op.src]);
      out.addPage(page);
      base = page.getRotation().angle;
    }
    page.setRotation(degrees((((base + op.rotation) % 360) + 360) % 360));
  }
  return out;
}

// ---------- Overlays (PDF forms) ----------

/**
 * A rect in PDF user space -> the same area on the page as displayed, measured from the top-left in points:
 * { left, top, width, height } plus the visual page size, for placing views over a rendered page.
 */
export function visualRect(page: PDFPage, [x, y, w, h]: [number, number, number, number]) {
  const f = pageFrame(page);
  const { x: bx, y: by, width: bw, height: bh } = f.box;
  const toVisual = (px: number, py: number): [number, number] => {
    switch (f.rotation) {
      case 90:
        return [py - by, bx + bw - px];
      case 180:
        return [bx + bw - px, by + bh - py];
      case 270:
        return [by + bh - py, px - bx];
      default:
        return [px - bx, py - by];
    }
  };
  const [ax, ay] = toVisual(x, y);
  const [cx, cy] = toVisual(x + w, y + h);
  const left = Math.min(ax, cx);
  const right = Math.max(ax, cx);
  const bottom = Math.min(ay, cy);
  const topY = Math.max(ay, cy);
  return { left, top: f.vh - topY, width: right - left, height: topY - bottom, pageWidth: f.vw, pageHeight: f.vh };
}
