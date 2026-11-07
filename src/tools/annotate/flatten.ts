// Annotate and sign: flatten editor items into the PDF with pdf-lib (design/AnnotatePdf.dc.html). Pure; unit-tested.
// Items are in page points from the top-left of the page as displayed; pageFrame maps them onto rotated pages.
import { BlendMode, degrees, LineCapStyle, rgb, type PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib';
import { drawVisualText, pageFrame } from '../pdfOps';
import {
  bubbleLeft,
  CAPTION_SIZE,
  HIGHLIGHT,
  NOTE_BUBBLE,
  NOTE_ICON,
  noteBubbleLayout,
  toSvgPath,
  wrapLines,
  type InkItem,
  type Item,
  type NoteItem,
  type SignatureItem,
  type TextItem,
  signatureImageSize,
} from './model';

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

const TEXT_INK = hex('#111827');
const NOTE_FILL = hex('#FDE047');
const NOTE_INK = hex('#713F12');
const BUBBLE_FILL = hex('#FEF9C3');
const CAPTION_INK = hex('#4B5563');

type PathStyle = {
  color?: ReturnType<typeof rgb>;
  borderColor?: ReturnType<typeof rgb>;
  borderWidth?: number;
  borderOpacity?: number;
  borderLineCap?: LineCapStyle;
  blendMode?: BlendMode;
};

/**
 * Draws an SVG path (y down, in page points) with its origin at the visual point (vx, vyTop).
 * drawSvgPath maps (sx, sy) to origin + R(rotate)(sx, -sy), which is exactly the page's visual axes when
 * rotate = the page rotation and the origin comes from pageFrame.toPdf.
 */
function drawVisualPath(page: PDFPage, d: string, vx: number, vyTop: number, style: PathStyle) {
  const f = pageFrame(page);
  const [x, y] = f.toPdf(vx, f.vh - vyTop);
  page.drawSvgPath(d, { x, y, rotate: degrees(f.angle(0)), ...style });
}

function roundedRect(w: number, h: number, r: number) {
  return `M${r} 0 H${w - r} Q${w} 0 ${w} ${r} V${h - r} Q${w} ${h} ${w - r} ${h} H${r} Q0 ${h} 0 ${h - r} V${r} Q0 0 ${r} 0 Z`;
}

/** Word wrap with a pdf-lib font. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  return wrapLines(text, (s) => font.widthOfTextAtSize(s, size), maxWidth);
}

/** Text lines with their top-left at (vx, vyTop). */
function drawLines(page: PDFPage, lines: string[], font: PDFFont, size: number, lineHeight: number, vx: number, vyTop: number, color: ReturnType<typeof rgb>) {
  const f = pageFrame(page);
  const ascent = font.heightAtSize(size, { descender: false });
  const lead = (lineHeight - size) / 2;
  lines.forEach((line, i) => {
    if (!line) return;
    drawVisualText(page, line, font, size, vx, f.vh - (vyTop + i * lineHeight + lead + ascent), 0, color);
  });
}

function drawInk(page: PDFPage, item: InkItem) {
  const highlight = item.kind === 'highlight';
  drawVisualPath(page, toSvgPath(item.points), 0, 0, {
    borderColor: hex(item.color),
    borderWidth: item.width,
    borderOpacity: highlight ? HIGHLIGHT.opacity : 1,
    borderLineCap: highlight ? LineCapStyle.Projecting : LineCapStyle.Round,
    blendMode: highlight ? BlendMode.Multiply : BlendMode.Normal,
  });
}

function drawTextItem(page: PDFPage, item: TextItem, font: PDFFont) {
  drawLines(page, wrapText(item.text, font, item.size, item.w), font, item.size, item.size * 1.4, item.x, item.y, TEXT_INK);
}

/** Bubble size for a note with a pdf-lib font (same layout as the editor). */
export function noteBubble(text: string, font: PDFFont) {
  return noteBubbleLayout(text, (s) => font.widthOfTextAtSize(s, NOTE_BUBBLE.size));
}

function drawNote(page: PDFPage, item: NoteItem, font: PDFFont) {
  // icon: 28 pt yellow square, radius 6, three lines (board: lines 16 of 24)
  drawVisualPath(page, roundedRect(NOTE_ICON, NOTE_ICON, 6), item.x, item.y, { color: NOTE_FILL });
  const s = NOTE_ICON / 24;
  drawVisualPath(page, `M${4 * s + 2} ${6 * s + 2}h${16 * s - 4} M${4 * s + 2} ${12 * s + 2}h${10 * s - 4} M${4 * s + 2} ${18 * s + 2}h${7 * s - 4}`, item.x, item.y, {
    borderColor: NOTE_INK,
    borderWidth: 1.6,
    borderLineCap: LineCapStyle.Round,
  });
  if (!item.text.trim()) return;
  const b = noteBubble(item.text, font);
  const top = item.y + NOTE_ICON + NOTE_BUBBLE.gap;
  const left = bubbleLeft(item.x, b.w, pageFrame(page).vw);
  drawVisualPath(page, roundedRect(b.w, b.h, 10), left, top, { color: BUBBLE_FILL, borderColor: NOTE_FILL, borderWidth: 1 });
  drawLines(page, b.lines, font, NOTE_BUBBLE.size, NOTE_BUBBLE.lineHeight, left + NOTE_BUBBLE.padX, top + NOTE_BUBBLE.padY, NOTE_INK);
}

async function drawSignature(doc: PDFDocument, page: PDFPage, item: SignatureItem, font: PDFFont) {
  const image = await doc.embedPng(item.png);
  const f = pageFrame(page);
  // turned a quarter at a time (clockwise as seen = counter-clockwise in PDF space, y up): the picture keeps its own size
  // and is turned about the box's centre; its anchor is its bottom-left corner before turning
  const turn = -(item.rotation ?? 0);
  const { w: iw, h: ih } = signatureImageSize(item);
  const cx = item.x + item.w / 2;
  const cy = f.vh - (item.y + item.h / 2);
  const a = (turn * Math.PI) / 180;
  const ox = cx - ((iw / 2) * Math.cos(a) - (ih / 2) * Math.sin(a));
  const oy = cy - ((iw / 2) * Math.sin(a) + (ih / 2) * Math.cos(a));
  const [x, y] = f.toPdf(ox, oy);
  page.drawImage(image, { x, y, width: iw, height: ih, rotate: degrees(f.angle(turn)) });
  if (item.caption) {
    const tw = font.widthOfTextAtSize(item.caption, CAPTION_SIZE);
    drawLines(page, [item.caption], font, CAPTION_SIZE, CAPTION_SIZE * 1.4, item.x + item.w - tw, item.y + item.h + 2, CAPTION_INK);
  }
}

/** All text the items will draw (to check the font can draw it). */
export function itemTexts(items: Item[]): string[] {
  return items.flatMap((i) => (i.type === 'text' || i.type === 'note' ? [i.text] : i.type === 'signature' && i.caption ? [i.caption] : []));
}

/** Draws every item onto its page in order (later items on top). */
export async function flattenItems(
  doc: PDFDocument,
  items: Item[],
  font: PDFFont,
  onItem?: (i: number, total: number) => Promise<void> | void,
) {
  const pages = doc.getPages();
  for (let i = 0; i < items.length; i++) {
    await onItem?.(i, items.length);
    const item = items[i];
    const page = pages[item.page];
    if (!page) continue;
    if (item.type === 'ink') drawInk(page, item);
    else if (item.type === 'text') drawTextItem(page, item, font);
    else if (item.type === 'note') drawNote(page, item, font);
    else await drawSignature(doc, page, item, font);
  }
}
