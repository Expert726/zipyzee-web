'use client';
// Passport photo's step 2 (the app's custom/image/PassportStep, rebuilt for the web on request): the document by
// country (src/tools/image/passportWeb.ts) or a custom size; the face found (MediaPipe, src/lib/faces.ts) only sets
// where the crop starts: drag the photo to move it, zoom with the slider or the mouse wheel, Reset. "Remove
// background" cuts the person out (ormbg, src/lib/segment.ts) onto White / Light gray / Light blue / Blue / Red / any
// colour. A live preview with the head guide, and the print sheet (paper and number of copies) previewed too.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Minus, Plus, RotateCcw } from 'lucide-react';
import { useT } from '@/i18n/client';
import { detectFaces } from '@/lib/faces';
import { decodeImage } from '@/lib/image';
import { renderPlan } from '@/lib/passportImage';
import { subjectMask } from '@/lib/segment';
import { capLongest } from '@/tools/image/sizes';
import {
  adjusted, centerCrop, cropNote, customSpec, DOC_SPECS, docSpec, faceCrop, headGuide, NO_ADJUST, PAPERS, paperOf, PHOTO_BG_HEX, sheetPlan,
  type Adjust, type Box, type PhotoBg,
} from '@/tools/image/passportWeb';
import { ToolError } from '@/tools/types';
import { Button } from '../../ui/Button';
import { Choice, Switch } from '../../custom/makedoc/parts';
import { FindingSparkles } from './FindingSparkles';
import type { CustomSetupProps } from './index';

const WORK_SIDE = 2048;
const PREVIEW_W = 600;
const BGS: PhotoBg[] = ['white', 'gray', 'lightblue', 'blue', 'red', 'custom'];
const COPIES = [1, 2, 4, 6, 8, 12, 16];

/** The photo with the mask as its alpha (the person alone). */
function cutout(photo: HTMLCanvasElement, mask: Uint8ClampedArray): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = photo.width;
  c.height = photo.height;
  const g = c.getContext('2d')!;
  g.drawImage(photo, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < mask.length; i++) px.data[i * 4 + 3] = mask[i];
  g.putImageData(px, 0, 0);
  return c;
}

/** `src` cropped to `crop` (photo px) on `bg`, into canvas `c` at w x h. */
function draw(c: HTMLCanvasElement, src: HTMLCanvasElement, crop: Box, w: number, h: number, bg: string) {
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.imageSmoothingQuality = 'high';
  const k = w / crop.w;
  g.drawImage(src, -crop.x * k, -crop.y * k, src.width * k, src.height * k);
}

export function PassportEditor({ tool, files, onStart, onReplace }: CustomSetupProps) {
  const t = useT();
  const file = files[0];
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [faces, setFaces] = useState<Box[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [specId, setSpecId] = useState('pk');
  const [custom, setCustom] = useState({ w: '35', h: '45' });
  const [removeBg, setRemoveBg] = useState(true);
  const [mask, setMask] = useState<Uint8ClampedArray | null | undefined>(undefined); // undefined: not made yet
  const [maskStatus, setMaskStatus] = useState<string | null>(null);
  const [bg, setBg] = useState<PhotoBg>('white');
  const [color, setColor] = useState('#FFFFFF');
  const [adjust, setAdjust] = useState<Adjust>(NO_ADJUST);
  const [paperId, setPaperId] = useState('4x6');
  const [copies, setCopies] = useState(0);
  const view = useRef<HTMLCanvasElement>(null);
  const sheetView = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number; a: Adjust } | null>(null);
  const colorInput = useRef<HTMLInputElement>(null);

  // the photo, then the face (only where the crop starts)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const bmp = await decodeImage(file);
        const s = capLongest({ w: bmp.width, h: bmp.height }, WORK_SIDE);
        const c = document.createElement('canvas');
        c.width = s.w;
        c.height = s.h;
        c.getContext('2d')!.drawImage(bmp, 0, 0, s.w, s.h);
        bmp.close();
        if (!alive) return;
        setPhoto(c);
        try {
          const f = await detectFaces(c);
          if (alive) setFaces(f);
        } catch {
          if (alive) setFaces([]);
        }
      } catch (e) {
        if (alive) setError(e instanceof ToolError ? e.message : t('This photo could not be read. Try another one.'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [file, t]);

  // the person cut out, once, when "Remove background" is on
  useEffect(() => {
    if (!photo || !removeBg || mask !== undefined) return;
    let alive = true;
    (async () => {
      setMaskStatus(t('Removing the background…'));
      try {
        const m = await subjectMask(photo, (pct) => alive && setMaskStatus(`${t('Getting the background tool ready (one time only)…')} ${pct}%`));
        if (alive) setMask(m);
      } catch {
        if (alive) setMask(null);
      }
      if (alive) setMaskStatus(null);
    })();
    return () => {
      alive = false;
    };
  }, [photo, removeBg, mask, t]);

  const spec = specId === 'custom' ? customSpec(Number(custom.w), Number(custom.h)) : docSpec(specId);
  const face = useMemo(() => (faces?.length ? [...faces].sort((a, b) => b.w * b.h - a.w * a.h)[0] : null), [faces]);
  const base = photo ? (face ? faceCrop(face, spec) : centerCrop({ w: photo.width, h: photo.height }, spec)) : null;
  const crop = base ? adjusted(base, adjust) : null;
  const subject = useMemo(() => (photo && removeBg && mask ? cutout(photo, mask) : photo), [photo, removeBg, mask]);
  const bgHex = !removeBg ? '#FFFFFF' : bg === 'custom' ? color : PHOTO_BG_HEX[bg];
  const plan = sheetPlan(spec, paperOf(paperId), copies);

  // the photo preview and the sheet preview, redrawn after every change
  useEffect(() => {
    if (!subject || !crop || !view.current) return;
    const id = requestAnimationFrame(() => {
      const v = view.current;
      if (!v) return;
      draw(v, subject, crop, PREVIEW_W, Math.round((PREVIEW_W * spec.hMm) / spec.wMm), bgHex);
      const sv = sheetView.current;
      if (sv) {
        const s = renderPlan(v, plan, 40);
        sv.width = s.width;
        sv.height = s.height;
        sv.getContext('2d')!.drawImage(s, 0, 0);
      }
    });
    return () => cancelAnimationFrame(id);
  });

  if (error) {
    return (
      <div className="card p-8 text-center flex flex-col items-center gap-3" role="alert">
        <p className="text-[17px] font-semibold">{error}</p>
        <Button variant="secondary" onClick={onReplace}>
          {t('Choose a photo')}
        </Button>
      </div>
    );
  }

  const note = crop && photo ? cropNote(crop, { w: photo.width, h: photo.height }, spec) : 'ok';
  const guide = headGuide(spec);
  const zoomBy = (k: number) => setAdjust((a) => ({ ...a, zoom: Math.min(4, Math.max(0.4, a.zoom * k)) }));
  const ready = !!photo && !!crop && !!faces && !(removeBg && mask === undefined) && plan.boxes.length > 0;
  const fits = plan.fits;
  const sheetText = t('{count} photos on one {sheet} sheet', { count: plan.boxes.length, sheet: t(paperOf(paperId).label) });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
      <section className="card p-5 flex flex-col items-center gap-4">
        <div className="relative w-64 sm:w-72 rounded-md border border-line bg-surface overflow-hidden shadow-raised" style={{ aspectRatio: `${spec.wMm} / ${spec.hMm}` }}>
          {photo ? (
            <canvas
              ref={view}
              className="absolute inset-0 size-full cursor-grab active:cursor-grabbing touch-none"
              aria-label={t('Drag to move the photo')}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY, a: adjust };
              }}
              onPointerMove={(e) => {
                const d = drag.current;
                if (!d) return;
                const r = e.currentTarget.getBoundingClientRect();
                setAdjust({ ...d.a, dx: d.a.dx - (e.clientX - d.x) / r.width, dy: d.a.dy - (e.clientY - d.y) / r.height });
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.06 : 1 / 1.06)}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center" role="status">
              <Loader2 size={24} className="animate-spin text-primary" aria-hidden="true" />
            </div>
          )}
          {/* head guide: the head should fill the oval, chin at its bottom */}
          <span
            aria-hidden="true"
            className="absolute border-2 border-dashed border-white/85 rounded-[50%] pointer-events-none"
            style={{ width: `${guide.w * 100}%`, height: `${guide.h * 100}%`, left: `${guide.left * 100}%`, top: `${guide.top * 100}%`, mixBlendMode: 'difference' }}
          />
          {maskStatus && removeBg && <FindingSparkles label={maskStatus} />}
        </div>

        <div className="flex items-center gap-2 w-full max-w-72">
          <button type="button" onClick={() => zoomBy(1 / 1.15)} aria-label={t('Zoom out')} title={t('Zoom out')} className="size-9 rounded-full grid place-items-center hover:bg-fill">
            <Minus size={18} aria-hidden="true" />
          </button>
          <input type="range" min={0.4} max={4} step={0.01} value={adjust.zoom} onChange={(e) => setAdjust((a) => ({ ...a, zoom: Number(e.target.value) }))} aria-label={t('Zoom')} className="flex-1 accent-[var(--primary)]" />
          <button type="button" onClick={() => zoomBy(1.15)} aria-label={t('Zoom in')} title={t('Zoom in')} className="size-9 rounded-full grid place-items-center hover:bg-fill">
            <Plus size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={() => setAdjust(NO_ADJUST)} aria-label={t('Reset')} title={t('Reset')} className="size-9 rounded-full grid place-items-center hover:bg-fill">
            <RotateCcw size={17} aria-hidden="true" />
          </button>
        </div>
        <p className="text-[13px] text-secondary text-center max-w-sm">
          {!faces ? t('Finding your face…') : face ? t('Drag the photo so the head fills the oval, chin at its bottom. Zoom to fit.') : t('No face found: drag and zoom so the head fills the oval.')}
        </p>
        {faces && faces.length > 1 && <p className="text-[13px] text-warning">{t('More than one face: using the biggest one.')}</p>}
        {note !== 'ok' ? (
          <p className="flex items-center gap-1.5 text-[13px] text-warning text-center" role="status">
            <AlertTriangle size={15} className="shrink-0" aria-hidden="true" />
            {note === 'small' ? t('This photo is small for printing: it may look soft. Use a bigger photo if you can.') : t('Part of the photo is outside the frame: zoom out or move it.')}
          </p>
        ) : (
          face && (
            <p className="flex items-center gap-1.5 text-[13px] text-success">
              <CheckCircle2 size={15} aria-hidden="true" />
              {t('Face fits')}
            </p>
          )
        )}

        <div className="w-full border-t border-line pt-4 flex flex-col items-center gap-2">
          <p className="text-[13px] font-semibold">{t('Print sheet')}</p>
          <canvas ref={sheetView} className="max-w-full max-h-64 w-auto h-auto shadow-raised rounded-sm bg-white" aria-label={sheetText} />
          <p className="text-[13px] text-secondary">{sheetText}</p>
        </div>
      </section>

      <aside className="card p-5 flex flex-col gap-5 lg:sticky lg:top-20">
        <label className="flex flex-col gap-2 text-[13px] font-semibold">
          {t('Document')}
          <select
            value={specId}
            onChange={(e) => {
              setSpecId(e.target.value);
              setAdjust(NO_ADJUST);
              const s = DOC_SPECS.find((x) => x.id === e.target.value);
              if (s) setBg(s.bg);
            }}
            className="min-h-11 rounded-tile bg-surface border border-line-strong px-3 text-[14px] font-normal"
          >
            {DOC_SPECS.map((s) => (
              <option key={s.id} value={s.id}>
                {t(s.country)} · {t(s.label)}
              </option>
            ))}
            <option value="custom">{t('Custom size (mm)')}</option>
          </select>
        </label>
        {specId === 'custom' && (
          <div className="flex items-center gap-2 -mt-2" dir="ltr">
            {(['w', 'h'] as const).map((k, i) => (
              <span key={k} className="contents">
                {i === 1 && <span className="text-secondary">×</span>}
                <input value={custom[k]} inputMode="decimal" onChange={(e) => setCustom((c) => ({ ...c, [k]: e.target.value.replace(/[^\d.]/g, '').slice(0, 5) }))} aria-label={k === 'w' ? t('Width') : t('Height')} className="w-20 min-h-10 rounded-tile bg-surface border border-line-strong px-3 text-[14px] text-center" />
              </span>
            ))}
            <span className="text-[13px] text-secondary">mm</span>
          </div>
        )}
        <p className="text-[12px] text-secondary -mt-3">{t('Rules change: check your country\'s current photo rules before printing.')}</p>

        <Switch label={t('Remove background')} sub={mask === null && removeBg ? t('Couldn\'t separate you from the background, so the photo keeps its own.') : t('Done in your browser')} value={removeBg} onChange={setRemoveBg} />
        {removeBg && (
          <fieldset>
            <legend className="text-[13px] font-semibold mb-2">{t('Background')}</legend>
            <div className="flex flex-wrap gap-2.5" role="radiogroup">
              {BGS.map((b) => {
                const label = { white: t('White'), gray: t('Light gray'), lightblue: t('Light blue'), blue: t('Blue'), red: t('Red'), custom: t('Custom color') }[b];
                return (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={bg === b}
                    aria-label={label}
                    title={label}
                    onClick={() => {
                      setBg(b);
                      if (b === 'custom') colorInput.current?.click();
                    }}
                    className={`size-10 rounded-full border ${bg === b ? 'ring-3 ring-primary ring-offset-2 ring-offset-surface border-transparent' : 'border-line-strong'}`}
                    style={{ background: b === 'custom' ? (bg === 'custom' ? color : 'conic-gradient(#F87171, #FBBF24, #A3E635, #38BDF8, #818CF8, #E879F9, #F87171)') : PHOTO_BG_HEX[b] }}
                  />
                );
              })}
              <input
                ref={colorInput}
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  setBg('custom');
                }}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
          </fieldset>
        )}

        <Choice label={t('Paper')} value={paperId} options={PAPERS.map((p) => [p.id, t(p.label)] as [string, string])} onChange={setPaperId} />
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t('Copies')}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {[0, ...COPIES.filter((n) => n < fits)].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={copies === n} onClick={() => setCopies(n)} className={`px-3.5 min-h-9 rounded-full text-sm font-medium border ${copies === n ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-line-strong hover:bg-fill'}`}>
                {n === 0 ? t('Full sheet ({count})', { count: fits }) : n}
              </button>
            ))}
          </div>
          {fits === 0 && <p className="text-[12px] text-warning mt-2">{t('This size doesn\'t fit on this paper. Pick bigger paper.')}</p>}
        </fieldset>

        <Button arrow disabled={!ready} onClick={() => onStart({ spec, crop: crop!, photo: photo!, mask: removeBg ? mask ?? null : null, bg: bgHex, paper: paperId, copies })} className="w-full">
          {t(tool.verb)}
        </Button>
      </aside>
    </div>
  );
}
