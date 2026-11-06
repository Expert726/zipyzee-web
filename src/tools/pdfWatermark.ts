// PDF watermark (pure, unit-tested). design/FlowPdfWatermark.dc.html has Text, Opacity and Center / Tiled; added on
// request: a logo instead of text, text color and weight, size, angle, more positions and which pages. The preview
// (src/flow/custom/PdfWatermarkStep.tsx) and the saved PDF (handlers/pdfWatermark.ts) both place stamps with
// stampCenters, in page units with y going down from the top of the page as displayed.
import { parseRanges } from './ranges';
import { t } from '@/i18n';

export type WmPosition = 'center' | 'tiled' | 'top' | 'bottom' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

export type WmSpec = {
  kind: 'text' | 'logo';
  text: string;
  /** '#RRGGBB' */
  color: string;
  bold: boolean;
  /** Width of one stamp as a percentage of the page width (10-100). */
  size: number;
  /** Degrees, counter-clockwise as you read it (35 = rising diagonal). */
  angle: number;
  /** 0-1 */
  opacity: number;
  position: WmPosition;
  /** '' = every page, otherwise ranges like "1-3, 5". */
  pages: string;
  /** Logo file uri (kind 'logo'). */
  logo: string;
};

/** The board's look: red, bold, a rising diagonal across the middle. */
export const WM_DEFAULTS: WmSpec = {
  kind: 'text', text: 'CONFIDENTIAL', color: '#E5533D', bold: true, size: 70, angle: 35, opacity: 0.35,
  position: 'center', pages: '', logo: '',
};

export const WM_COLORS = ['#E5533D', '#111827', '#6B7280', '#2563EB', '#16A34A'];

export const WM_POSITIONS: { value: WmPosition; label: string }[] = [
  { value: 'center', get label() { return t('Center'); } },
  { value: 'tiled', get label() { return t('Tiled'); } },
  { value: 'top', get label() { return t('Top'); } },
  { value: 'bottom', get label() { return t('Bottom'); } },
  { value: 'topLeft', get label() { return t('Top left'); } },
  { value: 'topRight', get label() { return t('Top right'); } },
  { value: 'bottomLeft', get label() { return t('Bottom left'); } },
  { value: 'bottomRight', get label() { return t('Bottom right'); } },
];

/** Room kept between a stamp and the page edge, as a share of the page's short side (24 pt on A4). */
const EDGE = 0.04;

const rad = (d: number) => (d * Math.PI) / 180;

/** Size of a w x h stamp's bounding box once turned `angle` degrees. */
export function turnedBox(w: number, h: number, angle: number) {
  const c = Math.abs(Math.cos(rad(angle)));
  const s = Math.abs(Math.sin(rad(angle)));
  return { bw: w * c + h * s, bh: w * s + h * c };
}

/**
 * Centers of every stamp on a vw x vh page (y down from the top), for a stamp w x h before turning. Edge positions
 * keep the turned stamp inside the page; Tiled repeats it in staggered rows past the edges (the page clips them).
 */
export function stampCenters(vw: number, vh: number, w: number, h: number, angle: number, position: WmPosition): { x: number; y: number }[] {
  const { bw, bh } = turnedBox(w, h, angle);
  const m = Math.min(vw, vh) * EDGE;
  const left = m + bw / 2;
  const right = vw - m - bw / 2;
  const top = m + bh / 2;
  const bottom = vh - m - bh / 2;
  switch (position) {
    case 'center':
      return [{ x: vw / 2, y: vh / 2 }];
    case 'top':
      return [{ x: vw / 2, y: top }];
    case 'bottom':
      return [{ x: vw / 2, y: bottom }];
    case 'topLeft':
      return [{ x: left, y: top }];
    case 'topRight':
      return [{ x: right, y: top }];
    case 'bottomLeft':
      return [{ x: left, y: bottom }];
    case 'bottomRight':
      return [{ x: right, y: bottom }];
    case 'tiled': {
      const stepX = Math.max(bw * 0.8 + h, w * 0.3);
      const stepY = Math.max(bh * 0.5 + h * 2, h * 3);
      const out: { x: number; y: number }[] = [];
      for (let row = 0, y = stepY / 2; y < vh + stepY; row++, y += stepY) {
        for (let x = row % 2 ? stepX / 2 : 0; x < vw + stepX; x += stepX) out.push({ x, y });
      }
      return out;
    }
  }
}

/** Width of one stamp on a page vw wide. */
export const stampWidth = (vw: number, size: number) => (vw * Math.min(100, Math.max(5, size))) / 100;

/** 0-based pages that get the watermark, or the reason the page list can't be used. */
export function watermarkPages(pages: string, count: number): { ok: true; pages: number[] } | { ok: false; error: string } {
  if (!pages.trim()) return { ok: true, pages: Array.from({ length: count }, (_, i) => i) };
  const r = parseRanges(pages, count);
  if (!r.ok) return r;
  const set = new Set<number>();
  for (const [a, b] of r.ranges) for (let p = a; p <= b; p++) set.add(p - 1);
  return { ok: true, pages: [...set].sort((x, y) => x - y) };
}

/** Saved options (older ones had `layout` and 0-100 opacity) -> a full spec. */
export function specOf(v: Record<string, unknown> | undefined): WmSpec {
  const o = v ?? {};
  const opacity = Number(o.opacity ?? WM_DEFAULTS.opacity * 100);
  return {
    kind: o.kind === 'logo' ? 'logo' : 'text',
    text: String(o.text ?? WM_DEFAULTS.text),
    color: typeof o.color === 'string' && /^#[0-9A-F]{6}$/i.test(o.color) ? o.color : WM_DEFAULTS.color,
    bold: o.bold !== false,
    size: Number(o.size ?? WM_DEFAULTS.size),
    angle: Number(o.angle ?? WM_DEFAULTS.angle),
    opacity: (opacity > 1 ? opacity / 100 : opacity) || WM_DEFAULTS.opacity,
    position: (o.position ?? o.layout ?? WM_DEFAULTS.position) as WmPosition,
    pages: String(o.pages ?? ''),
    logo: String(o.logo ?? ''),
  };
}
