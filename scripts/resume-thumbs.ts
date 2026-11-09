// Renders the resume gallery thumbnails: each of the 100 templates (src/resume/templates) with its sample persona,
// page 1, as a PNG 330 px wide in public/resume-thumbs/<id>.png. Uses the Chrome already installed (puppeteer-core)
// and the fonts in public/resume-fonts. Run after changing or adding a template:
//   npm run thumbs        (CHROME_PATH=/path/to/chrome to use another Chrome)
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { render, TEMPLATES } from '../src/resume/templates';
import { sampleResume } from '../src/resume/sample';

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public/resume-thumbs');
const FONTS = `file://${path.join(ROOT, 'public/resume-fonts')}/`;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const WIDTH = 330;
const PAGE = { w: 595, h: 842 };
const only = process.argv.slice(2);

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: PAGE.w, height: PAGE.h, deviceScaleFactor: WIDTH / PAGE.w });
    for (const t of TEMPLATES) {
      if (only.length && !only.includes(t.id)) continue;
      const file = path.join(OUT, `.${t.id}.html`);
      fs.writeFileSync(file, render(sampleResume(t), { fontBase: FONTS }));
      await page.goto(`file://${file}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(OUT, `${t.id}.png`) as `${string}.png`, clip: { x: 0, y: 0, width: PAGE.w, height: PAGE.h } });
      fs.unlinkSync(file);
      console.log(`${t.id}.png`);
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
