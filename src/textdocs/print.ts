'use client';
// Prints a page (textPageHtml) with the browser's print dialog, where "Save as PDF" makes a real PDF with real,
// selectable text. The site's own @font-face rules go with it (made absolute), so Poppins and Noto Naskh print as shown.
import { textPageHtml, type PageOptions } from './page';

function siteFontFaces(): string {
  const out: string[] = [];
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // another origin's sheet
    }
    const base = sheet.href ?? location.href;
    for (const rule of [...rules]) {
      if (rule instanceof CSSFontFaceRule) {
        out.push(rule.cssText.replace(/url\((["']?)([^"')]+)\1\)/g, (_m, q: string, u: string) => `url(${q}${new URL(u, base).href}${q})`));
      }
    }
  }
  return out.join('\n');
}

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

type Page = Omit<PageOptions, 'fontFaces' | 'sansFamily' | 'urduFamily'>;

/** The site's fonts for a printed page: @font-face rules and the sans / Urdu families. */
export const siteFonts = () => ({
  faces: siteFontFaces(),
  sans: cssVar('--font-poppins') || 'sans-serif',
  urdu: cssVar('--font-naskh') || "'Noto Naskh Arabic'",
});

/** The page with the site's fonts: what Preview shows and Save PDF prints. */
export const pageWithSiteFonts = (page: Page) =>
  textPageHtml({
    ...page,
    fontFaces: siteFontFaces(),
    sansFamily: cssVar('--font-poppins') || 'sans-serif',
    urduFamily: cssVar('--font-naskh') || "'Noto Naskh Arabic'",
  });

export const printDoc = (page: Page) => printHtml(pageWithSiteFonts(page));

/** Prints a whole HTML page in a hidden frame (no scripts run in it). Its <title> is the PDF's suggested name. */
export function printHtml(html: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;inset:auto;width:0;height:0;border:0;opacity:0;pointer-events:none';
    // no scripts in the printed page (the document's HTML is cleaned too)
    frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
    frame.srcdoc = html;
    frame.onload = async () => {
      const win = frame.contentWindow!;
      try {
        await win.document.fonts?.ready;
        await Promise.all([...win.document.images].map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)))));
      } catch {
        // print anyway
      }
      // the iframe's title becomes the PDF's suggested name
      const restore = document.title;
      document.title = win.document.title;
      win.focus();
      win.print();
      document.title = restore;
      setTimeout(() => {
        frame.remove();
        resolve();
      }, 500);
    };
    document.body.appendChild(frame);
  });
}
