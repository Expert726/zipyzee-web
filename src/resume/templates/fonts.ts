// Fonts of the resume templates, bundled in android/app/src/main/assets/fonts so previews and PDFs work offline
// (Google Fonts, OFL). Static files, one per weight the templates use: printing a variable font makes Chromium
// draw its letters as Type3 shapes, while static TrueType fonts are embedded as real fonts in the PDF (ATS, quality).
// DM Sans, Lora, Playfair Display, Source Serif 4 and Libre Baskerville are instances of Google's variable fonts
// (fontTools, optical size pinned at 11, the body text size); Plus Jakarta Sans files are the app's own UI fonts;
// IBM Plex Mono and Poppins are Google's static files. Arial (Plain) is the phone's own sans-serif.
import type { FontChoice } from '../types';

export const SERIF = "'Source Serif 4', Georgia, serif";
export const DM = "'DM Sans', Arial, sans-serif";
export const JAKARTA = "'Plus Jakarta Sans', Arial, sans-serif";
export const LORA = "'Lora', Georgia, serif";
export const POPPINS = "'Poppins', Arial, sans-serif";
export const PLAYFAIR = "'Playfair Display', Georgia, serif";
export const MONO = "'IBM Plex Mono', monospace";
export const BASKERVILLE = "'Libre Baskerville', Georgia, serif";
export const ARIAL = 'Arial, Helvetica, sans-serif';

/** Body fonts for the design screen's Sans / Serif / Modern when it isn't the template's own kind. */
export const FONT_STACKS: Record<FontChoice, string> = { sans: DM, serif: SERIF, modern: JAKARTA };

/** Where the WebView finds the bundled fonts. */
export const ANDROID_FONTS = 'file:///android_asset/fonts/';

const W = { Light: 300, Regular: 400, Medium: 500, SemiBold: 600, Bold: 700, ExtraBold: 800 } as const;

/**
 * Family, file prefix, the static weights bundled (assets/fonts/<prefix>-<Weight>.ttf): exactly the weights the
 * design boards load from Google Fonts, so a weight the board doesn't have (DM Sans 300 / 800, Playfair 400...) falls
 * back to the same neighbour on the phone as on the board.
 */
const FAMILIES: [family: string, prefix: string, weights: (keyof typeof W)[]][] = [
  ['DM Sans', 'DMSans', ['Regular', 'SemiBold', 'Bold']],
  ['Lora', 'Lora', ['Regular', 'SemiBold', 'Bold']],
  ['Playfair Display', 'PlayfairDisplay', ['Bold', 'ExtraBold']],
  ['Plus Jakarta Sans', 'PlusJakartaSans', ['Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold']],
  ['Source Serif 4', 'SourceSerif4', ['Regular', 'SemiBold', 'Bold']],
  ['Poppins', 'Poppins', ['Regular', 'SemiBold', 'Bold', 'ExtraBold']],
  ['IBM Plex Mono', 'IBMPlexMono', ['Regular', 'SemiBold']],
  ['Libre Baskerville', 'LibreBaskerville', ['Regular', 'Bold']],
];

const FACES: [family: string, file: string, weight: number][] = FAMILIES.flatMap(([family, prefix, weights]) =>
  weights.map((w): [string, string, number] => [family, `${prefix}-${w}.ttf`, W[w]]),
);

/** @font-face rules for every template font, loaded from `base` (the app's assets by default). */
export const fontFaces = (base = ANDROID_FONTS) =>
  FACES.map(([family, file, weight]) => `@font-face{font-family:'${family}';src:url('${base}${file}');font-weight:${weight};font-style:normal}`).join('\n');
