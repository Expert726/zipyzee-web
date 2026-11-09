'use client';
// ID card scan on the web (the app: its own card camera + custom/scan/IdScanStep, design/FlowIdScan.dc.html): Front
// and Back, each a photo with the card's corners found and adjustable (src/lib/docScan.ts) and Turn; a live preview of
// the page with both sides; Card size (Real size, Larger, Fill page), Page (A4, Letter), and the watermark (your words
// and colour, "Copy for bank use only" when empty). handlers/idScan.ts makes the PDF.
import { useEffect, useRef, useState } from 'react';
import { Crop, Loader2, RotateCw } from 'lucide-react';
import { useT } from '@/i18n/client';
import { findCorners, loadScanPhoto, renderScanPage, type ScanPageIn } from '@/lib/docScan';
import { fitIn, idLayout, rotateRight, type IdSize, type PaperSize } from '@/tools/scan';
import { WM_COLORS } from '@/tools/pdfWatermark';
import { ToolError } from '@/tools/types';
import { Button } from '../../../ui/Button';
import { Choice, Switch } from '../../../custom/makedoc/parts';
import type { CustomSetupProps } from '../index';
import { QuadEditor } from './QuadEditor';
import { PhotoInputs } from './ScanEditor';

export const ID_WATERMARK = 'Copy for bank use only';
const PREVIEW_W = 300;

export function IdScanEditor({ tool, files, onStart }: CustomSetupProps) {
  const t = useT();
  const [sides, setSides] = useState<(ScanPageIn | null)[]>([null, null]);
  const [side, setSide] = useState<0 | 1>(0);
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<IdSize>('real');
  const [paper, setPaper] = useState<PaperSize>('a4');
  const [watermark, setWatermark] = useState(false);
  const [text, setText] = useState(ID_WATERMARK);
  const [color, setColor] = useState(WM_COLORS[0]);
  const sheet = useRef<HTMLCanvasElement>(null);
  const used = useRef(new Set<File>());

  const load = async (s: 0 | 1, f: File) => {
    setError(null);
    setLoading(s);
    try {
      const p = await loadScanPhoto(f, 1800);
      setSides((list) => list.map((x, i) => (i === s ? p : x)));
      // after the front, go on to the back
      if (s === 0) setSide(1);
    } catch (e) {
      setError(e instanceof ToolError ? e.message : t('This photo could not be read. Try another one.'));
    }
    setLoading(null);
  };

  // photos dropped on the page or handed over: front first, then back
  useEffect(() => {
    const fresh = files.filter((f) => !used.current.has(f));
    if (!fresh.length) return;
    fresh.forEach((f) => used.current.add(f));
    void Promise.resolve().then(async () => {
      for (const f of fresh.slice(0, 2)) await load(sides[0] ? 1 : 0, f);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only new files
  }, [files]);

  const update = (s: number, patch: Partial<ScanPageIn>) => setSides((list) => list.map((x, i) => (i === s && x ? { ...x, ...patch } : x)));

  // the page as it will print, small
  useEffect(() => {
    const c = sheet.current;
    if (!c) return;
    const id = setTimeout(() => {
      const L = idLayout(paper, size);
      const k = PREVIEW_W / L.width;
      c.width = PREVIEW_W;
      c.height = Math.round(L.height * k);
      const g = c.getContext('2d')!;
      g.fillStyle = '#FFFFFF';
      g.fillRect(0, 0, c.width, c.height);
      [L.front, L.back].forEach((box, i) => {
        const s = sides[i];
        if (!s) {
          g.strokeStyle = '#C7CBD1';
          g.setLineDash([4, 3]);
          g.strokeRect(box.x * k, box.y * k, box.w * k, box.h * k);
          g.setLineDash([]);
          return;
        }
        const img = renderScanPage(s, 'original', 500);
        const b = fitIn(box, img.width, img.height);
        g.drawImage(img, b.x * k, b.y * k, b.w * k, b.h * k);
        img.width = img.height = 0;
      });
      if (watermark && text.trim()) {
        g.save();
        g.translate(c.width / 2, c.height / 2);
        g.rotate((-35 * Math.PI) / 180);
        g.globalAlpha = 0.3;
        g.fillStyle = color;
        g.font = `800 ${Math.round(c.width / 13)}px Poppins, system-ui, sans-serif`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(text.trim(), 0, 0);
        g.restore();
      }
    }, 80);
    return () => clearTimeout(id);
  }, [sides, size, paper, watermark, text, color]);

  const cur = sides[side];
  const label = side === 0 ? t('Front') : t('Back');

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
      <section className="card p-3 sm:p-5 flex flex-col items-center gap-4">
        <Choice value={String(side)} options={[['0', `${t('Front')}${sides[0] ? ' ✓' : ''}`], ['1', `${t('Back')}${sides[1] ? ' ✓' : ''}`]]} onChange={(v) => setSide(v === '1' ? 1 : 0)} />
        {loading === side ? (
          <Loader2 size={28} className="animate-spin text-primary my-20" aria-label={t('Opening the photo…')} />
        ) : cur ? (
          <>
            <QuadEditor photo={cur.photo} quad={cur.quad} onChange={(quad) => update(side, { quad })} />
            <p className="text-[12px] text-secondary text-center">{t('Drag the corners onto the corners of the card.')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="secondary" onClick={() => update(side, { rotation: rotateRight(cur.rotation) })}>
                <RotateCw size={17} aria-hidden="true" className="inline me-2" />
                {side === 0 ? t('Turn front') : t('Turn back')}
              </Button>
              <Button variant="secondary" onClick={() => update(side, { quad: findCorners(cur.photo) })}>
                <Crop size={17} aria-hidden="true" className="inline me-2" />
                {t('Find edges')}
              </Button>
            </div>
            <PhotoInputs onFiles={(f) => void load(side, f[0])} multiple={false} compact />
          </>
        ) : (
          <div className="py-10 flex flex-col items-center gap-3 text-center">
            <p className="text-[16px] font-semibold">{t('Photograph the {side} of the card', { side: label.toLowerCase() })}</p>
            <p className="text-[13px] text-secondary max-w-sm">{t('Put the card on a dark surface and fill most of the photo with it.')}</p>
            <PhotoInputs onFiles={(f) => void load(side, f[0])} multiple={false} />
          </div>
        )}
        {error && <p className="text-[13px] text-error" role="alert">{error}</p>}
      </section>

      <aside className="card p-5 flex flex-col gap-5 lg:sticky lg:top-20">
        <div className="flex flex-col items-center gap-2">
          <canvas ref={sheet} className="w-full max-w-[220px] shadow-raised rounded-sm bg-white" aria-label={t('Check the page')} />
        </div>
        <Choice label={t('Card size')} value={size} options={[['real', t('Real size')], ['large', t('Larger')], ['fit', t('Fill page')]]} onChange={setSize} />
        <Choice label={t('Page')} value={paper} options={[['a4', 'A4'], ['letter', t('Letter')]]} onChange={setPaper} />
        <Switch label={t('Add a watermark')} sub={watermark ? undefined : `"${text.trim() || ID_WATERMARK}"`} value={watermark} onChange={setWatermark} />
        {watermark && (
          <div className="flex flex-col gap-3 -mt-2">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              {t('Watermark text')}
              <input value={text} maxLength={60} onChange={(e) => setText(e.target.value)} placeholder={ID_WATERMARK} className="min-h-11 rounded-tile bg-surface border border-line-strong px-3 text-[14px] font-normal" />
            </label>
            <div className="flex gap-2" role="radiogroup" aria-label={t('Watermark colour')}>
              {WM_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className={`size-8 rounded-full border ${color === c ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface border-transparent' : 'border-line-strong'}`} style={{ background: c }} />
              ))}
            </div>
          </div>
        )}
        {(!sides[0] || !sides[1]) && <p className="text-[13px] text-secondary">{t('Scan both sides of the card first.')}</p>}
        <Button arrow disabled={!sides[0] || !sides[1] || loading != null} onClick={() => onStart({ pages: sides, paper, size, watermark, watermarkText: text, watermarkColor: color })} className="w-full">
          {t(tool.verb)}
        </Button>
      </aside>
    </div>
  );
}
