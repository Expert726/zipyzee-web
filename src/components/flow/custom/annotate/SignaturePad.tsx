'use client';
// "Create your signature" (the app's annotate/SignaturePad): Draw (mouse, finger or pen), Type (your name in a
// handwriting style) or Photo (a signature on white paper, its background taken away). The app's inks and thickness;
// "Save for next time" keeps it in this browser. The result is a PNG with a see-through background, trimmed to the ink.
import { useEffect, useRef, useState } from 'react';
import { Caveat, Dancing_Script, Great_Vibes } from 'next/font/google';
import { ImagePlus, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import type { Translate } from '@/i18n';
import { signatureInks } from '@/theme/inks';
import { Button } from '../../../ui/Button';
import { Choice, Switch } from '../../../custom/makedoc/parts';

const dancing = Dancing_Script({ subsets: ['latin'], weight: '600', display: 'swap' });
const vibes = Great_Vibes({ subsets: ['latin'], weight: '400', display: 'swap' });
const caveat = Caveat({ subsets: ['latin'], weight: '600', display: 'swap' });
const STYLES = [dancing, vibes, caveat];

export type MadeSignature = { png: string; w: number; h: number; save: boolean };
type Mode = 'draw' | 'type' | 'photo';

/** The ink's box in a canvas, as a trimmed PNG data URL (null when nothing was drawn). */
function trimmed(c: HTMLCanvasElement): { png: string; w: number; h: number } | null {
  const g = c.getContext('2d')!;
  const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
  let l = width;
  let r = -1;
  let tp = height;
  let b = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3] > 16) {
        if (x < l) l = x;
        if (x > r) r = x;
        if (y < tp) tp = y;
        if (y > b) b = y;
      }
  if (r < 0) return null;
  const pad = 6;
  l = Math.max(0, l - pad);
  tp = Math.max(0, tp - pad);
  r = Math.min(width - 1, r + pad);
  b = Math.min(height - 1, b + pad);
  const out = document.createElement('canvas');
  out.width = r - l + 1;
  out.height = b - tp + 1;
  out.getContext('2d')!.drawImage(c, l, tp, out.width, out.height, 0, 0, out.width, out.height);
  return { png: out.toDataURL('image/png'), w: out.width, h: out.height };
}

const inkLabel = (i: number, t: Translate) => [t('Dark blue'), t('Black'), t('Red')][i];

/** `inline`: shown in the page (Signature maker) instead of as a dialog; `doneLabel` names the main button. */
export function SignaturePad({ onClose, onDone, inline, doneLabel }: { onClose?: () => void; onDone: (s: MadeSignature) => void; inline?: boolean; doneLabel?: string }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('draw');
  const inks = [signatureInks[1].value, signatureInks[0].value, signatureInks[3].value]; // dark blue, black, red (the app's order)
  const [ink, setInk] = useState(inks[0]);
  const [thick, setThick] = useState(false);
  const [name, setName] = useState('');
  const [style, setStyle] = useState(0);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [threshold, setThreshold] = useState(70);
  const [save, setSave] = useState(true);
  const [drawn, setDrawn] = useState(false);
  const draw = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<{ x: number; y: number }[][]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inline || !onClose) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose, inline]);

  // the drawing, redrawn in the chosen ink and thickness
  const repaint = () => {
    const c = draw.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    g.strokeStyle = ink;
    g.lineWidth = thick ? 14 : 8; // the canvas is ~2x its shown size; a placed signature is ~160 pt wide
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of strokes.current) {
      g.beginPath();
      s.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      if (s.length === 1) g.lineTo(s[0].x + 0.1, s[0].y);
      g.stroke();
    }
  };
  useEffect(repaint);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  };

  const make = async (): Promise<{ png: string; w: number; h: number } | null> => {
    if (mode === 'draw') return draw.current ? trimmed(draw.current) : null;
    const c = document.createElement('canvas');
    if (mode === 'type') {
      if (!name.trim()) return null;
      const family = STYLES[style].style.fontFamily;
      await document.fonts.load(`96px ${family}`);
      c.width = 1400;
      c.height = 260;
      const g = c.getContext('2d')!;
      g.font = `96px ${family}`;
      g.fillStyle = ink;
      g.textBaseline = 'middle';
      g.fillText(name.trim(), 30, 130, 1340);
      return trimmed(c);
    }
    if (!photo) return null;
    // a photo: light paper becomes see-through, the rest becomes the chosen ink
    const k = Math.min(1, 1400 / Math.max(photo.naturalWidth, photo.naturalHeight));
    c.width = Math.round(photo.naturalWidth * k);
    c.height = Math.round(photo.naturalHeight * k);
    const g = c.getContext('2d')!;
    g.drawImage(photo, 0, 0, c.width, c.height);
    const img = g.getImageData(0, 0, c.width, c.height);
    const cut = (threshold / 100) * 255;
    const [ir, ig, ib] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16));
    for (let i = 0; i < img.data.length; i += 4) {
      const lum = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
      const a = lum >= cut ? 0 : Math.min(255, ((cut - lum) / cut) * 255 * 2.2);
      img.data[i] = ir;
      img.data[i + 1] = ig;
      img.data[i + 2] = ib;
      img.data[i + 3] = a;
    }
    g.putImageData(img, 0, 0);
    return trimmed(c);
  };

  const ready = mode === 'draw' ? drawn : mode === 'type' ? !!name.trim() : !!photo;

  return (
    <div className={inline ? 'grid place-items-center' : 'fixed inset-0 z-50 grid place-items-center p-4'} role={inline ? 'region' : 'dialog'} aria-modal={inline ? undefined : true} aria-label={t('Create your signature')}>
      {!inline && <button type="button" className="absolute inset-0 bg-overlay" tabIndex={-1} aria-hidden="true" onClick={onClose} />}
      <div className={`relative card w-full max-w-xl p-5 sm:p-6 flex flex-col gap-4 ${inline ? '' : 'shadow-raised max-h-[calc(100dvh-2rem)] overflow-y-auto'}`}>
        <div className="flex items-center">
          <h2 className="text-[19px] font-semibold flex-1">{t('Create your signature')}</h2>
          {onClose && (
            <button type="button" onClick={onClose} aria-label={t('Close')} className="size-10 rounded-full grid place-items-center hover:bg-fill">
              <X size={20} aria-hidden="true" />
            </button>
          )}
        </div>
        <Choice value={mode} options={[['draw', t('Draw')], ['type', t('Type')], ['photo', t('Photo')]]} onChange={setMode} />

        {mode === 'draw' && (
          <div>
            <div className="relative rounded-tile border border-line-strong bg-paper">
              <canvas
                ref={draw}
                width={1200}
                height={400}
                aria-label={t('Sign with your finger above the line')}
                className="block w-full aspect-[3/1] touch-none cursor-crosshair"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  strokes.current.push([at(e)]);
                  setDrawn(true);
                  repaint();
                }}
                onPointerMove={(e) => {
                  if (!e.buttons) return;
                  strokes.current[strokes.current.length - 1]?.push(at(e));
                  repaint();
                }}
              />
              <span className="absolute inset-x-8 bottom-[22%] border-b border-dashed border-line-strong pointer-events-none" aria-hidden="true" />
              {drawn && (
                <button
                  type="button"
                  onClick={() => {
                    strokes.current = [];
                    setDrawn(false);
                    repaint();
                  }}
                  className="absolute top-2 end-2 rounded-full bg-fill px-3 min-h-8 text-[13px] font-medium text-paper-ink"
                >
                  {t('Clear')}
                </button>
              )}
            </div>
            <p className="text-[12px] text-secondary text-center mt-2">{t('Sign with your mouse, finger or pen above the line')}</p>
          </div>
        )}

        {mode === 'type' && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-2 text-[13px] font-semibold">
              {t('Your name')}
              <input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} className="min-h-12 rounded-tile bg-surface border border-line-strong px-4 text-[15px] font-normal focus:outline-2 focus:outline-primary" />
            </label>
            <div className="grid gap-2" role="radiogroup" aria-label={t('Signature type')}>
              {STYLES.map((f, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={style === i}
                  aria-label={t('Signature style {n}', { n: i + 1 })}
                  onClick={() => setStyle(i)}
                  className={`rounded-tile border px-4 py-2 text-start bg-paper ${style === i ? 'border-primary outline-2 outline-primary' : 'border-line'}`}
                >
                  <span className={`${f.className} text-[34px] leading-tight`} style={{ color: ink }}>
                    {name.trim() || t('Your name')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'photo' && (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-secondary">{t('Sign on white paper, then take or choose a photo')}</p>
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              <ImagePlus size={18} aria-hidden="true" className="inline me-2" />
              {t('Choose photo')}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                const img = new Image();
                img.onload = () => setPhoto(img);
                img.src = URL.createObjectURL(f);
              }}
            />
            {photo && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- the chosen photo */}
                <img src={photo.src} alt="" className="max-h-40 object-contain rounded-tile border border-line bg-paper" />
                <label className="flex flex-col gap-1 text-[13px] font-semibold">
                  <span className="flex">
                    <span className="flex-1">{t('Remove background')}</span>
                    <span className="text-primary">{threshold}%</span>
                  </span>
                  <input type="range" min={50} max={95} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="accent-[var(--primary)]" />
                </label>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">{t('Ink')}</legend>
            <span className="text-[13px] font-semibold me-1" aria-hidden="true">
              {t('Ink')}
            </span>
            {inks.map((c, i) => (
              <button key={c} type="button" aria-label={inkLabel(i, t)} aria-pressed={ink === c} onClick={() => setInk(c)} className={`size-8 rounded-full border-2 ${ink === c ? 'border-primary' : 'border-transparent'}`}>
                <span className="block size-full rounded-full border-2 border-surface" style={{ background: c }} />
              </button>
            ))}
          </fieldset>
          {mode === 'draw' && (
            <Choice
              value={thick ? 'thick' : 'thin'}
              options={[
                ['thin', t('Thin')],
                ['thick', t('Thick')],
              ]}
              onChange={(v) => setThick(v === 'thick')}
            />
          )}
        </div>
        <Switch label={t('Save for next time')} sub={t('Kept only in this browser')} value={save} onChange={setSave} />
        <Button
          disabled={!ready}
          onClick={async () => {
            const made = await make();
            if (made) onDone({ ...made, save });
          }}
        >
          {doneLabel ?? t('Add to document')}
        </Button>
      </div>
    </div>
  );
}
