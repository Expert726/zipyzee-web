'use client';
// Crop and rotate (the app's custom/image/CropImageStep): the photo turned and flipped as it will be saved, a crop
// frame you drag (move it, or a corner to resize), Shape (Free, 1:1, 4:5, 16:9, 3:4: a shape keeps its proportions),
// Rotate left / right, Flip. The crop is in fractions of the turned photo (the app's src/tools/scan.ts), so the
// handler crops the full-size photo exactly as shown.
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlipHorizontal2, Loader2, RotateCcw, RotateCw } from 'lucide-react';
import { useT } from '@/i18n/client';
import { decodeImage } from '@/lib/image';
import { drawTurned } from '@/lib/turnImage';
import { capLongest } from '@/tools/image/sizes';
import { clampCrop, FULL_CROP, rotateCropRight, rotateRight, type Crop, type Rotation } from '@/tools/scan';
import { ToolError } from '@/tools/types';
import { Button } from '../../ui/Button';
import type { CustomSetupProps } from './index';

const PREVIEW_SIDE = 1400;
/** The app's Free, 1:1, 4:5, 16:9, 3:4 and, on the web, every common shape; "Original" = the photo's own; Custom = W:H. */
const SHAPES: { label: string; value: string; aspect?: number }[] = [
  { label: 'Free', value: 'free' },
  { label: 'Original', value: 'original' },
  { label: '1:1', value: '1:1', aspect: 1 },
  { label: '4:5', value: '4:5', aspect: 4 / 5 },
  { label: '5:4', value: '5:4', aspect: 5 / 4 },
  { label: '3:4', value: '3:4', aspect: 3 / 4 },
  { label: '4:3', value: '4:3', aspect: 4 / 3 },
  { label: '2:3', value: '2:3', aspect: 2 / 3 },
  { label: '3:2', value: '3:2', aspect: 3 / 2 },
  { label: '9:16', value: '9:16', aspect: 9 / 16 },
  { label: '16:9', value: '16:9', aspect: 16 / 9 },
  { label: '21:9', value: '21:9', aspect: 21 / 9 },
  { label: '1.91:1', value: '1.91:1', aspect: 1.91 },
  { label: 'A4', value: 'a4', aspect: 210 / 297 },
  { label: 'Custom', value: 'custom' },
];

/** The biggest centred crop of `aspect` (width / height in pixels) on a w x h photo; the whole photo when free. */
function aspectCrop(aspect: number | undefined, w: number, h: number): Crop {
  if (!aspect) return FULL_CROP;
  const fw = Math.min(1, (h * aspect) / w);
  const fh = Math.min(1, (w / aspect) / h);
  return { x: (1 - fw) / 2, y: (1 - fh) / 2, w: fw, h: fh };
}

type Drag = { kind: 'move' | 'tl' | 'tr' | 'bl' | 'br'; start: { x: number; y: number }; crop: Crop };

export function CropImageEditor({ tool, files, onStart, onReplace }: CustomSetupProps) {
  const t = useT();
  const file = files[0];
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shape, setShape] = useState('free');
  const [rotation, setRotation] = useState<Rotation>(0);
  const [flip, setFlip] = useState(false);
  const [crop, setCrop] = useState<Crop>(FULL_CROP);
  const drag = useRef<Drag | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const bmp = await decodeImage(file);
        const s = capLongest({ w: bmp.width, h: bmp.height }, PREVIEW_SIDE);
        const c = document.createElement('canvas');
        c.width = s.w;
        c.height = s.h;
        c.getContext('2d')!.drawImage(bmp, 0, 0, s.w, s.h);
        bmp.close();
        if (alive) setPhoto(c);
      } catch (e) {
        if (alive) setError(e instanceof ToolError ? e.message : t('This photo could not be read. Try another one.'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [file, t]);

  const turned = useMemo(() => (photo ? drawTurned(photo, rotation, flip) : null), [photo, rotation, flip]);
  const url = useMemo(() => turned?.toDataURL('image/jpeg', 0.85), [turned]);
  const [ratio, setRatio] = useState({ w: '5', h: '7' });
  const aspectOf = (v: string, r = ratio): number | undefined => {
    if (v === 'original') return turned ? turned.width / turned.height : undefined;
    if (v === 'custom') {
      const w = Number(r.w);
      const h = Number(r.h);
      return w > 0 && h > 0 ? w / h : undefined;
    }
    return SHAPES.find((s) => s.value === v)?.aspect;
  };
  const aspect = aspectOf(shape);

  const pickShape = (v: string) => {
    setShape(v);
    if (turned) setCrop(aspectCrop(aspectOf(v), turned.width, turned.height));
  };
  const pickRatio = (r: { w: string; h: string }) => {
    setRatio(r);
    if (turned) setCrop(aspectCrop(aspectOf('custom', r), turned.width, turned.height));
  };
  const turn = (right: boolean) => {
    setRotation((r) => (right ? rotateRight(r) : rotateRight(rotateRight(rotateRight(r)))));
    // the same part of the photo stays selected
    setCrop((c) => (right ? rotateCropRight(c) : rotateCropRight(rotateCropRight(rotateCropRight(c)))));
  };

  const pt = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !turned) return;
    const p = pt(e);
    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    const c = d.crop;
    if (d.kind === 'move') return setCrop(clampCrop({ ...c, x: c.x + dx, y: c.y + dy }, 0.05));
    let { x, y, w, h } = c;
    const left = d.kind === 'tl' || d.kind === 'bl';
    const top = d.kind === 'tl' || d.kind === 'tr';
    w = Math.max(0.05, left ? c.w - dx : c.w + dx);
    h = Math.max(0.05, top ? c.h - dy : c.h + dy);
    // a shape keeps its proportions (in pixels)
    if (aspect) h = (w * turned.width) / (aspect * turned.height);
    if (left) x = c.x + c.w - w;
    if (top) y = c.y + c.h - h;
    if (x < 0 || y < 0 || x + w > 1.0001 || y + h > 1.0001) return;
    setCrop({ x, y, w, h });
  };

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

  const handle = (kind: Drag['kind'], cls: string) => (
    <span
      key={kind}
      aria-hidden="true"
      className={`absolute size-5 rounded-full bg-white border-2 border-primary shadow ${cls}`}
      style={{ cursor: kind === 'tl' || kind === 'br' ? 'nwse-resize' : 'nesw-resize', touchAction: 'none' }}
      onPointerDown={(e) => {
        e.stopPropagation();
        box.current!.setPointerCapture(e.pointerId);
        drag.current = { kind, start: pt(e), crop };
      }}
    />
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      <section className="card p-3 sm:p-5 grid place-items-center">
        {!url ? (
          <div className="min-h-64 grid place-items-center" aria-busy="true">
            <Loader2 size={28} className="animate-spin text-primary" aria-hidden="true" />
            <span className="sr-only">{t('Opening the photo…')}</span>
          </div>
        ) : (
          <div
            ref={box}
            className="relative select-none touch-none max-w-full"
            onPointerMove={onMove}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the photo as it will be saved */}
            <img src={url} alt="" draggable={false} className="block max-w-full max-h-[70vh]" />
            {/* the part that will be cut away, dimmed: four bands around the frame, only over the photo */}
            {[
              { left: 0, top: 0, width: '100%', height: `${crop.y * 100}%` },
              { left: 0, top: `${(crop.y + crop.h) * 100}%`, width: '100%', height: `${(1 - crop.y - crop.h) * 100}%` },
              { left: 0, top: `${crop.y * 100}%`, width: `${crop.x * 100}%`, height: `${crop.h * 100}%` },
              { left: `${(crop.x + crop.w) * 100}%`, top: `${crop.y * 100}%`, width: `${(1 - crop.x - crop.w) * 100}%`, height: `${crop.h * 100}%` },
            ].map((b, i) => (
              <span key={i} aria-hidden="true" className="absolute bg-black/45 pointer-events-none" style={b} />
            ))}
            <div
              className="absolute border-2 border-white cursor-move"
              style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}
              onPointerDown={(e) => {
                box.current!.setPointerCapture(e.pointerId);
                drag.current = { kind: 'move', start: pt(e), crop };
              }}
              role="img"
              aria-label={t('Crop and rotate')}
            >
              {/* rule of thirds */}
              <span className="absolute inset-y-0 left-1/3 w-px bg-white/60" aria-hidden="true" />
              <span className="absolute inset-y-0 left-2/3 w-px bg-white/60" aria-hidden="true" />
              <span className="absolute inset-x-0 top-1/3 h-px bg-white/60" aria-hidden="true" />
              <span className="absolute inset-x-0 top-2/3 h-px bg-white/60" aria-hidden="true" />
              {handle('tl', '-left-2.5 -top-2.5')}
              {handle('tr', '-right-2.5 -top-2.5')}
              {handle('bl', '-left-2.5 -bottom-2.5')}
              {handle('br', '-right-2.5 -bottom-2.5')}
            </div>
          </div>
        )}
      </section>

      <aside className="card p-5 flex flex-col gap-5">
        <fieldset>
          <legend className="text-[13px] font-semibold mb-2">{t('Shape')}</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {SHAPES.map((s) => (
              <button key={s.value} type="button" role="radio" aria-checked={shape === s.value} disabled={!turned} onClick={() => pickShape(s.value)} className={`px-4 min-h-10 rounded-full text-sm font-medium border ${shape === s.value ? 'bg-ink text-on-ink border-transparent' : 'bg-surface border-line-strong hover:bg-fill'}`}>
                {s.value === 'free' ? t('Free') : s.value === 'original' ? t('Original') : s.value === 'custom' ? t('Custom') : s.label}
              </button>
            ))}
          </div>
          {shape === 'custom' && (
            <div className="flex items-center gap-2 mt-3" dir="ltr">
              {(['w', 'h'] as const).map((k, i) => (
                <span key={k} className="contents">
                  {i === 1 && <span className="text-secondary font-semibold">:</span>}
                  <input
                    value={ratio[k]}
                    inputMode="decimal"
                    onChange={(e) => pickRatio({ ...ratio, [k]: e.target.value.replace(/[^\d.]/g, '').slice(0, 6) })}
                    aria-label={k === 'w' ? t('Width') : t('Height')}
                    className="w-20 min-h-10 rounded-tile bg-surface border border-line-strong px-3 text-[14px] text-center"
                  />
                </span>
              ))}
            </div>
          )}
        </fieldset>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              [t('Rotate left'), RotateCcw, () => turn(false)],
              [t('Rotate right'), RotateCw, () => turn(true)],
              [t('Flip'), FlipHorizontal2, () => { setFlip((f) => !f); setCrop((c) => ({ ...c, x: 1 - c.x - c.w })); }],
            ] as const
          ).map(([label, Icon, run]) => (
            <button key={label} type="button" disabled={!turned} onClick={run} className="min-h-16 rounded-tile border border-line-strong flex flex-col items-center justify-center gap-1 text-[12px] font-medium hover:bg-fill disabled:opacity-40">
              <Icon size={20} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <Button arrow disabled={!turned} onClick={() => onStart({ rotation, flip, crop })} className="w-full">
          {t(tool.verb)}
        </Button>
      </aside>
    </div>
  );
}
