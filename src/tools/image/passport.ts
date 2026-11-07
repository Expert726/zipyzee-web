import { t } from '@/i18n';
// Passport photo geometry (pure, unit-tested) — design/FlowPassportPhoto.dc.html: where to crop around the face
// for each size, whether the face fits, the 300 dpi output size and the 6 x 4 in print sheet.

export type PassportSize = 'pk' | 'us' | 'visa';
export type PassportBackground = 'white' | 'blue' | 'gray';

type Spec = { label: string; wMm: number; hMm: number; head: number; crown: number; file: string };

/**
 * head: head height (chin to crown) as a share of the photo height, the middle of each country's range
 * (35 x 45: 32-36 mm -> ~0.76; US: 1-1 3/8 in of 2 in -> ~0.6). crown: space above the head, share of the height.
 */
export const PASSPORT_SPECS: Record<PassportSize, Spec> = {
  pk: { get label() { return t('Pakistan 35×45'); }, wMm: 35, hMm: 45, head: 0.76, crown: 0.09, file: '35x45' },
  us: { get label() { return t('US 2×2 in'); }, wMm: 50.8, hMm: 50.8, head: 0.6, crown: 0.12, file: '2x2' },
  visa: { get label() { return t('Visa 35×45'); }, wMm: 35, hMm: 45, head: 0.76, crown: 0.09, file: '35x45' },
};

export const PASSPORT_BACKGROUNDS = [
  { get label() { return t('White'); }, value: 'white' },
  { get label() { return t('Light blue'); }, value: 'blue' },
  { get label() { return t('Light gray'); }, value: 'gray' },
] as const;

export type Box = { x: number; y: number; w: number; h: number };

/**
 * ML Kit's face box runs from the forehead to the chin; the whole head (to the crown) is about 1.35x as tall
 * and the chin sits at the bottom of the box.
 */
const HEAD_PER_FACE = 1.35;

/** Pixels at 300 dpi: 35 x 45 mm -> 413 x 531, 2 x 2 in -> 600 x 600. */
export function outputPixels(size: PassportSize) {
  const s = PASSPORT_SPECS[size];
  return { w: Math.round((s.wMm / 25.4) * 300), h: Math.round((s.hMm / 25.4) * 300) };
}

export type FaceCheck = 'fits' | 'none' | 'many' | 'closer' | 'back';

export const FACE_CHECK_TEXT: Record<FaceCheck, string> = {
  get fits() { return t('Face fits'); },
  get none() { return t('No face found'); },
  get many() { return t('Only one person please'); },
  get closer() { return t('Move closer'); },
  get back() { return t('Step back a little'); },
};

/** The crop (in image px, may reach outside the photo) that puts this face where the size needs it. */
export function passportCrop(face: Box, size: PassportSize): Box {
  const s = PASSPORT_SPECS[size];
  const head = face.h * HEAD_PER_FACE;
  const chin = face.y + face.h;
  const crown = chin - head;
  const h = head / s.head;
  const w = (h * s.wMm) / s.hMm;
  return { x: face.x + face.w / 2 - w / 2, y: crown - s.crown * h, w, h };
}

/**
 * Fits when exactly one face is found, the crop has enough pixels for 300 dpi (at least 70%) and doesn't run
 * far outside the photo (the shoulders would be cut; a little at the bottom or sides is filled with background).
 */
export function checkFace(faces: Box[], img: { w: number; h: number }, size: PassportSize): FaceCheck {
  if (!faces.length) return 'none';
  if (faces.length > 1) return 'many';
  const c = passportCrop(faces[0], size);
  if (c.h < outputPixels(size).h * 0.7) return 'closer';
  const outside = Math.max(0, -c.y) + Math.max(0, -c.x) + Math.max(0, c.x + c.w - img.w);
  if (outside > c.h * 0.12) return 'back';
  return 'fits';
}

// ---------- print sheet ----------

export type PrintSheet = '4x6' | 'a4';

/** Paper in points: 6 x 4 in landscape (photo paper, printed edge to edge) and A4 portrait (0.25 in margin). */
export const SHEETS: Record<PrintSheet, { w: number; h: number; margin: number; label: string; name: string }> = {
  '4x6': { w: 432, h: 288, margin: 0, get label() { return t('4×6 in'); }, name: '4×6 in' },
  a4: { w: 595.28, h: 841.89, margin: 18, label: 'A4', name: 'A4' },
};

export const PRINT_SHEETS = (Object.keys(SHEETS) as PrintSheet[]).map((k) => ({ label: SHEETS[k].label, value: k }));

/**
 * Photos side by side with no gaps (cut along the lines), centred inside the margins.
 * 4x6: 8 of 35x45, 6 of 2x2. A4: 30 of 35x45, 15 of 2x2.
 */
export function sheetLayout(size: PassportSize, sheet: PrintSheet = '4x6'): Box[] {
  const s = PASSPORT_SPECS[size];
  const paper = SHEETS[sheet];
  const pw = (s.wMm / 25.4) * 72;
  const ph = (s.hMm / 25.4) * 72;
  const cols = Math.floor((paper.w - paper.margin * 2) / pw + 1e-6);
  const rows = Math.floor((paper.h - paper.margin * 2) / ph + 1e-6);
  const x0 = (paper.w - cols * pw) / 2;
  const y0 = (paper.h - rows * ph) / 2;
  const out: Box[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: x0 + c * pw, y: y0 + r * ph, w: pw, h: ph });
  return out;
}

export const sheetMeta = (count: number, sheet: PrintSheet = '4x6') => t('{count} photos on one {sheet} sheet', { count, sheet: SHEETS[sheet].name });

/** Paper colors for the photo itself (output data, not UI): white, a pale passport blue, a light gray. */
export const PASSPORT_BG_HEX: Record<PassportBackground, string> = { white: '#FFFFFF', blue: '#DBE9F6', gray: '#E5E7EB' };

/** Head guide on the preview (board: 124 x 152 dashed oval at top 26 on a 210 x 270 photo), as shares of it. */
export const HEAD_GUIDE = { w: 124 / 210, h: 152 / 270, top: 26 / 270 };
