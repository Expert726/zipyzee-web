'use client';
// Drawing a QR code (the app: react-native-qrcode-svg) from qrcode's (MIT) module matrix: the dots in one colour or
// a gradient across the code, the background, a quiet zone, and an optional logo in the middle on a white rounded
// square (then error correction H, so the code still reads with its middle covered). The same drawing makes the
// preview, the PNG and the SVG.
import QRCode from 'qrcode';

export type QrLook = { ink: string; to?: string; background: string; logo?: HTMLImageElement | ImageBitmap | null };

/** The module matrix, or null when the text is too long for a QR code. */
export function qrMatrix(text: string, withLogo: boolean): { size: number; on: (x: number, y: number) => boolean } | null {
  try {
    const q = QRCode.create(text, { errorCorrectionLevel: withLogo ? 'H' : 'M' });
    const { size, data } = q.modules;
    return { size, on: (x, y) => !!data[y * size + x] };
  } catch {
    return null;
  }
}

const QUIET = 4; // modules of empty border, as the standard asks

/** The code on a canvas `px` wide. */
export function drawQr(text: string, look: QrLook, px: number): HTMLCanvasElement | null {
  const m = qrMatrix(text, !!look.logo);
  if (!m) return null;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const g = c.getContext('2d')!;
  g.fillStyle = look.background;
  g.fillRect(0, 0, px, px);
  const cell = px / (m.size + QUIET * 2);
  if (look.to) {
    const grad = g.createLinearGradient(0, 0, px, px);
    grad.addColorStop(0, look.ink);
    grad.addColorStop(1, look.to);
    g.fillStyle = grad;
  } else g.fillStyle = look.ink;
  g.beginPath();
  for (let y = 0; y < m.size; y++)
    for (let x = 0; x < m.size; x++) if (m.on(x, y)) g.rect(Math.floor((x + QUIET) * cell), Math.floor((y + QUIET) * cell), Math.ceil(cell), Math.ceil(cell));
  g.fill();
  if (look.logo) {
    const s = px * 0.22;
    const pad = s * 0.12;
    const x = (px - s) / 2;
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    g.roundRect(x - pad, x - pad, s + pad * 2, s + pad * 2, s * 0.18);
    g.fill();
    const lw = look.logo.width;
    const lh = look.logo.height;
    const k = Math.min(s / lw, s / lh);
    g.drawImage(look.logo, (px - lw * k) / 2, (px - lh * k) / 2, lw * k, lh * k);
  }
  return c;
}

/** The same code as an SVG (sharp at any size, for print); the logo goes in as a PNG. */
export function qrSvg(text: string, look: QrLook, logoPng?: string): string | null {
  const m = qrMatrix(text, !!look.logo);
  if (!m) return null;
  const n = m.size + QUIET * 2;
  let path = '';
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.on(x, y)) path += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
  const fill = look.to ? 'url(#g)' : look.ink;
  const s = n * 0.22;
  const pad = s * 0.12;
  const o = (n - s) / 2;
  const logo = logoPng
    ? `<rect x="${o - pad}" y="${o - pad}" width="${s + pad * 2}" height="${s + pad * 2}" rx="${s * 0.18}" fill="#FFFFFF"/><image href="${logoPng}" x="${o}" y="${o}" width="${s}" height="${s}" preserveAspectRatio="xMidYMid meet"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="1024" height="1024" shape-rendering="crispEdges">${look.to ? `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${look.ink}"/><stop offset="1" stop-color="${look.to}"/></linearGradient></defs>` : ''}<rect width="${n}" height="${n}" fill="${look.background}"/><path d="${path}" fill="${fill}"/>${logo}</svg>`;
}
