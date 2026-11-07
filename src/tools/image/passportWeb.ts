// Passport photo on the web (pure; the app has 3 sizes in src/tools/image/passport.ts, kept here as the first ones):
// document sizes by country, where the head goes, the user's own move / zoom on top of the face-found crop, and print
// sheets of any paper with any number of copies. Sizes are each authority's published photo size; head height is
// the middle of its chin-to-crown range. Countries change rules: the editor says to check before printing, and
// Custom takes any size in mm.

export type DocSpec = {
  id: string;
  country: string;
  label: string;
  wMm: number;
  hMm: number;
  /** chin to crown, mm (the middle of the allowed range) */
  headMm: number;
  /** space above the head, mm */
  topMm: number;
  bg: PhotoBg;
};

export type PhotoBg = 'white' | 'gray' | 'lightblue' | 'blue' | 'red' | 'custom';
export const PHOTO_BG_HEX: Record<Exclude<PhotoBg, 'custom'>, string> = { white: '#FFFFFF', gray: '#E5E7EB', lightblue: '#DBE9F6', blue: '#3B6FC4', red: '#C8102E' };

const icao = (id: string, country: string, label: string, bg: PhotoBg = 'white'): DocSpec => ({ id, country, label, wMm: 35, hMm: 45, headMm: 34, topMm: 4, bg });

export const DOC_SPECS: DocSpec[] = [
  // the app's three (same ids)
  icao('pk', 'Pakistan', 'Passport 35 × 45 mm'),
  { id: 'us', country: 'United States', label: 'Passport / visa 2 × 2 in', wMm: 50.8, hMm: 50.8, headMm: 30, topMm: 6, bg: 'white' },
  icao('visa', 'Visa (most countries)', 'Visa 35 × 45 mm'),
  icao('pk-id', 'Pakistan', 'CNIC / NICOP 35 × 45 mm'),
  icao('in', 'India', 'Passport 35 × 45 mm'),
  { id: 'in-visa', country: 'India', label: 'Visa 2 × 2 in', wMm: 50.8, hMm: 50.8, headMm: 30, topMm: 6, bg: 'white' },
  { id: 'uk', country: 'United Kingdom', label: 'Passport / visa 35 × 45 mm', wMm: 35, hMm: 45, headMm: 31.5, topMm: 5, bg: 'gray' },
  icao('eu', 'Schengen / EU', 'Passport / visa 35 × 45 mm', 'gray'),
  { id: 'ca', country: 'Canada', label: 'Passport 50 × 70 mm', wMm: 50, hMm: 70, headMm: 33.5, topMm: 10, bg: 'white' },
  icao('au', 'Australia', 'Passport 35 × 45 mm', 'gray'),
  { id: 'cn', country: 'China', label: 'Passport / visa 33 × 48 mm', wMm: 33, hMm: 48, headMm: 30.5, topMm: 4, bg: 'white' },
  icao('jp', 'Japan', 'Passport 35 × 45 mm'),
  { id: 'sa', country: 'Saudi Arabia', label: 'Visa 40 × 60 mm', wMm: 40, hMm: 60, headMm: 36, topMm: 6, bg: 'white' },
  { id: 'ae', country: 'United Arab Emirates', label: 'Visa / Emirates ID 43 × 55 mm', wMm: 43, hMm: 55, headMm: 36, topMm: 5, bg: 'white' },
  { id: 'tr', country: 'Turkey', label: 'Passport 50 × 60 mm', wMm: 50, hMm: 60, headMm: 36, topMm: 6, bg: 'white' },
  { id: 'my', country: 'Malaysia', label: 'Passport 35 × 50 mm', wMm: 35, hMm: 50, headMm: 32, topMm: 5, bg: 'white' },
  { id: 'id', country: 'Indonesia', label: 'Passport 40 × 60 mm', wMm: 40, hMm: 60, headMm: 36, topMm: 6, bg: 'white' },
  { id: 'bd', country: 'Bangladesh', label: 'Passport 45 × 55 mm', wMm: 45, hMm: 55, headMm: 36, topMm: 5, bg: 'white' },
  icao('ng', 'Nigeria', 'Passport 35 × 45 mm'),
  icao('ph', 'Philippines', 'Passport 35 × 45 mm'),
  icao('ru', 'Russia', 'Passport 35 × 45 mm'),
  { id: 'br', country: 'Brazil', label: 'Passport 50 × 70 mm', wMm: 50, hMm: 70, headMm: 33, topMm: 10, bg: 'white' },
  { id: 'nz', country: 'New Zealand', label: 'Passport 35 × 45 mm', wMm: 35, hMm: 45, headMm: 34, topMm: 4, bg: 'gray' },
  { id: 'za', country: 'South Africa', label: 'Passport 35 × 45 mm', wMm: 35, hMm: 45, headMm: 34, topMm: 4, bg: 'white' },
];

export const docSpec = (id: string) => DOC_SPECS.find((s) => s.id === id) ?? DOC_SPECS[0];

/** A size the person types (mm); the head is ~75% of the height, like ICAO's 35 x 45. */
export function customSpec(wMm: number, hMm: number): DocSpec {
  const w = Math.min(200, Math.max(10, wMm || 35));
  const h = Math.min(200, Math.max(10, hMm || 45));
  return { id: 'custom', country: 'Custom', label: `${w} × ${h} mm`, wMm: w, hMm: h, headMm: h * 0.74, topMm: h * 0.09, bg: 'white' };
}

/** Pixels at 300 dpi. */
export const photoPixels = (s: DocSpec) => ({ w: Math.round((s.wMm / 25.4) * 300), h: Math.round((s.hMm / 25.4) * 300) });

export type Box = { x: number; y: number; w: number; h: number };

/** The face box of a face finder runs brow to chin; the whole head (to the crown) is about 1.35x as tall. */
const HEAD_PER_FACE = 1.35;

/** The crop (photo px, may reach outside) that puts this face where the document needs it. */
export function faceCrop(face: Box, s: DocSpec): Box {
  const head = face.h * HEAD_PER_FACE;
  const crown = face.y + face.h - head;
  const h = head / (s.headMm / s.hMm);
  const w = (h * s.wMm) / s.hMm;
  return { x: face.x + face.w / 2 - w / 2, y: crown - (s.topMm / s.hMm) * h, w, h };
}

/** With no face: the biggest crop of the document's shape, centred, a little towards the top (heads are high). */
export function centerCrop(img: { w: number; h: number }, s: DocSpec): Box {
  const ratio = s.wMm / s.hMm;
  let w = img.w;
  let h = w / ratio;
  if (h > img.h) {
    h = img.h;
    w = h * ratio;
  }
  return { x: (img.w - w) / 2, y: Math.max(0, (img.h - h) * 0.3), w, h };
}

/** The person's own adjustment: zoom (1 = as found, 2 = twice as close) and a shift in shares of the crop. */
export type Adjust = { zoom: number; dx: number; dy: number };
export const NO_ADJUST: Adjust = { zoom: 1, dx: 0, dy: 0 };

export function adjusted(base: Box, a: Adjust): Box {
  const w = base.w / a.zoom;
  const h = base.h / a.zoom;
  return { x: base.x + (base.w - w) / 2 + a.dx * w, y: base.y + (base.h - h) / 2 + a.dy * h, w, h };
}

/** Soft warnings (never blocking): too few pixels to print sharp, or the crop runs far outside the photo. */
export type CropNote = 'ok' | 'small' | 'outside';
export function cropNote(c: Box, img: { w: number; h: number }, s: DocSpec): CropNote {
  if (c.h < photoPixels(s).h * 0.6) return 'small';
  const outside = Math.max(0, -c.y) + Math.max(0, -c.x) + Math.max(0, c.x + c.w - img.w) + Math.max(0, c.y + c.h - img.h);
  return outside > c.h * 0.15 ? 'outside' : 'ok';
}

/** Head guide (an oval) on the photo, in shares of it: where the head should be. */
export function headGuide(s: DocSpec) {
  const h = s.headMm / s.hMm;
  const w = Math.min(0.95, (s.headMm * 0.74) / s.wMm);
  return { top: s.topMm / s.hMm, h, w, left: (1 - w) / 2 };
}

// ---------- print sheets ----------

export type Paper = { id: string; label: string; wMm: number; hMm: number; marginMm: number };
export const PAPERS: Paper[] = [
  { id: '4x6', label: '6 × 4 in', wMm: 152.4, hMm: 101.6, marginMm: 3 },
  { id: '5x7', label: '7 × 5 in', wMm: 177.8, hMm: 127, marginMm: 3 },
  { id: 'a4', label: 'A4', wMm: 210, hMm: 297, marginMm: 8 },
  { id: 'letter', label: 'Letter', wMm: 215.9, hMm: 279.4, marginMm: 8 },
  { id: 'a5', label: 'A5', wMm: 148, hMm: 210, marginMm: 6 },
];
export const paperOf = (id: string) => PAPERS.find((p) => p.id === id) ?? PAPERS[0];

/** Space between photos on the sheet (cut between them). */
export const GAP_MM = 2;

/** The paper turned whichever way holds more photos; `copies` (0 = as many as fit) placed from the top, centred. */
export function sheetPlan(s: DocSpec, paper: Paper, copies = 0): { wMm: number; hMm: number; boxes: Box[]; fits: number } {
  const fit = (pw: number, ph: number) => {
    const cols = Math.max(0, Math.floor((pw - paper.marginMm * 2 + GAP_MM) / (s.wMm + GAP_MM)));
    const rows = Math.max(0, Math.floor((ph - paper.marginMm * 2 + GAP_MM) / (s.hMm + GAP_MM)));
    return { cols, rows, n: cols * rows, pw, ph };
  };
  const a = fit(paper.wMm, paper.hMm);
  const b = fit(paper.hMm, paper.wMm);
  const best = b.n > a.n ? b : a;
  const n = copies > 0 ? Math.min(copies, best.n) : best.n;
  const rowsUsed = Math.ceil(n / Math.max(1, best.cols));
  const gridW = best.cols * s.wMm + (best.cols - 1) * GAP_MM;
  const gridH = rowsUsed * s.hMm + Math.max(0, rowsUsed - 1) * GAP_MM;
  const x0 = (best.pw - gridW) / 2;
  // a full sheet is centred; a few copies start at the top so the rest of the paper stays usable
  const y0 = copies > 0 && n < best.n ? paper.marginMm : (best.ph - gridH) / 2;
  const boxes: Box[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / best.cols);
    const c = i % best.cols;
    boxes.push({ x: x0 + c * (s.wMm + GAP_MM), y: y0 + r * (s.hMm + GAP_MM), w: s.wMm, h: s.hMm });
  }
  return { wMm: best.pw, hMm: best.ph, boxes, fits: best.n };
}
